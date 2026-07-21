import {
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { pathToFileURL } from "node:url";
import {
  canonicalStringify,
  compileProofPack,
  CompileError,
  receiptsEqual,
  ShareableExportError,
  type CompiledPack,
  type CompileInput,
  type PacketManifest,
  type Receipt,
  type RuleSet,
  type SourceDocument,
} from "../src/proofpack/index.ts";

const usage = "Usage: proofpack-demo <packet.json> [--json] [--out <directory>] [--verify-receipt <receipt.json>]";

class CliInputError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CliInputError";
    this.code = code;
  }
}

interface CliOptions {
  packetPath: string;
  json: boolean;
  outDirectory?: string;
  receiptPath?: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function parseArguments(args: readonly string[]): CliOptions {
  let packetPath: string | undefined;
  let json = false;
  let outDirectory: string | undefined;
  let receiptPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--json") {
      if (json) {
        throw new CliInputError("USAGE_INVALID", "--json may be supplied only once.");
      }
      json = true;
      continue;
    }
    if (argument === "--out" || argument === "--verify-receipt") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliInputError("USAGE_INVALID", `${argument} requires a path.`);
      }
      if (argument === "--out") {
        if (outDirectory !== undefined) {
          throw new CliInputError("USAGE_INVALID", "--out may be supplied only once.");
        }
        outDirectory = value;
      } else {
        if (receiptPath !== undefined) {
          throw new CliInputError("USAGE_INVALID", "--verify-receipt may be supplied only once.");
        }
        receiptPath = value;
      }
      index += 1;
      continue;
    }
    if (argument.startsWith("--") || packetPath !== undefined) {
      throw new CliInputError("USAGE_INVALID", "Arguments do not match the supported CLI contract.");
    }
    packetPath = argument;
  }
  if (packetPath === undefined) {
    throw new CliInputError("USAGE_INVALID", "A packet manifest path is required.");
  }
  return {
    packetPath,
    json,
    ...(outDirectory === undefined ? {} : { outDirectory }),
    ...(receiptPath === undefined ? {} : { receiptPath }),
  };
}

