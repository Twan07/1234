import { buildSidebar, getActiveProjectId, mountProjectPicker, requireProject, showToast } from "./shared.js";

buildSidebar(window.location.pathname);
await mountProjectPicker();

const output = document.querySelector("#shell-output");
const input = document.querySelector("#shell-input");
let socket = null;

function append(text) {
  output.textContent += text;
  output.scrollTop = output.scrollHeight;
}

function connect() {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  if (socket) {
    socket.close();
  }

  output.textContent = "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/ws/shell?projectId=${encodeURIComponent(getActiveProjectId())}`);

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "ready") {
      append(`[ready] ${payload.shell} @ ${payload.cwd}\n`);
    }
    if (payload.type === "stdout" || payload.type === "stderr") {
      append(payload.data);
    }
    if (payload.type === "error") {
      append(`[error] ${payload.message}\n`);
    }
    if (payload.type === "exit") {
      append(`\n[exit] code=${payload.code}\n`);
    }
  });

  socket.addEventListener("close", () => append("\n[socket closed]\n"));
}

document.querySelector("#send-shell-btn").addEventListener("click", () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showToast("Shell chưa kết nối");
    return;
  }

  const value = input.value;
  if (!value.trim()) {
    return;
  }

  socket.send(JSON.stringify({ type: "input", data: value + "\n" }));
  input.value = "";
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.querySelector("#send-shell-btn").click();
  }
});

document.querySelector("#reconnect-shell-btn").addEventListener("click", connect);
connect();
