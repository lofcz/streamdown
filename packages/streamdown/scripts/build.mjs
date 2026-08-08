import { rmSync } from "node:fs";
import { join } from "node:path";
import { execTsc, execTsup } from "../../../scripts/build-lib.mjs";

rmSync(join(process.cwd(), "dist"), { recursive: true, force: true });
execTsup(["--config", "tsup.config.ts"]);
execTsc([
  "-p",
  "tsconfig.build.json",
  "--declaration",
  "--emitDeclarationOnly",
  "--outDir",
  "dist",
]);
