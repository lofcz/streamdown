#!/usr/bin/env node
/**
 * First-time name claim for a new workspace package, then attach GitHub
 * trusted publishing so later `release.yml` OIDC publishes work like the
 * rest of the monorepo.
 *
 * npm cannot attach a trusted publisher to a name that does not exist yet,
 * and CI has no long-lived token. So a brand-new package is born in two
 * steps, both interactive (your npm login + 2FA OTP, never a token):
 *
 *   1. Publish a tiny claim stub (`0.0.0-bootstrap.0`, dist-tag `bootstrap`)
 *      from a temp directory (keeps any repo auth env out of the session).
 *   2. `npm trust github` for `lofcz/streamdown-ng` + `release.yml`.
 *
 * Usage:
 *   pnpm bootstrap:package @lofcz/streamdown-plantuml
 *   pnpm bootstrap:package @lofcz/streamdown-plantuml --dry-run
 *   pnpm bootstrap:package @lofcz/streamdown-plantuml --no-trust
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_REPO = "lofcz/streamdown-ng";
const CANONICAL_REPO_URL = `git+https://github.com/${CANONICAL_REPO}.git`;
const WORKFLOW_FILE = "release.yml";
const STUB_VERSION = "0.0.0-bootstrap.0";
const STUB_TAG = "bootstrap";

function fail(lines) {
  console.error(
    ["✖ bootstrap aborted (scripts/bootstrap-package.mjs):", ...lines].join("\n")
  );
  process.exit(1);
}

function npmEnv() {
  const env = { ...process.env };
  delete env.NPM_TOKEN;
  delete env.NODE_AUTH_TOKEN;
  return env;
}

function whoami(cwd) {
  const result = spawnSync("npm", ["whoami"], {
    cwd,
    encoding: "utf8",
    env: npmEnv(),
  });
  const name = (result.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop();
  return result.status === 0 && name ? name : "";
}

function ensureLogin(cwd) {
  let user = whoami(cwd);
  if (user) {
    console.log(`✔ npm session: ${user}`);
    return user;
  }
  if (!process.stdin.isTTY) {
    fail([
      "  npm whoami is 401 — the token in ~/.npmrc is invalid or expired.",
      "  npm masks that as 404 when creating a new scoped package.",
      "  Run `npm login` as the account that owns the @lofcz scope, then retry.",
    ]);
  }
  console.log(
    "npm whoami failed (401). Starting npm login — use the account that owns @lofcz.\n"
  );
  const login = spawnSync("npm", ["login"], {
    cwd,
    stdio: "inherit",
    env: npmEnv(),
  });
  if (login.status !== 0) {
    fail(["  npm login failed."]);
  }
  user = whoami(cwd);
  if (!user) {
    fail(["  still not logged in after npm login."]);
  }
  console.log(`✔ npm session: ${user}`);
  return user;
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipTrust = args.includes("--no-trust");
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.log(
    "Usage: pnpm bootstrap:package <@scope/name | workspace/dir> [--dry-run] [--no-trust]"
  );
  process.exit(args.length === 0 ? 1 : 0);
}
if (process.env.CI) {
  fail([
    "  this is a local human ritual (interactive 2FA OTP); it must not run in CI.",
  ]);
}
if (process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN) {
  fail([
    "  NPM_TOKEN / NODE_AUTH_TOKEN is set. Clear them and use interactive npm login.",
  ]);
}

const projects = JSON.parse(
  execFileSync("pnpm", ["ls", "-r", "--depth", "-1", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
).filter((p) => p.name && p.path);

const project = target.startsWith("@")
  ? projects.find((p) => p.name === target)
  : projects.find((p) => path.resolve(root, target) === p.path);
if (!project) {
  fail([
    `  ${target} is not a workspace package (checked name and path).`,
    "  Create the package directory with its package.json first.",
  ]);
}

const manifest = JSON.parse(
  readFileSync(path.join(project.path, "package.json"), "utf8")
);
if (manifest.private === true) {
  fail([
    `  ${manifest.name} is private — private packages are never published or bootstrapped.`,
  ]);
}

const relDir = path.relative(root, project.path);
const repository = {
  type: "git",
  url: normalizeGitUrl(manifest.repository?.url ?? CANONICAL_REPO_URL),
  directory: manifest.repository?.directory ?? relDir,
};

const workDir = mkdtempSync(path.join(os.tmpdir(), "sd-bootstrap-"));
process.on("exit", () => rmSync(workDir, { recursive: true, force: true }));

ensureLogin(workDir);

const view = spawnSync("npm", ["view", manifest.name, "versions", "--json"], {
  cwd: workDir,
  encoding: "utf8",
  env: npmEnv(),
});
const missing =
  view.status !== 0 && /E404|not found/i.test(`${view.stderr}${view.stdout}`);
if (view.status === 0) {
  console.log(
    `✔ ${manifest.name} already exists on the registry — skipping claim stub.`
  );
  if (!skipTrust) {
    await attachTrust(manifest.name);
  } else {
    printTrustCommand(manifest.name);
  }
  process.exit(0);
}
if (!missing) {
  fail([
    `  could not determine whether ${manifest.name} exists on the registry:`,
    ...(view.stderr || "no error output")
      .trim()
      .split("\n")
      .map((l) => `    ${l}`),
  ]);
}

if (!process.stdin.isTTY && !dryRun) {
  fail(["  run from an interactive terminal so npm login / 2FA can prompt."]);
}

console.log(`
This will:
  1. Publish a name-claim stub  ${manifest.name}@${STUB_VERSION}
     dist-tag: ${STUB_TAG}  (not latest — real ${manifest.version} comes from CI)
  2. Attach GitHub trusted publisher
     repo:     ${CANONICAL_REPO}
     workflow: .github/workflows/${WORKFLOW_FILE}
     action:   npm publish

No NPM_TOKEN is used. npm will prompt for your login / 2FA OTP.
The stub is built in ${workDir}
`);

if (!dryRun) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("Type yes to continue: ")).trim().toLowerCase();
  rl.close();
  if (answer !== "yes") {
    fail(["  aborted."]);
  }
}

const stub = {
  name: manifest.name,
  version: STUB_VERSION,
  description: `${manifest.description ?? manifest.name} (name claim — real releases are published from CI via npm trusted publishing)`,
  license: manifest.license ?? "Apache-2.0",
  repository,
};
writeFileSync(path.join(workDir, "package.json"), `${JSON.stringify(stub, null, 2)}\n`);
writeFileSync(
  path.join(workDir, "README.md"),
  [
    `# ${manifest.name}`,
    "",
    `This version (\`${STUB_VERSION}\`, dist-tag \`${STUB_TAG}\`) is a name claim so npm`,
    "trusted publishing can be attached to the package. Real releases are published",
    `from CI: https://github.com/${CANONICAL_REPO} (${relDir}).`,
    "",
  ].join("\n")
);

console.log(
  `▸ publishing claim stub ${manifest.name}@${STUB_VERSION} (dist-tag: ${STUB_TAG})${
    dryRun ? " [dry-run]" : " — npm will prompt for your 2FA OTP"
  }`
);
const publish = spawnSync(
  "npm",
  [
    "publish",
    "--access",
    "public",
    "--tag",
    STUB_TAG,
    ...(dryRun ? ["--dry-run"] : []),
  ],
  { cwd: workDir, stdio: "inherit", env: npmEnv() }
);
if (publish.status !== 0) {
  fail([
    "  npm publish failed (see output above).",
    "  A 404 on PUT for a new @lofcz/* name is usually a 401: the npm session",
    "  cannot create packages in that scope. Run `npm login` as the @lofcz owner,",
    "  revoke any stale classic token in ~/.npmrc, then retry.",
  ]);
}

console.log(`✔ ${dryRun ? "dry-run complete for" : "claimed"} ${manifest.name}`);

if (skipTrust) {
  printTrustCommand(manifest.name);
} else if (dryRun) {
  console.log("\n[--dry-run] would now attach the trusted publisher.");
  printTrustCommand(manifest.name);
} else {
  await attachTrust(manifest.name);
}

console.log(
  [
    "",
    "Next: merge the changeset and let release.yml publish the real version",
    `(${manifest.name}@${manifest.version}) via OIDC, same as the other packages.`,
    "",
    `  gh workflow run Release --repo ${CANONICAL_REPO}`,
    "",
  ].join("\n")
);

function printTrustCommand(name) {
  console.log(
    [
      "",
      "Attach the trusted publisher (needs account 2FA; npm >= 11.15):",
      "",
      `  npm trust github ${name} \\`,
      `    --repo ${CANONICAL_REPO} \\`,
      `    --file ${WORKFLOW_FILE} \\`,
      "    --allow-publish",
      "",
    ].join("\n")
  );
}

async function attachTrust(name) {
  const list = spawnSync("npm", ["trust", "list", name, "--json"], {
    encoding: "utf8",
    env: npmEnv(),
  });
  const raw = `${list.stdout || ""}\n${list.stderr || ""}`;
  if (
    raw.includes(CANONICAL_REPO) &&
    (raw.includes(WORKFLOW_FILE) || /github/i.test(raw))
  ) {
    console.log(`✔ trusted publisher already attached for ${name}`);
    return;
  }

  console.log(
    `\n▸ npm trust github ${name} --repo ${CANONICAL_REPO} --file ${WORKFLOW_FILE} --allow-publish`
  );
  const trust = spawnSync(
    "npm",
    [
      "trust",
      "github",
      name,
      "--repo",
      CANONICAL_REPO,
      "--file",
      WORKFLOW_FILE,
      "--allow-publish",
    ],
    { stdio: "inherit", env: npmEnv() }
  );
  if (trust.status !== 0) {
    fail([
      "  npm trust github failed (see output above).",
      "  You can retry:",
      `    npm trust github ${name} --repo ${CANONICAL_REPO} --file ${WORKFLOW_FILE} --allow-publish`,
    ]);
  }
  console.log(`✔ trusted publisher attached for ${name}`);
}

function normalizeGitUrl(url) {
  let out = url;
  if (!out.startsWith("git+")) {
    out = `git+${out}`;
  }
  if (!out.endsWith(".git")) {
    out = `${out}.git`;
  }
  return out;
}
