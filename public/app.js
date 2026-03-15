const state = {
  projects: [],
  activeProject: null,
  currentFolder: "",
  currentFile: "",
  shellSocket: null,
  logsSocket: null
};

const elements = {
  projectName: document.querySelector("#project-name"),
  sourceType: document.querySelector("#source-type"),
  templateFields: document.querySelector("#template-fields"),
  gitFields: document.querySelector("#git-fields"),
  templateName: document.querySelector("#template-name"),
  gitUrl: document.querySelector("#git-url"),
  gitBranch: document.querySelector("#git-branch"),
  createProjectBtn: document.querySelector("#create-project-btn"),
  refreshProjectsBtn: document.querySelector("#refresh-projects-btn"),
  projectsList: document.querySelector("#projects-list"),
  activeProjectName: document.querySelector("#active-project-name"),
  activeProjectRoot: document.querySelector("#active-project-root"),
  currentFolderLabel: document.querySelector("#current-folder-label"),
  fileTree: document.querySelector("#file-tree"),
  backFolderBtn: document.querySelector("#back-folder-btn"),
  refreshFilesBtn: document.querySelector("#refresh-files-btn"),
  editorFileLabel: document.querySelector("#editor-file-label"),
  editor: document.querySelector("#editor"),
  saveFileBtn: document.querySelector("#save-file-btn"),
  runCommand: document.querySelector("#run-command"),
  runBtn: document.querySelector("#run-btn"),
  stopBtn: document.querySelector("#stop-btn"),
  logsOutput: document.querySelector("#logs-output"),
  clearLogsBtn: document.querySelector("#clear-logs-btn"),
  shellOutput: document.querySelector("#shell-output"),
  shellInput: document.querySelector("#shell-input"),
  sendShellBtn: document.querySelector("#send-shell-btn"),
  reconnectShellBtn: document.querySelector("#reconnect-shell-btn"),
  proxyPrefix: document.querySelector("#proxy-prefix"),
  proxyTarget: document.querySelector("#proxy-target"),
  createProxyBtn: document.querySelector("#create-proxy-btn"),
  proxyList: document.querySelector("#proxy-list"),
  toast: document.querySelector("#toast")
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

function renderProjects() {
  elements.projectsList.innerHTML = "";

  if (state.projects.length === 0) {
    elements.projectsList.innerHTML = `<div class="muted">Chưa có project</div>`;
    return;
  }

  for (const project of state.projects) {
    const item = document.createElement("div");
    item.className = `list-item ${state.activeProject?.id === project.id ? "active" : ""}`;
    item.innerHTML = `
      <div>
        <strong>${project.name}</strong>
        <div class="muted">${project.sourceType}: ${project.source}</div>
      </div>
      <button>Open</button>
    `;

    item.querySelector("button").addEventListener("click", () => {
      selectProject(project.id);
    });

    elements.projectsList.appendChild(item);
  }
}

async function loadProjects() {
  const data = await request("/api/projects");
  state.projects = data.projects;
  renderProjects();
  if (!state.activeProject && state.projects.length > 0) {
    await selectProject(state.projects[0].id);
  }
}

async function createProject() {
  const sourceType = elements.sourceType.value;
  const payload = {
    name: elements.projectName.value.trim(),
    sourceType
  };

  if (sourceType === "git") {
    payload.gitUrl = elements.gitUrl.value.trim();
    payload.branch = elements.gitBranch.value.trim();
  } else {
    payload.templateName = elements.templateName.value;
  }

  const data = await request("/api/projects/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  showToast(`Đã tạo project ${data.project.name}`);
  elements.projectName.value = "";
  elements.gitUrl.value = "";
  elements.gitBranch.value = "";
  await loadProjects();
  await selectProject(data.project.id);
}

function renderProjectHeader() {
  if (!state.activeProject) {
    elements.activeProjectName.textContent = "Chưa chọn project";
    elements.activeProjectRoot.textContent = "—";
    return;
  }

  elements.activeProjectName.textContent = state.activeProject.name;
  elements.activeProjectRoot.textContent = state.activeProject.root;
}

async function selectProject(projectId) {
  state.activeProject = state.projects.find((item) => item.id === projectId) || null;
  state.currentFolder = "";
  state.currentFile = "";
  elements.editor.value = "";
  elements.editorFileLabel.textContent = "Editor";
  renderProjects();
  renderProjectHeader();
  await loadFiles("");
  connectShell();
  connectLogs();
}

async function loadFiles(relativePath = "") {
  if (!state.activeProject) {
    return;
  }

  const data = await request(`/api/projects/${state.activeProject.id}/tree?path=${encodeURIComponent(relativePath)}`);
  state.currentFolder = data.currentPath || "";
  elements.currentFolderLabel.textContent = "/" + (state.currentFolder || "");

  elements.fileTree.innerHTML = "";

  if (data.items.length === 0) {
    elements.fileTree.innerHTML = `<div class="muted">Thư mục trống</div>`;
    return;
  }

  for (const item of data.items) {
    const button = document.createElement("button");
    button.className = `file-entry ${item.type}`;
    button.textContent = item.name;

    button.addEventListener("click", async () => {
      if (item.type === "directory") {
        await loadFiles(item.path);
        return;
      }

      await openFile(item.path);
    });

    elements.fileTree.appendChild(button);
  }
}

async function openFile(filePath) {
  if (!state.activeProject) {
    return;
  }

  const data = await request(`/api/projects/${state.activeProject.id}/file?path=${encodeURIComponent(filePath)}`);
  state.currentFile = data.path;
  elements.editorFileLabel.textContent = data.path;
  elements.editor.value = data.content;
}

async function saveFile() {
  if (!state.activeProject || !state.currentFile) {
    showToast("Chưa chọn file");
    return;
  }

  await request(`/api/projects/${state.activeProject.id}/file`, {
    method: "PUT",
    body: JSON.stringify({
      path: state.currentFile,
      content: elements.editor.value
    })
  });

  showToast(`Đã lưu ${state.currentFile}`);
}

function appendConsole(target, text) {
  target.textContent += text;
  target.scrollTop = target.scrollHeight;
}

function resetConsole(target) {
  target.textContent = "";
}

function connectShell() {
  if (!state.activeProject) {
    return;
  }

  if (state.shellSocket) {
    state.shellSocket.close();
  }

  resetConsole(elements.shellOutput);

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws/shell?projectId=${state.activeProject.id}`);
  state.shellSocket = socket;

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "ready") {
      appendConsole(elements.shellOutput, `[shell] ${payload.shell} @ ${payload.cwd}\n`);
    }
    if (payload.type === "stdout" || payload.type === "stderr") {
      appendConsole(elements.shellOutput, payload.data);
    }
    if (payload.type === "error") {
      appendConsole(elements.shellOutput, `[error] ${payload.message}\n`);
    }
    if (payload.type === "exit") {
      appendConsole(elements.shellOutput, `\n[shell exited] code=${payload.code}\n`);
    }
  });

  socket.addEventListener("close", () => {
    appendConsole(elements.shellOutput, `\n[shell disconnected]\n`);
  });
}

function sendShellInput() {
  const value = elements.shellInput.value;
  if (!value || !state.shellSocket || state.shellSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  appendConsole(elements.shellOutput, `$ ${value}\n`);
  state.shellSocket.send(JSON.stringify({
    type: "input",
    data: value + "\n"
  }));
  elements.shellInput.value = "";
}

function connectLogs() {
  if (!state.activeProject) {
    return;
  }

  if (state.logsSocket) {
    state.logsSocket.close();
  }

  resetConsole(elements.logsOutput);

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws/logs?projectId=${state.activeProject.id}`);
  state.logsSocket = socket;

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "init") {
      const text = payload.logs.map((entry) => `[${entry.stream}] ${entry.line}`).join("\n");
      appendConsole(elements.logsOutput, text + (text ? "\n" : ""));
      return;
    }

    if (payload.type === "log") {
      appendConsole(elements.logsOutput, payload.data);
      return;
    }

    if (payload.type === "status") {
      appendConsole(elements.logsOutput, `\n[status] ${payload.status}\n`);
    }
  });
}

