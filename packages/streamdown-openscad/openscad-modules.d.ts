declare module "@lofcz/openscad-wasm" {
  interface WasmFs {
    mkdir(path: string): void;
    readFile(path: string, opts: { encoding: "binary" }): Uint8Array;
    writeFile(path: string, data: string | ArrayBufferView): void;
  }

  interface WasmInstance {
    callMain(args: string[]): number;
    ENV?: Record<string, string>;
    FS: WasmFs;
  }

  interface WasmOptions {
    noInitialRun?: boolean;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
    [key: string]: unknown;
  }

  const createOpenSCAD: (options?: WasmOptions) => Promise<WasmInstance>;

  export default createOpenSCAD;
}

declare module "@lofcz/openscad-wasm/fonts" {
  import type { OpenScadWasmInstance } from "./index";
  export function addFonts(instance: OpenScadWasmInstance): void;
}

declare module "@lofcz/openscad-wasm/mcad" {
  import type { OpenScadWasmInstance } from "./index";
  export function addMCAD(instance: OpenScadWasmInstance): void;
}
