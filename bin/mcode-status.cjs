// Stable entry point; each plugin update atomically selects its runtime.
const { readFileSync } = require("node:fs");
const { dirname, resolve, sep } = require("node:path");
const { pathToFileURL } = require("node:url");
const manifest = JSON.parse(readFileSync(resolve(__dirname, ".claude-plugin/plugin.json"), "utf8"));
const hook = manifest.hooks.hooks.SessionStart[0].hooks[0].args[0];
const bridge = resolve(dirname(hook.replace("${PLUGIN_ROOT}", __dirname)), "status-bridge.js");
if (!bridge.startsWith(resolve(__dirname) + sep)) throw new Error("Invalid title bridge path");
import(pathToFileURL(bridge).href).catch(() => { process.stderr.write("[mcode-emote] Title bridge could not start.\n"); process.exitCode = 1; });
