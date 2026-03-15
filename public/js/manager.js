import {
  buildSidebar,
  getActiveProjectId,
  mountProjectPicker,
  request,
  requireProject,
  showToast
} from "./shared.js";

buildSidebar(window.location.pathname);
await mountProjectPicker();

const fileTree = document.querySelector("#file-tree");
const currentFolderLabel = document.querySelector("#current-folder-label");
const editor = document.querySelector("#editor");
const editorFileLabel = document.querySelector("#editor-file-label");

const state = {
  currentFolder: "",
  currentFile: ""
};

function basename(filePath) {
  return String(filePath || "").split("/").filter(Boolean).pop() || "";
}

async function loadFiles(relativePath = "") {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  const data = await request(`/api/projects/${projectId}/tree?path=${encodeURIComponent(relativePath)}`);
  state.currentFolder = data.currentPath || "";
  currentFolderLabel.textContent = "/" + (state.currentFolder || "");

  if (data.items.length === 0) {
    fileTree.innerHTML = `<div class="empty">Thư mục trống</div>`;
    return;
  }

  fileTree.innerHTML = data.items.map((item) => `
    <button class="file-entry ${item.type}" data-path="${item.path}" data-type="${item.type}">${item.name}</button>
  `).join("");

  for (const button of fileTree.querySelectorAll("[data-path]")) {
    button.addEventListener("click", async () => {
      if (button.dataset.type === "directory") {
        await loadFiles(button.dataset.path);
        return;
      }

      await openFile(button.dataset.path);
    });
  }
}

async function openFile(filePath) {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  const data = await request(`/api/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`);
  state.currentFile = data.path;
  editorFileLabel.textContent = data.path;
  editor.value = data.content;
}

document.querySelector("#save-file-btn").addEventListener("click", async () => {
  const projectId = requireProject();
  if (!projectId || !state.currentFile) {
    showToast("Chưa chọn file");
    return;
  }

  await request(`/api/projects/${projectId}/file`, {
    method: "PUT",
    body: JSON.stringify({ path: state.currentFile, content: editor.value })
  });

  showToast(`Đã lưu ${state.currentFile}`);
});

document.querySelector("#back-folder-btn").addEventListener("click", async () => {
  const parts = state.currentFolder.split("/").filter(Boolean);
  parts.pop();
  await loadFiles(parts.join("/"));
});

document.querySelector("#refresh-files-btn").addEventListener("click", async () => {
  await loadFiles(state.currentFolder);
});

document.querySelector("#new-file-btn").addEventListener("click", async () => {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  const name = window.prompt("Tên file mới", state.currentFolder ? `${state.currentFolder}/new.txt` : "new.txt");
  if (!name) {
    return;
  }

  await request(`/api/projects/${projectId}/fs/create`, {
    method: "POST",
    body: JSON.stringify({ path: name, type: "file" })
  });

  showToast("Đã tạo file");
  await loadFiles(state.currentFolder);
});

document.querySelector("#new-folder-btn").addEventListener("click", async () => {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  const name = window.prompt("Tên folder mới", state.currentFolder ? `${state.currentFolder}/new-folder` : "new-folder");
  if (!name) {
    return;
  }

  await request(`/api/projects/${projectId}/fs/create`, {
    method: "POST",
    body: JSON.stringify({ path: name, type: "directory" })
  });

  showToast("Đã tạo folder");
  await loadFiles(state.currentFolder);
});

document.querySelector("#rename-item-btn").addEventListener("click", async () => {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  const originalPath = state.currentFile || state.currentFolder;
  if (!originalPath) {
    showToast("Chưa chọn file hoặc thư mục");
    return;
  }

  const newName = window.prompt("Đổi tên thành", basename(originalPath));
  if (!newName) {
    return;
  }

  const baseDir = originalPath.includes("/") ? originalPath.split("/").slice(0, -1).join("/") : "";
  const newPath = [baseDir, newName].filter(Boolean).join("/");

  await request(`/api/projects/${projectId}/fs/rename`, {
    method: "POST",
    body: JSON.stringify({ oldPath: originalPath, newPath })
  });

  state.currentFile = newPath;
  editorFileLabel.textContent = newPath;
  showToast("Đã đổi tên");
  await loadFiles(state.currentFolder);
});

document.querySelector("#delete-item-btn").addEventListener("click", async () => {
  const projectId = requireProject();
  if (!projectId) {
    return;
  }

  const targetPath = state.currentFile || state.currentFolder;
  if (!targetPath) {
    showToast("Chưa chọn gì để xóa");
    return;
  }

  if (!window.confirm(`Xóa ${targetPath}?`)) {
    return;
  }

  await request(`/api/projects/${projectId}/fs/item?path=${encodeURIComponent(targetPath)}`, {
    method: "DELETE"
  });

  if (state.currentFile === targetPath) {
    state.currentFile = "";
    editor.value = "";
    editorFileLabel.textContent = "Editor";
  }

  showToast("Đã xóa");
  await loadFiles(state.currentFolder);
});

await loadFiles("");
