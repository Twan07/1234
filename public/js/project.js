import { buildSidebar, request, setActiveProject, showToast } from "./shared.js";

buildSidebar(window.location.pathname);

const sourceType = document.querySelector("#source-type");
const templateBox = document.querySelector("#template-box");
const gitBox = document.querySelector("#git-box");
const templateName = document.querySelector("#template-name");
const templateList = document.querySelector("#template-list");

function syncSourceMode() {
  const isGit = sourceType.value === "git";
  templateBox.hidden = isGit;
  gitBox.hidden = !isGit;
}

sourceType.addEventListener("change", syncSourceMode);
syncSourceMode();

const templatesRes = await request("/api/projects/templates");
templateName.innerHTML = templatesRes.templates.map((template) => `
  <option value="${template.id}">${template.name}</option>
`).join("");

templateList.innerHTML = templatesRes.templates.map((template) => `
  <div class="list-item">
    <div>
      <strong>${template.name}</strong>
      <div class="muted">${template.description}</div>
    </div>
    <span class="badge">${template.id}</span>
  </div>
`).join("");

document.querySelector("#create-project-btn").addEventListener("click", async () => {
  try {
    const payload = {
      name: document.querySelector("#project-name").value.trim(),
      sourceType: sourceType.value,
      templateName: templateName.value,
      gitUrl: document.querySelector("#git-url").value.trim(),
      branch: document.querySelector("#git-branch").value.trim()
    };

    const data = await request("/api/projects/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setActiveProject(data.project.id);
    showToast(`Đã tạo ${data.project.name}`);
    window.setTimeout(() => {
      window.location.href = `/dashboard.html?projectId=${encodeURIComponent(data.project.id)}`;
    }, 400);
  } catch (error) {
    showToast(error.message);
  }
});
