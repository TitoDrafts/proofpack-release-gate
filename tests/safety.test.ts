import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShareableProjection,
  canonicalStringify,
  compileProofPack,
  renderShareableMarkdown,
  sha256Hex,
  shareableDigestMaterial,
  ShareableExportError,
} from "../src/proofpack/index.ts";
import {
  addRestrictedSentinelSource,
  loadProjectAlder,
  makeAnchor,
  makeClaim,
  makeCompileInput,
  makeSource,
} from "./proofpack-fixtures.ts";

const restrictedSentinel = ["PROOFPACK", "SECRET", "SENTINEL"].join("_");

test("builds an allowlisted projection from verified public evidence only", async () => {
  const result = await compileProofPack(await loadProjectAlder());

  assert.deepEqual(result.shareable.verifiedOutcomes, [{
    title: "Current field dimensions are verified",
    nextStep: "Use the verified field dimensions for fabrication planning.",
  }]);
  const serialized = JSON.stringify(result.shareable);
  for (const restrictedField of [
    "packetId",
    "claimId",
    "sourceId",
    "sourceFile",
    "locator",
    "evidenceIds",
    "excerpt",
    "reasonCodes",
    "diagnostics",
  ]) {
    assert.equal(serialized.includes(`"${restrictedField}"`), false, restrictedField);
  }
  assert.doesNotMatch(serialized, /handoff-draft|field-check\.json|observation-/u);
});

test("never leaks an unrelated restricted sentinel into shareable values or Markdown", async () => {
  const input = addRestrictedSentinelSource(await loadProjectAlder(), restrictedSentinel);
  const result = await compileProofPack(input);

  assert.doesNotMatch(JSON.stringify(result.shareable), new RegExp(restrictedSentinel, "u"));
  assert.doesNotMatch(result.artifacts.shareableMarkdown, new RegExp(restrictedSentinel, "u"));
});

test("omits a verified claim when any contributing observation is restricted", async () => {
  const source = { ...makeSource("evidence", "MATCH"), safety: "RESTRICTED" as const };
  const input = makeCompileInput([makeClaim({
    anchors: [makeAnchor({ safety: "RESTRICTED" })],
    publicEligibleWhenVerified: true,
  })], [source]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "VERIFIED");
  assert.deepEqual(result.shareable.verifiedOutcomes, []);
  assert.doesNotMatch(result.artifacts.shareableMarkdown, /Public claim/u);
});

test("propagates restricted lineage through a verified gate dependency", async () => {
  const restricted = { ...makeSource("restricted", "MATCH"), safety: "RESTRICTED" as const };
  const gateEvidence = makeSource("gate-evidence", "MATCH");
  const dependency = makeClaim({
    id: "restricted-dependency",
    critical: false,
    anchors: [makeAnchor({
      id: "restricted-anchor",
      sourceId: "restricted",
      safety: "RESTRICTED",
    })],
  });
  const gate = makeClaim({
    id: "public-gate",
    kind: "gate",
    anchors: [makeAnchor({ id: "gate-anchor", sourceId: "gate-evidence" })],
    requiresVerified: [dependency.id],
    publicTitle: "Public gate is complete",
  });

  const result = await compileProofPack(makeCompileInput([dependency, gate], [restricted, gateEvidence]));

  assert.equal(result.claims.find(({ id }) => id === gate.id)?.status, "VERIFIED");
  assert.deepEqual(result.shareable.verifiedOutcomes, []);
});

test("rejects ambiguous safety lineage instead of redacting or guessing", async () => {
  const input = await loadProjectAlder();
  input.sources[0]!.safety = undefined as never;
  await assert.rejects(() => compileProofPack(input), /SOURCE_SAFETY_REQUIRED/u);
});

test("rejects a public-eligible compiled claim whose evidence lineage cannot be resolved", async () => {
  const result = await compileProofPack(makeCompileInput([makeClaim()]));
  const corrupted = structuredClone(result);
  corrupted.claims[0]!.evidenceIds = ["observation-missing"];

  await assert.rejects(
    () => buildShareableProjection(corrupted),
    (error: unknown) => error instanceof ShareableExportError
      && error.code === "SHAREABLE_LINEAGE_AMBIGUOUS",
  );
});

