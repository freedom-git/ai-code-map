#!/usr/bin/env node
// Unregister the skills hosted in this repo by removing the symlinks created
// by scripts/register.mjs.
//
// Usage:
//   node scripts/unregister.mjs
//   node scripts/unregister.mjs --target=claude
//   node scripts/unregister.mjs --target=copilot
//   node scripts/unregister.mjs --target=both        (default)
//   node scripts/unregister.mjs --skill=code-flow    unregister just one skill
//   node scripts/unregister.mjs --dry-run            print actions, do nothing
//
// Safety: a path is only removed if it is a symlink/junction that actually
// points at one of this repo's skill directories. Real directories and links
// pointing elsewhere are left untouched.

import { lstat, readlink, realpath, unlink } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = platform() === "win32";

// Mirror of the SKILLS list in register.mjs — keep them in sync.
const SKILLS = [
  { name: "code-insight", source: "skills/code-insight" },
  { name: "code-flow", source: "skills/code-flow" },
];

const TARGET_DIRS = {
  claude: join(homedir(), ".claude", "skills"),
  copilot: join(homedir(), ".copilot", "skills"),
};

function parseArgs(argv) {
  const opts = { target: "both", skill: null, dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--target=")) opts.target = arg.slice("--target=".length);
    else if (arg.startsWith("--skill=")) opts.skill = arg.slice("--skill=".length);
    else if (arg === "-h" || arg === "--help") opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["claude", "copilot", "both"].includes(opts.target)) {
    throw new Error(`--target must be claude|copilot|both (got: ${opts.target})`);
  }
  if (opts.skill && !SKILLS.some((s) => s.name === opts.skill)) {
    const known = SKILLS.map((s) => s.name).join(", ");
    throw new Error(`--skill must be one of: ${known} (got: ${opts.skill})`);
  }
  return opts;
}

function printHelp() {
  const skillList = SKILLS.map((s) => s.name).join(", ");
  console.log(`Unregister skills hosted in this repo.

Skills in this repo: ${skillList}

Usage:
  node scripts/unregister.mjs [--target=claude|copilot|both]
                              [--skill=<name>]
                              [--dry-run]

Default target is "both" and all skills are unregistered. --skill=<name>
restricts the run to a single skill. --dry-run prints planned actions without
touching the filesystem. The script only removes symlinks/junctions that
actually point at this repo's skill directories.`);
}

async function readLinkTarget(path) {
  let stat;
  try {
    stat = await lstat(path);
  } catch {
    return null;
  }
  if (!stat.isSymbolicLink()) return null;
  try {
    return await realpath(path);
  } catch {
    try {
      const linked = await readlink(path);
      return resolve(dirname(path), linked);
    } catch {
      return null;
    }
  }
}

async function pathsEqual(a, b) {
  try {
    const ra = await realpath(a);
    const rb = await realpath(b);
    return ra.toLowerCase() === rb.toLowerCase();
  } catch {
    return resolve(a).toLowerCase() === resolve(b).toLowerCase();
  }
}

async function unregisterOne(label, parentDir, skill, opts) {
  const linkPath = join(parentDir, skill.name);
  const sourcePath = resolve(REPO_ROOT, skill.source);

  let stat;
  try {
    stat = await lstat(linkPath);
  } catch {
    console.log(`✓ ${label}/${skill.name}: not linked (nothing to remove)`);
    return true;
  }

  const linkTarget = await readLinkTarget(linkPath);
  if (!linkTarget) {
    console.error(
      `✗ ${label}/${skill.name}: ${linkPath} exists and is NOT a symlink.\n` +
        `  Refusing to delete real data. Remove it manually if intended.`,
    );
    return false;
  }

  if (!(await pathsEqual(linkTarget, sourcePath))) {
    console.error(
      `✗ ${label}/${skill.name}: ${linkPath} points at ${linkTarget}, not ${sourcePath}.\n` +
        `  Refusing to remove a link this script didn't create.`,
    );
    return false;
  }

  console.log(`→ ${label}/${skill.name}: removing ${linkPath}`);
  if (!opts.dryRun) {
    try {
      await unlink(linkPath);
    } catch (err) {
      console.error(`✗ ${label}/${skill.name}: failed to remove link: ${err.message}`);
      return false;
    }
  }
  console.log(`✓ ${label}/${skill.name}: unregistered.`);
  return true;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    printHelp();
    process.exit(2);
  }
  if (opts.help) {
    printHelp();
    return;
  }

  const targets = opts.target === "both" ? ["claude", "copilot"] : [opts.target];
  const skills = opts.skill ? SKILLS.filter((s) => s.name === opts.skill) : SKILLS;

  console.log(`Unregistering ${skills.length} skill(s) (repo: ${REPO_ROOT})`);
  if (opts.dryRun) console.log("(dry run — no changes will be made)");

  let allOk = true;
  for (const t of targets) {
    for (const skill of skills) {
      const ok = await unregisterOne(t, TARGET_DIRS[t], skill, opts);
      if (!ok) allOk = false;
    }
  }
  process.exit(allOk ? 0 : 1);
}

await main();
