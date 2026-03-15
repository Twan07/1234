import { buildSidebar, getActiveProjectId, mountProjectPicker, requireProject, showToast } from "./shared.js";
import { Terminal } from "https://esm.sh/@xterm/xterm@5.5.0";
import { FitAddon } from "https://esm.sh/@xterm/addon-fit@0.10.0";
import { WebLinksAddon } from "https://esm.sh/@xterm/addon-web-links@0.11.0";

buildSidebar(window.location.pathname);
await mountProjectPicker();

const statusNode = document.querySelector("#terminal-status");
const container = document.querySelector("#terminal");

const term = new Terminal({
  cursorBlink: true,
  convertEol: true,
  scrollback: 5000,
  fontFamily: '"Cascadia Code", "JetBrains Mono", monospace',
  fontSize: 14,
  theme: {
    background: "#050914"
  }
});
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon());
term.open(container);
fitAddon.fit();

let socket = null;

function setStatus(value) {
  statusNode.textContent = value;
}

function sendResize() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "resize",
      cols: term.cols,
      rows: term.rows
    })
  );
}

function connect() {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  if (socket) {
    socket.close();
  }

  term.clear();
  setStatus("connecting");
  fitAddon.fit();

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${protocol}//${window.location.host}/ws/shell`);
  url.searchParams.set("projectId", getActiveProjectId());
  url.searchParams.set("cols", String(term.cols || 120));
  url.searchParams.set("rows", String(term.rows || 32));

  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    setStatus("connected");
    sendResize();
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "ready") {
      term.writeln(`[ready] ${payload.shell} @ ${payload.cwd}`);
      return;
    }

    if (payload.type === "data") {
      term.write(payload.data);
      return;
    }

    if (payload.type === "error") {
      term.writeln(`\r\n[error] ${payload.message}`);
      setStatus("error");
      return;
    }

    if (payload.type === "exit") {
      term.writeln(`\r\n[exit] code=${payload.code}`);
      setStatus("closed");
    }
  });

  socket.addEventListener("close", () => {
    setStatus("disconnected");
  });
}

term.onData((data) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({ type: "input", data }));
});

window.addEventListener("resize", () => {
  fitAddon.fit();
  sendResize();
});

document.querySelector("#reconnect-shell-btn").addEventListener("click", connect);

if (!getActiveProjectId()) {
  showToast("Hãy chọn project trước");
}

connect();
