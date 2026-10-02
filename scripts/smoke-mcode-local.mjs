#!/usr/bin/env node
// Real MCode + installed hooks + real native overlay, with a loopback-only
// deterministic model fixture. No account credentials or paid model requests.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { resolveMCode } from "../dist/mcode/cli.js";

const root = resolve(import.meta.dirname, "..");
const run = join(root, ".tmp", `mcode-real-${Date.now()}`);
const profile = join(run, "profile");
const workspace = join(run, "workspace");
await mkdir(workspace, { recursive: true });
await mkdir(profile, { recursive: true });
await writeFile(join(workspace, "sample.txt"), "Local avatar acceptance fixture.\n");
const env = { ...process.env, MINIMAX_DATA_DIR: profile };
for (const key of Object.keys(env)) if (/API_KEY|ACCESS_TOKEN|AUTH_TOKEN|MCODE_EMOTE_|CLAUDE_EMOTE_/.test(key)) delete env[key];
const requests = [];
let requestCount = 0;
const model = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const input = JSON.parse(body || "{}");
  assert.equal(input.model, "mock");
  requests.push({ url: req.url, model: input.model });
  if (req.url.endsWith("/count_tokens")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ input_tokens: 1000 }));
    return;
  }
  assert.equal(req.url, "/v1/messages");
  requestCount++;
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  await delay(500);
  send("message_start", { message: { id: "local-smoke", type: "message", role: "assistant", model: "mock", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 0 } } });
  if (requestCount === 1) {
    // Native read tool, production-shaped JSON. Only the synthetic file is read.
    send("content_block_start", { index: 0, content_block: { type: "tool_use", id: "read-smoke", name: "read", input: {} } });
    send("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ path: join(workspace, "sample.txt") }) } });
    send("content_block_stop", { index: 0 });
    send("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 20 } });
  } else {
    await delay(Number(process.env.MCODE_SMOKE_HOLD_MS ?? 0));
    send("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
    send("content_block_delta", { index: 0, delta: { type: "text_delta", text: "Local fixture complete." } });
    send("content_block_stop", { index: 0 });
    send("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } });
  }
  send("message_stop", {});
  res.end();
});
await new Promise(resolve => model.listen(0, "127.0.0.1", resolve));
const config = {
  defaultModel: "emote-mock/mock",
  provider: { "emote-mock": { npm: "@ai-sdk/anthropic", options: { baseURL: `http://127.0.0.1:${model.address().port}/v1`, apiKey: "local-fixture-not-a-secret" }, models: { mock: { id: "mock", name: "Local mock", tool_call: true, reasoning: false, limit: { context: 32768, output: 1024 } } } } },
  agents: { default: { persona: { enabled: false }, tools: ["read"], builtinTools: [], skills: [], features: { mavis: false, delegation: false, webSearch: false } } },
  memory: { enabled: false, proactive: false }, skills: { external: { enabled: false } },
  telemetry: { enabled: false, metrics: false, diagnostics: false },
  beta: { autoMemory: false, skillEvolve: false, mcodeTools: false, browserBridge: false },
};
const configPath = join(profile, "config.yaml");
await writeFile(configPath, JSON.stringify(config, null, 2));
let child;
let connection;
const states = [];
let polling = true;
let poll;
try {
  const install = await promisify(execFile)(process.execPath, [join(root, "bin/mcode-emote.cjs"), "--emote-install"], { env, timeout: 40_000 });
  console.log(install.stdout.trim());
  const command = resolveMCode();
  child = spawn(command.executable, [...command.args, "exec", "--cwd", workspace, "--config", configPath, "--model", "emote-mock/mock", "--permission", "off", "--max-steps", "3", "--timeout", "45s", "--output-format", "json", "Read sample.txt and reply briefly."], { cwd: workspace, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  poll = (async () => {
    while (polling) {
      if (!connection) {
        for (const file of await readdir(join(homedir(), ".mcode-emote/connections")).catch(() => [])) {
          try {
            const candidate = JSON.parse(await readFile(join(homedir(), ".mcode-emote/connections", file), "utf8"));
            if (candidate.mcodePid === child.pid) connection = candidate;
          } catch {}
        }
      }
      if (connection) {
        try {
          const response = await fetch(new URL("/state", connection.endpoint), { headers: { authorization: `Bearer ${connection.capability}` }, signal: AbortSignal.timeout(500) });
          const state = await response.json();
          if (state.sequence !== states.at(-1)?.sequence) { states.push(state); console.log(`STATE ${state.activity}/${state.status}`); }
        } catch {}
      }
      await delay(25);
    }
  })();
  const timeout = setTimeout(() => child.kill(), 70_000);
  const code = await new Promise(resolve => child.once("close", resolve));
  clearTimeout(timeout);
  if (connection) {
    for (let i = 0; i < 100; i++) {
      try { process.kill(connection.launcherPid, 0); } catch { break; }
      await delay(100);
    }
    assert.throws(() => process.kill(connection.launcherPid, 0), "Companion did not stop after MCode exited");
    assert.throws(() => process.kill(connection.overlayPid, 0), "Native overlay did not stop");
  }
  await writeFile(join(run, "cli-output.json"), stdout);
  await writeFile(join(run, "cli-stderr.txt"), stderr);
  await writeFile(join(run, "evidence.json"), JSON.stringify({ code, requests, states }, null, 2));
  console.log(`Evidence: ${run}`);
  if (code !== 0) console.error(stderr.slice(-3000), stdout.slice(-1500));
  assert.equal(code, 0, "Real MCode execution failed");
  assert.equal(requestCount, 2, "Expected one tool step and one final response from the local fixture");
  assert.ok(states.some(s => s.activity === "reading"), "Real read hook was not observed");
  assert.ok(states.some(s => s.status === "ready"), "Real Stop hook was not observed");
  assert.ok(states.some(s => s.status === "ended"), "Companion did not publish ended state");
  console.log("PASS plain MCode automatic plugin lifecycle, native overlay, read tool, Stop, exit cleanup; zero paid model requests");
} finally {
  polling = false;
  await poll;
  if (child?.exitCode === null) child.kill();
  model.closeAllConnections();
  await new Promise(resolve => model.close(resolve));
}
