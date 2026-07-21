import { execFileSync, spawnSync } from "node:child_process";
import { lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requiredConfigRelativePath = "config/privacy-forbidden-terms.json";
const requiredConfigPath = resolve(repository, ...requiredConfigRelativePath.split("/"));
const defaultLocalTermsPath = resolve(repository, ".proofpack-privacy-terms.local");
const sentinel = ["PROOFPACK", "SECRET", "SENTINEL"].join("_");
const excludedSegments = new Set(["node_modules", ".git", ".next", ".vinext", "dist", "out", "coverage"]);
const knownTextExtensions = new Set([
  ".cjs", ".css", ".csv", ".diff", ".env", ".html", ".ini", ".js", ".json", ".jsonl",
  ".jsx", ".log", ".md", ".mdx", ".mjs", ".pem", ".svg", ".toml", ".ts", ".tsbuildinfo",
  ".tsx", ".txt", ".xml", ".yaml", ".yml",
]);
const knownTextConfigNames = new Set([
  ".editorconfig", ".gitattributes", ".gitignore", ".npmrc", ".nvmrc", "dockerfile", "license",
  "makefile",
]);
const javascriptAndTypeScriptExtensions = new Set([
  ".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx",
]);
const explicitBinaryExtensions = new Set([
  ".7z", ".avi", ".bmp", ".db", ".dll", ".doc", ".docx", ".eot", ".exe", ".gif", ".gz",
  ".ico", ".jpeg", ".jpg", ".mov", ".mp3", ".mp4", ".ogg", ".otf", ".pdf", ".png", ".ppt",
  ".pptx", ".sqlite", ".sqlite3", ".tar", ".tif", ".tiff", ".ttf", ".wav", ".webm", ".webp",
  ".woff", ".woff2", ".xls", ".xlsx", ".zip",
]);
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

const sensitiveKeySuffixes = [
  ["secret"],
  ["secret", "key"],
  ["secret", "access", "key"],
  ["token"],
  ["access", "token"],
  ["auth", "token"],
  ["password"],
  ["private", "key"],
  ["client", "secret"],
  ["api", "key"],
];

function assignmentKey(match) {
  return String(match[1] ?? match[2] ?? match[3] ?? "");
}

function assignmentValue(match) {
  return String(match[4] ?? match[5] ?? match[6] ?? match[7] ?? match[8] ?? "");
}

function normalizedKeyTokens(key) {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function hasSensitiveKeySuffix(key) {
  const tokens = normalizedKeyTokens(key);
  return sensitiveKeySuffixes.some((suffix) =>
    tokens.length >= suffix.length
    && suffix.every((token, index) => token === tokens[tokens.length - suffix.length + index]));
}

function isHardCodedCredentialAssignment(key, value) {
  return hasSensitiveKeySuffix(key)
    && value.length > 0
    && !/^(?:example|placeholder|redacted|synthetic|test|dummy|none|null|undefined|false|true)$/iu.test(value)
    && !/^process\.env(?:\.|\[)/u.test(value)
    && !/^import\.meta\.env(?:\.|\[)/u.test(value)
    && !/^<[^>]+>$/u.test(value)
    && !/^\$\{[^}]+\}$/u.test(value)
    && !/^\$[A-Z_][A-Z0-9_]*$/iu.test(value);
}

function isJavaScriptOrTypeScriptPath(path) {
  return javascriptAndTypeScriptExtensions.has(extname(path).toLowerCase());
}

function hasCompleteJavaScriptLiteralRhs(text, match) {
  const afterMatch = text.slice(match.index + match[0].length);
  const lineEnd = afterMatch.indexOf("\n");
  let tail = (lineEnd === -1 ? afterMatch : afterMatch.slice(0, lineEnd)).trimStart();
  while (tail.startsWith("/*")) {
    const commentEnd = tail.indexOf("*/", 2);
    if (commentEnd === -1) {
      return false;
    }
    tail = tail.slice(commentEnd + 2).trimStart();
  }
  return tail.length === 0
    || tail.startsWith("//")
    || ",;}])".includes(tail[0]);
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
    /(?<![A-Za-z0-9_])(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([A-Za-z][A-Za-z0-9_. -]*?))\s*(?::|=(?!=|>))\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|`([^`\r\n]*)`|(\$\{[^}\r\n]+\})|([^\s,;}\]]+))/gu,
    (match) => {
      const key = assignmentKey(match);
      const value = assignmentValue(match);
      const lineStart = text.lastIndexOf("\n", match.index - 1) + 1;
      const linePrefix = text.slice(lineStart, match.index);
      const hasJavaScriptLiteral = match[4] !== undefined
        || match[5] !== undefined
        || match[6] !== undefined;
      const hasStaticTemplateLiteral = match[6] === undefined || !String(match[6]).includes("${");
      return !/\b(?:const|let|var)\s*$/u.test(linePrefix)
        && !/\b(?:const|let|var)\s+/u.test(key)
        && (
          !isJavaScriptOrTypeScriptPath(path)
          || (
            hasJavaScriptLiteral
            && hasStaticTemplateLiteral
            && hasCompleteJavaScriptLiteralRhs(text, match)
          )
        )
        && isHardCodedCredentialAssignment(key, value);
    },
  );
  addPatternFindings(
    findings,
    path,
    text,
    "SECRET_ASSIGNMENT",
    /(?<![A-Za-z0-9_$])(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[^=;\r\n]+)?\s*=(?!=|>)\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|`([^`\r\n]*)`)/gu,
    (match) => {
      const key = String(match[1] ?? "");
      const value = String(match[2] ?? match[3] ?? match[4] ?? "");
      const hasStaticTemplateLiteral = match[4] === undefined || !String(match[4]).includes("${");
      return hasStaticTemplateLiteral
        && hasCompleteJavaScriptLiteralRhs(text, match)
        && isHardCodedCredentialAssignment(key, value);
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

function isKnownTextPath(path) {
  const name = basename(path).toLowerCase();
  const extension = extname(name);
  return extension.length === 0
    || knownTextExtensions.has(extension)
    || knownTextConfigNames.has(name);
}

function bytesStartWith(bytes, signature) {
  return bytes.length >= signature.length
    && signature.every((value, index) => bytes[index] === value);
}

function hasRecognizedBinarySignature(bytes) {
  return [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    [0xff, 0xd8, 0xff],
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
    [0x25, 0x50, 0x44, 0x46, 0x2d],
    [0x1f, 0x8b],
    [0x7f, 0x45, 0x4c, 0x46],
    [0x4d, 0x5a],
    [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00],
  ].some((signature) => bytesStartWith(bytes, signature))
    || (
      bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && bytes.length >= 12
      && bytesStartWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
    );
}

function shouldSkipAsBinary(path, bytes) {
  if (isKnownTextPath(path)) {
    return false;
  }
  return explicitBinaryExtensions.has(extname(path).toLowerCase())
    || hasRecognizedBinarySignature(bytes);
}

function decodeTextBytes(bytes) {
  if (bytes.includes(0)) {
    return undefined;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
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

function privacyConfigError(code) {
  return new Error(code);
}

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidTerm(term, requireSyntheticMarker) {
  return typeof term === "string"
    && term === term.trim()
    && term.length > 0
    && term.length <= 200
    && !/[\u0000-\u001f\u007f]/u.test(term)
    && (!requireSyntheticMarker || /(?:^|[^a-z])(?:synthetic|sentinel)(?:[^a-z]|$)/iu.test(term));
}

export async function loadRequiredForbiddenTerms(path = requiredConfigPath) {
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    throw privacyConfigError("PRIVACY_CONFIG_UNREADABLE");
  }
  const text = decodeTextBytes(bytes);
  if (text === undefined) {
    throw privacyConfigError("PRIVACY_CONFIG_INVALID");
  }
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    throw privacyConfigError("PRIVACY_CONFIG_INVALID");
  }
  if (
    !isPlainRecord(config)
    || Object.keys(config).sort().join("\0") !== ["schemaVersion", "terms"].sort().join("\0")
    || config.schemaVersion !== "proofpack.privacy-forbidden-terms/v1"
    || !Array.isArray(config.terms)
    || config.terms.length === 0
    || !config.terms.every((term) => isValidTerm(term, true))
    || new Set(config.terms).size !== config.terms.length
    || [...config.terms].sort(compareText).join("\0") !== config.terms.join("\0")
  ) {
    throw privacyConfigError("PRIVACY_CONFIG_INVALID");
  }
  return config.terms;
}

async function loadLocalForbiddenTerms() {
  const explicitlyConfigured = process.env.PROOFPACK_PRIVACY_LOCAL_TERMS_FILE !== undefined;
  const configuredPath = process.env.PROOFPACK_PRIVACY_LOCAL_TERMS_FILE;
  const path = explicitlyConfigured ? resolve(configuredPath ?? "") : defaultLocalTermsPath;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (error) {
    if (!explicitlyConfigured && error?.code === "ENOENT") {
      return [];
    }
    throw privacyConfigError("PRIVACY_LOCAL_TERMS_UNREADABLE");
  }
  const text = decodeTextBytes(bytes);
  if (text === undefined) {
    throw privacyConfigError("PRIVACY_LOCAL_TERMS_INVALID");
  }
  const terms = text.replace(/\r\n?/gu, "\n").normalize("NFC")
    .split("\n")
    .map((term) => term.trim())
    .filter(Boolean);
  if (!terms.every((term) => isValidTerm(term, false))) {
    throw privacyConfigError("PRIVACY_LOCAL_TERMS_INVALID");
  }
  return [...new Set(terms)].sort(compareText);
}

function isFindingExempt(path, finding) {
  if (
    path === requiredConfigRelativePath
    && finding.code === "PRIVACY_SENTINEL"
  ) {
    return true;
  }
  return detectorDefinitionExemptions.has(
    [path, finding.code, finding.line, finding.column].join("\0"),
  );
}

async function scanRepositoryFiles(requiredForbiddenTerms, localForbiddenTerms) {
  const findings = [];
  let scanned = 0;
  const allForbiddenTerms = [...new Set([
    ...requiredForbiddenTerms,
    ...localForbiddenTerms,
  ])].sort(compareText);
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
    if (shouldSkipAsBinary(path, bytes)) {
      continue;
    }
    const text = decodeTextBytes(bytes);
    if (text === undefined) {
      findings.push({ path, line: 1, column: 1, code: "TEXT_DECODE_FAILED" });
      continue;
    }
    scanned += 1;
    const forbiddenTerms = path === requiredConfigRelativePath
      ? localForbiddenTerms
      : allForbiddenTerms;
    for (const finding of scanText(path, text, { forbiddenTerms })) {
      if (!isFindingExempt(path, finding)) {
        findings.push(finding);
      }
    }
  }
  return { findings, scanned };
}

async function regularFilesBeneath(directory, prefix = "") {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    const relativePath = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await regularFilesBeneath(join(directory, entry.name), relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

export async function scanGeneratedBundle(forbiddenTerms = []) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "proofpack-privacy-scan-"));
  const outputDirectory = join(temporaryRoot, "bundle");
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/proofpack-demo.ts",
        "fixtures/project-alder/packet.json",
        "--out",
        outputDirectory,
      ],
      { cwd: repository, encoding: "utf8", windowsHide: true },
    );
    if (result.status !== 0) {
      throw new Error("GENERATED_ARTIFACT_COMPILE_FAILED");
    }
    const inventory = await regularFilesBeneath(outputDirectory);
    const findings = [];
    const scannedPaths = [];
    for (const relativePath of inventory) {
      const path = `generated/${normalizeRepositoryPath(relativePath)}`;
      const bytes = await readFile(join(outputDirectory, ...relativePath.split("/")));
      scannedPaths.push(path);
      const text = decodeTextBytes(bytes);
      if (text === undefined) {
        findings.push({ path, line: 1, column: 1, code: "TEXT_DECODE_FAILED" });
      } else {
        findings.push(...scanText(path, text, { forbiddenTerms }));
      }
    }
    return { findings, scannedPaths };
  } finally {
    const pathFromTemp = relative(tmpdir(), temporaryRoot);
    if (pathFromTemp.length > 0 && pathFromTemp !== ".." && !pathFromTemp.startsWith(`..\\`) && !pathFromTemp.startsWith("../")) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

export async function runPrivacyScan() {
  const requiredForbiddenTerms = await loadRequiredForbiddenTerms();
  const localForbiddenTerms = await loadLocalForbiddenTerms();
  const forbiddenTerms = [...new Set([
    ...requiredForbiddenTerms,
    ...localForbiddenTerms,
  ])].sort(compareText);
  const repositoryResult = await scanRepositoryFiles(requiredForbiddenTerms, localForbiddenTerms);
  const findings = [...repositoryResult.findings];
  const generated = await scanGeneratedBundle(forbiddenTerms);
  findings.push(...generated.findings);
  findings.sort(compareFinding);
  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(`${finding.path}:${finding.line}:${finding.column} ${finding.code}\n`);
    }
    return 1;
  }
  process.stdout.write(
    `Privacy scan passed: ${repositoryResult.scanned} repository text files and ${generated.scannedPaths.length} generated artifacts.\n`,
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