function isSafeDeclaredPath(value: string): boolean {
  return value.length > 0
    && !value.startsWith("/")
    && !value.startsWith("\\")
    && !value.includes("\\")
    && !value.includes(":")
    && !value.includes("\0")
    && value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function isBeneath(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot.length > 0
    && pathFromRoot !== ".."
    && !pathFromRoot.startsWith(`..${sep}`)
    && !isAbsolute(pathFromRoot);
}

async function requireRegularFile(path: string): Promise<void> {
  let metadata;
  try {
    metadata = await stat(path);
  } catch {
    throw new CliInputError("INPUT_FILE_UNREADABLE", "An input file could not be read.");
  }
  if (!metadata.isFile()) {
    throw new CliInputError("INPUT_FILE_INVALID", "An input path does not resolve to a regular file.");
  }
}

async function resolveDeclaredFile(packetDirectory: string, declaredPath: unknown): Promise<string> {
  if (typeof declaredPath !== "string" || !isSafeDeclaredPath(declaredPath)) {
    throw new CliInputError("PATH_OUTSIDE_PACKET", "Declared input paths must be safe packet-relative paths.");
  }
  let canonical: string;
  try {
    canonical = await realpath(resolve(packetDirectory, declaredPath));
  } catch {
    throw new CliInputError("INPUT_FILE_UNREADABLE", "A declared input file could not be resolved.");
  }
  if (!isBeneath(packetDirectory, canonical)) {
    throw new CliInputError("PATH_OUTSIDE_PACKET", "A declared input path resolves outside the packet directory.");
  }
  await requireRegularFile(canonical);
  return canonical;
}

async function resolveReceiptFile(packetDirectory: string, requestedPath: string): Promise<string> {
  const candidate = isAbsolute(requestedPath)
    ? requestedPath
    : resolve(packetDirectory, requestedPath);
  let canonical: string;
  try {
    canonical = await realpath(candidate);
  } catch {
    throw new CliInputError("INPUT_FILE_UNREADABLE", "The receipt file could not be resolved.");
  }
  if (!isBeneath(packetDirectory, canonical)) {
    throw new CliInputError("PATH_OUTSIDE_PACKET", "The receipt path resolves outside the packet directory.");
  }
  await requireRegularFile(canonical);
  return canonical;
}

async function readJson(path: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new CliInputError("INPUT_FILE_UNREADABLE", "An input file could not be read.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CliInputError("JSON_INVALID", "An input JSON file is malformed.");
  }
}

async function hydrateCompileInput(packetArgument: string): Promise<{
  input: CompileInput;
  packetDirectory: string;
}> {
  let packetPath: string;
  try {
    packetPath = await realpath(resolve(packetArgument));
  } catch {
    throw new CliInputError("INPUT_FILE_UNREADABLE", "The packet manifest could not be resolved.");
  }
  await requireRegularFile(packetPath);
  const packetDirectory = await realpath(dirname(packetPath));
  const manifestValue = await readJson(packetPath);
  if (!isRecord(manifestValue)) {
    throw new CliInputError("PACKET_MANIFEST_INVALID", "The packet manifest must be an object.");
  }
  const manifest = manifestValue as unknown as PacketManifest;
  const rulesPath = await resolveDeclaredFile(packetDirectory, manifestValue.rulesFile);
  const declarations = manifestValue.sources;
  if (!Array.isArray(declarations)) {
    throw new CliInputError("PACKET_MANIFEST_INVALID", "The packet manifest must declare source files.");
  }
  const sourcePaths = await Promise.all(declarations.map((declaration) =>
    resolveDeclaredFile(packetDirectory, isRecord(declaration) ? declaration.file : undefined)));
  const rules = await readJson(rulesPath) as RuleSet;
  const sources = await Promise.all(declarations.map(async (declaration, index): Promise<SourceDocument> => {
    if (!isRecord(declaration)) {
      throw new CliInputError("PACKET_MANIFEST_INVALID", "Every source declaration must be an object.");
    }
    let content: string;
    try {
      content = await readFile(sourcePaths[index]!, "utf8");
    } catch {
      throw new CliInputError("INPUT_FILE_UNREADABLE", "A source file could not be read.");
    }
    return { ...(declaration as unknown as Omit<SourceDocument, "content">), content };
  }));
  return { input: { manifest, rules, sources }, packetDirectory };
}

const receiptKeys: Array<keyof Receipt> = [
  "schemaVersion",
  "algorithm",
  "packetId",
  "rulesetId",
  "rulesetVersion",
  "engineVersion",
  "inputDigest",
  "observationDigest",
  "ledgerDigest",
  "handoffDigest",
  "shareableDigest",
];

function parseReceipt(value: unknown): Receipt {
  if (!isRecord(value) || Object.keys(value).sort().join("\0") !== [...receiptKeys].sort().join("\0")) {
    throw new CliInputError("RECEIPT_INVALID", "The receipt does not match the closed v1 contract.");
  }
  if (value.schemaVersion !== "proofpack.receipt/v1" || value.algorithm !== "SHA-256") {
    throw new CliInputError("RECEIPT_INVALID", "The receipt schema or algorithm is not supported.");
  }
  for (const field of ["packetId", "rulesetId", "rulesetVersion", "engineVersion"] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new CliInputError("RECEIPT_INVALID", "Receipt identity fields must be non-empty strings.");
    }
  }
  for (const field of [
    "inputDigest",
    "observationDigest",
    "ledgerDigest",
    "handoffDigest",
    "shareableDigest",
  ] as const) {
    if (typeof value[field] !== "string" || !/^[a-f0-9]{64}$/u.test(value[field])) {
      throw new CliInputError("RECEIPT_INVALID", "Receipt digests must be lowercase SHA-256 hex.");
    }
  }
  return value as unknown as Receipt;
}

