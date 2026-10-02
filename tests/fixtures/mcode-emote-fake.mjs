import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
if (args[0] === "plugin") {
  console.log(JSON.stringify({ installed: [{ name: "mcode-emote", enabled: process.env.FAKE_DISABLED !== "1" }] }));
  process.exit(0);
}
if (args.includes("--version")) { console.log("fake-mcode-0.6.0"); process.exit(0); }
assert.equal(process.env.CLAUDE_EMOTE_CAPABILITY_TOKEN, undefined);
assert.equal(process.env.MCODE_EMOTE_EXE, undefined);
let connection;
for (let i = 0; i < 50; i++) {
  try { connection = JSON.parse(await readFile(join(homedir(), ".mcode-emote", "connections", `${process.pid}.json`), "utf8")); break; } catch { await delay(20); }
}
assert.ok(connection, "Launcher must register a parent-bound connection");
const env = Object.fromEntries(["PATH", "SystemRoot", "USERPROFILE", "HOME", "TEMP", "TMP"].flatMap(key => process.env[key] ? [[key, process.env[key]]] : []));
const states = [];
for (const [name, tool, expected, session] of [
  ["SessionStart", null, "greeting"], ["UserPromptSubmit", null, "thinking"],
  ["PreToolUse", "Read", "reading"], ["PreToolUse", "edit", "writing"],
  ["SessionEnd", null, "writing", "child-session"],
  ["PermissionRequest", "Bash", "thinking"], ["PostToolUse", "Bash", "thinking"],
  ["PreCompact", null, "compacting"], ["Stop", null, "idle"],
]) {
  const bridge = spawn(process.execPath, [process.env.FAKE_BRIDGE], { env, stdio: ["pipe", "pipe", "pipe"] });
  bridge.stdin.end(JSON.stringify({ hook_event_name: name, session_id: session ?? "root-session", tool_name: tool, prompt: "secret prompt", tool_input: "secret args", tool_response: "secret output" }));
  let stdout = "", stderr = "";
  bridge.stdout.on("data", data => { stdout += data; });
  bridge.stderr.on("data", data => { stderr += data; });
  const code = await new Promise(resolve => bridge.once("exit", resolve));
  assert.equal(code, 0, stderr);
  assert.equal(stdout, "", "Observer must not inject control output");
  const response = await fetch(new URL("/state", connection.endpoint), { headers: { authorization: `Bearer ${connection.capability}` } });
  const state = await response.json();
  assert.equal(state.activity, expected, name);
  assert.deepEqual(Object.keys(state).sort(), ["activity", "sequence", "sessionId", "status", "timestamp"]);
  assert.ok(!JSON.stringify(state).includes("secret"));
  states.push(state);
}
await writeFile(process.env.FAKE_RECORD, JSON.stringify({ states, args, pid: process.pid }));
if (process.env.FAKE_HOLD_MS) await delay(Number(process.env.FAKE_HOLD_MS));
process.exit(Number(process.env.FAKE_EXIT ?? 0));
