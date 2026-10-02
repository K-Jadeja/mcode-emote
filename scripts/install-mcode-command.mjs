#!/usr/bin/env node
// Use npm's own shim generator; install only mcode-emote, not claude-emote.
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

if (!process.env.npm_execpath) throw new Error("Run this through npm run mcode:install-command");
const require = createRequire(process.env.npm_execpath);
const cmdShim = require("cmd-shim");
const { stdout } = await promisify(execFile)(process.execPath, [process.env.npm_execpath, "prefix", "-g"]);
const directory = process.platform === "win32" ? stdout.trim() : join(stdout.trim(), "bin");
const target = join(directory, "mcode-emote");
for (const suffix of ["", ".cmd", ".ps1"]) {
  if (existsSync(target + suffix)) throw new Error(`A command already exists at ${target + suffix}; it was not overwritten.`);
}
await cmdShim(resolve(import.meta.dirname, "../bin/mcode-emote.cjs"), target);
console.log(`Installed mcode-emote in ${directory}. Keep this checkout in place.`);
