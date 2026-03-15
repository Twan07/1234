import path from "node:path";

export function safeResolve(rootDir, relativePath = "") {
  const resolvedPath = path.resolve(rootDir, relativePath || ".");
  const normalizedRoot = path.resolve(rootDir);

  if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Invalid path");
  }

  return resolvedPath;
}
