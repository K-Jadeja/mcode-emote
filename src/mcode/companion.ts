import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile, rename, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { CONNECTIONS, type MCodeConnection } from "./connection.js";
import { startServer, type AvatarServer } from "../host/avatar-server.js";
import { createPetSessionStateTracker } from "../host/pet-session-state-tracker.js";
import { createAvatarOutputPolicy } from "../host/output-policy.js";
import { mapEventSafe } from "../claude/event-mapper.js";
import { resolveDesktopOverlay, buildDesktopOverlaySpawnSpec } from "../launcher/desktop-overlay.js";
import { terminateOwnedAvatar, waitForOwnedOverlayStartup } from "../launcher/startup.js";
import { prepareNativeRuntime } from "./native-runtime.js";
import { resolveSessionLabel } from "../launcher/session-label.js";
import { validChatIdentity } from "./identity.js";

// A Windows named pipe is an OS-owned mutex: concurrent hooks cannot start
// duplicate pets, and a crashed daemon cannot leave a stale lock behind.
async function main(): Promise<void> {
  const mcodePid = Number(process.argv[2]);
  if (!Number.isSafeInteger(mcodePid) || mcodePid <= 0) throw new Error("Invalid owner PID");
  const user = createHash("sha256").update(homedir()).digest("hex").slice(0, 16);
  const mutex = createServer(socket => socket.destroy());
  const pipe = process.platform === "win32" ? `\\\\.\\pipe\\mcode-emote-${user}-${mcodePid}` : join(CONNECTIONS, `${mcodePid}.sock`);
  await mkdir(CONNECTIONS, { recursive: true, mode: 0o700 });
  const acquired = await new Promise<boolean>((resolve, reject) => {
    mutex.once("error", (error: NodeJS.ErrnoException) => error.code === "EADDRINUSE" ? resolve(false) : reject(error));
    mutex.listen(pipe, () => resolve(true));
  });
  if (!acquired) return;
  const instanceId = randomBytes(12).toString("hex");
  const capability = randomBytes(32).toString("base64url");
  const tracker = createPetSessionStateTracker(instanceId);
  const connectionPath = join(CONNECTIONS, `${mcodePid}.json`);
  let connectionText = "";
  let host: AvatarServer | undefined;
  let overlay: ChildProcess | null = null;
  let rootSession: string | undefined;
  let rootEnded = false;
  let chatTitle: string | null = null;
  let parentWatch: ReturnType<typeof setInterval> | undefined;
  let stopping = false;
  let finish!: () => void;
  const lifetime = new Promise<void>(resolve => { finish = resolve; });
  const stop = () => { if (!stopping) { stopping = true; finish(); } };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    process.kill(mcodePid, 0);
    host = await startServer({ port: 0, instanceId, capabilityToken: capability, sessionState: tracker,
      identity: {
        getSnapshot: () => ({ title: chatTitle }),
        update(raw) {
          if (!validChatIdentity(raw)) return false;
          if (rootSession && raw.session !== rootSession && raw.event !== "session-change") return true;
          if (raw.session !== rootSession) {
            rootSession = raw.session;
            rootEnded = false;
            const selected = { hook_event_name: "SessionStart", session_id: instanceId };
            tracker.apply(selected, mapEventSafe(selected));
          }
          chatTitle = raw.title;
          return true;
        },
      },
      policy: createAvatarOutputPolicy({ visualPane: false, debug: false }),
      onEvent(reaction, raw) {
        const event = raw as { session_id?: string; hook_event_name?: string };
        if ((!rootSession || rootEnded) && (event.hook_event_name === "SessionStart" || event.hook_event_name === "UserPromptSubmit")) {
          if (rootSession !== event.session_id) chatTitle = null;
          rootSession = event.session_id;
          rootEnded = false;
        }
        if (!rootSession || event.session_id !== rootSession) return;
        rootEnded = event.hook_event_name === "SessionEnd";
        tracker.apply({ ...event, session_id: instanceId }, reaction);
      },
    });
    const env = { ...process.env, CLAUDE_EMOTE_PROVIDER: "mcode" };
    const override = process.argv.find(arg => arg.startsWith("--overlay-exe="))?.slice(14);
    if (override) Object.assign(env, { CLAUDE_EMOTE_OVERLAY_EXE: override });
    const command = await prepareNativeRuntime(resolveDesktopOverlay(env, process.platform, process.arch));
    // MCode starts hooks in the owning session's cwd. Send only its sanitized
    // final folder component through the existing environment-only label.
    const spec = buildDesktopOverlaySpawnSpec(command, env, host.url, capability, resolveSessionLabel(process.cwd(), {}));
    if (command.kind !== "override") spec.args.push("--window-title=MCode Emote");
    overlay = spawn(spec.executable, spec.args, spec.options);
    const ready = await waitForOwnedOverlayStartup(overlay, host.url, capability, 6500);
    if (ready.status !== "healthy") throw new Error("Native overlay failed readiness");
    // Keep the broker alive if the user dismisses the pet. Later hooks must not
    // reopen it in the same MCode process.
    process.kill(mcodePid, 0);
    const connection: MCodeConnection = { version: 1, mcodePid, launcherPid: process.pid, overlayPid: overlay.pid, endpoint: new URL("/event", host.url).href, capability };
    connectionText = JSON.stringify(connection);
    const temporary = `${connectionPath}.${process.pid}.tmp`;
    await writeFile(temporary, connectionText, { mode: 0o600, flag: "wx" });
    await rename(temporary, connectionPath);
    parentWatch = setInterval(() => {
      try { process.kill(mcodePid, 0); } catch { stop(); }
    }, 250);
    await lifetime;
    const ended = { hook_event_name: "SessionEnd", session_id: instanceId };
    tracker.apply(ended, mapEventSafe(ended));
    await new Promise(resolve => setTimeout(resolve, 350));
  } finally {
    if (parentWatch) clearInterval(parentWatch);
    await terminateOwnedAvatar(overlay);
    await host?.close();
    if (connectionText) {
      try { if (await readFile(connectionPath, "utf8") === connectionText) await unlink(connectionPath); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    mutex.close();
  }
}

main().catch(() => { process.exitCode = 1; });
