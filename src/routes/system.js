import express from "express";
import os from "node:os";

export function createSystemRouter() {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptimeSeconds: os.uptime(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg(),
      nodeVersion: process.version
    });
  });

  return router;
}
