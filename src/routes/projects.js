import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { listDir } from "../lib/fs.js";
import { safeResolve } from "../lib/security.js";

export function createProjectsRouter({ projectsStore }) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    res.json({ projects: projectsStore.list() });
  });

  router.post("/create", async (req, res) => {
    try {
      const name = String(req.body.name || "").trim();
      const sourceType = String(req.body.sourceType || "template").trim();
      const templateName = String(req.body.templateName || "blank").trim();
      const gitUrl = String(req.body.gitUrl || "").trim();
      const branch = String(req.body.branch || "").trim() || undefined;

      if (!name) {
        res.status(400).json({ error: "Project name is required" });
        return;
      }

      if (projectsStore.list().some((item) => item.name === name)) {
        res.status(409).json({ error: "Project name already exists" });
        return;
      }

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
      res.status(500).json({ error: error.message || "Failed to create project" });
    }
  });

  router.get("/:id/tree", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const relativePath = String(req.query.path || "");
      const targetPath = safeResolve(project.root, relativePath);
      const items = await listDir(targetPath);

      res.json({
        root: project.root,
        currentPath: relativePath,
        items: items.map((item) => ({
          ...item,
          path: path.posix.join(relativePath.replace(/\\/g, "/"), item.name).replace(/^\//, "")
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

      const relativePath = String(req.query.path || "");
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

      const relativePath = String(req.body.path || "");
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

  return router;
}