async function runProject() {
  if (!state.activeProject) {
    showToast("Chưa chọn project");
    return;
  }

  const command = elements.runCommand.value.trim();
  if (!command) {
    showToast("Nhập lệnh chạy app");
    return;
  }

  await request(`/api/runtime/${state.activeProject.id}/run`, {
    method: "POST",
    body: JSON.stringify({ command })
  });

  showToast("Đã chạy app");
}

async function stopProject() {
  if (!state.activeProject) {
    return;
  }

  await request(`/api/runtime/${state.activeProject.id}/stop`, {
    method: "POST"
  });

  showToast("Đã gửi lệnh dừng");
}

async function loadProxyRoutes() {
  const data = await request("/api/proxy-routes");
  elements.proxyList.innerHTML = "";

  if (data.routes.length === 0) {
    elements.proxyList.innerHTML = `<div class="muted">Chưa có route</div>`;
    return;
  }

  for (const route of data.routes) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${route.pathPrefix}</strong>
        <div class="muted">${route.target}</div>
      </div>
      <button>Xóa</button>
    `;

    item.querySelector("button").addEventListener("click", async () => {
      await request(`/api/proxy-routes/${route.id}`, { method: "DELETE" });
      showToast(`Đã xóa ${route.pathPrefix}`);
      await loadProxyRoutes();
    });

    elements.proxyList.appendChild(item);
  }
}

async function createProxyRoute() {
  await request("/api/proxy-routes", {
    method: "POST",
    body: JSON.stringify({
      pathPrefix: elements.proxyPrefix.value.trim(),
      target: elements.proxyTarget.value.trim(),
      projectId: state.activeProject?.id || null
    })
  });

  elements.proxyPrefix.value = "";
  elements.proxyTarget.value = "";
  showToast("Đã tạo proxy route");
  await loadProxyRoutes();
}

function getParentPath(inputPath) {
  const clean = String(inputPath || "").replace(/^\/+|\/+$/g, "");
  if (!clean) {
    return "";
  }

  const parts = clean.split("/");
  parts.pop();
  return parts.join("/");
}

function bindEvents() {
  elements.sourceType.addEventListener("change", () => {
    const isGit = elements.sourceType.value === "git";
    elements.gitFields.classList.toggle("hidden", !isGit);
    elements.templateFields.classList.toggle("hidden", isGit);
  });

  elements.createProjectBtn.addEventListener("click", async () => {
    try {
      await createProject();
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.refreshProjectsBtn.addEventListener("click", async () => {
    try {
      await loadProjects();
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.refreshFilesBtn.addEventListener("click", async () => {
    try {
      await loadFiles(state.currentFolder);
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.backFolderBtn.addEventListener("click", async () => {
    try {
      await loadFiles(getParentPath(state.currentFolder));
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.saveFileBtn.addEventListener("click", async () => {
    try {
      await saveFile();
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.runBtn.addEventListener("click", async () => {
    try {
      await runProject();
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.stopBtn.addEventListener("click", async () => {
    try {
      await stopProject();
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.clearLogsBtn.addEventListener("click", () => {
    resetConsole(elements.logsOutput);
  });

  elements.sendShellBtn.addEventListener("click", () => {
    sendShellInput();
  });

  elements.shellInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendShellInput();
    }
  });

  elements.reconnectShellBtn.addEventListener("click", () => {
    connectShell();
  });

  elements.createProxyBtn.addEventListener("click", async () => {
    try {
      await createProxyRoute();
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function boot() {
  bindEvents();

  try {
    await loadProjects();
    await loadProxyRoutes();
  } catch (error) {
    showToast(error.message);
  }
}

boot();
