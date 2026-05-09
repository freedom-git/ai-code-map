#!/usr/bin/env node
// Register this repo as a Claude Code / Copilot CLI skill by symlinking it
// into the agent's skills directory.
//
// Usage:
//   node scripts/register.mjs
//   node scripts/register.mjs --target=claude
//   node scripts/register.mjs --target=copilot
//   node scripts/register.mjs --target=both        (default)
//   node scripts/register.mjs --force              replace an existing link
//   node scripts/register.mjs --dry-run            print actions, do nothing
//
// On Windows we use a directory junction (no admin / Developer Mode needed).
// On macOS / Linux we use a regular directory symlink.

import { existsSync } from "node:fs";
import { lstat, mkdir, readlink, realpath, symlink, unlink } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "code-insight";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = platform() === "win32";
const LINK_TYPE = IS_WINDOWS ? "junction" : "dir";

const TARGET_DIRS = {
  claude: join(homedir(), ".claude", "skills"),
  copilot: join(homedir(), ".copilot", "skills"),
};

function parseArgs(argv) {
  const opts = { target: "both", force: false, dryRun: false };
  for (const arg of argv) {
    if (arg === "--force") opts.force = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--target=")) opts.target = arg.slice("--target=".length);
    else if (arg === "-h" || arg === "--help") opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["claude", "copilot", "both"].includes(opts.target)) {
    throw new Error(`--target must be claude|copilot|both (got: ${opts.target})`);
  }
  return opts;
}

function printHelp() {
  console.log(`Register ${SKILL_NAME} as a Claude / Copilot CLI skill.

Usage:
  node scripts/register.mjs [--target=claude|copilot|both] [--force] [--dry-run]

Default target is "both". --force replaces an existing symlink (never a real
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

async function registerOne(label, parentDir, opts) {
  const linkPath = join(parentDir, SKILL_NAME);
  let stat;
  try {
    stat = await lstat(linkPath);
  } catch {
    stat = null;
  }

  if (stat) {
    const linkTarget = await readLinkTarget(linkPath);
    if (linkTarget && (await pathsEqual(linkTarget, REPO_ROOT))) {
      console.log(`✓ ${label}: already linked → ${linkPath}`);
      return true;
    }
    if (linkTarget) {
      // Symlink/junction pointing somewhere else.
      if (!opts.force) {
        console.error(
          `✗ ${label}: ${linkPath} already exists and points at ${linkTarget}.\n` +
            `  Use --force to replace it.`,
        );
        return false;
      }
      console.log(`↻ ${label}: removing stale link → ${linkTarget}`);
      if (!opts.dryRun) await unlink(linkPath);
    } else {
      // Real directory or file — refuse to touch it, even with --force.
      console.error(
        `✗ ${label}: ${linkPath} exists and is NOT a symlink.\n` +
          `  Refusing to delete real data. Move or remove it manually first.`,
      );
      return false;
    }
  }

  if (!existsSync(parentDir)) {
    console.log(`+ ${label}: creating ${parentDir}`);
    if (!opts.dryRun) await mkdir(parentDir, { recursive: true });
  }

  console.log(`→ ${label}: ${linkPath}  →  ${REPO_ROOT}  (${LINK_TYPE})`);
  if (!opts.dryRun) {
    try {
      await symlink(REPO_ROOT, linkPath, LINK_TYPE);
    } catch (err) {
      console.error(`✗ ${label}: failed to create link: ${err.message}`);
      if (IS_WINDOWS && err.code === "EPERM") {
        console.error(
          "  Hint: Windows directory junctions normally don't need admin.\n" +
            "        Try running this script from a non-elevated PowerShell.",
        );
      }
      return false;
    }
  }
  console.log(`✓ ${label}: linked.`);
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

  console.log(`Registering '${SKILL_NAME}' from ${REPO_ROOT}`);
  if (opts.dryRun) console.log("(dry run — no changes will be made)");

  let allOk = true;
  for (const t of targets) {
    const ok = await registerOne(t, TARGET_DIRS[t], opts);
    if (!ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

await main();
