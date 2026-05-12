import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

function resolveInWorkspace(workspaceRoot: string, inputPath: string): string {
  const resolved = path.resolve(workspaceRoot, inputPath);
  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
    throw new Error(`path outside workspace root: ${inputPath}`);
  }
  return resolved;
}

export function createRealFsRead(workspaceRoot: string) {
  return async function fsRead(input: { path: string }): Promise<{ path: string; content: string }> {
    const resolved = resolveInWorkspace(workspaceRoot, input.path);

    let content: string;
    try {
      content = await readFile(resolved, "utf-8");
    } catch (cause) {
      const err = cause as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        throw new Error(`fs.read: file not found: ${input.path}`);
      }
      if (err.code === "EISDIR") {
        throw new Error(`fs.read: path is a directory: ${input.path}`);
      }
      if (err.code === "EACCES") {
        throw new Error(`fs.read: permission denied: ${input.path}`);
      }
      throw new Error(`fs.read: ${err.message}`);
    }

    return { path: resolved, content };
  };
}

export function createRealFsWrite(workspaceRoot: string) {
  return async function fsWrite(input: { path: string; content: string }): Promise<{ path: string; bytesWritten: number }> {
    const resolved = resolveInWorkspace(workspaceRoot, input.path);

    const dir = path.dirname(resolved);
    await mkdir(dir, { recursive: true });

    await writeFile(resolved, input.content, "utf-8");
    const bytesWritten = Buffer.byteLength(input.content, "utf-8");

    return { path: resolved, bytesWritten };
  };
}
