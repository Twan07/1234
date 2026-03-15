import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

export async function ensureJsonFile(filePath, fallbackValue) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
  } catch {
    await ensureDir(path.dirname(filePath));
    await writeJson(filePath, fallbackValue);
  }
}

export async function readJson(filePath, fallbackValue) {
  try {
    const content = await fsp.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallbackValue;
  }
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function copyDir(sourceDir, targetDir) {
  await ensureDir(targetDir);
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    await ensureDir(path.dirname(targetPath));
    await fsp.copyFile(sourcePath, targetPath);
  }
}

export async function emptyDir(dirPath) {
  await ensureDir(dirPath);
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dirPath, entry.name);
    await fsp.rm(fullPath, { recursive: true, force: true });
  }));
}

export async function removeDir(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true });
}

export async function listDir(dirPath) {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const stat = await fsp.stat(fullPath);

    items.push({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      size: stat.size,
      mtimeMs: stat.mtimeMs
    });
  }

  items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  return items;
}
