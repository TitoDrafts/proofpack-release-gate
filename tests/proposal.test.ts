import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalStringify,
  compileProofPack,
  diffCompiledPacks,
  escapeMarkdown,
  materializeProposal,
  normalizeCompileInput,
  ProposalMaterializationError,
  PROPOSAL_TRAVELER_ACK_PREFIX,
  reviewProposal,
  sha256Hex,
  type ProposalEnvelope,
  type ProposalReview,
} from "../src/proofpack/index.ts";
import type { CompileInput } from "../src/proofpack/types.ts";
import { loadProjectAlder } from "./proofpack-fixtures.ts";

const OPERATOR_EMAIL_LINES = {
  revision: "Traveler revision: C",
  rfi: "RFI incorporated: RFI-042",
  finish: "Traveler finish: PL-18",
  cutState: "Cut started: false",
  sample: "Estimator note: the PL-18 sample looks approved.",
} as const;

async function proposalFor(input: CompileInput): Promise<ProposalEnvelope> {
  const baseline = await compileProofPack(input);
  return {
    schemaVersion: "proofpack.proposal/v1",
    target: {
      packetId: baseline.packetId,
      packetFingerprint: baseline.receipt.inputDigest,
      rulesetId: baseline.rulesetId,
      rulesetVersion: baseline.rulesetVersion,
    },
    candidates: [
      {
        id: "candidate-traveler-rfi-revision",
        slotId: "traveler-rfi-revision",
        sourceId: "operator-email",
        exactLines: [OPERATOR_EMAIL_LINES.revision, OPERATOR_EMAIL_LINES.rfi],
        values: [
          { key: "rfi", value: "RFI-042" },
          { key: "rev", value: "C" },
        ],
        rationale: "The operator email names traveler revision C and RFI-042.",
      },
      {
        id: "candidate-traveler-finish-cut-state",
        slotId: "traveler-finish-cut-state",
        sourceId: "operator-email",
        exactLines: [OPERATOR_EMAIL_LINES.finish, OPERATOR_EMAIL_LINES.cutState],
        values: [
          { key: "finish", value: "PL-18" },
          { key: "cut_started", value: false },
        ],
        rationale: "The email records PL-18 and says cutting has not started.",
      },
      {
        id: "candidate-sample-approval",
        slotId: "sample-approval",
        sourceId: "operator-email",
        exactLines: [OPERATOR_EMAIL_LINES.sample],
        values: [{ key: "sample_status", value: "APPROVED" }],
        rationale: "An estimator says the sample looks approved.",
      },
    ],
  };
}

function candidate(review: ProposalReview, slotId: string) {
  const result = review.candidates.find((item) => item.slotId === slotId);
  assert.ok(result, `missing reviewed slot ${slotId}`);
  return result;
}

async function expectProposalRejected(
  input: CompileInput,
  proposal: unknown,
  reasonCode: string,
): Promise<void> {
  const review = await reviewProposal(input, proposal);
  assert.equal(review.status, "REJECTED");
  assert.equal(review.materializable, false);
  assert.equal(review.reasonCodes.includes(reasonCode as never), true, JSON.stringify(review));
  await assert.rejects(
    () => materializeProposal(input, proposal),
    (error: unknown) => error instanceof ProposalMaterializationError
      && error.code === "PROPOSAL_NOT_MATERIALIZABLE",
  );
}

