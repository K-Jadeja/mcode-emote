#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { CONNECTIONS, type MCodeConnection } from "./connection.js";
import { resolveMCode, spawnMCode } from "./cli.js";
import { installPlugin, requirePlugin } from "./plugin.js";
import { startServer, type AvatarServer } from "../host/avatar-server.js";
import { createPetSessionStateTracker } from "../host/pet-session-state-tracker.js";
import { createAvatarOutputPolicy } from "../host/output-policy.js";
import { buildDesktopOverlaySpawnSpec, resolveDesktopOverlay } from "../launcher/desktop-overlay.js";
import { resolveSessionLabel } from "../launcher/session-label.js";
import { terminateOwnedAvatar, waitForOwnedOverlayStartup } from "../launcher/startup.js";
import { mapEventSafe } from "../claude/event-mapper.js";

function cleanedEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("CLAUDE_EMOTE_") && !key.startsWith("MCODE_EMOTE_")));
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--emote-help") {
    console.log("MCode Emote\n\n  mcode-emote --emote-install   Install/enable local observer plugin\n  mcode-emote --emote-doctor    Check CLI, plugin and native pet\n  mcode-emote [MCode args]      Start MCode with its desktop companion\n  mcode-emote --no-emote ...   Run MCode without the companion\n\nAfter installation, plain mcode starts the pet automatically. Use --help for MCode help. Windows x64 desktop beta.");
    return 0;
  }
  const command = resolveMCode();
  if (args.length === 1 && args[0] === "--emote-install") {
    console.log(`[mcode-emote] Plugin installed and enabled: ${await installPlugin(command)}`);
    return 0;
  }
  const noEmote = args[0] === "--no-emote";
  if (noEmote) args.shift();
  // Maintenance/help/version commands do not create windows or require a plugin.
  const direct = noEmote || args.includes("--help") || args.includes("-h") || args.includes("--version") || args.includes("-V") ||
    ["plugin", "provider", "login", "logout", "update"].includes(args[0] ?? "");
  if (direct) {
    const child = spawnMCode(command, args, cleanedEnvironment());
    const completion = waitForChild(child);
    let suppression: string | undefined;
    try {
      if (noEmote && child.pid) {
        await mkdir(CONNECTIONS, { recursive: true, mode: 0o700 });
        suppression = join(CONNECTIONS, `${child.pid}.disabled`);
        await writeFile(suppression, String(process.pid), { mode: 0o600 });
      }
      return await completion;
    } finally {
      if (suppression) await unlink(suppression);
    }
  }
  if (args.includes("acp")) throw new Error("ACP is not supported by this launcher. Use the interactive CLI or exec.");
  if (args.some(arg => arg.startsWith("--emote-")) && args[0] !== "--emote-doctor") throw new Error("Unknown emote option. Run --emote-help.");
  const overlayEnv: NodeJS.ProcessEnv = { ...cleanedEnvironment(), CLAUDE_EMOTE_PROVIDER: "mcode" };
  if (process.env.MCODE_EMOTE_OVERLAY_EXE) overlayEnv.CLAUDE_EMOTE_OVERLAY_EXE = process.env.MCODE_EMOTE_OVERLAY_EXE;
  const overlayCommand = resolveDesktopOverlay(overlayEnv, process.platform, process.arch);
  await requirePlugin(command);
  if (args.length === 1 && args[0] === "--emote-doctor") {
    console.log("MCode Emote doctor: CLI found; observer plugin enabled; native overlay available. No model request made.");
    return 0;
  }

  const instanceId = randomBytes(12).toString("hex");
  const capability = randomBytes(32).toString("base64url");
  const tracker = createPetSessionStateTracker(instanceId);
  let rootSession: string | null = null;
  let host: AvatarServer | null = null;
  let overlay: ChildProcess | null = null;
  let child: ChildProcess | null = null;
  let connectionPath: string | null = null;
  let connectionText: string | null = null;
  const signalHandlers = new Map<NodeJS.Signals, () => void>();
  try {
    host = await startServer({
      port: 0, instanceId, capabilityToken: capability, sessionState: tracker,
      policy: createAvatarOutputPolicy({ visualPane: false, debug: false }),
      onEvent(reaction, raw) {
        const event = raw as { session_id?: string; hook_event_name?: string };
        if (!rootSession && (event.hook_event_name === "SessionStart" || event.hook_event_name === "UserPromptSubmit")) rootSession = event.session_id ?? null;
        if (!rootSession || event.session_id !== rootSession) return;
        // Never send even the hashed native session ID to the overlay.
        tracker.apply({ ...event, session_id: instanceId }, reaction);
      },
    });
    const labelEnv: NodeJS.ProcessEnv = { ...overlayEnv };
    if (process.env.MCODE_EMOTE_HIDE_SESSION_LABEL === "1") labelEnv.CLAUDE_EMOTE_HIDE_SESSION_LABEL = "1";
    const spec = buildDesktopOverlaySpawnSpec(overlayCommand, overlayEnv, host.url, capability, resolveSessionLabel(process.cwd(), labelEnv));
    // Independent native title while reusing the shared packaged renderer.
    if (overlayCommand.kind !== "override") spec.args.push("--window-title=MCode Emote");
    overlay = spawn(spec.executable, spec.args, spec.options);
    const startup = await waitForOwnedOverlayStartup(overlay, host.url, capability, 15_000);
    if (startup.status !== "healthy") throw new Error(`Desktop pet did not render (${startup.status}). Run --emote-doctor or use --no-emote.`);
    await mkdir(CONNECTIONS, { recursive: true, mode: 0o700 });
    child = spawnMCode(command, args, cleanedEnvironment());
    // Register the child immediately, before its Runtime can dispatch hooks.
    const completion = waitForChild(child);
    if (!child.pid) return await completion;
    connectionPath = join(CONNECTIONS, `${child.pid}.json`);
    const connection: MCodeConnection = { version: 1, mcodePid: child.pid, launcherPid: process.pid, endpoint: new URL("/event", host.url).href, capability };
    connectionText = JSON.stringify(connection);
    await writeFile(connectionPath, connectionText, { mode: 0o600, flag: "wx" });
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      const handler = () => { child?.kill(signal); };
      signalHandlers.set(signal, handler);
      process.on(signal, handler);
    }
    let warned = false;
    overlay.once("exit", () => {
      if (!warned && child?.exitCode === null) {
        warned = true;
        process.stderr.write("[mcode-emote] Pet closed; MCode continues in this terminal.\n");
      }
    });
    const code = await completion;
    const event = { hook_event_name: code === 0 ? "SessionEnd" : "StopFailure", session_id: instanceId };
    tracker.apply(event, mapEventSafe(event));
    await new Promise(resolve => setTimeout(resolve, 600));
    return code;
  } finally {
    for (const [signal, handler] of signalHandlers) process.off(signal, handler);
    await terminateOwnedAvatar(child);
    try {
      if (connectionPath && connectionText) {
        try {
          if (await readFile(connectionPath, "utf8") === connectionText) await unlink(connectionPath);
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
    } finally {
      await terminateOwnedAvatar(overlay);
      await host?.close();
    }
  }
}

function waitForChild(child: ChildProcess): Promise<number> {
  return new Promise(resolve => {
    child.once("error", () => { process.stderr.write("[mcode-emote] MCode could not start.\n"); resolve(127); });
    child.once("close", (code, signal) => resolve(code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1)));
  });
}

main().then(code => { process.exitCode = code; }).catch(error => {
  console.error(`[mcode-emote] ${error instanceof Error ? error.message : "Startup failed"}`);
  process.exitCode = 1;
});
