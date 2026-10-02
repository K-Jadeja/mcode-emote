import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const artifacts = join(root, ".tmp", `mcode-auto-${randomUUID()}`);
mkdirSync(artifacts, { recursive: true });
const fixture = join(root, "tests/fixtures/mcode-auto-fake.mjs");
const bridge = join(root, "dist/mcode/hook-bridge.js");
const overlay = join(root, "tests/fixtures/mcode-overlay-fake.mjs");
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function assertClean(report: any) {
  const file = join(homedir(), ".mcode-emote/connections", `${report.mcodePid}.json`);
  for (let i = 0; i < 60 && (existsSync(file) || alive(report.daemonPid) || alive(report.firstOverlayPid)); i++) await delay(100);
  expect(existsSync(file)).toBe(false);
  for (const pid of [report.daemonPid, report.firstDaemonPid, report.overlayPid, report.firstOverlayPid]) expect(alive(pid)).toBe(false);
}
describe("automatic MCode companion", () => {
  it("preserves the explicit no-emote opt-out even with automatic hooks installed", async () => {
    const reportPath = join(artifacts, "suppressed.json");
    await promisify(execFile)(process.execPath, [join(root, "bin/mcode-emote.cjs"), "--no-emote", bridge, overlay, reportPath, "suppressed"], {
      env: { ...process.env, MCODE_EMOTE_EXE: fixture }, timeout: 10_000,
    });
    expect(JSON.parse(readFileSync(reportPath, "utf8"))).toEqual({ suppressed: true });
  });
  it("starts from plain CLI hooks; deduplicates, resumes, repairs crashes, respects dismissal and cleans up", async () => {
    const reportPath = join(artifacts, "normal.json");
    await promisify(execFile)(process.execPath, [fixture, bridge, overlay, reportPath], { timeout: 25_000 });
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    expect(report.passed).toBe(true);
    const label = JSON.parse(readFileSync(join(root, ".tmp/overlay-labels", `${report.firstOverlayPid}.json`), "utf8"));
    expect(label).toEqual({ label: basename(root) });
    await assertClean(report);
  }, 35_000);
  it("cleans up after an abruptly terminated MCode parent", async () => {
    const reportPath = join(artifacts, "killed.json");
    const child = spawn(process.execPath, [fixture, bridge, overlay, reportPath, "hold"], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.on("data", bytes => { stderr += bytes; });
    try {
      for (let i = 0; i < 200 && !existsSync(reportPath) && child.exitCode === null; i++) await delay(100);
      expect(existsSync(reportPath), stderr).toBe(true);
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      child.kill();
      await assertClean(report);
    } finally { if (child.exitCode === null) child.kill(); }
  }, 35_000);
});
