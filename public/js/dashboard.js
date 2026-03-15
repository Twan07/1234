import {
  appendProjectId,
  buildSidebar,
  formatUptime,
  getActiveProjectId,
  loadProjects,
  mountProjectPicker,
  request,
  setActiveProject,
  showToast
} from "./shared.js";

buildSidebar(window.location.pathname);
await mountProjectPicker();

const projectsList = document.querySelector("#projects-list");
const runtimeBadge = document.querySelector("#runtime-badge");
const replaceZipInput = document.querySelector("#replace-zip-input");

function renderProjects(projects) {
  const activeProjectId = getActiveProjectId();

  if (projects.length === 0) {
    projectsList.innerHTML = `<div class="empty">Chưa có project</div>`;
    return;
  }

  projectsList.innerHTML = projects
    .map(
      (project) => `
        <button class="list-item ${project.id === activeProjectId ? "active" : ""}" data-project-id="${project.id}">
          <div>
            <strong>${project.name}</strong>
            <div class="muted">${project.sourceType}: ${project.source}</div>
          </div>
          <span class="badge">Open</span>
        </button>
      `
    )
    .join("");

  for (const button of projectsList.querySelectorAll("[data-project-id]")) {
    button.addEventListener("click", () => {
      setActiveProject(button.dataset.projectId);
      window.location.search = `?projectId=${encodeURIComponent(button.dataset.projectId)}`;
    });
  }
}

async function renderSystem() {
  const data = await request("/api/system");
  document.querySelector("#hostname").textContent = data.hostname;
  document.querySelector("#node-version").textContent = data.nodeVersion;
  document.querySelector("#uptime").textContent = formatUptime(data.uptimeSeconds);
}

async function renderProjectDetails() {
  const projectId = getActiveProjectId();
  if (!projectId) {
    document.querySelector("#detail-name").textContent = "Chưa chọn";
    document.querySelector("#detail-root").textContent = "—";
    document.querySelector("#detail-source").textContent = "—";
    document.querySelector("#detail-runtime").textContent = "—";
    runtimeBadge.textContent = "idle";
    runtimeBadge.className = "badge idle";
    return;
  }

  const data = await request(`/api/projects/${projectId}`);
  document.querySelector("#detail-name").textContent = data.project.name;
  document.querySelector("#detail-root").textContent = data.project.root;
  document.querySelector("#detail-source").textContent = `${data.project.sourceType}: ${data.project.source}`;
  document.querySelector("#detail-runtime").textContent = data.runtime.command || "idle";
  runtimeBadge.textContent = data.runtime.status;
  runtimeBadge.className = `badge ${data.runtime.status}`;

  document.querySelector("#go-manager").href = appendProjectId("/manager.html");
  document.querySelector("#go-console").href = appendProjectId("/console.html");
  document.querySelector("#go-shell").href = appendProjectId("/shell.html");
}

async function renderProxyRoutes() {
  const data = await request("/api/proxy-routes");
  const list = document.querySelector("#proxy-list");
  if (data.routes.length === 0) {
    list.innerHTML = `<div class="empty">Chưa có proxy route</div>`;
    return;
  }

  list.innerHTML = data.routes
    .map(
      (route) => `
        <div class="list-item">
          <div>
            <strong>${route.pathPrefix}</strong>
            <div class="muted">${route.target}</div>
          </div>
          <button class="btn danger" data-route-id="${route.id}">Xóa</button>
        </div>
      `
    )
    .join("");

  for (const button of list.querySelectorAll("[data-route-id]")) {
    button.addEventListener("click", async () => {
      await request(`/api/proxy-routes/${button.dataset.routeId}`, { method: "DELETE" });
      showToast("Đã xóa proxy route");
      await renderProxyRoutes();
    });
  }
}

document.querySelector("#create-proxy-btn").addEventListener("click", async () => {
  try {
    await request("/api/proxy-routes", {
      method: "POST",
      body: JSON.stringify({
        pathPrefix: document.querySelector("#proxy-prefix").value.trim(),
        target: document.querySelector("#proxy-target").value.trim(),
        projectId: getActiveProjectId() || null
      })
    });

    showToast("Đã tạo proxy route");
    document.querySelector("#proxy-prefix").value = "";
    document.querySelector("#proxy-target").value = "";
    await renderProxyRoutes();
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#export-zip-btn").addEventListener("click", () => {
  const projectId = getActiveProjectId();
  if (!projectId) {
    showToast("Hãy chọn project trước");
    return;
  }

  window.location.href = `/api/projects/${encodeURIComponent(projectId)}/export-zip`;
});

replaceZipInput.addEventListener("change", async () => {
  const projectId = getActiveProjectId();
  const file = replaceZipInput.files?.[0];

  if (!projectId) {
    showToast("Hãy chọn project trước");
    replaceZipInput.value = "";
    return;
  }

  if (!file) {
    return;
  }

  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/import-zip?replace=1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/zip"
      },
      body: await file.arrayBuffer()
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    showToast("Đã thay project bằng file zip");
    await renderProjectDetails();
  } catch (error) {
    showToast(error.message);
  } finally {
    replaceZipInput.value = "";
  }
});

const projects = await loadProjects();
renderProjects(projects);
await renderSystem();
await renderProjectDetails();
await renderProxyRoutes();
