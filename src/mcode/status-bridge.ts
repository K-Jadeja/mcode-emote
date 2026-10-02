import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { readConnection } from "./connection.js";
import { parseChatIdentity } from "./identity.js";

let phase = "input";
async function main(): Promise<void> {
  const timer = setTimeout(() => {
    process.stderr.write(`[mcode-emote] Chat title update timed out (${phase}).\n`);
    process.exit(1);
  }, 4500);
  try {
    let text = "";
    for await (const bytes of process.stdin) {
      text += bytes;
      if (Buffer.byteLength(text) > 64 * 1024) throw new Error("Status input too large");
    }
    const identity = parseChatIdentity(JSON.parse(text));
    if (!identity) return; // Startup may precede creation of any chat.
    phase = "connection lookup";
    let connection = readConnection(process.ppid);
    if (!connection && process.platform === "win32") {
      // Unlike exec-form plugin hooks, MCode runs status commands through cmd.
      // Resolve that shell's parent; never select a session from a global list.
      phase = "parent lookup";
      const powershell = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
      const { stdout } = await promisify(execFile)(powershell, ["-NoProfile", "-NonInteractive", "-Command", `(Get-CimInstance Win32_Process -Filter 'ProcessId=${process.ppid}').ParentProcessId`], { windowsHide: true, timeout: 2500 });
      phase = "owner connection lookup";
      const owner = Number(stdout.trim());
      if (Number.isSafeInteger(owner) && owner > 0) connection = readConnection(owner);
    }
    if (!connection) return; // Next scheduled refresh retries after pet startup.
    phase = "identity delivery";
    const response = await fetch(new URL("/identity", connection.endpoint), {
      method: "POST", headers: { authorization: `Bearer ${connection.capability}`, "content-type": "application/json" },
      body: JSON.stringify(identity), redirect: "error", signal: AbortSignal.timeout(900),
    });
    if (!response.ok) throw new Error("Identity rejected");
    await response.body?.cancel();
  } finally { clearTimeout(timer); }
}
main().catch((error: unknown) => {
  const timedOut = error && typeof error === "object" && "killed" in error && error.killed === true;
  process.stderr.write(`[mcode-emote] Chat title could not be updated (${phase}${timedOut ? ": process timeout" : ""}).\n`);
  process.exitCode = 1;
});
