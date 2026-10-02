import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const labels = new URL("../../.tmp/overlay-labels/", import.meta.url);
await mkdir(labels, { recursive: true });
await writeFile(fileURLToPath(new URL(`${process.pid}.json`, labels)), JSON.stringify({ label: process.env.CLAUDE_EMOTE_SESSION_LABEL ?? null }));
const response = await fetch(new URL("/overlay-ready", process.env.CLAUDE_EMOTE_ENDPOINT), {
  method: "POST", headers: { authorization: `Bearer ${process.env.CLAUDE_EMOTE_CAPABILITY_TOKEN}` },
});
if (!response.ok) process.exit(9);
setInterval(async () => {
  try {
    const response = await fetch(new URL("/state", process.env.CLAUDE_EMOTE_ENDPOINT), {
      headers: { authorization: `Bearer ${process.env.CLAUDE_EMOTE_CAPABILITY_TOKEN}` }, signal: AbortSignal.timeout(500),
    });
    if (!response.ok) process.exit(1);
  } catch { process.exit(0); }
}, 250);
