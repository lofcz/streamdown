import { spawnSync } from "node:child_process";
import { join } from "node:path";

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const localBin = (name) => join(process.cwd(), "node_modules", ".bin", name);

export const execTsup = (args) => run(localBin("tsup"), args);

export const execTsc = (args) => run(localBin("tsc"), args);
