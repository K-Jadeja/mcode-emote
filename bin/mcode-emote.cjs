#!/usr/bin/env node
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");
import(pathToFileURL(resolve(__dirname, "../dist/mcode/launcher.js")).href).catch(() => {
  console.error("[mcode-emote] Build is missing. Run npm run build first.");
  process.exitCode = 1;
});
