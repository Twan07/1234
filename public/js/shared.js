export const state = {
  activeProjectId: new URLSearchParams(window.location.search).get("projectId") || localStorage.getItem("panel.activeProjectId") || ""
};

export const pages = [
  ["/panel.html", "Panel"],
  ["/project.html", "Create Project"],
  ["/dashboard.html", "Dashboard"],
  ["/manager.html", "File Manager"],
  ["/shell.html", "Shell"],
  ["/console.html", "Logs & Runner"]
];

export function showToast(message) {
  const node = document.querySelector("#toast");
  if (!node) {
    return;
  }

  node.textContent = message;
  node.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => node.classList.remove("show"), 2200);
}

export async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

export function setActiveProject(projectId) {
  state.activeProjectId = projectId || "";
  localStorage.setItem("panel.activeProjectId", state.activeProjectId);
}

export function getActiveProjectId() {
  return state.activeProjectId || "";
}

export async function loadProjects() {
  const data = await request("/api/projects");
  return data.projects;
}

export function buildSidebar(activePath) {
  const sidebar = document.querySelector("#sidebar");
  if (!sidebar) {
    return;
  }

  const nav = pages.map(([href, label]) => `
    <a class="nav-link ${activePath === href ? "active" : ""}" href="${appendProjectId(href)}">${label}</a>
  `).join("");

  sidebar.innerHTML = `
    <div class="brand">
      <h1>Mini Exocore Panel</h1>
      <p>Panel nhỏ kiểu exocore-web để tạo, sửa, chạy và publish project.</p>
    </div>
    <div class="nav-group">${nav}</div>
    <div class="sidebar-footer">
      <div class="badge">Project hiện tại: <span id="active-project-pill">${getActiveProjectId() || "chưa chọn"}</span></div>
      <a class="btn secondary" href="/project.html">+ Tạo project mới</a>
    </div>
  `;
}

export function appendProjectId(href) {
  const url = new URL(href, window.location.origin);
  if (getActiveProjectId()) {
    url.searchParams.set("projectId", getActiveProjectId());
  }
  return url.pathname + url.search;
}

export async function mountProjectPicker(targetSelector = "#project-picker") {
  const target = document.querySelector(targetSelector);
  if (!target) {
    return;
  }

  const projects = await loadProjects();
  const current = getActiveProjectId();

  target.innerHTML = `
    <label>Project hiện tại</label>
    <select id="global-project-select">
      <option value="">-- Chọn project --</option>
      ${projects.map((project) => `
        <option value="${project.id}" ${project.id === current ? "selected" : ""}>${project.name}</option>
      `).join("")}
    </select>
  `;

  const select = target.querySelector("#global-project-select");
  select?.addEventListener("change", (event) => {
    setActiveProject(event.currentTarget.value);
    window.location.search = getActiveProjectId() ? `?projectId=${encodeURIComponent(getActiveProjectId())}` : "";
  });
}

export function requireProject() {
  const projectId = getActiveProjectId();
  if (!projectId) {
    showToast("Hãy chọn project trước");
    return null;
  }
  return projectId;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatUptime(seconds) {
  const total = Math.floor(seconds || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}
