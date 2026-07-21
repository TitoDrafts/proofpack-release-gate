import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReceipt,
  canonicalStringify,
  compileProofPack,
  diffCompiledPacks,
  normalizeCompileInput,
  PackDiffError,
  sha256Hex,
  verifyReceipt,
  type Receipt,
} from "../src/proofpack/index.ts";
import { appendReceipt, loadProjectAlder } from "./proofpack-fixtures.ts";

const replayLine = "traveler_ack rfi=RFI-042 rev=C finish=PL-18 cut_started=false";
const digestFields = [
  "inputDigest",
  "observationDigest",
  "ledgerDigest",
  "handoffDigest",
  "shareableDigest",
] as const;

test("builds full lowercase SHA-256 stage receipts deterministically", async () => {
  const input = await loadProjectAlder();
  const first = await compileProofPack(input);
  const second = await compileProofPack(input);

  assert.deepEqual(first.receipt, second.receipt);
  assert.deepEqual(
    {
      schemaVersion: first.receipt.schemaVersion,
      algorithm: first.receipt.algorithm,
      packetId: first.receipt.packetId,
      rulesetId: first.receipt.rulesetId,
      rulesetVersion: first.receipt.rulesetVersion,
      engineVersion: first.receipt.engineVersion,
    },
    {
      schemaVersion: "proofpack.receipt/v1",
      algorithm: "SHA-256",
      packetId: input.manifest.packetId,
      rulesetId: input.rules.rulesetId,
      rulesetVersion: input.rules.rulesetVersion,
      engineVersion: input.rules.engineVersion,
    },
  );
  for (const field of digestFields) {
    assert.match(first.receipt[field], /^[a-f0-9]{64}$/u, field);
  }
});

test("maps each receipt digest to its independently canonicalized semantic stage", async () => {
  const input = await loadProjectAlder();
  const result = await compileProofPack(input);
  const expected = {
    inputDigest: await sha256Hex(canonicalStringify(normalizeCompileInput(input))),
    observationDigest: await sha256Hex(canonicalStringify(result.observations)),
    ledgerDigest: await sha256Hex(canonicalStringify(result.claims)),
    handoffDigest: await sha256Hex(canonicalStringify(result.handoff)),
    shareableDigest: result.shareable.digest,
  };

  assert.deepEqual(Object.fromEntries(
    digestFields.map((field) => [field, result.receipt[field]]),
  ), expected);
});

test("verifyReceipt recompiles input and compares every receipt field", async () => {
  const input = await loadProjectAlder();
  const result = await compileProofPack(input);
  assert.equal(await verifyReceipt(input, result.receipt), true);

  for (const field of Object.keys(result.receipt) as Array<keyof Receipt>) {
    const tampered = { ...result.receipt, [field]: `${result.receipt[field]}-tampered` } as Receipt;
    assert.equal(await verifyReceipt(input, tampered), false, field);
  }

  const changedInput = structuredClone(input);
  changedInput.manifest.title = `${changedInput.manifest.title} changed`;
  assert.equal(await verifyReceipt(changedInput, result.receipt), false);
  assert.equal(await verifyReceipt(input, { ...result.receipt, extra: "untrusted" } as Receipt), false);
});

test("buildReceipt and verifyReceipt share semantic input normalization", async () => {
  const input = await loadProjectAlder();
  input.manifest.title = "Project Cafe\u0301";
  input.manifest.asOf = "2026-07-21T07:00:00.000+02:00";
  for (const declaration of input.manifest.sources) {
    const source = input.sources.find(({ id }) => id === declaration.id);
    assert.ok(source);
    const hour = Number(declaration.capturedAt.slice(11, 13));
    const shifted = `${declaration.capturedAt.slice(0, 11)}${String(hour + 2).padStart(2, "0")}${declaration.capturedAt.slice(13, -1)}+02:00`;
    declaration.capturedAt = shifted;
    source.capturedAt = shifted;
    source.content = source.content.replace(/\n/gu, "\r\n");
  }
  const compiled = await compileProofPack(input);
  const rebuilt = await buildReceipt({
    input,
    observations: compiled.observations,
    claims: compiled.claims,
    handoff: compiled.handoff,
    shareable: compiled.shareable,
  });

  assert.deepEqual(rebuilt, compiled.receipt);
  assert.equal(await verifyReceipt(input, rebuilt), true);
});

