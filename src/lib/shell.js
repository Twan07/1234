import { spawn } from "node:child_process";
import os from "node:os";

function getShellExecutable() {
  if (process.platform === "win32") {
    return process.env.COMSPEC || "powershell.exe";
  }

  if (process.env.SHELL) {
    return process.env.SHELL;
  }

  return "/bin/bash";
}

export function createShellSession(cwd) {
  const shell = getShellExecutable();
  const child = spawn(shell, [], {
    cwd,
    env: {
      ...process.env,
      TERM: process.env.TERM || "xterm-256color"
    },
    stdio: ["pipe", "pipe", "pipe"]
  });

  return {
    os: os.platform(),
    shell,
    process: child,
    write(data) {
      child.stdin.write(data);
    },
    close() {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
  };
}
