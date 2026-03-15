import { buildSidebar, request, setActiveProject, showToast } from "./shared.js";

buildSidebar(window.location.pathname);

const sourceType = document.querySelector("#source-type");
const templateBox = document.querySelector("#template-box");
const gitBox = document.querySelector("#git-box");
const zipBox = document.querySelector("#zip-box");
const templateName = document.querySelector("#template-name");
const templateList = document.querySelector("#template-list");
const zipFile = document.querySelector("#zip-file");

function syncSourceMode() {
  const mode = sourceType.value;
  templateBox.hidden = mode !== "template";
  gitBox.hidden = mode !== "git";
  zipBox.hidden = mode !== "zip";
}

sourceType.addEventListener("change", syncSourceMode);
syncSourceMode();

const templatesRes = await request("/api/projects/templates");
templateName.innerHTML = templatesRes.templates
  .map((template) => `
    <option value="${template.id}">${template.name}</option>
  `)
  .join("");

templateList.innerHTML = templatesRes.templates
  .map(
    (template) => `
      <div class="list-item">
        <div>
          <strong>${template.name}</strong>
          <div class="muted">${template.description}</div>
        </div>
        <span class="badge">${template.id}</span>
      </div>
    `
  )
  .join("");

async function createFromZip(name) {
  const file = zipFile.files?.[0];
  if (!file) {
    throw new Error("Hãy chọn file zip trước");
  }

  const response = await fetch(`/api/projects/create-from-zip?name=${encodeURIComponent(name)}`, {
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

  return data;
}

document.querySelector("#create-project-btn").addEventListener("click", async () => {
  try {
    const name = document.querySelector("#project-name").value.trim();
    let data;

    if (sourceType.value === "zip") {
      data = await createFromZip(name);
    } else {
      const payload = {
        name,
        sourceType: sourceType.value,
        templateName: templateName.value,
        gitUrl: document.querySelector("#git-url").value.trim(),
        branch: document.querySelector("#git-branch").value.trim()
      };

      data = await request("/api/projects/create", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    setActiveProject(data.project.id);
    showToast(`Đã tạo ${data.project.name}`);
    window.setTimeout(() => {
      window.location.href = `/dashboard.html?projectId=${encodeURIComponent(data.project.id)}`;
    }, 400);
  } catch (error) {
    showToast(error.message);
  }
});
