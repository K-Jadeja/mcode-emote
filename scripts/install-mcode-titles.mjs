import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { parseDocument } from "yaml";
import { resolveMCode, mcodeJson } from "../dist/mcode/cli.js";

const sources = await mcodeJson(resolveMCode(), ["plugin", "marketplace", "list"]);
const local = sources.find(source => source.name === "local" && source.kind === "directory");
if (!local?.path) throw new Error("Active profile plugin directory not found");
const bridge = join(local.path, "mcode-emote", "mcode-status.cjs");
await readFile(bridge);
if (/[%!"'\r\n]/.test(bridge)) throw new Error("Status command path contains unsupported shell characters");
// MCode tokenizes first, then invokes cmd on Windows. Preserve the inner
// quotes through that first tokenizer so spaces remain one shell argument.
const command = process.platform === "win32" ? `node '"${bridge}"'` : `node "${bridge}"`;
const configPath = join(dirname(local.path), "config.yaml");
const before = await readFile(configPath, "utf8");
const document = parseDocument(before);
if (document.errors.length) throw new Error("MCode config is invalid; refusing to modify it");
const previous = document.getIn(["tui", "customStatusLine", "command"]);
if (previous && previous !== command) throw new Error("A custom status command already exists; refusing to replace it");
let items = document.getIn(["tui", "statusLine"])?.toJSON();
if (items && (!Array.isArray(items) || items.some(item => typeof item !== "string"))) throw new Error("Invalid statusLine configuration");
if (items?.some(item => ["build-mode", "status-protocol", "vela"].includes(item))) throw new Error("Build-mode disables status commands; resolve that preference before enabling titles");
items ??= ["current-dir", "session-title", "git-branch", "review-link", "plan-mode", "approval-mode", "model-with-reasoning", "context-window", "subagent", "token-quota", "context-remaining"];
if (!items.includes("custom-command")) items.push("custom-command");
document.setIn(["tui", "statusLine"], items);
document.setIn(["tui", "customStatusLine", "command"], command);
document.setIn(["tui", "customStatusLine", "intervalSeconds"], 10);
document.setIn(["tui", "customStatusLine", "timeoutMs"], 5000);
const after = document.toString();
const unmanaged = value => {
  const copy = structuredClone(value);
  if (copy.tui) {
    delete copy.tui.statusLine;
    if (copy.tui.customStatusLine) {
      for (const key of ["command", "intervalSeconds", "timeoutMs"]) delete copy.tui.customStatusLine[key];
      if (!Object.keys(copy.tui.customStatusLine).length) delete copy.tui.customStatusLine;
    }
    if (!Object.keys(copy.tui).length) delete copy.tui;
  }
  return copy;
};
if (!isDeepStrictEqual(unmanaged(parseDocument(before).toJS()), unmanaged(parseDocument(after).toJS()))) throw new Error("Unrelated config changed; refusing title setup");
if (before !== after) {
  await copyFile(configPath, `${configPath}.before-emote-titles-${randomUUID()}`);
  const temporary = `${configPath}.${randomUUID()}.tmp`;
  await writeFile(temporary, after, { mode: 0o600, flag: "wx" });
  if (await readFile(configPath, "utf8") !== before) throw new Error("MCode settings changed during title setup; retry after inspection");
  await rename(temporary, configPath);
}
console.log("Chat-title bridge enabled. Existing settings preserved; no model request made. Restart MCode to load it.");
