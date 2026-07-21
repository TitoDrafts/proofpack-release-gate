import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildHumanDecision,
  formatStatusTransition,
  hasProposalMaterialization,
  proposalCanApply,
  proposalDecisionCounts,
  resolveDiffObservations,
} from "../app/release-gate-model.ts";
import {
  compileProofPack,
  diffCompiledPacks,
  materializeProposal,
  PROPOSAL_TRAVELER_ACK_PREFIX,
  reviewProposal,
} from "../src/proofpack/index.ts";
import { loadProjectAlder } from "./proofpack-fixtures.ts";

async function recordedProposal(): Promise<unknown> {
  return JSON.parse(await readFile(
    new URL("../fixtures/project-alder/recorded-proposal.json", import.meta.url),
    "utf8",
  )) as unknown;
}

test("recorded proposal review is pure and exposes exactly two applicable bindings", async () => {
  const input = await loadProjectAlder();
  const before = structuredClone(input);
  const proposal = await recordedProposal();

  const review = await reviewProposal(input, proposal);

  assert.deepEqual(input, before);
  assert.deepEqual(proposalDecisionCounts(review), { admissible: 2, rejected: 1 });
  assert.equal(proposalCanApply(review), true);
  assert.equal(proposalCanApply(await reviewProposal(input, {})), false);
});

test("human HOLD acknowledgement does not require exception reasoning", () => {
  assert.deepEqual(buildHumanDecision("HOLD", "", "digest-a"), {
    ok: true,
    record: { kind: "HOLD", reason: "", inputDigest: "digest-a" },
  });
});

test("human exception requires and preserves a visible reason", () => {
  assert.deepEqual(buildHumanDecision("EXCEPTION", "   ", "digest-a"), {
    ok: false,
    message: "Add a reason before recording an exception request.",
  });
  assert.deepEqual(buildHumanDecision("EXCEPTION", "  PM accepts sample risk.  ", "digest-a"), {
    ok: true,
    record: {
      kind: "EXCEPTION",
      reason: "PM accepts sample risk.",
      inputDigest: "digest-a",
    },
  });
});

test("status transitions are only labeled when proposal application changes a claim", () => {
  assert.equal(formatStatusTransition("CONFLICTED", "VERIFIED"), "CONFLICTED → VERIFIED");
  assert.equal(formatStatusTransition("BLOCKED", "BLOCKED"), null);
  assert.equal(formatStatusTransition(undefined, "VERIFIED"), null);
});

test("causal diff observation ids resolve to exact inspectable anchors", async () => {
  const input = await loadProjectAlder();
  const baseline = await compileProofPack(input);
  const materialized = await materializeProposal(input, await recordedProposal());
  const replay = await compileProofPack(materialized);
  const diff = diffCompiledPacks(baseline, replay);

  const added = resolveDiffObservations(diff.addedObservationIds, replay.observations);
  assert.equal(added.length, 2);
  assert.equal(added.every(({ sourceId }) => sourceId === "incoming-receipts"), true);
  assert.equal(added.every(({ locator }) => locator === "event:traveler_ack@line:1"), true);
  assert.equal(added.every(({ excerpt }) => excerpt.startsWith(`${PROPOSAL_TRAVELER_ACK_PREFIX} `)), true);
  assert.equal(added.every(({ excerpt }) => excerpt.includes("origin=proposal_gate")), true);
  assert.deepEqual(resolveDiffObservations(["not-present"], replay.observations), []);
});

test("reset input clears proposal materialization and restores the baseline receipt", async () => {
  const baselineInput = await loadProjectAlder();
  const baseline = await compileProofPack(baselineInput);
  const appliedInput = await materializeProposal(baselineInput, await recordedProposal());
  assert.equal(hasProposalMaterialization(appliedInput), true);

  const resetInput = await loadProjectAlder();
  const reset = await compileProofPack(resetInput);
  assert.equal(hasProposalMaterialization(resetInput), false);
  assert.deepEqual(reset.receipt, baseline.receipt);
});
