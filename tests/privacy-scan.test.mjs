import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanText } from "../scripts/privacy-scan.mjs";

const sentinel = ["PROOFPACK", "SECRET", "SENTINEL"].join("_");
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredConfigPath = join(repository, "config", "privacy-forbidden-terms.json");

function runScanner(environment = {}) {
  return spawnSync(process.execPath, ["scripts/privacy-scan.mjs"], {
    cwd: repository,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

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

test("privacy scanner detects every assignment-key family without retaining values", () => {
  const secretValue = ["high", "signal", "credential"].join("-");
  const cases = [
    { key: ["se", "cret"].join(""), render: (key, value) => `${key}=${value}` },
    { key: ["secret", "key"].join("_"), render: (key, value) => `${key}: ${value}` },
    { key: ["AWS", "SECRET", "ACCESS", "KEY"].join("_"), render: (key, value) => `${key}=${value}` },
    { key: ["to", "ken"].join(""), render: (key, value) => `"${key}": "${value}"` },
    { key: ["pass", "word"].join(""), render: (key, value) => `${key}: ${value}` },
    { key: ["private", "key"].join("-"), render: (key, value) => `"${key}" = "${value}"` },
    { key: ["client", "secret"].join("_"), render: (key, value) => `"${key}": "${value}"` },
    { key: ["api", "key"].join("_"), render: (key, value) => `${key}=${value}` },
  ];

  const results = cases.map(({ key, render }) => scanText("probe.config", render(key, secretValue)));
  assert.deepEqual(results.map((findings) => findings.map(({ code }) => code)), cases.map(() => ["SECRET_ASSIGNMENT"]));
  assert.equal(JSON.stringify(results).includes(secretValue), false);
});

test("privacy scanner detects arbitrarily provider-prefixed secret families without retaining values", () => {
  const secretValue = ["provider", "credential", "value"].join("-");
  const cases = [
    { key: ["OPENAI", "API", "KEY"].join("_"), render: (key, value) => `"${key}": "${value}"` },
    { key: ["GITHUB", "TOKEN"].join("_"), render: (key, value) => `${key}: ${value}` },
    { key: ["DB", "PASSWORD"].join("_"), render: (key, value) => `${key}=${value}` },
    { key: ["STRIPE", "CLIENT", "SECRET"].join("_"), render: (key, value) => `"${key}": "${value}"` },
    { key: ["SERVICE", "PRIVATE", "KEY"].join("_"), render: (key, value) => `${key}=${value}` },
    { key: ["MY", "SERVICE", "OPENAI", "API", "KEY"].join("_"), render: (key, value) => `${key}: ${value}` },
  ];

  const results = cases.map(({ key, render }) => scanText("probe.config", render(key, secretValue)));
  assert.deepEqual(results.map((findings) => findings.map(({ code }) => code)), cases.map(() => ["SECRET_ASSIGNMENT"]));
  assert.equal(JSON.stringify(results).includes(secretValue), false);
});

test("privacy scanner normalizes provider-prefixed camelCase keys without matching fused innocent tokens", () => {
  const secretValue = ["camel", "case", "credential"].join("-");
  const cases = [
    { key: ["openai", "Api", "Key"].join(""), render: (key, value) => `"${key}": "${value}"` },
    { key: ["github", "Token"].join(""), render: (key, value) => `${key}: ${value}` },
    { key: ["db", "Password"].join(""), render: (key, value) => `{ ${key}: "${value}" }` },
    { key: ["aws", "Secret", "Access", "Key"].join(""), render: (key, value) => `${key}=${value}` },
  ];

  const results = cases.map(({ key, render }) => scanText("probe.config", render(key, secretValue)));
  assert.deepEqual(results.map((findings) => findings.map(({ code }) => code)), cases.map(() => ["SECRET_ASSIGNMENT"]));
  assert.equal(JSON.stringify(results).includes(secretValue), false);

  const innocentKey = ["nota", "secret"].join("");
  assert.deepEqual(scanText("probe.config", `${innocentKey}=${secretValue}`), []);
});

test("privacy scanner detects JavaScript and TypeScript credential declarations and later assignments", () => {
  const secretValue = ["live", "credential", "value"].join("-");
  const openaiKey = ["openai", "Api", "Key"].join("");
  const githubKey = ["github", "Token"].join("");
  const databaseKey = ["db", "Password"].join("");
  const serviceKey = ["service", "Private", "Key"].join("");
  const delimitedKey = ["OPENAI", "API", "KEY"].join("_");
  const source = [
    `const ${openaiKey} = "${secretValue}";`,
    `let ${githubKey}='${secretValue}';`,
    `var ${databaseKey} = "${secretValue}";`,
    `const ${serviceKey}: string = \`${secretValue}\`;`,
    `${serviceKey} = "${secretValue}";`,
    `const ${delimitedKey} = "${secretValue}";`,
  ].join("\n");

  assert.deepEqual(
    scanText("probe.ts", source).map(({ code, line }) => ({ code, line })),
    [1, 2, 3, 4, 5, 6].map((line) => ({ code: "SECRET_ASSIGNMENT", line })),
  );
  assert.equal(JSON.stringify(scanText("probe.ts", source)).includes(secretValue), false);
});

test("privacy scanner preserves declaration value exemptions and operator and key boundaries", () => {
  const secretValue = ["comparison", "credential", "value"].join("-");
  const openaiKey = ["openai", "Api", "Key"].join("");
  const githubKey = ["github", "Token"].join("");
  const databaseKey = ["db", "Password"].join("");
  const serviceKey = ["service", "Private", "Key"].join("");
  const fusedInnocentKey = ["nota", "secret"].join("");
  const nonSuffixKey = ["secret", "Handler"].join("");
  const source = [
    `const ${openaiKey} = process.env.OPENAI_API_KEY;`,
    `let ${githubKey}: string = import.meta.env.GITHUB_TOKEN;`,
    `${openaiKey} = import.meta.env.OPENAI_API_KEY;`,
    `var ${databaseKey} = "";`,
    `const ${serviceKey} = "example";`,
    `const ${openaiKey} = "placeholder";`,
    `let ${githubKey} = <injected-at-runtime>;`,
    `const ${githubKey} = encodedToken.replace(/old/gu, "new");`,
    `${serviceKey} = buildCredential();`,
    `${serviceKey} = encodedToken.replace(/old/gu, "new");`,
    `const ${openaiKey} = \`prefix-\${process.env.OPENAI_API_KEY}\`;`,
    `const ${openaiKey} = "prefix-" + dynamicSuffix;`,
    `${githubKey} === "${secretValue}";`,
    `${githubKey} => consume(${githubKey});`,
    `const ${fusedInnocentKey} = "${secretValue}";`,
    `const ${nonSuffixKey} = "${secretValue}";`,
  ].join("\n");

  assert.deepEqual(scanText("probe.ts", source), []);
});

test("privacy scanner preserves placeholder and environment-reference exemptions", () => {
  const keyA = ["se", "cret"].join("");
  const keyB = ["to", "ken"].join("");
  const text = [
    `${keyA}=placeholder`,
    `${keyA}=<injected-at-runtime>`,
    `${keyB}=process.env.PROOFPACK_TOKEN`,
    `${keyB}=\${PROOFPACK_TOKEN}`,
  ].join("\n");

  assert.deepEqual(scanText("probe.env", text), []);
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
  try {
    await writeFile(probePath, `${sentinel}\n`, "utf8");
    const result = runScanner();
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`${probeName}:1:1 PRIVACY_SENTINEL`, "u"));
    assert.equal(result.stderr.includes(sentinel), false);
  } finally {
    await rm(probePath, { force: true });
  }
});

test("repository scan fails closed on valid UTF-8 containing NUL in an extensionless file", async () => {
  const probeName = `.privacy-nul-${process.pid}`;
  const probePath = join(repository, probeName);
  try {
    await writeFile(probePath, Uint8Array.from([0x73, 0x61, 0x66, 0x65, 0x00, 0x74, 0x65, 0x78, 0x74]));
    const result = runScanner();
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`${probeName}:1:1 TEXT_DECODE_FAILED`, "u"));
  } finally {
    await rm(probePath, { force: true });
  }
});

