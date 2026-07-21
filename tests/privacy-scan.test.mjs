import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanText } from "../scripts/privacy-scan.mjs";

const sentinel = ["PROOFPACK", "SECRET", "SENTINEL"].join("_");
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("privacy scanner detects synthetic sentinels with stable sorted findings", () => {
  const profilePath = ["C:", "Users", "Synthetic", "private.txt"].join("\\");
  const findings = scanText("probe.txt", `safe\n${sentinel}\n${profilePath}\n`);

  assert.deepEqual(findings.map(({ code, line }) => ({ code, line })), [
    { code: "PRIVACY_SENTINEL", line: 2 },
    { code: "WINDOWS_PROFILE_PATH", line: 3 },
  ]);
});

test("privacy scanner permits fictional dot-example email addresses", () => {
  assert.deepEqual(scanText("probe.txt", "operator@northstar.example\n"), []);
  const prohibitedEmail = ["operator", "not-fictional.invalid"].join("@");
  assert.deepEqual(
    scanText("probe.txt", `${prohibitedEmail}\n`).map(({ code }) => code),
    ["EMAIL_ADDRESS"],
  );
});

test("privacy scanner detects secret assignments and configured terms without echoing values", () => {
  const secretValue = ["synthetic", "secret", "value"].join("-");
  const secretAssignment = `${["api", "key"].join("_")} = ${secretValue}`;
  const forbiddenTerm = ["PRIVATE", "PROJECT"].join("_");
  const findings = scanText(
    "probe.txt",
    `${forbiddenTerm}\n${secretAssignment}\n`,
    { forbiddenTerms: [forbiddenTerm] },
  );

  assert.deepEqual(findings.map(({ code, line }) => ({ code, line })), [
    { code: "FORBIDDEN_TERM", line: 1 },
    { code: "SECRET_ASSIGNMENT", line: 2 },
  ]);
  assert.equal(JSON.stringify(findings).includes(secretValue), false);
  assert.equal(JSON.stringify(findings).includes(forbiddenTerm), false);
});

test("privacy scanner detects quoted credential keys in structured text", () => {
  const secretValue = ["high", "signal", "value"].join("-");
  const credentialNameA = ["pass", "word"].join("");
  const credentialNameB = ["api", "key"].join("_");
  const structured = [
    JSON.stringify({ [credentialNameA]: secretValue }),
    `"${credentialNameB}" = "${secretValue}"`,
  ].join("\n");

  assert.deepEqual(
    scanText("probe.config", structured).map(({ code, line }) => ({ code, line })),
    [
      { code: "SECRET_ASSIGNMENT", line: 1 },
      { code: "SECRET_ASSIGNMENT", line: 2 },
    ],
  );
});

test("repository scan includes extensionless untracked text", async () => {
  const probeName = `.privacy-probe-${process.pid}`;
  const probePath = join(repository, probeName);
  await writeFile(probePath, `${sentinel}\n`, "utf8");
  try {
    const result = spawnSync(process.execPath, ["scripts/privacy-scan.mjs"], {
      cwd: repository,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`${probeName}:1:1 PRIVACY_SENTINEL`, "u"));
    assert.equal(result.stderr.includes(sentinel), false);
  } finally {
    await rm(probePath, { force: true });
  }
});

test("repository scan fails closed on undecodable non-NUL files", async () => {
  const probeName = `.privacy-invalid-utf8-${process.pid}`;
  const probePath = join(repository, probeName);
  await writeFile(probePath, Uint8Array.from([0xff, 0xfe, 0x41]));
  try {
    const result = spawnSync(process.execPath, ["scripts/privacy-scan.mjs"], {
      cwd: repository,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`${probeName}:1:1 TEXT_DECODE_FAILED`, "u"));
  } finally {
    await rm(probePath, { force: true });
  }
});
