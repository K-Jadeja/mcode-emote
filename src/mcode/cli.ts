import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";

export interface MCodeCommand { executable: string; args: string[]; }
export function resolveMCode(env: NodeJS.ProcessEnv = process.env): MCodeCommand {
  const candidates = env.MCODE_EMOTE_EXE ? [resolve(env.MCODE_EMOTE_EXE)] :
    (env.PATH ?? "").split(delimiter).flatMap(dir => dir ? [join(dir, "mcode"), join(dir, "mcode.exe"), join(dir, "mcode.cmd")] : []);
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    if (/\.(?:cjs|mjs|js)$/i.test(file)) return { executable: process.execPath, args: [file] };
    if (/\.cmd$/i.test(file)) {
      const cli = join(dirname(file), "node_modules", "@minimax-ai", "code", "cli.js");
      if (existsSync(cli)) return { executable: process.execPath, args: [cli] };
      throw new Error("Unsupported MCode command shim. Set MCODE_EMOTE_EXE to the installed cli.js or native executable.");
    }
    // npm's extensionless Windows shell shim is not an executable.
    if (process.platform === "win32" && !/\.exe$/i.test(file)) continue;
    return { executable: file, args: [] };
  }
  throw new Error("MCode was not found on PATH. Install @minimax-ai/code first.");
}
export async function mcodeJson(command: MCodeCommand, args: string[]): Promise<any> {
  const { stdout } = await promisify(execFile)(command.executable, [...command.args, ...args, "--json"], {
    windowsHide: true, timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}
export function spawnMCode(command: MCodeCommand, args: string[], env = process.env): ChildProcess {
  return spawn(command.executable, [...command.args, ...args], { stdio: "inherit", env, shell: false });
}
