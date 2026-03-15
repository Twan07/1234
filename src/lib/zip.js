import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { safeResolve } from "./security.js";
import { emptyDir, ensureDir } from "./fs.js";

const IGNORED_EXPORT_NAMES = new Set([".git", "node_modules"]);
const IGNORED_IMPORT_PREFIXES = ["__MACOSX/"];

async function walkFiles(rootDir, currentDir = rootDir, files = []) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_EXPORT_NAMES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      await walkFiles(rootDir, fullPath, files);
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    files.push({ fullPath, relativePath });
  }

  return files;
}

function normalizeEntryName(entryName) {
  return String(entryName || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

export async function exportProjectZip(projectRoot) {
  const zip = new AdmZip();
  const files = await walkFiles(projectRoot);

  for (const file of files) {
    const directory = path.posix.dirname(file.relativePath);
    zip.addLocalFile(file.fullPath, directory === "." ? "" : directory);
  }

  return zip.toBuffer();
}

export async function importProjectZip(buffer, projectRoot, options = {}) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  if (options.replace) {
    await emptyDir(projectRoot);
  } else {
    await ensureDir(projectRoot);
  }

  for (const entry of entries) {
    const entryName = normalizeEntryName(entry.entryName);

    if (!entryName) {
      continue;
    }

    if (IGNORED_IMPORT_PREFIXES.some((prefix) => entryName.startsWith(prefix))) {
      continue;
    }

    if (entryName.split("/").some((segment) => segment === "..")) {
      throw new Error(`Invalid zip entry: ${entryName}`);
    }

    if (entryName === ".git" || entryName.startsWith(".git/") || entryName === "node_modules" || entryName.startsWith("node_modules/")) {
      continue;
    }

    const outputPath = safeResolve(projectRoot, entryName);

    if (entry.isDirectory) {
      await ensureDir(outputPath);
      continue;
    }

    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, entry.getData());
  }
}
