import assert from "node:assert/strict";
import test from "node:test";
import { compileProofPack } from "../src/proofpack/index.ts";
import type { ClaimStatus, CompileInput } from "../src/proofpack/types.ts";
import {
  makeAnchor,
  makeClaim,
  makeCompileInput,
  makeSource,
} from "./proofpack-fixtures.ts";

type FixtureName =
  | "unopposed direct blocker"
  | "mixed mutually exclusive values"
  | "contradiction-only non-gate evidence"
  | "complete direct predicates"
  | "complete named inference premises"
  | "missing declared evidence";

function statusFixture(name: FixtureName): CompileInput {
  if (name === "unopposed direct blocker") {
    return makeCompileInput([makeClaim({
      kind: "gate",
      anchors: [makeAnchor({ effect: "BLOCK", strength: "DIRECT" })],
      stopCondition: "Stop release.",
    })]);
  }
  if (name === "mixed mutually exclusive values") {
    return makeCompileInput([makeClaim({
      kind: "exclusive",
      anchors: [
        makeAnchor({ id: "value-a", selector: { kind: "line", contains: "VALUE A" }, effect: "ASSERT_VALUE", value: "A" }),
        makeAnchor({ id: "value-b", selector: { kind: "line", contains: "VALUE B" }, effect: "ASSERT_VALUE", value: "B" }),
      ],
    })], [makeSource("evidence", "VALUE A\nVALUE B")]);
  }
  if (name === "contradiction-only non-gate evidence") {
    return makeCompileInput([makeClaim({
      anchors: [makeAnchor({ effect: "CONTRADICT", strength: "DIRECT" })],
    })]);
  }
  if (name === "complete direct predicates") {
    return makeCompileInput([makeClaim({
      anchors: [
        makeAnchor({ id: "predicate-a", selector: { kind: "line", contains: "MATCH A" } }),
        makeAnchor({ id: "predicate-b", selector: { kind: "line", contains: "MATCH B" } }),
      ],
    })], [makeSource("evidence", "MATCH A\nMATCH B")]);
  }
  if (name === "complete named inference premises") {
    return makeCompileInput([makeClaim({
      kind: "inference",
      anchors: [makeAnchor({ strength: "CORROBORATING" })],
    })]);
  }
  return makeCompileInput([makeClaim({
    anchors: [makeAnchor({ selector: { kind: "line", contains: "ABSENT" } })],
  })]);
}

const truthTable: ReadonlyArray<readonly [FixtureName, ClaimStatus]> = [
  ["unopposed direct blocker", "BLOCKED"],
  ["mixed mutually exclusive values", "CONFLICTED"],
  ["contradiction-only non-gate evidence", "CONFLICTED"],
  ["complete direct predicates", "VERIFIED"],
  ["complete named inference premises", "INFERRED"],
  ["missing declared evidence", "NEEDS_CONFIRMATION"],
];

for (const [fixtureName, expected] of truthTable) {
  test(`classifies ${fixtureName} as ${expected}`, async () => {
    const result = await compileProofPack(statusFixture(fixtureName));
    assert.equal(result.claims[0]?.status, expected);
  });
}

