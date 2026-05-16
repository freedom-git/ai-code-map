#!/usr/bin/env node
// Register the skills hosted in this repo as Claude Code / Copilot CLI skills
// by symlinking each one into the agent's skills directory.
//
// Usage:
//   node scripts/register.mjs
//   node scripts/register.mjs --target=claude
//   node scripts/register.mjs --target=copilot
//   node scripts/register.mjs --target=both         (default)
//   node scripts/register.mjs --skill=code-flow     register just one skill
//   node scripts/register.mjs --force               replace an existing link
//   node scripts/register.mjs --dry-run             print actions, do nothing
//
// On Windows we use a directory junction (no admin / Developer Mode needed).
// On macOS / Linux we use a regular directory symlink.

import { existsSync } from "node:fs";
import { lstat, mkdir, readlink, realpath, symlink, unlink } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = platform() === "win32";
const LINK_TYPE = IS_WINDOWS ? "junction" : "dir";

// Each skill in this repo gets one junction per target agent.
// `source` is the directory the junction points at, relative to REPO_ROOT.
const SKILLS = [
  { name: "code-insight", source: "skills/code-insight" },
  { name: "code-flow", source: "skills/code-flow" },
];

const TARGET_DIRS = {
  claude: join(homedir(), ".claude", "skills"),
  copilot: join(homedir(), ".copilot", "skills"),
};

function parseArgs(argv) {
  const opts = { target: "both", skill: null, force: false, dryRun: false };
  for (const arg of argv) {
    if (arg === "--force") opts.force = true;
    else if (arg === "--dry-run") opts.dryRun = true;
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
  console.log(`Register skills from this repo as Claude / Copilot CLI skills.

Skills in this repo: ${skillList}

Usage:
  node scripts/register.mjs [--target=claude|copilot|both]
                            [--skill=<name>]
                            [--force] [--dry-run]

Default target is "both" and all skills are registered. --skill=<name> restricts
the run to a single skill. --force replaces an existing symlink (never a real
directory). --dry-run prints planned actions without touching the filesystem.`);
}

// Resolve the real path a symlink/junction points at, or null if it's a real
// directory / file (i.e. not something this script created).
async function readLinkTarget(path) {
  let stat;
  try {
    stat = await lstat(path);
  } catch {
    return null;
  }
  // On POSIX, symlinks report as such. On Windows, both symlinks and junctions
  // report isSymbolicLink() === true via lstat().
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

async function registerOne(label, parentDir, skill, opts) {
  const linkPath = join(parentDir, skill.name);
  const sourcePath = resolve(REPO_ROOT, skill.source);

  if (!existsSync(sourcePath)) {
    console.error(`✗ ${label}/${skill.name}: source directory missing → ${sourcePath}`);
    return false;
  }

  let stat;
  try {
    stat = await lstat(linkPath);
  } catch {
    stat = null;
  }

  if (stat) {
    const linkTarget = await readLinkTarget(linkPath);
    if (linkTarget && (await pathsEqual(linkTarget, sourcePath))) {
      console.log(`✓ ${label}/${skill.name}: already linked → ${linkPath}`);
      return true;
    }
    if (linkTarget) {
      // Symlink/junction pointing somewhere else.
      if (!opts.force) {
        console.error(
          `✗ ${label}/${skill.name}: ${linkPath} already exists and points at ${linkTarget}.\n` +
            `  Use --force to replace it.`,
        );
        return false;
      }
      console.log(`↻ ${label}/${skill.name}: removing stale link → ${linkTarget}`);
      if (!opts.dryRun) await unlink(linkPath);
    } else {
      // Real directory or file — refuse to touch it, even with --force.
      console.error(
        `✗ ${label}/${skill.name}: ${linkPath} exists and is NOT a symlink.\n` +
          `  Refusing to delete real data. Move or remove it manually first.`,
      );
      return false;
    }
  }

  if (!existsSync(parentDir)) {
    console.log(`+ ${label}: creating ${parentDir}`);
    if (!opts.dryRun) await mkdir(parentDir, { recursive: true });
  }

  console.log(`→ ${label}/${skill.name}: ${linkPath}  →  ${sourcePath}  (${LINK_TYPE})`);
  if (!opts.dryRun) {
    try {
      await symlink(sourcePath, linkPath, LINK_TYPE);
    } catch (err) {
      console.error(`✗ ${label}/${skill.name}: failed to create link: ${err.message}`);
      if (IS_WINDOWS && err.code === "EPERM") {
        console.error(
          "  Hint: Windows directory junctions normally don't need admin.\n" +
            "        Try running this script from a non-elevated PowerShell.",
        );
      }
      return false;
    }
  }
  console.log(`✓ ${label}/${skill.name}: linked.`);
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

  console.log(`Registering ${skills.length} skill(s) from ${REPO_ROOT}`);
  if (opts.dryRun) console.log("(dry run — no changes will be made)");

  let allOk = true;
  for (const t of targets) {
    for (const skill of skills) {
      const ok = await registerOne(t, TARGET_DIRS[t], skill, opts);
      if (!ok) allOk = false;
    }
  }
  process.exit(allOk ? 0 : 1);
}

await main();