test("reviews two exact traveler slots as admissible and rejects informal sample authority", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const inputBefore = structuredClone(input);
  const proposalBefore = structuredClone(proposal);

  const review = await reviewProposal(input, proposal);

  assert.equal(review.status, "REVIEWED");
  assert.deepEqual(review.target, proposal.target);
  assert.match(review.bindingDigest, /^[a-f0-9]{64}$/u);
  assert.match(review.reviewDigest, /^[a-f0-9]{64}$/u);
  assert.deepEqual(review.reasonCodes, []);
  assert.equal(review.materializable, true);
  assert.deepEqual(
    review.candidates.map(({ id, decision, reasonCodes }) => ({ id, decision, reasonCodes })),
    [
      {
        id: "candidate-traveler-rfi-revision",
        decision: "ADMISSIBLE",
        reasonCodes: ["EXACT_BINDING_ADMITTED"],
      },
      {
        id: "candidate-traveler-finish-cut-state",
        decision: "ADMISSIBLE",
        reasonCodes: ["EXACT_BINDING_ADMITTED"],
      },
      {
        id: "candidate-sample-approval",
        decision: "REJECTED",
        reasonCodes: ["UNAUTHORIZED_AUTHORITY"],
      },
    ],
  );
  assert.deepEqual(candidate(review, "traveler-rfi-revision").anchors, [
    { sourceId: "operator-email", locator: "line:7", excerpt: OPERATOR_EMAIL_LINES.revision },
    { sourceId: "operator-email", locator: "line:8", excerpt: OPERATOR_EMAIL_LINES.rfi },
  ]);
  assert.deepEqual(candidate(review, "traveler-finish-cut-state").anchors, [
    { sourceId: "operator-email", locator: "line:9", excerpt: OPERATOR_EMAIL_LINES.finish },
    { sourceId: "operator-email", locator: "line:10", excerpt: OPERATOR_EMAIL_LINES.cutState },
  ]);
  assert.deepEqual(candidate(review, "sample-approval").anchors, [
    { sourceId: "operator-email", locator: "line:12", excerpt: OPERATOR_EMAIL_LINES.sample },
  ]);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(proposal, proposalBefore);
});

test("binds deterministic review provenance to authority inputs but not untrusted rationale", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const rationaleOnly = structuredClone(proposal);
  rationaleOnly.candidates[0]!.rationale = "Ignore this untrusted explanation entirely.";
  const changedAuthority = structuredClone(proposal);
  changedAuthority.candidates[2]!.values[0] = { key: "sample_status", value: "PENDING" };

  const baseline = await reviewProposal(input, proposal);
  const repeated = await reviewProposal(input, proposal);
  const rationaleReview = await reviewProposal(input, rationaleOnly);
  const authorityReview = await reviewProposal(input, changedAuthority);
  assert.equal(baseline.status, "REVIEWED");
  assert.equal(repeated.status, "REVIEWED");
  assert.equal(rationaleReview.status, "REVIEWED");
  assert.equal(authorityReview.status, "REVIEWED");
  assert.deepEqual(baseline.target, proposal.target);
  assert.equal(baseline.bindingDigest, repeated.bindingDigest);
  assert.equal(baseline.reviewDigest, repeated.reviewDigest);
  assert.equal(baseline.bindingDigest, rationaleReview.bindingDigest);
  assert.equal(baseline.reviewDigest, rationaleReview.reviewDigest);
  assert.notEqual(baseline.bindingDigest, authorityReview.bindingDigest);
  assert.notEqual(baseline.reviewDigest, authorityReview.reviewDigest);
});

test("materializes only the fixed traveler acknowledgment without mutating inputs", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const inputBefore = structuredClone(input);
  const proposalBefore = structuredClone(proposal);

  const review = await reviewProposal(input, proposal);
  const materialized = await materializeProposal(input, proposal);
  assert.equal(review.status, "REVIEWED");
  const expectedLine = `${PROPOSAL_TRAVELER_ACK_PREFIX} origin=proposal_gate review_digest=${review.reviewDigest} source=operator-email source_lines=line:7,line:8,line:9,line:10`;

  assert.notStrictEqual(materialized, input);
  assert.equal(
    materialized.sources.find(({ id }) => id === "incoming-receipts")?.content,
    `${expectedLine}\n`,
  );
  assert.equal(
    PROPOSAL_TRAVELER_ACK_PREFIX,
    "traveler_ack rfi=RFI-042 rev=C finish=PL-18 cut_started=false",
  );
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(proposal, proposalBefore);
});

