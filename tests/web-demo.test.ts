import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";
import { canonicalStringify, compileProofPack, diffCompiledPacks, materializeProposal, reviewProposal, sha256Hex } from "../src/proofpack/index.ts";
import type { RecordedProposalArtifact } from "../src/proofpack/demo-bundle.ts";
import type { CompileInput } from "../src/proofpack/types.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

test("web demo raw bundle reviews, applies, and exactly resets the recorded proposal", async (context) => {
  const vite = await createServer({
    root: projectRoot,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  context.after(async () => vite.close());
  const demoModule = await vite.ssrLoadModule("/src/proofpack/demo-bundle.ts") as {
    createDemoInput: () => CompileInput;
    createRecordedProposalArtifact: () => RecordedProposalArtifact;
  };

  const first = demoModule.createDemoInput();
  const second = demoModule.createDemoInput();
  assert.notStrictEqual(first.manifest, second.manifest);
  assert.notStrictEqual(first.rules, second.rules);
  assert.notStrictEqual(first.sources, second.sources);
  assert.notStrictEqual(first.rules.claims[0], second.rules.claims[0]);
  assert.notStrictEqual(first.sources[0], second.sources[0]);
  first.rules.claims[0]!.title = "mutated only in first input";
  first.sources[0]!.content = "mutated only in first input";
  assert.notEqual(first.rules.claims[0]!.title, second.rules.claims[0]!.title);
  assert.notEqual(first.sources[0]!.content, second.sources[0]!.content);

  const baselineInput = demoModule.createDemoInput();
  const operatorEmail = baselineInput.sources.find(({ id }) => id === "operator-email");
  assert.ok(operatorEmail);
  assert.equal(operatorEmail.file, "operator-email.md");
  assert.equal(operatorEmail.mediaType, "text/markdown");
  assert.equal(operatorEmail.safety, "RESTRICTED");
  assert.match(operatorEmail.content, /^# Synthetic Operator Email$/mu);
  assert.match(operatorEmail.content, /^Estimator note: the PL-18 sample looks approved\.$/mu);
  const baseline = await compileProofPack(baselineInput);
  assert.deepEqual(baseline.claims.map(({ id, status }) => ({ id, status })), [
    { id: "fabrication-release", status: "BLOCKED" },
    { id: "field-dimensions-current", status: "VERIFIED" },
    { id: "finish-coordinated", status: "CONFLICTED" },
    { id: "rfi-incorporated", status: "NEEDS_CONFIRMATION" },
    { id: "traveler-current-finish", status: "INFERRED" },
  ]);

  const artifact = demoModule.createRecordedProposalArtifact();
  const secondArtifact = demoModule.createRecordedProposalArtifact();
  assert.deepEqual(
    {
      recorded: artifact.recorded,
      trust: artifact.trust,
      authority: artifact.authority,
      model: artifact.model,
      cliVersion: artifact.cliVersion,
      authMode: artifact.authMode,
    },
    {
      recorded: true,
      trust: "UNTRUSTED",
      authority: "NON_AUTHORITATIVE",
      model: "gpt-5.6-sol",
      cliVersion: "0.144.6",
      authMode: "CHATGPT",
    },
  );
  assert.notStrictEqual(artifact.proposal, secondArtifact.proposal);
  assert.equal(await sha256Hex(canonicalStringify(artifact.proposal)), artifact.proposalDigest);
  const review = await reviewProposal(baselineInput, artifact.proposal);
  assert.equal(review.status, "REVIEWED");
  assert.equal(review.status === "REVIEWED" ? review.reviewDigest : undefined, artifact.recordedReviewDigest);
  assert.deepEqual(
    review.candidates
      .map(({ slotId, decision }) => ({ slotId, decision }))
      .sort((left, right) => left.slotId.localeCompare(right.slotId)),
    [
      { slotId: "sample-approval", decision: "REJECTED" },
      { slotId: "traveler-finish-cut-state", decision: "ADMISSIBLE" },
      { slotId: "traveler-rfi-revision", decision: "ADMISSIBLE" },
    ],
  );
  const appliedInput = await materializeProposal(baselineInput, artifact.proposal);
  const applied = await compileProofPack(appliedInput);
  const diff = diffCompiledPacks(baseline, applied);
  assert.deepEqual(diff.changedClaimIds, ["finish-coordinated", "rfi-incorporated"]);
  assert.equal(applied.claims.find(({ id }) => id === "fabrication-release")?.status, "BLOCKED");
  assert.equal(applied.handoff.decision, "HOLD");

  const reset = await compileProofPack(demoModule.createDemoInput());
  assert.deepEqual(reset.receipt, baseline.receipt);
  assert.deepEqual(reset.artifacts, baseline.artifacts);
});
