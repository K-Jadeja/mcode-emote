import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

export interface MCodeConnection {
  version: 1;
  mcodePid: number;
  launcherPid: number;
  endpoint: string;
  capability: string;
  overlayPid?: number;
}
export const CONNECTIONS = join(homedir(), ".mcode-emote", "connections");

export function isSuppressed(parentPid: number): boolean {
  try {
    const pid = Number(readFileSync(join(CONNECTIONS, `${parentPid}.disabled`), "utf8"));
    if (!Number.isSafeInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

export function validConnection(value: unknown, parentPid: number): value is MCodeConnection {
  if (!value || typeof value !== "object") return false;
  const c = value as MCodeConnection;
  if (c.version !== 1 || c.mcodePid !== parentPid || !Number.isSafeInteger(c.launcherPid) || c.launcherPid <= 0) return false;
  if (typeof c.capability !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(c.capability)) return false;
  try {
    const url = new URL(c.endpoint);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && !!url.port && url.pathname === "/event" && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}

export function readConnection(parentPid: number, directory = CONNECTIONS): MCodeConnection | null {
  try {
    const value: unknown = JSON.parse(readFileSync(join(directory, `${parentPid}.json`), "utf8"));
    if (!validConnection(value, parentPid)) throw new Error("Invalid MCode Emote connection record");
    process.kill(value.launcherPid, 0);
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ESRCH") return null;
    throw error;
  }
}
