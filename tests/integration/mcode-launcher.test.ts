import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const artifacts = join(root, ".tmp", `mcode-tests-${randomUUID()}`);
mkdirSync(artifacts, { recursive: true });
const env = { ...process.env, MCODE_EMOTE_EXE: join(root, "tests/fixtures/mcode-emote-fake.mjs"), MCODE_EMOTE_OVERLAY_EXE: join(root, "tests/fixtures/mcode-overlay-fake.mjs"), FAKE_BRIDGE: join(root, "dist/mcode/hook-bridge.js"), FAKE_RECORD: join(artifacts, "states.json") };
const run = (args: string[], extra = {}) => promisify(execFile)(process.execPath, [join(root, "bin/mcode-emote.cjs"), ...args], { env: { ...env, ...extra }, timeout: 15_000 });

describe("MCode process integration without model calls", () => {
  it("is inert without a parent-bound launcher connection", async () => {
    const result = await promisify(execFile)(process.execPath, [join(root, "dist/mcode/hook-bridge.js")], { timeout: 3000 });
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
  it("delivers sanitized hooks despite stripped env, isolates child sessions, and removes its connection", async () => {
    await run(["--model", "my/model", "literal $() & argument"]);
    const report = JSON.parse(readFileSync(env.FAKE_RECORD, "utf8"));
    expect(report.args).toEqual(["--model", "my/model", "literal $() & argument"]);
    expect(report.states.at(-1).status).toBe("ready");
    expect(report.states[4].sequence).toBe(report.states[3].sequence);
    expect(report.states[5].status).toBe("needs-input");
    expect(existsSync(join(homedir(), ".mcode-emote", "connections", `${report.pid}.json`))).toBe(false);
    expect(() => process.kill(report.pid, 0)).toThrow();
  }, 20_000);
  it("forwards the MCode failure exit code", async () => {
    await expect(run([], { FAKE_EXIT: "23" })).rejects.toMatchObject({ code: 23 });
  }, 20_000);
  it("version bypasses plugin and native overlay startup", async () => {
    const result = await run(["--version"], { MCODE_EMOTE_OVERLAY_EXE: "missing-overlay.exe", FAKE_DISABLED: "1" });
    expect(result.stdout.trim()).toBe("fake-mcode-0.6.0");
  });
  it("fails clearly if its plugin is disabled", async () => {
    await expect(run([], { FAKE_DISABLED: "1" })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("plugin is missing or disabled") });
  });
});
