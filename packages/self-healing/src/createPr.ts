import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CommandRunner, FixProposal, PrResult } from "./types.js";

const execFileAsync = promisify(execFile);

const defaultRunner: CommandRunner = async (command, args) => {
  const { stdout } = await execFileAsync(command, args);
  return stdout;
};

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "issue";
}

export async function createPr(fix: FixProposal, runner: CommandRunner = defaultRunner): Promise<PrResult> {
  const branch = `fix/${slug(fix.category)}-${Date.now().toString(36)}`;
  const title = `fix: ${fix.summary}`.slice(0, 100);
  const plan: [string, string[]][] = [
    ["git", ["checkout", "-b", branch]],
    ["git", ["add", "-A"]],
    ["git", ["commit", "-m", title]],
    ["gh", ["pr", "create", "--fill", "--head", branch]],
  ];

  const commands: string[] = [];
  for (const [command, args] of plan) {
    const joined = [command, ...args].join(" ");
    // Block an actual merge subcommand (git merge / gh ... merge) — but NOT a commit message that merely contains the word.
    const isMerge = (command === "git" && args[0] === "merge") || (command === "gh" && args.includes("merge"));
    if (isMerge) {
      throw new Error(`createPr refuses to run a merge command: ${joined}`);
    }
    await runner(command, args);
    commands.push(joined);
  }

  return { branch, commands, merged: false };
}
