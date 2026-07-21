import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertChatGptLogin,
  assertSafeRunRecord,
  buildCodexEnvironment,
  buildExecArguments,
  parseCodexJsonl,
} from "../scripts/lib/codex-command.ts";
import { proposalPrompt } from "../scripts/ai-propose.ts";
import { hydrateCompileInput } from "../scripts/proofpack-demo.ts";
import { canonicalStringify, compileProofPack, reviewProposal, sha256Hex } from "../src/proofpack/index.ts";

test("builds the exact pinned Sol read-only ephemeral invocation", () => {
  const args = buildExecArguments({
    repository: "C:\\repo",
    schemaPath: "C:\\repo\\schemas\\proposal.json",
    outputPath: "C:\\temp\\proposal.json",
  });
  assert.deepEqual(args, [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--model", "gpt-5.6-sol",
    "--sandbox", "read-only",
    "--ephemeral",
    "--json",
    "--color", "never",
    "--output-schema", "C:\\repo\\schemas\\proposal.json",
    "--output-last-message", "C:\\temp\\proposal.json",
    "-C", "C:\\repo",
    "-",
  ]);
  assert.equal(args.includes("npx"), false);
  assert.equal(args.includes("shell"), false);
});

test("passes a minimal execution environment and strips API keys case-insensitively", () => {
  const env = buildCodexEnvironment(Object.fromEntries([
    ["Path", "C:\\Windows"],
    ["HOME", "/home/synthetic"],
    ["USERPROFILE", "C:\\Users\\Synthetic"],
    ["TEMP", "C:\\Temp"],
    [["OPENAI", "API", "KEY"].join("_"), "forbidden-a"],
    [["codex", "api", "key"].join("_"), "forbidden-b"],
    [["SOME", "TOKEN"].join("_"), "forbidden-c"],
  ]));
  assert.equal(env.Path, "C:\\Windows");
  assert.equal(env.HOME, "/home/synthetic");
  assert.equal(env.USERPROFILE, "C:\\Users\\Synthetic");
  assert.equal(env.TEMP, "C:\\Temp");
  assert.equal(Object.keys(env).some((key) => key.toUpperCase().includes("API_KEY")), false);
  assert.equal("SOME_TOKEN" in env, false);
});

test("accepts only the exact ChatGPT login state, including stderr output", () => {
  assert.doesNotThrow(() => assertChatGptLogin(0, "", "Logged in using ChatGPT\r\n"));
  assert.throws(() => assertChatGptLogin(0, "Logged in using an API key", ""), /AI_AUTH_NOT_CHATGPT/u);
  assert.throws(() => assertChatGptLogin(0, "Logged in using ChatGPT", ""), /AI_AUTH_NOT_CHATGPT/u);
  assert.throws(() => assertChatGptLogin(1, "", "Logged in using ChatGPT"), /AI_AUTH_NOT_CHATGPT/u);
  assert.throws(() => assertChatGptLogin(0, "", "ChatGPT login active for person@synthetic.example"), /AI_AUTH_NOT_CHATGPT/u);
});

test("retains only event counts and usage while rejecting tool activity", () => {
  const safe = parseCodexJsonl([
    JSON.stringify({ type: "thread.started", thread_id: "secret-thread" }),
    JSON.stringify({ type: "turn.started" }),
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "private raw response" } }),
    JSON.stringify({ type: "turn.completed", usage: { input_tokens: 120, output_tokens: 30, cached_input_tokens: 10 } }),
  ].join("\n"));
  assert.deepEqual(safe.eventCounts, {
    "item.completed": 1,
    "thread.started": 1,
    "turn.completed": 1,
    "turn.started": 1,
  });
  assert.deepEqual(safe.usage, { inputTokens: 120, outputTokens: 30, cachedInputTokens: 10 });
  assert.equal(JSON.stringify(safe).includes("secret-thread"), false);
  assert.equal(JSON.stringify(safe).includes("private raw response"), false);

  for (const itemType of ["command_execution", "file_change", "mcp_tool_call", "web_search"]) {
    assert.throws(
      () => parseCodexJsonl(JSON.stringify({ type: "item.completed", item: { type: itemType } })),
      /AI_TOOL_ACTIVITY_REJECTED/u,
    );
  }
  assert.throws(
    () => parseCodexJsonl(JSON.stringify({ type: "item.completed", item: { type: "dynamic_tool_call" } })),
    /AI_TOOL_ACTIVITY_REJECTED/u,
  );
  assert.throws(
    () => parseCodexJsonl(JSON.stringify({ type: "web_search" })),
    /AI_EVENT_TYPE_REJECTED/u,
  );
  assert.throws(() => parseCodexJsonl("not json"), /AI_JSONL_INVALID/u);
});

