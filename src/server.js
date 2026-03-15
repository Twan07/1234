import express from "express";
import http from "node:http";
import path from "node:path";
import { WebSocketServer } from "ws";
import httpProxy from "http-proxy";
import { config } from "./config.js";
import { ProjectsStore } from "./lib/projects-store.js";
import { ProxyStore } from "./lib/proxy-store.js";
import { ProcessManager } from "./lib/process-manager.js";
import { createShellSession } from "./lib/shell.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createRuntimeRouter } from "./routes/runtime.js";
import { createProxyRouter } from "./routes/proxy.js";

const projectsStore = new ProjectsStore();
const proxyStore = new ProxyStore();
const processManager = new ProcessManager(config.maxLogLines);

await projectsStore.init();
await proxyStore.init();

const app = express();
const server = http.createServer(app);
const wsShell = new WebSocketServer({ noServer: true });
const wsLogs = new WebSocketServer({ noServer: true });
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  xfwd: true,
  secure: false
});

app.use(express.json({ limit: "2mb" }));
app.use("/api/projects", createProjectsRouter({ projectsStore }));
app.use("/api/runtime", createRuntimeRouter({ projectsStore, processManager }));
app.use("/api/proxy-routes", createProxyRouter({ proxyStore }));

app.use("/vendor", express.static(path.join(config.rootDir, "public", "vendor")));
app.use(express.static(path.join(config.rootDir, "public")));

function rewriteProxyPath(requestPath, pathPrefix) {
  if (requestPath === pathPrefix) {
    return "/";
  }

  if (requestPath.startsWith(pathPrefix + "/")) {
    return requestPath.slice(pathPrefix.length) || "/";
  }

  return requestPath;
}

app.use((req, res, next) => {
  const route = proxyStore.match(req.path);
  if (!route) {
    next();
    return;
  }

  const originalUrl = req.url;
  req.url = rewriteProxyPath(req.url, route.pathPrefix);

  proxy.web(req, res, {
    target: route.target,
    ignorePath: false
  }, () => {
    req.url = originalUrl;
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

proxy.on("error", (error, _req, res) => {
  if (!res.headersSent) {
    res.writeHead(502, { "Content-Type": "application/json" });
  }

  res.end(JSON.stringify({
    error: "Proxy error",
    details: error.message
  }));
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/ws/shell") {
    wsShell.handleUpgrade(request, socket, head, (ws) => {
      wsShell.emit("connection", ws, request, url);
    });
    return;
  }

  if (url.pathname === "/ws/logs") {
    wsLogs.handleUpgrade(request, socket, head, (ws) => {
      wsLogs.emit("connection", ws, request, url);
    });
    return;
  }

  const route = proxyStore.match(url.pathname);
  if (route) {
    request.url = rewriteProxyPath(url.pathname + url.search, route.pathPrefix);
    proxy.ws(request, socket, head, { target: route.target });
    return;
  }

  socket.destroy();
});

wsShell.on("connection", (ws, _request, url) => {
  const projectId = url.searchParams.get("projectId");
  const project = projectId ? projectsStore.getById(projectId) : null;

  if (!project) {
    ws.send(JSON.stringify({ type: "error", message: "Project not found" }));
    ws.close();
    return;
  }

  const session = createShellSession(project.root);

  ws.send(JSON.stringify({
    type: "ready",
    shell: session.shell,
    cwd: project.root,
    os: session.os
  }));

  session.process.stdout.on("data", (chunk) => {
    ws.send(JSON.stringify({ type: "stdout", data: String(chunk) }));
  });

  session.process.stderr.on("data", (chunk) => {
    ws.send(JSON.stringify({ type: "stderr", data: String(chunk) }));
  });

  session.process.on("close", (code) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "exit", code }));
      ws.close();
    }
  });

  ws.on("message", (payload) => {
    try {
      const message = JSON.parse(String(payload));
      if (message.type === "input") {
        session.write(String(message.data || ""));
      }
      if (message.type === "resize") {
        // reserved for future node-pty upgrade
      }
    } catch {
      session.write(String(payload));
    }
  });

  ws.on("close", () => {
    session.close();
  });
});

wsLogs.on("connection", (ws, _request, url) => {
  const projectId = url.searchParams.get("projectId");
  const project = projectId ? projectsStore.getById(projectId) : null;

  if (!project) {
    ws.send(JSON.stringify({ type: "error", message: "Project not found" }));
    ws.close();
    return;
  }

  const initialLogs = processManager.getLogs(project.id);
  ws.send(JSON.stringify({ type: "init", logs: initialLogs }));

  const onLog = (payload) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const onStatus = (payload) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  processManager.events.on(`log:${project.id}`, onLog);
  processManager.events.on(`status:${project.id}`, onStatus);

  ws.on("close", () => {
    processManager.events.off(`log:${project.id}`, onLog);
    processManager.events.off(`status:${project.id}`, onStatus);
  });
});

server.listen(config.port, config.host, () => {
  console.log(`Mini Control Panel running on http://${config.host}:${config.port}`);
});
