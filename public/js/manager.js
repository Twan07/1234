import {
  buildSidebar,
  mountProjectPicker,
  request,
  requireProject,
  showToast
} from "./shared.js";
import { basicSetup, EditorView } from "https://esm.sh/codemirror@6.0.1";
import { Compartment, EditorState } from "https://esm.sh/@codemirror/state@6.4.1";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark@6.1.2";
import { javascript } from "https://esm.sh/@codemirror/lang-javascript@6.2.2";
import { json } from "https://esm.sh/@codemirror/lang-json@6.0.1";
import { html } from "https://esm.sh/@codemirror/lang-html@6.4.9";
import { css } from "https://esm.sh/@codemirror/lang-css@6.2.1";
import { markdown } from "https://esm.sh/@codemirror/lang-markdown@6.2.5";
import { python } from "https://esm.sh/@codemirror/lang-python@6.1.4";
import { php } from "https://esm.sh/@codemirror/lang-php@6.0.1";
import { sql } from "https://esm.sh/@codemirror/lang-sql@6.6.0";
import { xml } from "https://esm.sh/@codemirror/lang-xml@6.1.0";
import { yaml } from "https://esm.sh/@codemirror/lang-yaml@6.1.1";

buildSidebar(window.location.pathname);
await mountProjectPicker();

const fileTree = document.querySelector("#file-tree");
const currentFolderLabel = document.querySelector("#current-folder-label");
const editorFileLabel = document.querySelector("#editor-file-label");
const editorFilePath = document.querySelector("#editor-file-path");
const editorLang = document.querySelector("#editor-lang");
const editorDirty = document.querySelector("#editor-dirty");
const importZipInput = document.querySelector("#import-zip-input");

const languageCompartment = new Compartment();
let skipDirtyEvent = false;
let view = null;

const state = {
  currentFolder: "",
  currentFile: "",
  originalContent: ""
};

function basename(filePath) {
  return String(filePath || "")
    .split("/")
    .filter(Boolean)
    .pop() || "";
}

function getLanguageExtension(filePath) {
  const extension = basename(filePath).split(".").pop()?.toLowerCase() || "";

  const map = {
    js: javascript(),
    mjs: javascript(),
    cjs: javascript(),
    ts: javascript({ typescript: true }),
    jsx: javascript({ jsx: true }),
    tsx: javascript({ jsx: true, typescript: true }),
    json: json(),
    html: html(),
    htm: html(),
    css: css(),
    md: markdown(),
    markdown: markdown(),
    py: python(),
    php: php(),
    sql: sql(),
    xml: xml(),
    svg: xml(),
    yml: yaml(),
    yaml: yaml()
  };

  return {
    label: extension || "plain text",
    extension: map[extension] || []
  };
}

function setDirty(value) {
  editorDirty.textContent = value ? "modified" : "saved";
}

function createEditor() {
  const updateListener = EditorView.updateListener.of((update) => {
    if (skipDirtyEvent || !update.docChanged) {
      return;
    }

    setDirty(view.state.doc.toString() !== state.originalContent);
  });

  view = new EditorView({
    state: EditorState.create({
      doc: "",
      extensions: [basicSetup, oneDark, languageCompartment.of([]), updateListener]
    }),
    parent: document.querySelector("#editor-surface")
  });
}

createEditor();

function setEditorValue(content, filePath = "") {
  const language = getLanguageExtension(filePath);
  skipDirtyEvent = true;
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: content
    },
    effects: languageCompartment.reconfigure(language.extension)
  });
  skipDirtyEvent = false;
  state.originalContent = content;
  editorLang.textContent = language.label;
  setDirty(false);
}

function getEditorValue() {
  return view.state.doc.toString();
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

  fileTree.innerHTML = data.items
    .map(
      (item) => `
        <button class="file-entry ${item.type}" data-path="${item.path}" data-type="${item.type}">${item.name}</button>
      `
    )
    .join("");

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
  editorFileLabel.textContent = basename(data.path);
  editorFilePath.textContent = data.path;
  setEditorValue(data.content, data.path);
}

async function saveCurrentFile() {
  const projectId = requireProject();
  if (!projectId || !state.currentFile) {
    showToast("Chưa chọn file");
    return;
  }

  await request(`/api/projects/${projectId}/file`, {
    method: "PUT",
    body: JSON.stringify({ path: state.currentFile, content: getEditorValue() })
  });

  state.originalContent = getEditorValue();
  setDirty(false);
  showToast(`Đã lưu ${state.currentFile}`);
}

document.addEventListener("keydown", async (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    await saveCurrentFile();
  }
});

document.querySelector("#save-file-btn").addEventListener("click", saveCurrentFile);

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

  await loadFiles(state.currentFolder);
  await openFile(name);
  showToast("Đã tạo file mới");
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

  await loadFiles(state.currentFolder);
  showToast("Đã tạo folder mới");
});

document.querySelector("#rename-item-btn").addEventListener("click", async () => {
  const projectId = requireProject();
  const currentPath = state.currentFile || state.currentFolder;
  if (!projectId || !currentPath) {
    showToast("Chưa chọn item để đổi tên");
    return;
  }

  const nextPath = window.prompt("Tên mới", currentPath);
  if (!nextPath || nextPath === currentPath) {
    return;
  }

  await request(`/api/projects/${projectId}/fs/rename`, {
    method: "POST",
    body: JSON.stringify({ oldPath: currentPath, newPath: nextPath })
  });

  if (state.currentFile) {
    state.currentFile = nextPath;
    editorFileLabel.textContent = basename(nextPath);
    editorFilePath.textContent = nextPath;
  }

  await loadFiles(state.currentFolder);
  showToast("Đã đổi tên");
});

document.querySelector("#delete-item-btn").addEventListener("click", async () => {
  const projectId = requireProject();
  const currentPath = state.currentFile || state.currentFolder;
  if (!projectId || !currentPath) {
    showToast("Chưa chọn item để xóa");
    return;
  }

  const confirmed = window.confirm(`Xóa ${currentPath}?`);
  if (!confirmed) {
    return;
  }

  await request(`/api/projects/${projectId}/fs/item?path=${encodeURIComponent(currentPath)}`, {
    method: "DELETE"
  });

  if (state.currentFile === currentPath) {
    state.currentFile = "";
    state.originalContent = "";
    editorFileLabel.textContent = "Editor";
    editorFilePath.textContent = "Chọn file bên trái để sửa...";
    setEditorValue("", "");
  }

  await loadFiles(state.currentFolder);
  showToast("Đã xóa item");
});

document.querySelector("#download-file-btn").addEventListener("click", async () => {
  if (!state.currentFile) {
    showToast("Chưa chọn file");
    return;
  }

  const blob = new Blob([getEditorValue()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = basename(state.currentFile);
  anchor.click();
  URL.revokeObjectURL(url);
});

importZipInput.addEventListener("change", async () => {
  const projectId = requireProject();
  const file = importZipInput.files?.[0];

  if (!projectId) {
    showToast("Hãy chọn project trước");
    importZipInput.value = "";
    return;
  }

  if (!file) {
    return;
  }

  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/import-zip?replace=0`, {
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

    showToast("Đã import zip vào project");
    await loadFiles(state.currentFolder);
  } catch (error) {
    showToast(error.message);
  } finally {
    importZipInput.value = "";
  }
});

await loadFiles();