test("rejects raw HTML and authored links from public projection fields", async () => {
  const unsafeValues = [
    "<img src=x onerror=alert(1)>",
    "<!DOCTYPE html>",
    "<?xml version='1.0'?>",
    "[open](https://invalid.example)",
    "![image](https://invalid.example/image.png)",
  ];

  for (const publicTitle of unsafeValues) {
    const input = makeCompileInput([makeClaim({ publicTitle })]);
    await assert.rejects(
      () => compileProofPack(input),
      (error: unknown) => error instanceof ShareableExportError
        && error.code === "SHAREABLE_MARKUP_REJECTED",
    );
  }
});

test("escapes inert Markdown punctuation in trusted public rule language", async () => {
  const input = makeCompileInput([makeClaim({
    publicTitle: "Outcome *verified* [public]",
    nextAction: "Use #1 assembly (approved).",
  })]);
  const result = await compileProofPack(input);

  assert.match(result.artifacts.shareableMarkdown, /Outcome \\\*verified\\\* \\\[public\\\]/u);
  assert.match(result.artifacts.shareableMarkdown, /Use \\#1 assembly \\\(approved\\\)\\\./u);
});

test("uses one explicit digest material for projection, Markdown, and receipt", async () => {
  const result = await compileProofPack(await loadProjectAlder());
  const material = shareableDigestMaterial(result.shareable);
  const expected = await sha256Hex(canonicalStringify(material));

  assert.deepEqual(Object.keys(material).sort(), ["packetAlias", "schemaVersion", "verifiedOutcomes"]);
  assert.equal(result.shareable.digest, expected);
  assert.equal(result.receipt.shareableDigest, expected);
  assert.match(await renderShareableMarkdown(result.shareable), new RegExp(expected, "u"));
  assert.equal(result.artifacts.shareableMarkdown, await renderShareableMarkdown(result.shareable));
});

test("rejects a tampered projection digest before rendering Markdown", async () => {
  const result = await compileProofPack(await loadProjectAlder());

  await assert.rejects(
    () => renderShareableMarkdown({ ...result.shareable, digest: "<script>unsafe()</script>" }),
    (error: unknown) => error instanceof ShareableExportError
      && error.code === "SHAREABLE_DIGEST_INVALID",
  );
});

test("rejects a stale valid-hex digest after projection material is copied and changed", async () => {
  const result = await compileProofPack(await loadProjectAlder());
  const stale = {
    ...result.shareable,
    verifiedOutcomes: [{
      ...result.shareable.verifiedOutcomes[0]!,
      title: "Changed after digest",
    }],
  };

  await assert.rejects(
    () => renderShareableMarkdown(stale),
    (error: unknown) => error instanceof ShareableExportError
      && error.code === "SHAREABLE_DIGEST_INVALID",
  );
});

test("verifies and renders a valid shareable projection after JSON transport", async () => {
  const result = await compileProofPack(await loadProjectAlder());
  const transported = JSON.parse(JSON.stringify(result.shareable)) as typeof result.shareable;

  assert.equal(
    await renderShareableMarkdown(transported),
    result.artifacts.shareableMarkdown,
  );
});

test("renders transported outcomes in canonical order under the verified digest", async () => {
  const result = await compileProofPack(makeCompileInput([
    makeClaim({ id: "z-outcome", publicTitle: "Zulu outcome" }),
    makeClaim({ id: "a-outcome", publicTitle: "Alpha outcome" }),
  ]));
  const transported = JSON.parse(JSON.stringify(result.shareable)) as typeof result.shareable;
  transported.verifiedOutcomes.reverse();

  assert.equal(
    await renderShareableMarkdown(transported),
    result.artifacts.shareableMarkdown,
  );
});

test("rejects an unsupported shareable projection schema even with otherwise valid material", async () => {
  const result = await compileProofPack(await loadProjectAlder());
  const transported = JSON.parse(JSON.stringify(result.shareable)) as typeof result.shareable;
  transported.schemaVersion = "proofpack.shareable/v2" as never;

  await assert.rejects(
    () => renderShareableMarkdown(transported),
    (error: unknown) => error instanceof ShareableExportError
      && error.code === "SHAREABLE_DIGEST_INVALID",
  );
});

test("operator artifact contains every required handoff and receipt section", async () => {
  const result = await compileProofPack(await loadProjectAlder());
  const markdown = result.artifacts.operatorMarkdown;

  for (const heading of [
    "# ProofPack operator handoff",
    "## Executive summary",
    "## Done",
    "## Not done",
    "## Next action",
    "## Stop conditions",
    "## Evidence ledger",
    "## Reproducibility/integrity receipt",
  ]) {
    assert.match(markdown, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(markdown, /inputDigest: [a-f0-9]{64}/u);
});
