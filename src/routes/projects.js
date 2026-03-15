import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { exportProjectZip, importProjectZip } from "../lib/zip.js";
import { listDir } from "../lib/fs.js";
import { safeResolve } from "../lib/security.js";

function normalizeRelative(target) {
  return String(target || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function validateProjectName(name, projectsStore) {
  if (!name) {
    throw new Error("Project name is required");
  }

  if (!projectsStore.isValidName(name)) {
    throw new Error("Project name chỉ được chứa chữ, số, dấu chấm, gạch dưới và gạch ngang");
  }

  if (projectsStore.getByName(name)) {
    throw new Error("Project name already exists");
  }
}

export function createProjectsRouter({ projectsStore, processManager }) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    res.json({ projects: projectsStore.list() });
  });

  router.get("/templates", async (_req, res) => {
    res.json({ templates: projectsStore.getTemplates() });
  });

  router.post("/create", async (req, res) => {
    try {
      const name = String(req.body.name || "").trim();
      const sourceType = String(req.body.sourceType || "template").trim();
      const templateName = String(req.body.templateName || "blank").trim();
      const gitUrl = String(req.body.gitUrl || "").trim();
      const branch = String(req.body.branch || "").trim() || undefined;

      validateProjectName(name, projectsStore);

      let project;

      if (sourceType === "git") {
        if (!gitUrl) {
          res.status(400).json({ error: "gitUrl is required for git source" });
          return;
        }

        project = await projectsStore.createFromGit({ name, gitUrl, branch });
      } else {
        project = await projectsStore.createFromTemplate({ name, templateName });
      }

      res.status(201).json({ project });
    } catch (error) {
      const statusCode = String(error.message || "").includes("Project name") ? 400 : 500;
      res.status(statusCode).json({ error: error.message || "Failed to create project" });
    }
  });

  router.post(
    "/create-from-zip",
    express.raw({ type: ["application/zip", "application/octet-stream"], limit: "300mb" }),
    async (req, res) => {
      try {
        const name = String(req.query.name || req.headers["x-project-name"] || "").trim();
        validateProjectName(name, projectsStore);

        if (!req.body || req.body.length === 0) {
          res.status(400).json({ error: "Zip file is required" });
          return;
        }

        const project = await projectsStore.createFromZip({
          name,
          buffer: Buffer.from(req.body)
        });

        res.status(201).json({ project });
      } catch (error) {
        const statusCode = String(error.message || "").includes("Project name") || String(error.message || "").includes("Zip") ? 400 : 500;
        res.status(statusCode).json({ error: error.message || "Failed to create project from zip" });
      }
    }
  );

  router.get("/:id", async (req, res) => {
    const project = projectsStore.getById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const runner = processManager.get(project.id);
    res.json({
      project,
      runtime: runner
        ? {
            status: runner.status,
            command: runner.command,
            cwd: runner.cwd,
            startedAt: runner.startedAt,
            exitedAt: runner.exitedAt || null
          }
        : {
            status: "idle",
            command: null,
            cwd: project.root,
            startedAt: null,
            exitedAt: null
          }
    });
  });

  router.delete("/:id", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      processManager.stop(project.id);
      const removed = await projectsStore.remove(project.id);
      res.json({ ok: true, removed });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to remove project" });
    }
  });

  router.get("/:id/export-zip", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const buffer = await exportProjectZip(project.root);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${project.name}.zip"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to export zip" });
    }
  });

  router.post(
    "/:id/import-zip",
    express.raw({ type: ["application/zip", "application/octet-stream"], limit: "300mb" }),
    async (req, res) => {
      try {
        const project = projectsStore.getById(req.params.id);
        if (!project) {
          res.status(404).json({ error: "Project not found" });
          return;
        }

        if (!req.body || req.body.length === 0) {
          res.status(400).json({ error: "Zip file is required" });
          return;
        }

        processManager.stop(project.id);
        const replace = String(req.query.replace || "1") !== "0";
        await importProjectZip(Buffer.from(req.body), project.root, { replace });
        res.json({ ok: true, replaced: replace });
      } catch (error) {
        res.status(500).json({ error: error.message || "Failed to import zip" });
      }
    }
  );

  router.get("/:id/tree", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const relativePath = normalizeRelative(req.query.path || "");
      const targetPath = safeResolve(project.root, relativePath);
      const items = await listDir(targetPath);

      res.json({
        root: project.root,
        currentPath: relativePath,
        items: items.map((item) => ({
          ...item,
          path: path.posix.join(relativePath, item.name).replace(/^\//, "")
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to read directory" });
    }
  });

  router.get("/:id/file", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const relativePath = normalizeRelative(req.query.path || "");
      if (!relativePath) {
        res.status(400).json({ error: "path is required" });
        return;
      }

      const targetPath = safeResolve(project.root, relativePath);
      const stat = await fs.stat(targetPath);

      if (stat.isDirectory()) {
        res.status(400).json({ error: "Cannot open a directory as file" });
        return;
      }

      const content = await fs.readFile(targetPath, "utf8");
      res.json({ path: relativePath, content });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to read file" });
    }
  });

  router.put("/:id/file", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const relativePath = normalizeRelative(req.body.path || "");
      const content = String(req.body.content || "");

      if (!relativePath) {
        res.status(400).json({ error: "path is required" });
        return;
      }

      const targetPath = safeResolve(project.root, relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");

      res.json({ ok: true, path: relativePath });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to write file" });
    }
  });

  router.post("/:id/fs/create", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const relativePath = normalizeRelative(req.body.path || "");
      const itemType = String(req.body.type || "file").trim();

      if (!relativePath) {
        res.status(400).json({ error: "path is required" });
        return;
      }

      const targetPath = safeResolve(project.root, relativePath);

      if (itemType === "directory") {
        await fs.mkdir(targetPath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, "", "utf8");
      }

      res.status(201).json({ ok: true, path: relativePath, type: itemType });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to create item" });
    }
  });

  router.post("/:id/fs/rename", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const oldPath = normalizeRelative(req.body.oldPath || "");
      const newPath = normalizeRelative(req.body.newPath || "");

      if (!oldPath || !newPath) {
        res.status(400).json({ error: "oldPath and newPath are required" });
        return;
      }

      const fromPath = safeResolve(project.root, oldPath);
      const toPath = safeResolve(project.root, newPath);
      await fs.mkdir(path.dirname(toPath), { recursive: true });
      await fs.rename(fromPath, toPath);

      res.json({ ok: true, oldPath, newPath });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to rename item" });
    }
  });

  router.delete("/:id/fs/item", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const relativePath = normalizeRelative(req.query.path || "");
      if (!relativePath) {
        res.status(400).json({ error: "path is required" });
        return;
      }

      const targetPath = safeResolve(project.root, relativePath);
      await fs.rm(targetPath, { recursive: true, force: true });
      res.json({ ok: true, path: relativePath });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to delete item" });
    }
  });

  return router;
}
