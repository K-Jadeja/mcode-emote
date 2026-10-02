import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const [bridgePath, overlayPath, reportPath, mode] = process.argv.slice(2);
const connectionPath = join(homedir(), ".mcode-emote/connections", `${process.pid}.json`);
const readConnection = async () => JSON.parse(await readFile(connectionPath, "utf8"));
const env = Object.fromEntries(["PATH", "SystemRoot", "USERPROFILE", "HOME", "TEMP", "TMP"].flatMap(key => process.env[key] ? [[key, process.env[key]]] : []));
async function hook(name, session = "root-session", extra = {}) {
  const child = spawn(process.execPath, [bridgePath, "--auto", `--overlay-exe=${overlayPath}`], { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let stdout = "", stderr = "";
  child.stdout.on("data", bytes => { stdout += bytes; });
  child.stderr.on("data", bytes => { stderr += bytes; });
  child.stdin.end(JSON.stringify({ hook_event_name: name, session_id: session, prompt: "PRIVATE", ...extra }));
  const code = await new Promise(resolve => child.once("close", resolve));
  assert.equal(code, 0, `${name}: ${stderr}`);
  assert.equal(stdout, "");
}
async function state(connection) {
  return (await fetch(new URL("/state", connection.endpoint), { headers: { authorization: `Bearer ${connection.capability}` } })).json();
}
if (mode === "suppressed") {
  await hook("SessionStart");
  await assert.rejects(readConnection());
  await writeFile(reportPath, JSON.stringify({ suppressed: true }));
  process.exit(0);
}
// SessionEnd alone must never launch a pet.
await hook("SessionEnd");
await assert.rejects(readConnection());
await Promise.all([hook("SessionStart"), hook("SessionStart"), hook("SessionStart")]);
let connection = await readConnection();
const first = connection;
await hook("SessionStart", "root-session", { source: "resume" });
assert.equal((await readConnection()).launcherPid, first.launcherPid);
// Mirror the real TUI's Windows status-command launch through cmd.exe.
const statusBridge = fileURLToPath(new URL("../../dist/mcode/status-bridge.js", import.meta.url));
async function title(event, session, title) {
  const child = spawn("node", [`"${statusBridge}"`], { shell: true, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", bytes => { stdout += bytes; });
  child.stderr.on("data", bytes => { stderr += bytes; });
  child.stdin.end(JSON.stringify({ protocol: 1, event, session_id: session, session_title: title, workspace_dir: "private/path" }));
  assert.equal(await new Promise(resolve => child.once("close", resolve)), 0, stderr);
  assert.equal(stdout, "");
}
async function currentTitle() {
  return (await fetch(new URL("/identity", connection.endpoint), { headers: { authorization: `Bearer ${connection.capability}` } })).json();
}
await title("interval", "root-session", "Fix the login screen");
assert.deepEqual(await currentTitle(), { title: "Fix the login screen" });
await title("interval", "child-session", "Wrong chat");
assert.deepEqual(await currentTitle(), { title: "Fix the login screen" });
await title("session-change", "selected-chat", "Selected chat");
assert.deepEqual(await currentTitle(), { title: "Selected chat" });
await title("session-change", "root-session", "Fix the login screen");
assert.equal((await fetch(new URL("/identity", connection.endpoint))).status, 401);
await hook("PreToolUse", "root-session", { tool_name: "read" });
assert.equal((await state(connection)).activity, "reading");
await hook("SessionEnd", "child-session");
assert.equal((await state(connection)).activity, "reading");
await hook("SessionEnd");
assert.equal((await state(connection)).status, "ended");
await hook("SessionStart", "next-root");
assert.equal((await state(connection)).activity, "greeting");
assert.equal((await readConnection()).launcherPid, first.launcherPid);
// An abrupt host crash releases its mutex and the next prompt repairs it.
process.kill(first.launcherPid);
// Windows termination is asynchronous. Exercise recovery after actual death,
// not an assumed 300ms scheduling delay on a busy desktop.
let terminated = false;
for (let i = 0; i < 100; i++) {
  try { process.kill(first.launcherPid, 0); } catch { terminated = true; break; }
  await delay(50);
}
assert.ok(terminated, "Companion did not terminate before crash-recovery test");
await hook("UserPromptSubmit", "next-root");
connection = await readConnection();
assert.notEqual(connection.launcherPid, first.launcherPid);
assert.equal((await state(connection)).activity, "thinking");
// Explicit dismissal must survive later prompts without spawning another pet.
process.kill(connection.overlayPid);
await delay(150);
await hook("UserPromptSubmit", "next-root");
assert.equal((await readConnection()).launcherPid, connection.launcherPid);
await writeFile(reportPath, JSON.stringify({ mcodePid: process.pid, daemonPid: connection.launcherPid, firstDaemonPid: first.launcherPid, firstOverlayPid: first.overlayPid, overlayPid: connection.overlayPid, passed: true }));
if (mode === "hold") setInterval(() => {}, 1000);
