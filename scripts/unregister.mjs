#!/usr/bin/env node
// Unregister this repo as a Claude Code / Copilot CLI skill by removing the
// symlinks created by scripts/register.mjs.
//
// Usage:
//   node scripts/unregister.mjs
//   node scripts/unregister.mjs --target=claude
//   node scripts/unregister.mjs --target=copilot
//   node scripts/unregister.mjs --target=both       (default)
//   node scripts/unregister.mjs --dry-run           print actions, do nothing
//
// Safety: a path is only removed if it is a symlink/junction that actually
// points at this repo. Real directories and links pointing elsewhere are
// left untouched.

import { lstat, readlink, realpath, unlink } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "code-insight";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = platform() === "win32";

const TARGET_DIRS = {
  claude: join(homedir(), ".claude", "skills"),
  copilot: join(homedir(), ".copilot", "skills"),
};

function parseArgs(argv) {
  const opts = { target: "both", dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
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
  console.log(`Unregister ${SKILL_NAME} from Claude / Copilot CLI.

Usage:
  node scripts/unregister.mjs [--target=claude|copilot|both] [--dry-run]

Default target is "both". --dry-run prints planned actions without touching
the filesystem. The script only removes symlinks/junctions that actually
point at this repo; real directories or links pointing elsewhere are left
untouched.`);
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

async function unregisterOne(label, parentDir, opts) {
  const linkPath = join(parentDir, SKILL_NAME);

  let stat;
  try {
    stat = await lstat(linkPath);
  } catch {
    console.log(`✓ ${label}: not linked (nothing to remove)`);
    return true;
  }

  const linkTarget = await readLinkTarget(linkPath);
  if (!linkTarget) {
    console.error(
      `✗ ${label}: ${linkPath} exists and is NOT a symlink.\n` +
        `  Refusing to delete real data. Remove it manually if intended.`,
    );
    return false;
  }

  if (!(await pathsEqual(linkTarget, REPO_ROOT))) {
    console.error(
      `✗ ${label}: ${linkPath} points at ${linkTarget}, not this repo.\n` +
        `  Refusing to remove a link this script didn't create.`,
    );
    return false;
  }

  console.log(`→ ${label}: removing ${linkPath}`);
  if (!opts.dryRun) {
    try {
      await unlink(linkPath);
    } catch (err) {
      console.error(`✗ ${label}: failed to remove link: ${err.message}`);
      return false;
    }
  }
  console.log(`✓ ${label}: unregistered.`);
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

  console.log(`Unregistering '${SKILL_NAME}' (repo: ${REPO_ROOT})`);
  if (opts.dryRun) console.log("(dry run — no changes will be made)");

  let allOk = true;
  for (const t of targets) {
    const ok = await unregisterOne(t, TARGET_DIRS[t], opts);
    if (!ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

await main();
