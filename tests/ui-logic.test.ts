import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSyntheticReceipt,
  buildHumanDecision,
  formatStatusTransition,
  resolveDiffObservations,
  SYNTHETIC_RECEIPT_LINE,
} from "../app/release-gate-model.ts";
import { compileProofPack, diffCompiledPacks } from "../src/proofpack/index.ts";
import { loadProjectAlder } from "./proofpack-fixtures.ts";

test("replay immutably appends exactly one approved receipt line", async () => {
  const input = await loadProjectAlder();
  const originalSource = input.sources.find(({ id }) => id === "incoming-receipts");
  assert.equal(originalSource?.content, "");

  const replay = appendSyntheticReceipt(input);
  const replaySource = replay.sources.find(({ id }) => id === "incoming-receipts");
  assert.equal(replaySource?.content, `${SYNTHETIC_RECEIPT_LINE}\n`);
  assert.equal(originalSource?.content, "");

  const repeated = appendSyntheticReceipt(replay);
  const repeatedSource = repeated.sources.find(({ id }) => id === "incoming-receipts");
  assert.equal(repeatedSource?.content, `${SYNTHETIC_RECEIPT_LINE}\n`);
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

test("status transitions are only labeled when replay changes a claim", () => {
  assert.equal(formatStatusTransition("CONFLICTED", "VERIFIED"), "CONFLICTED → VERIFIED");
  assert.equal(formatStatusTransition("BLOCKED", "BLOCKED"), null);
  assert.equal(formatStatusTransition(undefined, "VERIFIED"), null);
});

test("causal diff observation ids resolve to exact inspectable anchors", async () => {
  const input = await loadProjectAlder();
  const baseline = await compileProofPack(input);
  const replay = await compileProofPack(appendSyntheticReceipt(input));
  const diff = diffCompiledPacks(baseline, replay);

  const added = resolveDiffObservations(diff.addedObservationIds, replay.observations);
  assert.equal(added.length, 2);
  assert.equal(added.every(({ sourceId }) => sourceId === "incoming-receipts"), true);
  assert.equal(added.every(({ locator }) => locator === "event:traveler_ack@line:1"), true);
  assert.equal(added.every(({ excerpt }) => excerpt === SYNTHETIC_RECEIPT_LINE), true);
  assert.deepEqual(resolveDiffObservations(["not-present"], replay.observations), []);
});
