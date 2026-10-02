import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { archivePreviousRuntimes } from "../../src/mcode/plugin.js";

it("moves previous payloads outside the scanned package without deleting them or touching the active revision", async () => {
  const profile = resolve(".tmp", `plugin-update-${randomUUID()}`);
  const root = join(profile, "plugins", "mcode-emote");
  const previous = randomUUID(), current = randomUUID();
  for (const revision of [previous, current, "user-notes"]) {
    await mkdir(join(root, "runtime", revision), { recursive: true });
    await writeFile(join(root, "runtime", revision, "keep.txt"), revision);
  }
  await archivePreviousRuntimes(root, current);
  expect((await readdir(join(root, "runtime"))).sort()).toEqual([current, "user-notes"].sort());
  const archives = await readdir(join(profile, "mcode-emote-archive"));
  expect(archives).toHaveLength(1);
  expect(await readFile(join(profile, "mcode-emote-archive", archives[0], previous, "keep.txt"), "utf8")).toBe(previous);
  expect(await readFile(join(root, "runtime", current, "keep.txt"), "utf8")).toBe(current);
  await archivePreviousRuntimes(root, current);
  expect(await readdir(join(profile, "mcode-emote-archive"))).toEqual(archives);
});
