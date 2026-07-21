import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { compileProofPack } from "../src/proofpack/index.ts";
import type { PacketManifest, RuleSet } from "../src/proofpack/types.ts";
import { loadProjectAlder } from "./proofpack-fixtures.ts";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = join(repository, "fixtures", "project-alder");

function runCli(args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/proofpack-demo.ts", ...args],
    { cwd: repository, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } },
  );
}

async function withFixture<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "proofpack-cli-test-"));
  const directory = join(root, "packet");
  await cp(fixtureDirectory, directory, { recursive: true });
  try {
    return await run(directory);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("JSON CLI output has exact core ledger and shareable digest parity", async () => {
  const direct = await compileProofPack(await loadProjectAlder());
  const result = runCli(["fixtures/project-alder/packet.json", "--json"]);

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout) as typeof direct;
  assert.deepEqual(parsed.claims, direct.claims);
  assert.equal(parsed.receipt.ledgerDigest, direct.receipt.ledgerDigest);
  assert.equal(parsed.receipt.shareableDigest, direct.receipt.shareableDigest);
  assert.equal(parsed.artifacts.shareableMarkdown, direct.artifacts.shareableMarkdown);
});

test("human CLI output shows HOLD, all five statuses, and the integrity receipt", () => {
  const result = runCli(["fixtures/project-alder/packet.json"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Decision: HOLD/u);
  for (const status of ["VERIFIED", "INFERRED", "NEEDS_CONFIRMATION", "CONFLICTED", "BLOCKED"]) {
    assert.match(result.stdout, new RegExp(status, "u"));
  }
  assert.match(result.stdout, /Reproducibility\/integrity receipt/u);
  assert.match(result.stdout, /inputDigest: [a-f0-9]{64}/u);
});

test("verifies a receipt by recomputing the packet and rejects tampering with exit 2", async () => {
  await withFixture(async (directory) => {
    const result = await compileProofPack(await loadProjectAlder());
    const receiptPath = join(directory, "expected-receipt.json");
    await writeFile(receiptPath, `${JSON.stringify(result.receipt)}\n`, "utf8");

    const valid = runCli([join(directory, "packet.json"), "--verify-receipt", receiptPath, "--json"]);
    assert.equal(valid.status, 0, valid.stderr);

    await writeFile(receiptPath, `${JSON.stringify({ ...result.receipt, ledgerDigest: "0".repeat(64) })}\n`, "utf8");
    const invalid = runCli([join(directory, "packet.json"), "--verify-receipt", receiptPath]);
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /RECEIPT_MISMATCH/u);
    assert.doesNotMatch(invalid.stderr, /\n\s+at /u);
  });
});

test("rejects a receipt input that canonically resolves outside the packet directory", async () => {
  await withFixture(async (directory) => {
    const result = await compileProofPack(await loadProjectAlder());
    const outsideReceipt = join(dirname(directory), "outside-receipt.json");
    await writeFile(outsideReceipt, `${JSON.stringify(result.receipt)}\n`, "utf8");

    const rejected = runCli([
      join(directory, "packet.json"),
      "--verify-receipt",
      outsideReceipt,
    ]);

    assert.equal(rejected.status, 2);
    assert.match(rejected.stderr, /PATH_OUTSIDE_PACKET/u);
    assert.doesNotMatch(rejected.stderr, /\n\s+at /u);
  });
});

