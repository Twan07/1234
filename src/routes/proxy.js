import express from "express";

export function createProxyRouter({ proxyStore }) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    res.json({ routes: proxyStore.list() });
  });

  router.post("/", async (req, res) => {
    try {
      let pathPrefix = String(req.body.pathPrefix || "").trim();
      const target = String(req.body.target || "").trim();
      const projectId = String(req.body.projectId || "").trim() || null;

      if (!pathPrefix || !target) {
        res.status(400).json({ error: "pathPrefix and target are required" });
        return;
      }

      if (!pathPrefix.startsWith("/")) {
        pathPrefix = `/${pathPrefix}`;
      }

      const route = await proxyStore.add({ pathPrefix, target, projectId });
      res.status(201).json({ route });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to create proxy route" });
    }
  });

  router.delete("/:id", async (req, res) => {
    const removed = await proxyStore.remove(req.params.id);
    res.json({ ok: true, removed });
  });

  return router;
}
