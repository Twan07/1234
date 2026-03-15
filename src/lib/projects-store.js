import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { copyDir, ensureDir, ensureJsonFile, readJson, removeDir, writeJson } from "./fs.js";
import { importProjectZip } from "./zip.js";

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

  getByName(name) {
    return this.projects.find((item) => item.name === name) || null;
  }

  isValidName(name) {
    return /^[a-zA-Z0-9._-]+$/.test(name);
  }

  getTemplates() {
    return [
      {
        id: "blank",
        name: "Blank",
        description: "Thư mục rỗng để tự bắt đầu từ đầu",
        git: null
      },
      {
        id: "static-site",
        name: "Static Site",
        description: "Mẫu HTML/CSS/JS tĩnh chạy ngay sau khi tạo",
        git: null
      },
      {
        id: "node-api",
        name: "Node API",
        description: "Express API nhỏ có sẵn package.json và server.js",
        git: null
      }
    ];
  }

  async save() {
    await writeJson(config.projectStateFile, this.projects);
  }

  createRecord({ name, root, sourceType, source, branch = null }) {
    return {
      id: randomUUID(),
      name,
      root,
      sourceType,
      source,
      branch,
      createdAt: new Date().toISOString()
    };
  }

  async createFromTemplate({ name, templateName }) {
    const root = path.join(config.projectsDir, name);
    const templateRoot = path.join(config.templatesDir, templateName);

    await copyDir(templateRoot, root);

    const project = this.createRecord({
      name,
      root,
      sourceType: "template",
      source: templateName
    });

    this.projects.push(project);
    await this.save();
    return project;
  }

  async createFromGit({ name, gitUrl, branch }) {
    const root = path.join(config.projectsDir, name);
    const args = ["clone"];

    if (branch) {
      args.push("--branch", branch);
    }

    args.push(gitUrl, root);

    await execFileAsync("git", args, {
      cwd: config.rootDir
    });

    const project = this.createRecord({
      name,
      root,
      sourceType: "git",
      source: gitUrl,
      branch: branch || null
    });

    this.projects.push(project);
    await this.save();
    return project;
  }

  async createFromZip({ name, buffer }) {
    const root = path.join(config.projectsDir, name);
    await ensureDir(root);
    await importProjectZip(buffer, root, { replace: true });

    const project = this.createRecord({
      name,
      root,
      sourceType: "zip",
      source: `${name}.zip`
    });

    this.projects.push(project);
    await this.save();
    return project;
  }

  async remove(projectId) {
    const project = this.getById(projectId);
    if (!project) {
      return false;
    }

    await removeDir(project.root);
    this.projects = this.projects.filter((item) => item.id !== projectId);
    await this.save();
    return true;
  }
}