test("repository scan fails closed on invalid non-NUL UTF-8 in a JSON config", async () => {
  const probeName = `.privacy-invalid-utf8-${process.pid}.json`;
  const probePath = join(repository, probeName);
  try {
    await writeFile(probePath, Uint8Array.from([0xff, 0xfe, 0x41]));
    const result = runScanner();
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`${probeName}:1:1 TEXT_DECODE_FAILED`, "u"));
  } finally {
    await rm(probePath, { force: true });
  }
});

test("repository scan skips a recognized binary signature for an unknown extension", async () => {
  const probeName = `.privacy-binary-${process.pid}.data`;
  const probePath = join(repository, probeName);
  const payload = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...Buffer.from(sentinel, "utf8"),
  ]);
  try {
    await writeFile(probePath, payload);
    const result = runScanner();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr.includes(probeName), false);
  } finally {
    await rm(probePath, { force: true });
  }
});

test("required tracked forbidden-term config is closed, non-empty, and visibly synthetic", async () => {
  const config = JSON.parse(await readFile(requiredConfigPath, "utf8"));
  assert.deepEqual(Object.keys(config).sort(), ["schemaVersion", "terms"]);
  assert.equal(config.schemaVersion, "proofpack.privacy-forbidden-terms/v1");
  assert.ok(Array.isArray(config.terms) && config.terms.length > 0);
  assert.ok(config.terms.every((term) => typeof term === "string" && /synthetic|sentinel/iu.test(term)));
});

