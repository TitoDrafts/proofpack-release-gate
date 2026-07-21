import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadProjectAlder } from "./proofpack-fixtures.ts";

const coreDirectory = fileURLToPath(new URL("../src/proofpack/", import.meta.url));

test("compiles with browser and Node network entry points replaced by throwing sentinels", async () => {
  const blocked = (): never => {
    throw new Error("NETWORK_SENTINEL_CALLED");
  };
  const names = ["fetch", "XMLHttpRequest", "WebSocket"] as const;
  const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const require = createRequire(import.meta.url);
  const http = require("node:http") as typeof import("node:http");
  const https = require("node:https") as typeof import("node:https");
  const originalHttp = { request: http.request, get: http.get };
  const originalHttps = { request: https.request, get: https.get };

  try {
    for (const name of names) {
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: blocked });
    }
    Object.assign(http, { request: blocked, get: blocked });
    Object.assign(https, { request: blocked, get: blocked });
    syncBuiltinESMExports();
    const importedHttp = await import("node:http");
    const importedHttps = await import("node:https");
    assert.throws(() => importedHttp.request("http://network.invalid"), /NETWORK_SENTINEL_CALLED/u);
    assert.throws(() => importedHttps.get("https://network.invalid"), /NETWORK_SENTINEL_CALLED/u);
    const { compileProofPack } = await import(`../src/proofpack/index.ts?network-sentinel=${import.meta.url.length}`);
    const result = await compileProofPack(await loadProjectAlder());
    assert.equal(result.handoff.decision, "HOLD");
  } finally {
    Object.assign(http, originalHttp);
    Object.assign(https, originalHttps);
    syncBuiltinESMExports();
    for (const name of names) {
      const descriptor = descriptors.get(name);
      if (descriptor === undefined) {
        Reflect.deleteProperty(globalThis, name);
      } else {
        Object.defineProperty(globalThis, name, descriptor);
      }
    }
  }
});

test("keeps forbidden network, clock, and randomness primitives out of the compiler core", async () => {
  const files = (await readdir(coreDirectory, { recursive: true }))
    .filter((file) => file.endsWith(".ts"))
    .sort();
  const forbidden = [
    /fetch\s*\(/u,
    /XMLHttpRequest/u,
    /WebSocket/u,
    /node:http/u,
    /node:https/u,
    /Date\.now/u,
    /new\s+Date\s*\(/u,
    /Math\.random/u,
    /crypto\.randomUUID/u,
  ];

  for (const file of files) {
    const source = await readFile(`${coreDirectory}/${file}`, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`);
    }
  }
});