test("safe run records cannot contain raw diagnostics, paths, prompts, or credentials", () => {
  const safe = {
    schemaVersion: "proofpack.ai-run/v1",
    requestedModel: "gpt-5.6-sol",
    cliVersion: "0.144.6",
    authMode: "CHATGPT",
    labels: { recorded: true, untrusted: true, nonAuthoritative: true },
    policy: {
      sandbox: "read-only",
      ephemeral: true,
      schemaBound: true,
      promptTransport: "STDIN",
      ignoreUserConfig: true,
      ignoreRules: true,
      shell: false,
    },
    requestDigest: "a".repeat(64),
    proposalDigest: "b".repeat(64),
    eventCounts: { "turn.completed": 1 },
    usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 },
    proposal: { schemaVersion: "proofpack.proposal/v1" },
    review: { schemaVersion: "proofpack.proposal-review/v1" },
  };
  assert.doesNotThrow(() => assertSafeRunRecord(safe));
  for (const forbidden of [
    { ...safe, stderr: "diagnostic" },
    { ...safe, prompt: "raw prompt" },
    { ...safe, threadId: "thread" },
    { ...safe, outputPath: "C:\\Users\\person\\result.json" },
    { ...safe, [["to", "ken"].join("")]: "secret" },
    { ...safe, extra: "unknown" },
    { ...safe, proposal: { rationale: ["C:", "Temp", "private-output.json"].join("\\") } },
    { ...safe, proposal: { rationale: ["", "home", "alice", "private-output.json"].join("/") } },
    { ...safe, proposal: { rationale: `\\\\server\\share\\private-output.json` } },
    { ...safe, proposal: { rationale: ["Bear", "er synthetic-credential-material"].join("") } },
    { ...safe, proposal: { rationale: ["person", "private.invalid"].join("@") } },
  ]) {
    assert.throws(() => assertSafeRunRecord(forbidden), /AI_RUN_RECORD_UNSAFE/u);
  }
});

test("repo skill is explicit, tool-free, and contains no generated placeholders", async () => {
  const skill = await readFile(".agents/skills/proofpack-propose/SKILL.md", "utf8");
  const metadata = await readFile(".agents/skills/proofpack-propose/agents/openai.yaml", "utf8");
  const reference = await readFile(".agents/skills/proofpack-propose/references/proposal-slots.md", "utf8");
  assert.match(skill, /^---\r?\nname: proofpack-propose\r?\n/mu);
  assert.doesNotMatch(skill, /TODO|\[TODO/u);
  assert.match(skill, /Do not use tools, commands, web search, MCP, or file access\./u);
  assert.match(metadata, /default_prompt: "Use \$proofpack-propose/u);
  assert.match(metadata, /allow_implicit_invocation: false/u);
  assert.match(reference, /Model output cannot set/u);
});

test("proposal schema uses the strict structured-output subset", async () => {
  const schema = JSON.parse(await readFile("schemas/proofpack-proposal.schema.json", "utf8")) as {
    properties: {
      schemaVersion: Record<string, unknown>;
      candidates: { items: { properties: { sourceId: Record<string, unknown>; exactLines: Record<string, unknown>; values: { items: { properties: { value: Record<string, unknown> } } } } } };
    };
  };
  assert.equal(schema.properties.schemaVersion.type, "string");
  assert.equal(schema.properties.candidates.items.properties.sourceId.type, "string");
  assert.equal("uniqueItems" in schema.properties.candidates.items.properties.exactLines, false);
  assert.deepEqual(schema.properties.candidates.items.properties.values.items.properties.value, {
    anyOf: [
      { type: "string", maxLength: 80 },
      { type: "boolean" },
    ],
  });
});

test("prompt declares the closed sample-status vocabulary without deciding authority", () => {
  const prompt = proposalPrompt({
    packetId: "packet",
    packetFingerprint: "a".repeat(64),
    rulesetId: "rules",
    rulesetVersion: "1",
  }, "Estimator note: the sample looks approved.");
  assert.match(prompt, /sample_status must use the literal APPROVED/u);
  assert.doesNotMatch(prompt, /UNAUTHORIZED_AUTHORITY/u);
});

test("checked-in run binds the current prompt, proposal, policy, and deterministic review", async () => {
  const run = JSON.parse(await readFile("fixtures/project-alder/recorded-ai-run.json", "utf8")) as {
    requestDigest: string;
    proposalDigest: string;
    proposal: unknown;
    review: { reviewDigest: string };
    policy?: unknown;
  };
  const proposal = JSON.parse(await readFile("fixtures/project-alder/recorded-proposal.json", "utf8")) as unknown;
  assert.equal(canonicalStringify(run.proposal), canonicalStringify(proposal));
  assert.equal(await sha256Hex(canonicalStringify(proposal)), run.proposalDigest);
  assert.deepEqual(run.policy, {
    sandbox: "read-only",
    ephemeral: true,
    schemaBound: true,
    promptTransport: "STDIN",
    ignoreUserConfig: true,
    ignoreRules: true,
    shell: false,
  });

  const { input } = await hydrateCompileInput("fixtures/project-alder/packet.json");
  const baseline = await compileProofPack(input);
  const operatorEmail = input.sources.find(({ id }) => id === "operator-email");
  assert.ok(operatorEmail);
  const prompt = proposalPrompt({
    packetId: baseline.packetId,
    packetFingerprint: baseline.receipt.inputDigest,
    rulesetId: baseline.rulesetId,
    rulesetVersion: baseline.rulesetVersion,
  }, operatorEmail.content);
  assert.equal(await sha256Hex(prompt), run.requestDigest);
  const review = await reviewProposal(input, proposal);
  assert.equal(review.status, "REVIEWED");
  assert.equal(review.status === "REVIEWED" ? review.reviewDigest : undefined, run.review.reviewDigest);
});