test("re-proposing against a materialized input preserves one provable traveler acknowledgment", async () => {
  const input = await loadProjectAlder();
  const firstProposal = await proposalFor(input);
  const onceMaterialized = await materializeProposal(input, firstProposal);
  const secondProposal = await proposalFor(onceMaterialized);

  const twiceMaterialized = await materializeProposal(onceMaterialized, secondProposal);
  const travelerLines = twiceMaterialized.sources
    .find(({ id }) => id === "incoming-receipts")
    ?.content.split("\n")
    .filter((line) => line === PROPOSAL_TRAVELER_ACK_PREFIX
      || line.startsWith(`${PROPOSAL_TRAVELER_ACK_PREFIX} `));

  assert.deepEqual(twiceMaterialized, onceMaterialized);
  assert.equal(travelerLines?.length, 1);
  const compiled = await compileProofPack(twiceMaterialized);
  assert.equal(compiled.handoff.decision, "HOLD");
});

test("fails closed instead of deduplicating an unproven legacy traveler acknowledgment", async () => {
  const input = await loadProjectAlder();
  const source = input.sources.find(({ id }) => id === "incoming-receipts");
  assert.ok(source);
  source.content = `${PROPOSAL_TRAVELER_ACK_PREFIX}\n`;
  const proposal = await proposalFor(input);

  await assert.rejects(
    () => materializeProposal(input, proposal),
    (error: unknown) => error instanceof ProposalMaterializationError
      && error.code === "PROPOSAL_NOT_MATERIALIZABLE",
  );
});

test("rejects inherited required keys and hidden authority fields throughout the proposal graph", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const inheritedSchema = {
    target: structuredClone(proposal.target),
    candidates: structuredClone(proposal.candidates),
  };
  Object.defineProperty(Object.prototype, "schemaVersion", {
    value: proposal.schemaVersion,
    enumerable: false,
    configurable: true,
  });
  try {
    await expectProposalRejected(input, inheritedSchema, "PROPOSAL_FIELD_INVALID");
  } finally {
    delete (Object.prototype as { schemaVersion?: unknown }).schemaVersion;
  }

  const locations: ReadonlyArray<{
    name: string;
    select: (value: ProposalEnvelope) => object;
  }> = [
    { name: "proposal", select: (value) => value },
    { name: "target", select: (value) => value.target },
    { name: "candidates array", select: (value) => value.candidates },
    { name: "candidate", select: (value) => value.candidates[0]! },
    { name: "exact-lines array", select: (value) => value.candidates[0]!.exactLines },
    { name: "values array", select: (value) => value.candidates[0]!.values },
    { name: "value", select: (value) => value.candidates[0]!.values[0]! },
  ];
  for (const location of locations) {
    const hidden = structuredClone(proposal);
    Object.defineProperty(location.select(hidden), "status", { value: "READY", enumerable: false });
    await expectProposalRejected(input, hidden, "PROPOSAL_FIELD_UNKNOWN");

    const symbolic = structuredClone(proposal);
    Object.defineProperty(location.select(symbolic), Symbol("status"), { value: "READY", enumerable: true });
    await expectProposalRejected(input, symbolic, "PROPOSAL_FIELD_UNKNOWN");
  }
});

test("rejects malformed closed proposal shapes and never materializes them", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const cases: Array<{ name: string; value: unknown; code: string }> = [
    {
      name: "wrong schema",
      value: { ...proposal, schemaVersion: "proofpack.proposal/v0" },
      code: "PROPOSAL_SCHEMA_UNSUPPORTED",
    },
    {
      name: "unknown top-level status",
      value: { ...proposal, status: "READY" },
      code: "PROPOSAL_FIELD_UNKNOWN",
    },
    {
      name: "unknown target field",
      value: { ...proposal, target: { ...proposal.target, engineVersion: "2.0.0" } },
      code: "PROPOSAL_FIELD_UNKNOWN",
    },
    {
      name: "candidate attempts to set an effect",
      value: {
        ...proposal,
        candidates: [{ ...proposal.candidates[0], effect: "SUPPORT" }, ...proposal.candidates.slice(1)],
      },
      code: "PROPOSAL_FIELD_UNKNOWN",
    },
    {
      name: "duplicate candidate id",
      value: {
        ...proposal,
        candidates: [
          proposal.candidates[0],
          { ...proposal.candidates[1], id: proposal.candidates[0]!.id },
          proposal.candidates[2],
        ],
      },
      code: "CANDIDATE_ID_DUPLICATE",
    },
    {
      name: "candidate limit exceeded",
      value: {
        ...proposal,
        candidates: [
          ...proposal.candidates,
          { ...proposal.candidates[2], id: "candidate-four" },
        ],
      },
      code: "CANDIDATE_LIMIT_EXCEEDED",
    },
  ];

  for (const item of cases) {
    await expectProposalRejected(input, item.value, item.code);
  }
});