test("replay changes exactly the two causal claims and leaves the active sample gate blocked", async () => {
  const beforeInput = await loadProjectAlder();
  const before = await compileProofPack(beforeInput);
  const afterInput = appendReceipt(beforeInput, replayLine);
  const after = await compileProofPack(afterInput);
  const diff = diffCompiledPacks(before, after);

  assert.notEqual(after.receipt.inputDigest, before.receipt.inputDigest);
  assert.deepEqual(diff.changedClaimIds, ["finish-coordinated", "rfi-incorporated"]);
  assert.deepEqual(diff.unchangedClaimIds, [
    "fabrication-release",
    "field-dimensions-current",
    "traveler-current-finish",
  ]);
  assert.equal(after.claims.find(({ id }) => id === "fabrication-release")?.status, "BLOCKED");
  assert.equal(after.claims.find(({ id }) => id === "finish-coordinated")?.status, "VERIFIED");
  assert.equal(after.claims.find(({ id }) => id === "rfi-incorporated")?.status, "VERIFIED");
  assert.deepEqual(diff.removedObservationIds, []);
  assert.equal(diff.addedObservationIds.length, 2);
  assert.deepEqual(diff.addedObservationIds, [...diff.addedObservationIds].sort());
  assert.deepEqual(diff.changedHandoffFields, ["done", "notDone", "stopConditions", "summary"]);
});

test("replay plus sample approval satisfies the dependency-established fabrication gate", async () => {
  const input = appendReceipt(await loadProjectAlder(), replayLine);
  const sampleRegister = input.sources.find(({ id }) => id === "sample-register");
  assert.ok(sampleRegister);
  sampleRegister.content = sampleRegister.content.replace('"status": "PENDING"', '"status": "APPROVED"');

  const result = await compileProofPack(input);

  assert.equal(result.claims.find(({ id }) => id === "fabrication-release")?.status, "VERIFIED");
  assert.equal(result.handoff.decision, "READY");
});

test("fabrication release requires explicit sample approval and fails closed for every other sample state", async () => {
  const cases = [
    { sampleStatus: "APPROVED", claimStatus: "VERIFIED", decision: "READY", missing: [] },
    { sampleStatus: "PENDING", claimStatus: "BLOCKED", decision: "HOLD", missing: [] },
    { sampleStatus: "REJECTED", claimStatus: "BLOCKED", decision: "HOLD", missing: [] },
    {
      sampleStatus: undefined,
      claimStatus: "NEEDS_CONFIRMATION",
      decision: "HOLD",
      missing: ["sample-pl18-approved"],
    },
  ] as const;

  for (const item of cases) {
    const input = appendReceipt(await loadProjectAlder(), replayLine);
    const sampleRegister = input.sources.find(({ id }) => id === "sample-register");
    assert.ok(sampleRegister);
    const document = JSON.parse(sampleRegister.content) as { sample: { status?: string } };
    if (item.sampleStatus === undefined) {
      delete document.sample.status;
    } else {
      document.sample.status = item.sampleStatus;
    }
    sampleRegister.content = JSON.stringify(document, null, 2);

    const result = await compileProofPack(input);
    const release = result.claims.find(({ id }) => id === "fabrication-release");

    assert.equal(release?.status, item.claimStatus, item.sampleStatus ?? "missing");
    assert.equal(result.handoff.decision, item.decision, item.sampleStatus ?? "missing");
    assert.deepEqual(release?.missingPredicates, item.missing, item.sampleStatus ?? "missing");
  }
});

test("reset recompilation restores the exact original receipt", async () => {
  const beforeInput = await loadProjectAlder();
  const before = await compileProofPack(beforeInput);
  const after = await compileProofPack(appendReceipt(beforeInput, replayLine));
  const reset = await compileProofPack(beforeInput);

  assert.notDeepEqual(after.receipt, before.receipt);
  assert.deepEqual(reset.receipt, before.receipt);
});

test("causal diff reports exact before and after stage digests", async () => {
  const input = await loadProjectAlder();
  const before = await compileProofPack(input);
  const after = await compileProofPack(appendReceipt(input, replayLine));
  const diff = diffCompiledPacks(before, after);

  assert.deepEqual(diff.beforeReceiptDigests, Object.fromEntries(
    digestFields.map((field) => [field, before.receipt[field]]),
  ));
  assert.deepEqual(diff.afterReceiptDigests, Object.fromEntries(
    digestFields.map((field) => [field, after.receipt[field]]),
  ));
  assert.notEqual(diff.beforeReceiptDigests.ledgerDigest, diff.afterReceiptDigests.ledgerDigest);
  assert.equal(diff.beforeReceiptDigests.shareableDigest, diff.afterReceiptDigests.shareableDigest);
});

test("causal diff rejects incompatible packet and engine identities", async () => {
  const pack = await compileProofPack(await loadProjectAlder());
  for (const field of ["packetId", "rulesetId", "rulesetVersion", "engineVersion"] as const) {
    const incompatible = structuredClone(pack);
    incompatible[field] = `${incompatible[field]}-different`;

    assert.throws(
      () => diffCompiledPacks(pack, incompatible),
      (error: unknown) => error instanceof PackDiffError
        && error.code === "PACK_DIFF_IDENTITY_MISMATCH"
        && /packet identity, ruleset\/version identity, and engine identity/i.test(error.message),
      field,
    );
  }
});
