import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

export const PINNED_CODEX_VERSION = "0.144.6";
export const PROPOSAL_MODEL = "gpt-5.6-sol";

const ENVIRONMENT_ALLOWLIST = new Set([
  "APPDATA",
  "CODEX_HOME",
  "COMSPEC",
  "HOMEDRIVE",
  "HOMEPATH",
  "HOME",
  "LOCALAPPDATA",
  "NO_COLOR",
  "PATH",
  "PATHEXT",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "USERPROFILE",
  "WINDIR",
]);

const ALLOWED_EVENT_TYPES = new Set([
  "item.completed",
  "item.started",
  "thread.started",
  "turn.completed",
  "turn.started",
]);

const ALLOWED_ITEM_TYPES = new Set(["agent_message", "reasoning"]);

const BLOCKED_RECORD_KEYS = new Set([
  "authorization",
  "command",
  "cookie",
  "outputpath",
  "password",
  "path",
  "prompt",
  "secret",
  "stderr",
  "stdout",
  "threadid",
  "thread_id",
  "token",
]);

const RUN_RECORD_KEYS = [
  "authMode",
  "cliVersion",
  "eventCounts",
  "labels",
  "policy",
  "proposal",
  "proposalDigest",
  "requestDigest",
  "requestedModel",
  "review",
  "schemaVersion",
  "usage",
] as const;

type UnknownRecord = Record<string, unknown>;

export interface CodexExecPaths {
  repository: string;
  schemaPath: string;
  outputPath: string;
}

export interface SanitizedCodexEvents {
  eventCounts: Readonly<Record<string, number>>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, 1_000_000_000)
    : 0;
}

export function buildExecArguments(paths: CodexExecPaths): string[] {
  return [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--model", PROPOSAL_MODEL,
    "--sandbox", "read-only",
    "--ephemeral",
    "--json",
    "--color", "never",
    "--output-schema", paths.schemaPath,
    "--output-last-message", paths.outputPath,
    "-C", paths.repository,
    "-",
  ];
}

export function buildCodexEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv {
  const result = {} as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(source)) {
    const normalized = key.toUpperCase();
    if (
      value !== undefined
      && ENVIRONMENT_ALLOWLIST.has(normalized)
      && normalized !== "OPENAI_API_KEY"
      && normalized !== "CODEX_API_KEY"
    ) {
      result[key] = value;
    }
  }
  return result;
}

export function assertChatGptLogin(exitCode: number | null, stdout: string, stderr: string): void {
  const lines = stderr.replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    exitCode !== 0
    || stdout.trim().length !== 0
    || lines.length !== 1
    || lines[0] !== "Logged in using ChatGPT"
  ) {
    throw new Error("AI_AUTH_NOT_CHATGPT");
  }
}

export function parseCodexJsonl(text: string): SanitizedCodexEvents {
  if (Buffer.byteLength(text, "utf8") > 2 * 1024 * 1024) {
    throw new Error("AI_JSONL_TOO_LARGE");
  }
  const counts = new Map<string, number>();
  let usage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  const lines = text.replaceAll("\r\n", "\n").split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("AI_JSONL_INVALID");
  }
  for (const line of lines) {
    let event: unknown;
    try {
      event = JSON.parse(line) as unknown;
    } catch {
      throw new Error("AI_JSONL_INVALID");
    }
    if (!isRecord(event) || typeof event.type !== "string" || event.type.length > 80) {
      throw new Error("AI_JSONL_INVALID");
    }
    if (!ALLOWED_EVENT_TYPES.has(event.type)) {
      throw new Error("AI_EVENT_TYPE_REJECTED");
    }
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    if (event.type === "item.started" || event.type === "item.completed") {
      if (!isRecord(event.item) || typeof event.item.type !== "string") {
        throw new Error("AI_JSONL_INVALID");
      }
      if (!ALLOWED_ITEM_TYPES.has(event.item.type)) {
        throw new Error("AI_TOOL_ACTIVITY_REJECTED");
      }
    }
    if (event.type === "turn.completed" && isRecord(event.usage)) {
      usage = {
        inputTokens: boundedTokenCount(event.usage.input_tokens),
        outputTokens: boundedTokenCount(event.usage.output_tokens),
        cachedInputTokens: boundedTokenCount(event.usage.cached_input_tokens),
      };
    }
  }
  return {
    eventCounts: Object.fromEntries([...counts].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)),
    usage,
  };
}

function inspectSafeValue(value: unknown, ancestors: WeakSet<object>): void {
  if (typeof value === "string") {
    if (
      /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\\\\)/u.test(value)
      || /(?:^|[\s"'(])\/(?:Users|etc|home|root|tmp|var)\//u.test(value)
      || /-----BEGIN .*PRIVATE KEY-----/u.test(value)
      || /(?:OPENAI|CODEX)_API_KEY/iu.test(value)
      || /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/iu.test(value)
      || /\b(?:sk|ghp)_[A-Za-z0-9_-]{8,}/iu.test(value)
      || /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u.test(value)
    ) {
      throw new Error("AI_RUN_RECORD_UNSAFE");
    }
    for (const match of value.matchAll(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,63})\b/giu)) {
      const domain = String(match[1]).toLowerCase();
      if (!domain.endsWith(".example")) throw new Error("AI_RUN_RECORD_UNSAFE");
    }
    return;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value !== "object" || ancestors.has(value)) {
    throw new Error("AI_RUN_RECORD_UNSAFE");
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const item of value) inspectSafeValue(item, ancestors);
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (BLOCKED_RECORD_KEYS.has(key.toLowerCase())) {
        throw new Error("AI_RUN_RECORD_UNSAFE");
      }
      inspectSafeValue(item, ancestors);
    }
  }
  ancestors.delete(value);
}

export function assertSafeRunRecord(value: unknown): void {
  if (
    !isRecord(value)
    || Object.keys(value).sort().join("\0") !== [...RUN_RECORD_KEYS].sort().join("\0")
  ) {
    throw new Error("AI_RUN_RECORD_UNSAFE");
  }
  inspectSafeValue(value, new WeakSet<object>());
}

export async function resolvePinnedCodexEntrypoint(): Promise<string> {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("@openai/codex/package.json");
  const packageValue = JSON.parse(await readFile(packageJsonPath, "utf8")) as unknown;
  if (
    !isRecord(packageValue)
    || packageValue.name !== "@openai/codex"
    || packageValue.version !== PINNED_CODEX_VERSION
  ) {
    throw new Error("AI_CODEX_VERSION_MISMATCH");
  }
  return join(dirname(packageJsonPath), "bin", "codex.js");
}