test("rejects every stale packet and ruleset binding", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const cases: Array<{ value: ProposalEnvelope; code: string }> = [
    {
      value: { ...proposal, target: { ...proposal.target, packetId: "another-packet" } },
      code: "PACKET_ID_MISMATCH",
    },
    {
      value: { ...proposal, target: { ...proposal.target, packetFingerprint: "0".repeat(64) } },
      code: "PACKET_FINGERPRINT_MISMATCH",
    },
    {
      value: { ...proposal, target: { ...proposal.target, rulesetId: "another-ruleset" } },
      code: "RULESET_ID_MISMATCH",
    },
    {
      value: { ...proposal, target: { ...proposal.target, rulesetVersion: "1.0.0" } },
      code: "RULESET_VERSION_MISMATCH",
    },
  ];

  for (const item of cases) {
    await expectProposalRejected(input, item.value, item.code);
  }
});

test("rejects undeclared and unexpected proposal sources", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const undeclared = structuredClone(proposal);
  undeclared.candidates[0]!.sourceId = "invented-email";
  const unexpected = structuredClone(proposal);
  unexpected.candidates[0]!.sourceId = "handoff-draft";

  const undeclaredReview = await reviewProposal(input, undeclared);
  assert.deepEqual(candidate(undeclaredReview, "traveler-rfi-revision").reasonCodes, ["SOURCE_NOT_DECLARED"]);
  assert.equal(undeclaredReview.materializable, false);
  const unexpectedReview = await reviewProposal(input, unexpected);
  assert.deepEqual(candidate(unexpectedReview, "traveler-rfi-revision").reasonCodes, ["UNEXPECTED_SOURCE"]);
  assert.equal(unexpectedReview.materializable, false);
  await assert.rejects(() => materializeProposal(input, undeclared), ProposalMaterializationError);
  await assert.rejects(() => materializeProposal(input, unexpected), ProposalMaterializationError);
});

test("rejects missing and ambiguous exact line anchors", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const missing = structuredClone(proposal);
  missing.candidates[0]!.exactLines[0] = "Traveler revision: Z";
  const missingReview = await reviewProposal(input, missing);
  assert.deepEqual(candidate(missingReview, "traveler-rfi-revision").reasonCodes, ["ANCHOR_MISSING"]);
  assert.equal(missingReview.materializable, false);

  const ambiguousInput = structuredClone(input);
  const email = ambiguousInput.sources.find(({ id }) => id === "operator-email");
  assert.ok(email);
  email.content = `${email.content}${OPERATOR_EMAIL_LINES.revision}\n`;
  const ambiguousProposal = await proposalFor(ambiguousInput);
  const ambiguousReview = await reviewProposal(ambiguousInput, ambiguousProposal);
  assert.deepEqual(candidate(ambiguousReview, "traveler-rfi-revision").reasonCodes, ["ANCHOR_AMBIGUOUS"]);
  assert.equal(ambiguousReview.materializable, false);
  await assert.rejects(() => materializeProposal(input, missing), ProposalMaterializationError);
  await assert.rejects(() => materializeProposal(ambiguousInput, ambiguousProposal), ProposalMaterializationError);
});

