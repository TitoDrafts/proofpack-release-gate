import { execFileSync, spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sentinel = ["PROOFPACK", "SECRET", "SENTINEL"].join("_");
const excludedSegments = new Set(["node_modules", ".git", ".next", ".vinext", "dist", "out", "coverage"]);
const detectorDefinitionExemptions = new Set([
  ["docs/superpowers/plans/2026-07-21-proofpack-release-gate.md", "PRIVACY_SENTINEL", 485, 48].join("\0"),
  ["docs/superpowers/plans/2026-07-21-proofpack-release-gate.md", "PRIVACY_SENTINEL", 487, 60].join("\0"),
  ["docs/superpowers/plans/2026-07-21-proofpack-release-gate.md", "PRIVACY_SENTINEL", 488, 58].join("\0"),
  ["docs/superpowers/plans/2026-07-21-proofpack-release-gate.md", "PRIVACY_SENTINEL", 553, 262].join("\0"),
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareFinding(left, right) {
  return compareText(left.path, right.path)
    || left.line - right.line
    || left.column - right.column
    || compareText(left.code, right.code);
}

function positionAt(text, index) {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function addPatternFindings(findings, path, text, code, pattern, accept = () => true) {
  pattern.lastIndex = 0;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (accept(match)) {
      findings.push({ path, ...positionAt(text, match.index), code });
    }
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function scanText(path, rawText, options = {}) {
  const text = rawText.replace(/\r\n?/gu, "\n").normalize("NFC");
  const findings = [];
  addPatternFindings(
    findings,
    path,
    text,
    "WINDOWS_PROFILE_PATH",
    /[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\r\n]+(?:[\\/][^\r\n]*)?/giu,
  );
  addPatternFindings(
    findings,
    path,
    text,
    "EMAIL_ADDRESS",
    /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,63})\b/giu,
    (match) => {
      const domain = String(match[1]).toLowerCase();
      return domain !== "example" && !domain.endsWith(".example");
    },
  );
  addPatternFindings(
    findings,
    path,
    text,
    "SECRET_ASSIGNMENT",
    /(?<![A-Za-z0-9_])["']?(?:api[_ -]?key|access[_ -]?token|auth[_ -]?token|client[_ -]?secret|password|private[_ -]?key)["']?\s*[:=]\s*["']?([^\s"',;}\]]+)/giu,
    (match) => {
      const value = String(match[1]).replace(/["']$/u, "");
      return !/^(?:example|placeholder|redacted|synthetic|test|dummy|none|null|undefined|false|true)$/iu.test(value)
        && !/^process\.env(?:\.|\[)/u.test(value)
        && !/^<[^>]+>$/u.test(value)
        && !/^\$\{[^}]+\}$/u.test(value);
    },
  );
  addPatternFindings(
    findings,
    path,
    text,
    "PRIVATE_KEY_MATERIAL",
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
  );
  addPatternFindings(
    findings,
    path,
    text,
    "PRIVACY_SENTINEL",
    new RegExp(escapeRegExp(sentinel), "gu"),
  );
  for (const term of options.forbiddenTerms ?? []) {
    if (typeof term === "string" && term.length > 0) {
      addPatternFindings(
        findings,
        path,
        text,
        "FORBIDDEN_TERM",
        new RegExp(escapeRegExp(term), "giu"),
      );
    }
  }
  return findings.sort(compareFinding);
}

function normalizeRepositoryPath(path) {
  return path.split("\\").join("/");
}

function isRepositoryCandidate(path, tracked) {
  const normalized = normalizeRepositoryPath(path);
  return tracked || !normalized.split("/").some((segment) => excludedSegments.has(segment));
}

function gitFiles(args) {
  return execFileSync(
    "git",
    ["ls-files", ...args, "-z"],
    { cwd: repository, encoding: "utf8", windowsHide: true },
  ).split("\0").filter(Boolean).map(normalizeRepositoryPath);
}

function repositoryFiles() {
  return [
    ...gitFiles(["--cached"]).map((path) => ({ path, tracked: true })),
    ...gitFiles(["--others", "--exclude-standard"]).map((path) => ({ path, tracked: false })),
  ].sort((left, right) => compareText(left.path, right.path));
}

function configuredForbiddenTerms() {
  return (process.env.PROOFPACK_PRIVACY_TERMS ?? "")
    .split(";")
    .map((term) => term.trim())
    .filter(Boolean);
}

async function scanRepositoryFiles(forbiddenTerms) {
  const findings = [];
  let scanned = 0;
  for (const { path, tracked } of repositoryFiles()) {
    if (!isRepositoryCandidate(path, tracked)) {
      continue;
    }
    const absolute = resolve(repository, ...path.split("/"));
    const metadata = await lstat(absolute);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      continue;
    }
    const bytes = await readFile(absolute);
    if (bytes.includes(0)) {
      continue;
    }
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      findings.push({ path, line: 1, column: 1, code: "TEXT_DECODE_FAILED" });
      continue;
    }
    scanned += 1;
    for (const finding of scanText(path, text, { forbiddenTerms })) {
      if (!detectorDefinitionExemptions.has(
        [path, finding.code, finding.line, finding.column].join("\0"),
      )) {
        findings.push(finding);
      }
    }
  }
  return { findings, scanned };
}

function generateSampleArtifacts() {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/proofpack-demo.ts", "fixtures/project-alder/packet.json", "--json"],
    { cwd: repository, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error("GENERATED_ARTIFACT_COMPILE_FAILED");
  }
  let pack;
  try {
    pack = JSON.parse(result.stdout);
  } catch {
    throw new Error("GENERATED_ARTIFACT_JSON_INVALID");
  }
  if (
    typeof pack?.artifacts?.operatorMarkdown !== "string"
    || typeof pack?.artifacts?.shareableMarkdown !== "string"
    || typeof pack?.shareable !== "object"
  ) {
    throw new Error("GENERATED_ARTIFACT_SHAPE_INVALID");
  }
  return [
    ["generated/operator.md", pack.artifacts.operatorMarkdown],
    ["generated/shareable.md", pack.artifacts.shareableMarkdown],
    ["generated/shareable.json", JSON.stringify(pack.shareable)],
  ];
}

export async function runPrivacyScan() {
  const forbiddenTerms = configuredForbiddenTerms();
  const repositoryResult = await scanRepositoryFiles(forbiddenTerms);
  const findings = [...repositoryResult.findings];
  const generated = generateSampleArtifacts();
  for (const [path, text] of generated) {
    findings.push(...scanText(path, text, { forbiddenTerms }));
  }
  findings.sort(compareFinding);
  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(`${finding.path}:${finding.line}:${finding.column} ${finding.code}\n`);
    }
    return 1;
  }
  process.stdout.write(
    `Privacy scan passed: ${repositoryResult.scanned} repository text files and ${generated.length} generated artifacts.\n`,
  );
  return 0;
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  try {
    process.exitCode = await runPrivacyScan();
  } catch {
    process.stderr.write("PRIVACY_SCAN_ERROR: Scan could not complete.\n");
    process.exitCode = 1;
  }
}
