import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

export class ProcessManager {
  constructor(maxLogLines = 2000) {
    this.maxLogLines = maxLogLines;
    this.runners = new Map();
    this.events = new EventEmitter();
  }

  get(projectId) {
    return this.runners.get(projectId) || null;
  }

  getLogs(projectId) {
    const runner = this.get(projectId);
    return runner ? runner.logs : [];
  }

  isRunning(projectId) {
    const runner = this.get(projectId);
    return Boolean(runner && runner.process && !runner.process.killed);
  }

  appendLog(projectId, chunk, stream = "stdout") {
    const runner = this.get(projectId);
    if (!runner) {
      return;
    }

    const text = String(chunk);
    const lines = text.split(/\r?\n/).filter((line, index, array) => line.length > 0 || index < array.length - 1);

    for (const line of lines) {
      runner.logs.push({
        timestamp: new Date().toISOString(),
        stream,
        line
      });
    }

    if (runner.logs.length > this.maxLogLines) {
      runner.logs.splice(0, runner.logs.length - this.maxLogLines);
    }

    this.events.emit(`log:${projectId}`, {
      type: "log",
      data: text,
      stream,
      timestamp: new Date().toISOString()
    });
  }

  run(projectId, options) {
    this.stop(projectId);

    const child = spawn(options.command, {
      cwd: options.cwd,
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: "1"
      }
    });

    const runner = {
      process: child,
      logs: [],
      command: options.command,
      cwd: options.cwd,
      startedAt: new Date().toISOString(),
      status: "running"
    };

    this.runners.set(projectId, runner);
    this.events.emit(`status:${projectId}`, {
      type: "status",
      status: "running",
      command: options.command,
      cwd: options.cwd,
      timestamp: runner.startedAt
    });

    child.stdout.on("data", (chunk) => {
      this.appendLog(projectId, chunk, "stdout");
    });

    child.stderr.on("data", (chunk) => {
      this.appendLog(projectId, chunk, "stderr");
    });

    child.on("close", (code, signal) => {
      const current = this.get(projectId);
      if (!current) {
        return;
      }

      current.status = "stopped";
      current.exitedAt = new Date().toISOString();
      current.exitCode = code;
      current.signal = signal;

      this.events.emit(`status:${projectId}`, {
        type: "status",
        status: "stopped",
        exitCode: code,
        signal,
        timestamp: current.exitedAt
      });
    });

    child.on("error", (error) => {
      this.appendLog(projectId, error.message, "stderr");
    });

    return runner;
  }

  stop(projectId) {
    const runner = this.get(projectId);
    if (!runner || !runner.process) {
      return false;
    }

    if (!runner.process.killed) {
      runner.process.kill("SIGTERM");
    }

    runner.status = "stopping";
    this.events.emit(`status:${projectId}`, {
      type: "status",
      status: "stopping",
      timestamp: new Date().toISOString()
    });

    return true;
  }
}