test("rejects unknown slots, altered values, and duplicate admitted slots", async () => {
  const input = await loadProjectAlder();
  const proposal = await proposalFor(input);
  const unknown = structuredClone(proposal);
  unknown.candidates[0]!.slotId = "fabrication-release";
  const altered = structuredClone(proposal);
  altered.candidates[0]!.values[1] = { key: "rev", value: "D" };
  const duplicateSlot = structuredClone(proposal);
  duplicateSlot.candidates[1] = {
    ...structuredClone(proposal.candidates[0]!),
    id: "candidate-duplicate-traveler-slot",
  };

  const unknownReview = await reviewProposal(input, unknown);
  assert.deepEqual(candidate(unknownReview, "fabrication-release").reasonCodes, ["UNKNOWN_SLOT"]);
  assert.equal(unknownReview.materializable, false);
  const alteredReview = await reviewProposal(input, altered);
  assert.deepEqual(candidate(alteredReview, "traveler-rfi-revision").reasonCodes, ["BINDING_MISMATCH"]);
  assert.equal(alteredReview.materializable, false);
  const duplicateReview = await reviewProposal(input, duplicateSlot);
  assert.equal(duplicateReview.candidates.filter(({ reasonCodes }) => reasonCodes.includes("DUPLICATE_SLOT")).length, 2);
  assert.equal(duplicateReview.materializable, false);
  await assert.rejects(() => materializeProposal(input, unknown), ProposalMaterializationError);
  await assert.rejects(() => materializeProposal(input, altered), ProposalMaterializationError);
  await assert.rejects(() => materializeProposal(input, duplicateSlot), ProposalMaterializationError);
});

test("compiles an admitted proposal through the existing causal diff while release stays held", async () => {
  const input = await loadProjectAlder();
  const baseline = await compileProofPack(input);
  const proposal = await proposalFor(input);
  const review = await reviewProposal(input, proposal);
  const materialized = await materializeProposal(input, proposal);
  const compiled = await compileProofPack(materialized);
  const diff = diffCompiledPacks(baseline, compiled);

  assert.equal(review.materializable, true);
  assert.deepEqual(diff.changedClaimIds, ["finish-coordinated", "rfi-incorporated"]);
  assert.equal(compiled.claims.find(({ id }) => id === "fabrication-release")?.status, "BLOCKED");
  assert.equal(compiled.handoff.decision, "HOLD");
  assert.notEqual(compiled.receipt.inputDigest, baseline.receipt.inputDigest);
  assert.equal(review.status, "REVIEWED");
  const materializedLine = `${PROPOSAL_TRAVELER_ACK_PREFIX} origin=proposal_gate review_digest=${review.reviewDigest} source=operator-email source_lines=line:7,line:8,line:9,line:10`;
  assert.equal(compiled.observations.some(({ excerpt }) => excerpt === materializedLine), true);
  assert.equal(compiled.artifacts.operatorMarkdown.includes(escapeMarkdown(materializedLine)), true);
  assert.equal(
    compiled.receipt.inputDigest,
    await sha256Hex(canonicalStringify(normalizeCompileInput(materialized))),
  );
});

test("ships a closed JSON Schema that cannot express compiler authority fields", async () => {
  const schemaPath = new URL("../schemas/proofpack-proposal.schema.json", import.meta.url);
  const schema = JSON.parse(await readFile(schemaPath, "utf8")) as Record<string, unknown>;
  const propertyNames = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.properties === "object" && record.properties !== null) {
      Object.keys(record.properties as Record<string, unknown>).forEach((key) => propertyNames.add(key));
    }
    Object.values(record).forEach(visit);
  };
  visit(schema);

  assert.equal(schema.additionalProperties, false);
  const valueSchema = schema as {
    properties: {
      candidates: { items: { properties: { values: { items: { properties: { value: Record<string, unknown> } } } } } };
    };
  };
  assert.deepEqual(valueSchema.properties.candidates.items.properties.values.items.properties.value, {
    anyOf: [
      { type: "string", maxLength: 80 },
      { type: "boolean" },
    ],
  });
  assert.deepEqual([...propertyNames].sort(), [
    "candidates",
    "exactLines",
    "id",
    "key",
    "packetFingerprint",
    "packetId",
    "rationale",
    "rulesetId",
    "rulesetVersion",
    "schemaVersion",
    "slotId",
    "sourceId",
    "target",
    "value",
    "values",
  ]);
  for (const forbidden of [
    "authority",
    "claimStatus",
    "critical",
    "decision",
    "effect",
    "event",
    "path",
    "publicCopy",
    "regex",
    "rules",
    "status",
    "strength",
  ]) {
    assert.equal(propertyNames.has(forbidden), false, forbidden);
  }
});
