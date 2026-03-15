import os from "node:os";
import * as pty from "node-pty";

function getShellExecutable() {
  if (process.platform === "win32") {
    return process.env.COMSPEC || "powershell.exe";
  }

  if (process.env.SHELL) {
    return process.env.SHELL;
  }

  return "/bin/bash";
}

export function createShellSession(cwd, options = {}) {
  const shell = getShellExecutable();
  const cols = Number(options.cols) > 0 ? Number(options.cols) : 120;
  const rows = Number(options.rows) > 0 ? Number(options.rows) : 32;
  const processRef = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: "xterm-256color"
    }
  });

  return {
    os: os.platform(),
    shell,
    process: processRef,
    write(data) {
      processRef.write(String(data || ""));
    },
    resize(nextCols, nextRows) {
      const safeCols = Math.max(20, Number(nextCols) || cols);
      const safeRows = Math.max(5, Number(nextRows) || rows);
      processRef.resize(safeCols, safeRows);
    },
    close() {
      processRef.kill();
    }
  };
}