test("applies conflict ahead of direct verification", async () => {
  const input = makeCompileInput([makeClaim({
    anchors: [
      makeAnchor({ id: "support", selector: { kind: "line", contains: "YES" } }),
      makeAnchor({ id: "contradiction", selector: { kind: "line", contains: "NO" }, effect: "CONTRADICT" }),
    ],
  })], [makeSource("evidence", "YES\nNO")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "CONFLICTED");
  assert.deepEqual(result.claims[0]?.reasonCodes, ["QUALIFYING_CONTRADICTION"]);
});

test("classifies opposed gate evidence as conflicted instead of blocked", async () => {
  const input = makeCompileInput([makeClaim({
    kind: "gate",
    anchors: [
      makeAnchor({ id: "gate-pass", selector: { kind: "line", contains: "PASS" } }),
      makeAnchor({ id: "gate-block", selector: { kind: "line", contains: "FAIL" }, effect: "BLOCK" }),
    ],
  })], [makeSource("evidence", "PASS\nFAIL")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "CONFLICTED");
  assert.deepEqual(result.claims[0]?.reasonCodes, ["GATE_EVIDENCE_DISAGREEMENT"]);
});

test("treats a corroborating gate blocker as a qualifying contradiction", async () => {
  const input = makeCompileInput([makeClaim({
    kind: "gate",
    anchors: [
      makeAnchor({ id: "gate-pass", selector: { kind: "line", contains: "PASS" } }),
      makeAnchor({
        id: "corroborating-block",
        selector: { kind: "line", contains: "RISK" },
        effect: "BLOCK",
        strength: "CORROBORATING",
      }),
    ],
  })], [makeSource("evidence", "PASS\nRISK")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "CONFLICTED");
  assert.deepEqual(result.claims[0]?.reasonCodes, ["QUALIFYING_CONTRADICTION"]);
});

test("does not treat missing gate evidence as a blocker", async () => {
  const input = makeCompileInput([makeClaim({
    kind: "gate",
    anchors: [makeAnchor({ effect: "BLOCK", selector: { kind: "line", contains: "ABSENT" } })],
  })]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "NEEDS_CONFIRMATION");
});

test("uses a matched exclusive authority resolver to defeat other active values", async () => {
  const input = makeCompileInput([makeClaim({
    kind: "exclusive",
    anchors: [
      makeAnchor({ id: "older", selector: { kind: "line", contains: "OLD" }, effect: "ASSERT_VALUE", value: "OLD" }),
      makeAnchor({ id: "newer", selector: { kind: "line", contains: "NEW" }, effect: "ASSERT_VALUE", value: "NEW" }),
      makeAnchor({ id: "resolver", selector: { kind: "line", contains: "AUTHORITY" }, effect: "ASSERT_VALUE", value: "NEW" }),
    ],
    authorityResolverAnchorId: "resolver",
  })], [makeSource("evidence", "OLD\nNEW\nAUTHORITY")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "VERIFIED");
  assert.deepEqual(result.claims[0]?.reasonCodes, ["AUTHORITY_RESOLVER_APPLIED"]);
});

test("keeps competing values conflicted when the observed resolver asserts an unrelated value", async () => {
  const input = makeCompileInput([makeClaim({
    kind: "exclusive",
    anchors: [
      makeAnchor({ id: "value-a", selector: { kind: "line", contains: "VALUE A" }, effect: "ASSERT_VALUE", value: "A" }),
      makeAnchor({ id: "value-b", selector: { kind: "line", contains: "VALUE B" }, effect: "ASSERT_VALUE", value: "B" }),
      makeAnchor({ id: "resolver", selector: { kind: "line", contains: "AUTHORITY C" }, effect: "ASSERT_VALUE", value: "C" }),
    ],
    authorityResolverAnchorId: "resolver",
  })], [makeSource("evidence", "VALUE A\nVALUE B\nAUTHORITY C")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "CONFLICTED");
  assert.deepEqual(result.claims[0]?.reasonCodes, ["EXCLUSIVE_VALUES_UNRESOLVED"]);
  assert.deepEqual(result.claims[0]?.missingPredicates, []);
});

test("leaves distinct active values conflicted when the resolver does not match", async () => {
  const input = makeCompileInput([makeClaim({
    kind: "exclusive",
    anchors: [
      makeAnchor({ id: "older", selector: { kind: "line", contains: "OLD" }, effect: "ASSERT_VALUE", value: "OLD" }),
      makeAnchor({ id: "newer", selector: { kind: "line", contains: "NEW" }, effect: "ASSERT_VALUE", value: "NEW" }),
      makeAnchor({ id: "resolver", selector: { kind: "line", contains: "AUTHORITY" }, effect: "ASSERT_VALUE", value: "NEW" }),
    ],
    authorityResolverAnchorId: "resolver",
  })], [makeSource("evidence", "OLD\nNEW")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "CONFLICTED");
  assert.deepEqual(result.claims[0]?.reasonCodes, ["EXCLUSIVE_VALUES_UNRESOLVED"]);
});

test("propagates dependency disagreement but keeps a local blocker authoritative", async () => {
  const conflicted = makeClaim({
    id: "dependency",
    critical: false,
    anchors: [makeAnchor({ id: "dependency-contradiction", effect: "CONTRADICT" })],
  });
  const dependentGate = makeClaim({
    id: "dependent-gate",
    kind: "gate",
    anchors: [makeAnchor({ id: "gate-support" })],
    requiresVerified: ["dependency"],
  });
  const blockedGate = makeClaim({
    id: "blocked-gate",
    kind: "gate",
    anchors: [makeAnchor({ id: "local-blocker", effect: "BLOCK" })],
    requiresVerified: ["dependency"],
  });
  const result = await compileProofPack(makeCompileInput([dependentGate, conflicted, blockedGate]));

  assert.deepEqual(result.claims.map(({ id, status }) => ({ id, status })), [
    { id: "blocked-gate", status: "BLOCKED" },
    { id: "dependency", status: "CONFLICTED" },
    { id: "dependent-gate", status: "CONFLICTED" },
  ]);
});

test("requires verified dependencies for a named inference and emits its premise evidence", async () => {
  const directPremise = makeClaim({
    id: "premise",
    critical: false,
    anchors: [makeAnchor({ id: "premise-direct" })],
  });
  const inference = makeClaim({
    id: "inference",
    kind: "inference",
    anchors: [makeAnchor({ id: "inference-corroboration", strength: "CORROBORATING" })],
    requiresVerified: ["premise"],
  });

  const result = await compileProofPack(makeCompileInput([inference, directPremise]));
  const inferred = result.claims.find(({ id }) => id === "inference");
  const premise = result.claims.find(({ id }) => id === "premise");
  const premiseEvidenceIds = result.observations
    .filter(({ anchorId }) => anchorId === "premise-direct")
    .map(({ id }) => id)
    .sort();
  const expectedInferenceEvidenceIds = result.observations
    .filter(({ anchorId }) => anchorId === "premise-direct" || anchorId === "inference-corroboration")
    .map(({ id }) => id)
    .sort();

  assert.equal(inferred?.status, "INFERRED");
  assert.equal(premiseEvidenceIds.length, 1);
  assert.equal(expectedInferenceEvidenceIds.length, 2);
  assert.deepEqual(premise?.evidenceIds, premiseEvidenceIds);
  assert.deepEqual(inferred?.evidenceIds, expectedInferenceEvidenceIds);
});

test("prefers complete direct predicates over complete inference premises", async () => {
  const input = makeCompileInput([makeClaim({
    kind: "inference",
    anchors: [
      makeAnchor({ id: "direct", selector: { kind: "line", contains: "DIRECT" }, strength: "DIRECT" }),
      makeAnchor({ id: "premise", selector: { kind: "line", contains: "PREMISE" }, strength: "CORROBORATING" }),
    ],
  })], [makeSource("evidence", "DIRECT\nPREMISE")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "VERIFIED");
  assert.deepEqual(result.claims[0]?.reasonCodes, ["DIRECT_PREDICATES_COMPLETE"]);
});

test("keeps critical inferred and unresolved claims on HOLD", async () => {
  const inferred = await compileProofPack(statusFixture("complete named inference premises"));
  const missing = await compileProofPack(statusFixture("missing declared evidence"));

  assert.equal(inferred.handoff.decision, "HOLD");
  assert.equal(missing.handoff.decision, "HOLD");
});
