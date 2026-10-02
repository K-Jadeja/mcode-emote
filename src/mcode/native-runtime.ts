import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, link, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DesktopOverlayCommand } from "../launcher/desktop-overlay.js";

/** MCode's hashed plugin cache can exceed Windows' executable path limit. */
export async function prepareNativeRuntime(command: DesktopOverlayCommand, cache = join(homedir(), ".mcode-emote", "runtime")): Promise<DesktopOverlayCommand> {
  if (command.kind !== "packaged") return command;
  const names = ["claude-pet-win_x64.exe", "resources.neu"];
  const contents = await Promise.all(names.map(name => readFile(join(command.cwd, name))));
  const digest = createHash("sha256");
  for (const bytes of contents) digest.update(bytes);
  const cwd = join(cache, digest.digest("hex").slice(0, 24));
  await mkdir(cwd, { recursive: true, mode: 0o700 });
  for (const [index, name] of names.entries()) {
    const target = join(cwd, name);
    try {
      if (!(await readFile(target)).equals(contents[index])) throw new Error("MCode Emote native cache is corrupt; reinstall into a new cache after inspection");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, contents[index], { mode: 0o700, flag: "wx" });
      try {
        // Exclusive publication also works if another MCode process has
        // already launched this executable (Windows prevents replacing it).
        await link(temporary, target);
      } catch (publishError) {
        if ((publishError as NodeJS.ErrnoException).code !== "EEXIST") throw publishError;
        if (!(await readFile(target)).equals(contents[index])) throw new Error("MCode Emote native cache is corrupt");
      } finally { await unlink(temporary); }
    }
  }
  return { ...command, executable: join(cwd, names[0]), cwd };
}
