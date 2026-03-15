import { buildSidebar, getActiveProjectId, mountProjectPicker, request, requireProject, showToast } from "./shared.js";

buildSidebar(window.location.pathname);
await mountProjectPicker();

const logsOutput = document.querySelector("#logs-output");
const runStatus = document.querySelector("#run-status");
const runDetail = document.querySelector("#run-detail");
const runCommand = document.querySelector("#run-command");
let socket = null;

function append(text) {
  logsOutput.textContent += text;
  logsOutput.scrollTop = logsOutput.scrollHeight;
}

function setStatus(status, detail = "") {
  runStatus.textContent = status;
  runStatus.className = `badge ${status}`;
  runDetail.textContent = detail || "—";
}

async function refreshStatus() {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  const data = await request(`/api/runtime/${projectId}/logs`);
  setStatus(data.status, data.command || data.cwd);
  logsOutput.textContent = data.logs.map((entry) => `[${entry.stream}] ${entry.line}`).join("\n");
}

function connectLogs() {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  if (socket) {
    socket.close();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/ws/logs?projectId=${encodeURIComponent(getActiveProjectId())}`);

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "init") {
      logsOutput.textContent = payload.logs.map((entry) => `[${entry.stream}] ${entry.line}`).join("\n");
      return;
    }

    if (payload.type === "log") {
      append(payload.data);
      return;
    }

    if (payload.type === "status") {
      setStatus(payload.status, payload.command || `${payload.exitCode ?? ""}`.trim());
    }
  });
}

document.querySelector("#run-btn").addEventListener("click", async () => {
  try {
    const projectId = requireProject();
    if (!projectId) {
      return;
    }

    const data = await request(`/api/runtime/${projectId}/run`, {
      method: "POST",
      body: JSON.stringify({ command: runCommand.value.trim() })
    });

    setStatus(data.status, data.command);
    showToast("Đã chạy app");
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#stop-btn").addEventListener("click", async () => {
  try {
    const projectId = requireProject();
    if (!projectId) {
      return;
    }

    await request(`/api/runtime/${projectId}/stop`, { method: "POST" });
    showToast("Đã gửi tín hiệu stop");
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#clear-logs-btn").addEventListener("click", () => {
  logsOutput.textContent = "";
});

await refreshStatus();
connectLogs();
