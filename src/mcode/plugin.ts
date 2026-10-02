import { mkdir, readFile, writeFile, copyFile, rename, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { PROJECT_ROOT } from "../launcher/args.js";
import { mcodeJson, type MCodeCommand } from "./cli.js";
import { MCODE_EVENTS } from "./events.js";

export async function archivePreviousRuntimes(root: string, current: string): Promise<void> {
  const runtimeRoot = resolve(root, "runtime");
  const old = (await readdir(runtimeRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^[0-9a-f-]{36}$/i.test(entry.name) && entry.name !== current);
  if (!old.length) return;
  // Outside the discoverable plugin tree: MCode caps a package at 64 MiB.
  // MCode runs hooks from its own immutable snapshot, so running sessions keep
  // their original payload. Preserve prior source revisions for inspection.
  const archiveRoot = resolve(root, "..", "..", "mcode-emote-archive");
  const archive = join(archiveRoot, randomUUID());
  await mkdir(archive, { recursive: true });
  for (const entry of old) {
    const source = resolve(runtimeRoot, entry.name);
    const destination = resolve(archive, entry.name);
    if (!source.startsWith(runtimeRoot + sep) || !destination.startsWith(archiveRoot + sep)) throw new Error("Plugin archive path escaped its owned directory");
    await rename(source, destination);
  }
}

export async function installPlugin(command: MCodeCommand): Promise<string> {
  const sources = await mcodeJson(command, ["plugin", "marketplace", "list"]);
  const local = sources.find((s: any) => s.name === "local" && s.kind === "directory");
  if (!local || typeof local.path !== "string") throw new Error("MCode did not report a local plugin directory");
  const root = join(local.path, "mcode-emote");
  const manifestPath = join(root, ".claude-plugin", "plugin.json");
  if (existsSync(root)) {
    let marker;
    try { marker = await readFile(join(root, ".mcode-emote-owner"), "utf8"); } catch {}
    if (marker !== "mcode-emote-v1\n") throw new Error(`Refusing to overwrite an existing unmanaged plugin: ${root}`);
  }
  // MCode's compatible reader supports exec-form args; native format only
  // supports shell commands. Exec form preserves direct-parent process binding.
  const oldNative = join(root, ".minimax-plugin", "plugin.json");
  if (existsSync(oldNative)) await rename(oldNative, `${oldNative}.disabled-${randomUUID()}`);
  await mkdir(join(root, ".claude-plugin"), { recursive: true });
  await mkdir(join(root, "dist", "mcode"), { recursive: true });
  await writeFile(join(root, ".mcode-emote-owner"), "mcode-emote-v1\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ private: true, type: "module" }));
  await copyFile(join(PROJECT_ROOT, "bin", "mcode-status.cjs"), join(root, "mcode-status.cjs"));
  // Immutable payloads let existing sessions finish while an update activates.
  const revision = randomUUID();
  const runtime = join(root, "runtime", revision);
  await mkdir(runtime, { recursive: true });
  await cp(join(PROJECT_ROOT, "dist"), join(runtime, "dist"), { recursive: true });
  const nativeRoot = join(runtime, "desktop", "dist", "claude-pet");
  await mkdir(nativeRoot, { recursive: true });
  for (const name of ["claude-pet-win_x64.exe", "resources.neu"]) {
    await copyFile(join(PROJECT_ROOT, "desktop", "dist", "claude-pet", name), join(nativeRoot, name));
  }
  await copyFile(join(PROJECT_ROOT, "emotes", "default", "idle", "idle.png"), join(root, "icon.png"));
  for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) await copyFile(join(PROJECT_ROOT, name), join(root, name));
  const hooks = Object.fromEntries(MCODE_EVENTS.map(event => [event, [{ hooks: [{
    type: "command", command: process.execPath,
    args: [`\${PLUGIN_ROOT}/runtime/${revision}/dist/mcode/hook-bridge.js`, "--auto"], timeout: 10,
  }] }]]));
  await writeFile(join(root, "hooks.json"), JSON.stringify({ hooks }, null, 2));
  const manifest = { name: "mcode-emote", version: "0.3.0",
    description: "An animated companion that starts automatically with MCode sessions.",
    author: { name: "K-Jadeja" }, hooks: { hooks } };
  const temp = `${manifestPath}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(manifest, null, 2));
  await rename(temp, manifestPath);
  await archivePreviousRuntimes(root, revision);
  await mcodeJson(command, ["plugin", "enable", "mcode-emote@local"]);
  return root;
}

export async function requirePlugin(command: MCodeCommand): Promise<void> {
  const list = await mcodeJson(command, ["plugin", "list", "--marketplace", "local"]);
  const entry = list.installed?.find((p: any) => p.name === "mcode-emote");
  if (!entry || entry.enabled !== true) throw new Error("MCode Emote plugin is missing or disabled. Run mcode-emote --emote-install.");
}
