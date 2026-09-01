#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Attach GitHub trusted publishing (OIDC) for every public workspace package
 * that already exists on npm. Same ritual as the other @lofcz monorepos.
 *
 * Prerequisites: npm >= 11.15, account 2FA, interactive `npm login`.
 *
 * Usage:
 *   pnpm trust:packages
 *   pnpm trust:packages --dry-run
 *   pnpm trust:packages --only @lofcz/streamdown-plantuml
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "lofcz/streamdown-ng";
const WORKFLOW_FILE = "release.yml";
const GITHUB_RE = /github/i;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIndex = args.indexOf("--only");
const only = onlyIndex === -1 ? null : args[onlyIndex + 1];

function npmEnv() {
  const {
    NPM_TOKEN: _npmToken,
    NODE_AUTH_TOKEN: _nodeAuthToken,
    ...env
  } = process.env;
  return env;
}

function listPublicPackages() {
  const names = [];
  for (const entry of readdirSync(path.join(ROOT, "packages"), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pkgPath = path.join(ROOT, "packages", entry.name, "package.json");
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }
    if (!pkg.name || pkg.private) {
      continue;
    }
    names.push(pkg.name);
  }
  names.sort();
  return only ? names.filter((n) => n === only) : names;
}

function packageExists(name) {
  const result = spawnSync("npm", ["view", name, "name"], {
    encoding: "utf8",
    env: npmEnv(),
  });
  return result.status === 0 && (result.stdout || "").trim().length > 0;
}

function hasDesiredTrust(name) {
  const result = spawnSync("npm", ["trust", "list", name, "--json"], {
    encoding: "utf8",
    env: npmEnv(),
  });
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0 && !raw.trim()) {
    return false;
  }
  return (
    raw.includes(REPO) && (raw.includes(WORKFLOW_FILE) || GITHUB_RE.test(raw))
  );
}

if (process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN) {
  console.error(
    "NPM_TOKEN / NODE_AUTH_TOKEN is set. Clear them and use interactive npm login."
  );
  process.exit(1);
}
if (!(process.stdin.isTTY || dryRun)) {
  console.error("Run from an interactive terminal so npm can complete 2FA.");
  process.exit(1);
}

const names = listPublicPackages();
if (only && names.length === 0) {
  console.error(`No public workspace package named ${only}`);
  process.exit(1);
}

console.log(
  `Configuring GitHub trusted publisher for ${names.length} package(s)`
);
console.log(`  repo:     ${REPO}`);
console.log(`  workflow: .github/workflows/${WORKFLOW_FILE}`);
console.log(`  dry-run:  ${dryRun}`);
console.log("");

const ok = [];
const skipped = [];
const failed = [];

for (const name of names) {
  if (!packageExists(name)) {
    skipped.push(
      `${name} (not on npm yet — run pnpm bootstrap:package ${name})`
    );
    console.log(`↩ skip (not on registry): ${name}`);
    continue;
  }
  if (hasDesiredTrust(name)) {
    skipped.push(`${name} (already configured)`);
    console.log(`↩ skip (already trusted): ${name}`);
    continue;
  }

  const argv = [
    "trust",
    "github",
    name,
    "--file",
    WORKFLOW_FILE,
    "--repo",
    REPO,
    "--allow-publish",
  ];
  if (dryRun) {
    argv.push("--dry-run");
  }

  console.log(`\n→ npm ${argv.join(" ")}`);
  if (dryRun) {
    ok.push(name);
    continue;
  }

  const result = spawnSync("npm", argv, {
    stdio: "inherit",
    env: npmEnv(),
  });
  if (result.status === 0 || hasDesiredTrust(name)) {
    ok.push(name);
  } else {
    failed.push(name);
    console.error(`✖ failed: ${name}`);
  }
}

console.log("\n=== trusted publishing setup summary ===");
console.log(JSON.stringify({ ok, skipped, failed }, null, 2));
if (failed.length) {
  process.exit(1);
}
