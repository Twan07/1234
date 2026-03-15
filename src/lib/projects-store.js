import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { copyDir, ensureDir, ensureJsonFile, readJson, writeJson } from "./fs.js";

const execFileAsync = promisify(execFile);

export class ProjectsStore {
  constructor() {
    this.projects = [];
  }

  async init() {
    await ensureDir(config.projectsDir);
    await ensureJsonFile(config.projectStateFile, []);
    this.projects = await readJson(config.projectStateFile, []);
  }

  list() {
    return [...this.projects].sort((a, b) => a.name.localeCompare(b.name));
  }

  getById(projectId) {
    return this.projects.find((item) => item.id === projectId) || null;
  }

  async save() {
    await writeJson(config.projectStateFile, this.projects);
  }

  async createFromTemplate({ name, templateName }) {
    const id = randomUUID();
    const root = path.join(config.projectsDir, name);
    const templateRoot = path.join(config.templatesDir, templateName);

    await copyDir(templateRoot, root);

    const project = {
      id,
      name,
      root,
      sourceType: "template",
      source: templateName,
      createdAt: new Date().toISOString()
    };

    this.projects.push(project);
    await this.save();
    return project;
  }

  async createFromGit({ name, gitUrl, branch }) {
    const id = randomUUID();
    const root = path.join(config.projectsDir, name);
    const args = ["clone"];

    if (branch) {
      args.push("--branch", branch);
    }

    args.push(gitUrl, root);

    await execFileAsync("git", args, {
      cwd: config.rootDir
    });

    const project = {
      id,
      name,
      root,
      sourceType: "git",
      source: gitUrl,
      branch: branch || null,
      createdAt: new Date().toISOString()
    };

    this.projects.push(project);
    await this.save();
    return project;
  }
}