test("rejects lexical traversal before reading and writes no output", async () => {
  await withFixture(async (directory) => {
    const manifestPath = join(directory, "packet.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PacketManifest;
    manifest.rulesFile = "../outside-rules.json";
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
    const out = join(dirname(directory), "artifacts");

    const result = runCli([manifestPath, "--out", out]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /PATH_OUTSIDE_PACKET/u);
    await assert.rejects(() => readFile(join(out, "receipt.json"), "utf8"));
  });
});

test("rejects a canonical symlink escape beneath a declared source path", async (context) => {
  await withFixture(async (directory) => {
    const root = dirname(directory);
    const outside = join(root, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "escaped.json"), "{}\n", "utf8");
    const link = join(directory, "linked");
    try {
      await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      context.skip(`symlink unavailable: ${String(error)}`);
      return;
    }
    const manifestPath = join(directory, "packet.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PacketManifest;
    manifest.sources[0]!.file = "linked/escaped.json";
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");

    const result = runCli([manifestPath, "--json"]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /PATH_OUTSIDE_PACKET/u);
  });
});

test("computes all artifacts before an unsafe public export and exits 3 without an output bundle", async () => {
  await withFixture(async (directory) => {
    const rulesPath = join(directory, "release-rules.json");
    const rules = JSON.parse(await readFile(rulesPath, "utf8")) as RuleSet;
    const publicClaim = rules.claims.find(({ id }) => id === "field-dimensions-current");
    assert.ok(publicClaim);
    publicClaim.publicTitle = "<script>unsafe()</script>";
    await writeFile(rulesPath, `${JSON.stringify(rules)}\n`, "utf8");
    const out = join(dirname(directory), "artifacts");

    const result = runCli([join(directory, "packet.json"), "--out", out]);

    assert.equal(result.status, 3);
    assert.match(result.stderr, /SHAREABLE_MARKUP_REJECTED/u);
    await assert.rejects(() => readFile(join(out, "operator.md"), "utf8"));
  });
});

test("publishes one complete output directory after successful in-memory compilation", async () => {
  await withFixture(async (directory) => {
    const out = join(dirname(directory), "artifacts");
    const result = runCli([join(directory, "packet.json"), "--out", out, "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as Awaited<ReturnType<typeof compileProofPack>>;

    assert.equal(await readFile(join(out, "operator.md"), "utf8"), parsed.artifacts.operatorMarkdown);
    assert.equal(await readFile(join(out, "shareable.md"), "utf8"), parsed.artifacts.shareableMarkdown);
    assert.deepEqual(JSON.parse(await readFile(join(out, "receipt.json"), "utf8")), parsed.receipt);
    assert.deepEqual(JSON.parse(await readFile(join(out, "compiled.json"), "utf8")), parsed);
  });
});

test("rejects output collisions atomically and preserves existing content", async () => {
  await withFixture(async (directory) => {
    const out = join(dirname(directory), "artifacts");
    await mkdir(out);
    const marker = join(out, "keep.txt");
    await writeFile(marker, "keep\n", "utf8");

    const result = runCli([join(directory, "packet.json"), "--out", out]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /OUTPUT_COLLISION/u);
    assert.equal(await readFile(marker, "utf8"), "keep\n");
    await assert.rejects(() => readFile(join(out, "operator.md"), "utf8"));
  });
});

test("honors an atomic publication lock without touching the final directory", async () => {
  await withFixture(async (directory) => {
    const out = join(dirname(directory), "artifacts");
    const lock = `${out}.proofpack.lock`;
    await writeFile(lock, "held\n", "utf8");

    const result = runCli([join(directory, "packet.json"), "--out", out]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /OUTPUT_COLLISION/u);
    assert.equal(await readFile(lock, "utf8"), "held\n");
    await assert.rejects(() => readFile(join(out, "operator.md"), "utf8"));
  });
});

test("uses stable invalid-input exits and never emits a normal stack trace", async () => {
  await withFixture(async (directory) => {
    await writeFile(join(directory, "packet.json"), "{invalid", "utf8");
    const malformed = runCli([join(directory, "packet.json")]);
    assert.equal(malformed.status, 2);
    assert.match(malformed.stderr, /JSON_INVALID/u);
    assert.doesNotMatch(malformed.stderr, /\n\s+at /u);

    const usage = runCli([]);
    assert.equal(usage.status, 2);
    assert.match(usage.stderr, /Usage: proofpack-demo/u);
  });
});

test("maps an unexpected compiler primitive failure to stable exit 70", async () => {
  await withFixture(async (directory) => {
    const preloader = join(dirname(directory), "break-digest.mjs");
    await writeFile(preloader, [
      "Object.defineProperty(globalThis.crypto.subtle, 'digest', {",
      "  configurable: true,",
      "  value: async () => { throw new Error('synthetic primitive failure'); },",
      "});",
      "",
    ].join("\n"), "utf8");
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(preloader).href,
        "--import",
        "tsx",
        "scripts/proofpack-demo.ts",
        join(directory, "packet.json"),
      ],
      { cwd: repository, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } },
    );

    assert.equal(result.status, 70, result.stderr);
    assert.equal(result.stderr, "UNEXPECTED_FAILURE: ProofPack could not complete the requested operation.\n");
    assert.doesNotMatch(result.stderr, /synthetic primitive failure|\n\s+at /u);
  });
});
