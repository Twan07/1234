import express from "express";

export function createRuntimeRouter({ projectsStore, processManager }) {
  const router = express.Router();

  router.post("/:id/run", async (req, res) => {
    try {
      const project = projectsStore.getById(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const command = String(req.body.command || "").trim();
      if (!command) {
        res.status(400).json({ error: "command is required" });
        return;
      }

      const runner = processManager.run(project.id, {
        command,
        cwd: project.root
      });

      res.json({
        ok: true,
        status: runner.status,
        command: runner.command,
        cwd: runner.cwd,
        startedAt: runner.startedAt
      });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to start app" });
    }
  });

  router.post("/:id/stop", async (req, res) => {
    const project = projectsStore.getById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const stopped = processManager.stop(project.id);
    res.json({ ok: true, stopped });
  });

  router.get("/:id/logs", async (req, res) => {
    const project = projectsStore.getById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const runner = processManager.get(project.id);
    const logs = processManager.getLogs(project.id);

    res.json({
      status: runner ? runner.status : "idle",
      command: runner ? runner.command : null,
      cwd: runner ? runner.cwd : project.root,
      startedAt: runner ? runner.startedAt : null,
      exitedAt: runner ? runner.exitedAt || null : null,
      logs
    });
  });

  return router;
}