test("required config validation rejects missing, open, empty, and non-synthetic inputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "proofpack-privacy-config-test-"));
  const scanner = await import("../scripts/privacy-scan.mjs");
  const cases = [
    ["missing.json", undefined],
    ["open.json", JSON.stringify({ schemaVersion: "proofpack.privacy-forbidden-terms/v1", terms: ["SYNTHETIC_SENTINEL"], extra: true })],
    ["empty.json", JSON.stringify({ schemaVersion: "proofpack.privacy-forbidden-terms/v1", terms: [] })],
    ["private.json", JSON.stringify({ schemaVersion: "proofpack.privacy-forbidden-terms/v1", terms: [["real", "project"].join("-")] })],
  ];
  try {
    for (const [name, contents] of cases) {
      const path = join(root, name);
      if (contents !== undefined) {
        await writeFile(path, contents, "utf8");
      }
      await assert.rejects(
        () => scanner.loadRequiredForbiddenTerms(path),
        /PRIVACY_CONFIG_(?:UNREADABLE|INVALID)/u,
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("privacy scanner scans the exact four-file CLI bundle inventory", () => {
  const result = runScanner();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /and 4 generated artifacts\./u);
});

test("generated-bundle scanning returns the exact stable paths it visited", async () => {
  const scanner = await import("../scripts/privacy-scan.mjs");
  const generated = await scanner.scanGeneratedBundle([]);

  assert.deepEqual(generated.scannedPaths, [
    "generated/compiled.json",
    "generated/operator.md",
    "generated/receipt.json",
    "generated/shareable.md",
  ]);
});

test("a local supplemental term matching config content is not covered by the required-term exemption", async () => {
  const root = await mkdtemp(join(tmpdir(), "proofpack-privacy-config-local-test-"));
  const localTermsPath = join(root, "local-terms.txt");
  const localTerm = ["proofpack", "privacy-forbidden-terms", "v1"].join(".").replace(".v1", "/v1");
  try {
    await writeFile(localTermsPath, `${localTerm}\n`, "utf8");
    const result = runScanner({ PROOFPACK_PRIVACY_LOCAL_TERMS_FILE: localTermsPath });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /config\/privacy-forbidden-terms\.json:\d+:\d+ FORBIDDEN_TERM/u);
    assert.equal(result.stderr.includes(localTerm), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("optional local terms scan generated compiled and receipt JSON without printing the term", async () => {
  const root = await mkdtemp(join(tmpdir(), "proofpack-privacy-local-test-"));
  const localTermsPath = join(root, "local-terms.txt");
  const privateTerm = ["proofpack", "receipt", "v1"].join(".").replace(".v1", "/v1");
  try {
    await writeFile(localTermsPath, `${privateTerm}\n`, "utf8");
    const result = runScanner({ PROOFPACK_PRIVACY_LOCAL_TERMS_FILE: localTermsPath });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /generated\/compiled\.json:\d+:\d+ FORBIDDEN_TERM/u);
    assert.match(result.stderr, /generated\/receipt\.json:\d+:\d+ FORBIDDEN_TERM/u);
    assert.equal(result.stderr.includes(privateTerm), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an explicitly configured missing or invalid local term file fails closed generically", async () => {
  const root = await mkdtemp(join(tmpdir(), "proofpack-privacy-local-invalid-test-"));
  const missingPath = join(root, "missing.txt");
  const invalidPath = join(root, "invalid.txt");
  try {
    await writeFile(invalidPath, Uint8Array.from([0x00, 0xff]));
    for (const configuredPath of [missingPath, invalidPath, root]) {
      const result = runScanner({ PROOFPACK_PRIVACY_LOCAL_TERMS_FILE: configuredPath });
      assert.equal(result.status, 1);
      assert.equal(result.stderr, "PRIVACY_SCAN_ERROR: Scan could not complete.\n");
      assert.equal(result.stderr.includes(configuredPath), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
