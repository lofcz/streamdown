/**
 * Before `changeset publish` under npm OIDC trusted publishing, unauthenticated
 * `npm info` often 404s for scoped packages. Changesets then treats every
 * workspace package as unpublished and retries versions that already exist —
 * those publishes fail and the release job exits non-zero even when the new
 * package(s) published fine.
 *
 * Mark already-published packages as `private: true` in this CI checkout so
 * changesets skips them. Edits are never committed.
 *
 * @see https://github.com/changesets/changesets/issues/2099
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const WORKSPACE_DIRS = ["packages", "apps"];

function packageJsonPaths() {
  const paths = [];
  for (const dir of WORKSPACE_DIRS) {
    const abs = join(ROOT, dir);
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      paths.push(join(abs, entry.name, "package.json"));
    }
  }
  return paths;
}

function versionOnNpm(name, version) {
  try {
    execFileSync(
      "npm",
      ["view", `${name}@${version}`, "version", "--registry", "https://registry.npmjs.org"],
      { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }
    );
    return true;
  } catch {
    return false;
  }
}

let skipped = 0;
let pending = 0;

for (const pkgPath of packageJsonPaths()) {
  let raw;
  try {
    raw = readFileSync(pkgPath, "utf8");
  } catch {
    continue;
  }

  const pkg = JSON.parse(raw);
  if (!pkg.name || pkg.private) continue;

  if (versionOnNpm(pkg.name, pkg.version)) {
    pkg.private = true;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`skip  ${pkg.name}@${pkg.version} (already on npm)`);
    skipped += 1;
  } else {
    console.log(`publish ${pkg.name}@${pkg.version}`);
    pending += 1;
  }
}

console.log(`\nReady: ${pending} to publish, ${skipped} skipped.`);
