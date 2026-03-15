import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
  rootDir,
  projectsDir: path.join(rootDir, "projects"),
  runtimeDir: path.join(rootDir, "runtime"),
  templatesDir: path.join(rootDir, "templates"),
  maxLogLines: 2000,
  projectStateFile: path.join(rootDir, "runtime", "projects.json"),
  proxyStateFile: path.join(rootDir, "runtime", "proxy-routes.json")
};
