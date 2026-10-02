import { mapMCodeEvent } from "./events.js";
import { readConnection, isSuppressed } from "./connection.js";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

async function main(): Promise<void> {
  if (isSuppressed(process.ppid)) return;
  // Exec-form hook commands make MCode the direct parent. MCode intentionally
  // scrubs environment variables; never depend on inherited endpoint/token.
  let connection = readConnection(process.ppid);
  const automatic = process.argv.includes("--auto");
  if (!connection && !automatic) return;
  const chunks: Buffer[] = [];
  let size = 0;
  const timeout = setTimeout(() => process.exit(1), 1500);
  try {
    for await (const chunk of process.stdin) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > 256 * 1024) throw new Error("Hook input exceeds size limit");
      chunks.push(bytes);
    }
    const event = mapMCodeEvent(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!event) throw new Error("Unsupported or malformed hook event");
    clearTimeout(timeout);
    if (!connection && automatic && ["SessionStart", "UserPromptSubmit"].includes(event.hook_event_name)) {
      const override = process.argv.filter(arg => arg.startsWith("--overlay-exe="));
      const child = spawn(process.execPath, [fileURLToPath(new URL("./companion.js", import.meta.url)), String(process.ppid), ...override], {
        detached: true, windowsHide: true, stdio: "ignore", env: process.env,
      });
      let spawnError = false;
      child.once("error", () => { spawnError = true; });
      child.unref();
      const deadline = Date.now() + 8000;
      while (!connection && Date.now() < deadline && !spawnError) {
        await delay(50);
        connection = readConnection(process.ppid);
      }
      if (!connection) throw new Error("Automatic companion startup failed");
    }
    if (!connection) return;
    const response = await fetch(connection.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${connection.capability}` },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(900),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Avatar rejected hook event");
    await response.body?.cancel();
  } finally { clearTimeout(timeout); }
}

main().catch(() => {
  // No raw event/error details, control JSON, stdout, or exit-code-2 rejection.
  process.stderr.write("[mcode-emote] Activity could not be delivered to the pet.\n");
  process.exitCode = 1;
});
