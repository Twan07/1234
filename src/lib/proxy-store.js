import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { ensureJsonFile, readJson, writeJson } from "./fs.js";

export class ProxyStore {
  constructor() {
    this.routes = [];
  }

  async init() {
    await ensureJsonFile(config.proxyStateFile, []);
    this.routes = await readJson(config.proxyStateFile, []);
  }

  list() {
    return [...this.routes].sort((a, b) => a.pathPrefix.localeCompare(b.pathPrefix));
  }

  match(requestPath) {
    const sorted = [...this.routes].sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
    return sorted.find((route) => requestPath === route.pathPrefix || requestPath.startsWith(route.pathPrefix + "/")) || null;
  }

  async add(route) {
    const payload = {
      id: randomUUID(),
      pathPrefix: route.pathPrefix,
      target: route.target,
      projectId: route.projectId || null,
      createdAt: new Date().toISOString()
    };

    this.routes.push(payload);
    await this.save();
    return payload;
  }

  async remove(routeId) {
    const before = this.routes.length;
    this.routes = this.routes.filter((route) => route.id !== routeId);
    const changed = this.routes.length !== before;

    if (changed) {
      await this.save();
    }

    return changed;
  }

  async save() {
    await writeJson(config.proxyStateFile, this.routes);
  }
}
