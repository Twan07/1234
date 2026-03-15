import { buildSidebar, loadProjects } from "./shared.js";

buildSidebar(window.location.pathname);

const countNode = document.querySelector("#project-count");
const listNode = document.querySelector("#recent-projects");

const projects = await loadProjects();
countNode.textContent = String(projects.length);

if (projects.length === 0) {
  listNode.innerHTML = `<div class="empty">Chưa có project nào. Tạo project đầu tiên ở màn Create Project.</div>`;
} else {
  listNode.innerHTML = projects.slice(0, 8).map((project) => `
    <a class="list-item" href="/dashboard.html?projectId=${encodeURIComponent(project.id)}">
      <div>
        <strong>${project.name}</strong>
        <div class="muted">${project.sourceType}: ${project.source}</div>
      </div>
      <span class="badge">Open</span>
    </a>
  `).join("");
}