function bundleFiles(pack: CompiledPack): Readonly<Record<string, string>> {
  return {
    "operator.md": pack.artifacts.operatorMarkdown,
    "shareable.md": pack.artifacts.shareableMarkdown,
    "receipt.json": `${canonicalStringify(pack.receipt)}\n`,
    "compiled.json": `${canonicalStringify(pack)}\n`,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ENOENT";
  }
}

async function publishBundle(requestedDirectory: string, files: Readonly<Record<string, string>>): Promise<void> {
  const requested = resolve(requestedDirectory);
  const requestedName = basename(requested);
  if (requestedName.length === 0 || dirname(requested) === requested) {
    throw new CliInputError("OUTPUT_PATH_INVALID", "The output path must name a new directory.");
  }
  let canonicalParent: string;
  try {
    canonicalParent = await realpath(dirname(requested));
  } catch {
    throw new CliInputError("OUTPUT_PARENT_INVALID", "The output parent directory must already exist.");
  }
  const finalDirectory = join(canonicalParent, requestedName);
  const lockPath = `${finalDirectory}.proofpack.lock`;
  try {
    await writeFile(lockPath, "", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new CliInputError("OUTPUT_COLLISION", "The output directory is reserved by another publication.");
    }
    throw error;
  }

  let stagingDirectory: string | undefined;
  let published = false;
  try {
    if (await pathExists(finalDirectory)) {
      throw new CliInputError("OUTPUT_COLLISION", "The output directory already exists.");
    }
    stagingDirectory = await mkdtemp(join(canonicalParent, ".proofpack-staging-"));
    for (const [name, content] of Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
      await writeFile(join(stagingDirectory, name), content, { encoding: "utf8", flag: "wx" });
    }
    await rename(stagingDirectory, finalDirectory);
    published = true;
  } catch (error) {
    if (["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? "")) {
      throw new CliInputError("OUTPUT_COLLISION", "The output directory already exists.");
    }
    throw error;
  } finally {
    if (
      !published
      && stagingDirectory !== undefined
      && isBeneath(canonicalParent, stagingDirectory)
    ) {
      await rm(stagingDirectory, { recursive: true, force: true });
    }
    try {
      await unlink(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function renderHuman(pack: CompiledPack): string {
  return [
    "ProofPack Release Gate",
    `Decision: ${pack.handoff.decision}`,
    "Claims:",
    ...pack.claims.map(({ id, status }) => `- ${status} ${id}`),
    "Reproducibility/integrity receipt:",
    ...receiptKeys.map((field) => `${field}: ${pack.receipt[field]}`),
    "",
  ].join("\n");
}

function reportError(error: unknown): number {
  if (error instanceof ShareableExportError) {
    process.stderr.write(`${error.code}: Allowlisted shareable export rejected.\n`);
    return 3;
  }
  if (error instanceof CliInputError) {
    process.stderr.write(`${error.code}: ${error.message}\n${error.code === "USAGE_INVALID" ? `${usage}\n` : ""}`);
    return 2;
  }
  if (error instanceof CompileError) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
  process.stderr.write("UNEXPECTED_FAILURE: ProofPack could not complete the requested operation.\n");
  return 70;
}

export async function runProofPackCli(args: readonly string[]): Promise<number> {
  try {
    const options = parseArguments(args);
    const { input, packetDirectory } = await hydrateCompileInput(options.packetPath);
    const receipt = options.receiptPath === undefined
      ? undefined
      : parseReceipt(await readJson(await resolveReceiptFile(packetDirectory, options.receiptPath)));
    const pack = await compileProofPack(input);
    if (receipt !== undefined && !receiptsEqual(pack.receipt, receipt)) {
      throw new CliInputError("RECEIPT_MISMATCH", "Receipt verification failed against the recomputed packet.");
    }
    const files = bundleFiles(pack);
    if (options.outDirectory !== undefined) {
      await publishBundle(options.outDirectory, files);
    }
    process.stdout.write(options.json ? `${canonicalStringify(pack)}\n` : renderHuman(pack));
    return 0;
  } catch (error) {
    return reportError(error);
  }
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  process.exitCode = await runProofPackCli(process.argv.slice(2));
}
