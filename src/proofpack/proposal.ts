import { canonicalStringify, normalizeText, sha256Hex } from "./canonical.ts";
import { compileProofPack } from "./compile.ts";
import type { CompileInput, SourceDocument } from "./types.ts";

export const PROPOSAL_TRAVELER_ACK_PREFIX =
  "traveler_ack rfi=RFI-042 rev=C finish=PL-18 cut_started=false";

export type ProposalValueScalar = string | boolean;

export interface ProposalValue {
  key: string;
  value: ProposalValueScalar;
}

export interface ProposalCandidate {
  id: string;
  slotId: string;
  sourceId: string;
  exactLines: string[];
  values: ProposalValue[];
  rationale: string;
}

export interface ProposalTarget {
  packetId: string;
  packetFingerprint: string;
  rulesetId: string;
  rulesetVersion: string;
}

export interface ProposalEnvelope {
  schemaVersion: "proofpack.proposal/v1";
  target: ProposalTarget;
  candidates: ProposalCandidate[];
}

export type ProposalDecision = "ADMISSIBLE" | "REJECTED";

export type ProposalReasonCode =
  | "ANCHOR_AMBIGUOUS"
  | "ANCHOR_MISSING"
  | "BINDING_MISMATCH"
  | "CANDIDATE_ID_DUPLICATE"
  | "CANDIDATE_LIMIT_EXCEEDED"
  | "DUPLICATE_SLOT"
  | "EXACT_BINDING_ADMITTED"
  | "PACKET_FINGERPRINT_MISMATCH"
  | "PACKET_ID_MISMATCH"
  | "PROPOSAL_FIELD_INVALID"
  | "PROPOSAL_FIELD_UNKNOWN"
  | "PROPOSAL_SCHEMA_UNSUPPORTED"
  | "RULESET_ID_MISMATCH"
  | "RULESET_VERSION_MISMATCH"
  | "SOURCE_NOT_DECLARED"
  | "UNAUTHORIZED_AUTHORITY"
  | "UNEXPECTED_SOURCE"
  | "UNKNOWN_SLOT";

export interface ProposalLineAnchor {
  sourceId: string;
  locator: string;
  excerpt: string;
}

export interface ReviewedProposalCandidate extends ProposalCandidate {
  decision: ProposalDecision;
  reasonCodes: ProposalReasonCode[];
  anchors: ProposalLineAnchor[];
}

interface ProposalReviewBase {
  schemaVersion: "proofpack.proposal-review/v1";
  reasonCodes: ProposalReasonCode[];
  candidates: ReviewedProposalCandidate[];
  materializable: boolean;
}

export interface ReviewedProposalReview extends ProposalReviewBase {
  status: "REVIEWED";
  target: ProposalTarget;
  bindingDigest: string;
  reviewDigest: string;
}

export interface RejectedProposalReview extends ProposalReviewBase {
  status: "REJECTED";
}

export type ProposalReview = ReviewedProposalReview | RejectedProposalReview;

interface SlotDefinition {
  sourceId: "operator-email";
  exactLines: readonly string[];
  values: readonly ProposalValue[];
  authority: "ADMISSIBLE" | "UNAUTHORIZED";
}

type UnknownRecord = Record<string, unknown>;

const VALUE_KEYS = new Set(["rfi", "rev", "finish", "cut_started", "sample_status"]);
const REQUIRED_MATERIALIZATION_SLOTS = [
  "traveler-rfi-revision",
  "traveler-finish-cut-state",
] as const;

const SLOT_DEFINITIONS: Readonly<Record<string, SlotDefinition>> = {
  "traveler-rfi-revision": {
    sourceId: "operator-email",
    exactLines: ["Traveler revision: C", "RFI incorporated: RFI-042"],
    values: [
      { key: "rfi", value: "RFI-042" },
      { key: "rev", value: "C" },
    ],
    authority: "ADMISSIBLE",
  },
  "traveler-finish-cut-state": {
    sourceId: "operator-email",
    exactLines: ["Traveler finish: PL-18", "Cut started: false"],
    values: [
      { key: "finish", value: "PL-18" },
      { key: "cut_started", value: false },
    ],
    authority: "ADMISSIBLE",
  },
  "sample-approval": {
    sourceId: "operator-email",
    exactLines: ["Estimator note: the PL-18 sample looks approved."],
    values: [{ key: "sample_status", value: "APPROVED" }],
    authority: "UNAUTHORIZED",
  },
};

export class ProposalMaterializationError extends Error {
  readonly code = "PROPOSAL_NOT_MATERIALIZABLE" as const;

  constructor() {
    super("PROPOSAL_NOT_MATERIALIZABLE: The proposal did not admit both required traveler bindings.");
    this.name = "ProposalMaterializationError";
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyEnumerableOwnStringKeys(value: UnknownRecord, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Reflect.ownKeys(value).every((key) =>
    typeof key === "string"
    && Object.prototype.propertyIsEnumerable.call(value, key)
    && allowedKeys.has(key));
}

function hasExactEnumerableOwnStringKeys(value: UnknownRecord, required: readonly string[]): boolean {
  return hasOnlyEnumerableOwnStringKeys(value, required)
    && required.every((key) => Object.prototype.propertyIsEnumerable.call(value, key));
}

function isClosedArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== value.length + 1 || ownKeys[ownKeys.length - 1] !== "length") {
    return false;
  }
  return Array.from({ length: value.length }, (_, index) => String(index)).every((key, index) =>
    ownKeys[index] === key && Object.prototype.propertyIsEnumerable.call(value, key));
}

function validString(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximumLength
    && normalizeText(value) === value;
}

function invalidReview(reasonCode: ProposalReasonCode): ProposalReview {
  return {
    schemaVersion: "proofpack.proposal-review/v1",
    status: "REJECTED",
    reasonCodes: [reasonCode],
    candidates: [],
    materializable: false,
  };
}

function parseValue(value: unknown): ProposalValue | undefined {
  if (
    !isRecord(value)
    || !hasExactEnumerableOwnStringKeys(value, ["key", "value"])
    || !validString(value.key, 40)
    || !VALUE_KEYS.has(value.key)
    || (typeof value.value !== "boolean" && !validString(value.value, 80))
  ) {
    return undefined;
  }
  return { key: value.key, value: value.value };
}

function parseCandidate(value: unknown): ProposalCandidate | undefined {
  const required = ["id", "slotId", "sourceId", "exactLines", "values", "rationale"] as const;
  if (!isRecord(value) || !hasExactEnumerableOwnStringKeys(value, required)) {
    return undefined;
  }
  if (
    !validString(value.id, 100)
    || !validString(value.slotId, 100)
    || !validString(value.sourceId, 100)
    || !validString(value.rationale, 500)
    || !isClosedArray(value.exactLines)
    || value.exactLines.length < 1
    || value.exactLines.length > 2
    || !value.exactLines.every((line) => validString(line, 240))
    || new Set(value.exactLines).size !== value.exactLines.length
    || !isClosedArray(value.values)
    || value.values.length < 1
    || value.values.length > 2
  ) {
    return undefined;
  }
  const values = value.values.map(parseValue);
  if (values.some((item) => item === undefined)) {
    return undefined;
  }
  const parsedValues = values as ProposalValue[];
  if (new Set(parsedValues.map(({ key }) => key)).size !== parsedValues.length) {
    return undefined;
  }
  return {
    id: value.id,
    slotId: value.slotId,
    sourceId: value.sourceId,
    exactLines: [...value.exactLines] as string[],
    values: parsedValues,
    rationale: value.rationale,
  };
}

function parseTarget(value: unknown): ProposalTarget | undefined {
  const required = ["packetId", "packetFingerprint", "rulesetId", "rulesetVersion"] as const;
  if (!isRecord(value) || !hasExactEnumerableOwnStringKeys(value, required)) {
    return undefined;
  }
  if (
    !validString(value.packetId, 120)
    || !validString(value.packetFingerprint, 64)
    || !/^[a-f0-9]{64}$/u.test(value.packetFingerprint)
    || !validString(value.rulesetId, 120)
    || !validString(value.rulesetVersion, 40)
  ) {
    return undefined;
  }
  return {
    packetId: value.packetId,
    packetFingerprint: value.packetFingerprint,
    rulesetId: value.rulesetId,
    rulesetVersion: value.rulesetVersion,
  };
}

function containsUnknownProposalField(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyEnumerableOwnStringKeys(value, ["schemaVersion", "target", "candidates"])) {
    return true;
  }
  if (!isRecord(value.target) || !hasOnlyEnumerableOwnStringKeys(value.target, [
    "packetId",
    "packetFingerprint",
    "rulesetId",
    "rulesetVersion",
  ])) {
    return true;
  }
  if (!Array.isArray(value.candidates)) {
    return false;
  }
  if (!isClosedArray(value.candidates)) return true;
  return value.candidates.some((candidate) => {
    if (!isRecord(candidate) || !hasOnlyEnumerableOwnStringKeys(candidate, [
      "id",
      "slotId",
      "sourceId",
      "exactLines",
      "values",
      "rationale",
    ])) {
      return true;
    }
    if (Array.isArray(candidate.exactLines) && !isClosedArray(candidate.exactLines)) return true;
    if (!Array.isArray(candidate.values)) return false;
    return !isClosedArray(candidate.values)
      || candidate.values.some((item) =>
        !isRecord(item) || !hasOnlyEnumerableOwnStringKeys(item, ["key", "value"]));
  });
}

function parseProposal(value: unknown): ProposalEnvelope | ProposalReview {
  if (containsUnknownProposalField(value)) {
    return invalidReview("PROPOSAL_FIELD_UNKNOWN");
  }
  if (!isRecord(value) || !hasExactEnumerableOwnStringKeys(value, ["schemaVersion", "target", "candidates"])) {
    return invalidReview("PROPOSAL_FIELD_INVALID");
  }
  if (value.schemaVersion !== "proofpack.proposal/v1") {
    return invalidReview("PROPOSAL_SCHEMA_UNSUPPORTED");
  }
  if (!isClosedArray(value.candidates)) {
    return invalidReview("PROPOSAL_FIELD_INVALID");
  }
  if (value.candidates.length > 3) {
    return invalidReview("CANDIDATE_LIMIT_EXCEEDED");
  }
  if (value.candidates.length === 0) {
    return invalidReview("PROPOSAL_FIELD_INVALID");
  }
  const target = parseTarget(value.target);
  const candidates = value.candidates.map(parseCandidate);
  if (target === undefined || candidates.some((candidate) => candidate === undefined)) {
    return invalidReview("PROPOSAL_FIELD_INVALID");
  }
  const parsedCandidates = candidates as ProposalCandidate[];
  if (new Set(parsedCandidates.map(({ id }) => id)).size !== parsedCandidates.length) {
    return invalidReview("CANDIDATE_ID_DUPLICATE");
  }
  return {
    schemaVersion: "proofpack.proposal/v1",
    target,
    candidates: parsedCandidates,
  };
}

function rejectedCandidate(
  candidate: ProposalCandidate,
  reasonCode: ProposalReasonCode,
  anchors: ProposalLineAnchor[] = [],
): ReviewedProposalCandidate {
  return {
    ...candidate,
    exactLines: [...candidate.exactLines],
    values: candidate.values.map((value) => ({ ...value })),
    decision: "REJECTED",
    reasonCodes: [reasonCode],
    anchors,
  };
}

function normalizedValueMap(values: readonly ProposalValue[]): Map<string, ProposalValueScalar> {
  return new Map(values.map(({ key, value }) => [normalizeText(key), typeof value === "string" ? normalizeText(value) : value]));
}

function bindingsEqual(candidate: ProposalCandidate, expected: SlotDefinition): boolean {
  const candidateLines = [...candidate.exactLines].map(normalizeText).sort();
  const expectedLines = [...expected.exactLines].map(normalizeText).sort();
  if (
    candidateLines.length !== expectedLines.length
    || candidateLines.some((line, index) => line !== expectedLines[index])
  ) {
    return false;
  }
  const candidateValues = normalizedValueMap(candidate.values);
  const expectedValues = normalizedValueMap(expected.values);
  if (candidateValues.size !== expectedValues.size) {
    return false;
  }
  return [...expectedValues].every(([key, value]) => candidateValues.get(key) === value);
}

function resolveExactLines(source: SourceDocument, exactLines: readonly string[]): {
  anchors: ProposalLineAnchor[];
  missing: boolean;
  ambiguous: boolean;
} {
  const sourceLines = normalizeText(source.content).split("\n");
  const anchors: ProposalLineAnchor[] = [];
  let missing = false;
  let ambiguous = false;
  for (const exactLine of exactLines) {
    const normalizedExactLine = normalizeText(exactLine);
    const matches = sourceLines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line === normalizedExactLine);
    if (matches.length === 0) {
      missing = true;
      continue;
    }
    if (matches.length > 1) {
      ambiguous = true;
      continue;
    }
    const match = matches[0]!;
    anchors.push({
      sourceId: source.id,
      locator: `line:${match.index + 1}`,
      excerpt: match.line,
    });
  }
  return { anchors, missing, ambiguous };
}

function reviewCandidate(
  input: CompileInput,
  candidate: ProposalCandidate,
  duplicateSlots: ReadonlySet<string>,
): ReviewedProposalCandidate {
  if (duplicateSlots.has(candidate.slotId)) {
    return rejectedCandidate(candidate, "DUPLICATE_SLOT");
  }
  const slot = SLOT_DEFINITIONS[candidate.slotId];
  if (slot === undefined) {
    return rejectedCandidate(candidate, "UNKNOWN_SLOT");
  }
  const source = input.sources.find(({ id }) => id === candidate.sourceId);
  if (source === undefined) {
    return rejectedCandidate(candidate, "SOURCE_NOT_DECLARED");
  }
  if (candidate.sourceId !== slot.sourceId) {
    return rejectedCandidate(candidate, "UNEXPECTED_SOURCE");
  }
  const resolution = resolveExactLines(source, candidate.exactLines);
  if (resolution.ambiguous) {
    return rejectedCandidate(candidate, "ANCHOR_AMBIGUOUS");
  }
  if (resolution.missing) {
    return rejectedCandidate(candidate, "ANCHOR_MISSING");
  }
  if (!bindingsEqual(candidate, slot)) {
    return rejectedCandidate(candidate, "BINDING_MISMATCH", resolution.anchors);
  }
  if (slot.authority === "UNAUTHORIZED") {
    return rejectedCandidate(candidate, "UNAUTHORIZED_AUTHORITY", resolution.anchors);
  }
  return {
    ...candidate,
    exactLines: [...candidate.exactLines],
    values: candidate.values.map((value) => ({ ...value })),
    decision: "ADMISSIBLE",
    reasonCodes: ["EXACT_BINDING_ADMITTED"],
    anchors: resolution.anchors,
  };
}

function duplicateSlotIds(candidates: readonly ProposalCandidate[]): Set<string> {
  const counts = new Map<string, number>();
  for (const { slotId } of candidates) {
    counts.set(slotId, (counts.get(slotId) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([slotId]) => slotId));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function authorityDigestCandidates(candidates: readonly ReviewedProposalCandidate[]) {
  return candidates.map((item) => ({
    id: item.id,
    slotId: item.slotId,
    sourceId: item.sourceId,
    exactLines: [...item.exactLines].sort(compareText),
    values: item.values
      .map(({ key, value }) => ({ key, value }))
      .sort((left, right) => compareText(left.key, right.key)),
    decision: item.decision,
    reasonCodes: [...item.reasonCodes].sort(compareText),
    anchors: item.anchors
      .map(({ sourceId, locator, excerpt }) => ({ sourceId, locator, excerpt }))
      .sort((left, right) => compareText(left.sourceId, right.sourceId)
        || compareText(left.locator, right.locator)
        || compareText(left.excerpt, right.excerpt)),
  }));
}

async function buildReviewedProposal(
  target: ProposalTarget,
  candidates: ReviewedProposalCandidate[],
  materializable: boolean,
): Promise<ReviewedProposalReview> {
  const targetBinding = { ...target };
  const bindingDigest = await sha256Hex(canonicalStringify({
    schemaVersion: "proofpack.proposal-binding/v1",
    target: targetBinding,
    candidates: authorityDigestCandidates(candidates),
  }));
  const reviewDigest = await sha256Hex(canonicalStringify({
    schemaVersion: "proofpack.proposal-review/v1",
    status: "REVIEWED",
    target: targetBinding,
    reasonCodes: [],
    materializable,
    bindingDigest,
  }));
  return {
    schemaVersion: "proofpack.proposal-review/v1",
    status: "REVIEWED",
    target: targetBinding,
    bindingDigest,
    reviewDigest,
    reasonCodes: [],
    candidates,
    materializable,
  };
}

function proposalTravelerAckLine(review: ReviewedProposalReview): string {
  const locators = review.candidates
    .filter(({ slotId, decision }) =>
      REQUIRED_MATERIALIZATION_SLOTS.includes(slotId as typeof REQUIRED_MATERIALIZATION_SLOTS[number])
      && decision === "ADMISSIBLE")
    .flatMap(({ anchors }) => anchors)
    .filter(({ sourceId }) => sourceId === "operator-email")
    .map(({ locator }) => locator)
    .sort((left, right) => {
      const leftLine = /^line:(\d+)$/u.exec(left)?.[1];
      const rightLine = /^line:(\d+)$/u.exec(right)?.[1];
      return leftLine !== undefined && rightLine !== undefined
        ? Number(leftLine) - Number(rightLine)
        : compareText(left, right);
    });
  return `${PROPOSAL_TRAVELER_ACK_PREFIX} origin=proposal_gate review_digest=${review.reviewDigest} source=operator-email source_lines=${locators.join(",")}`;
}

function isSemanticTravelerAckLine(line: string): boolean {
  return line === PROPOSAL_TRAVELER_ACK_PREFIX
    || line.startsWith(`${PROPOSAL_TRAVELER_ACK_PREFIX} `);
}

function isProvenProposalTravelerAckLine(line: string): boolean {
  const lineage = line.slice(PROPOSAL_TRAVELER_ACK_PREFIX.length);
  return /^ origin=proposal_gate review_digest=[a-f0-9]{64} source=operator-email source_lines=line:7,line:8,line:9,line:10$/u
    .test(lineage);
}

export async function reviewProposal(input: CompileInput, value: unknown): Promise<ProposalReview> {
  const parsed = parseProposal(value);
  if (parsed.schemaVersion === "proofpack.proposal-review/v1") {
    return parsed;
  }
  const compiled = await compileProofPack(input);
  const targetChecks: ReadonlyArray<[boolean, ProposalReasonCode]> = [
    [parsed.target.packetId === compiled.packetId, "PACKET_ID_MISMATCH"],
    [parsed.target.packetFingerprint === compiled.receipt.inputDigest, "PACKET_FINGERPRINT_MISMATCH"],
    [parsed.target.rulesetId === compiled.rulesetId, "RULESET_ID_MISMATCH"],
    [parsed.target.rulesetVersion === compiled.rulesetVersion, "RULESET_VERSION_MISMATCH"],
  ];
  const mismatch = targetChecks.find(([matches]) => !matches);
  if (mismatch !== undefined) {
    return invalidReview(mismatch[1]);
  }
  const candidates = parsed.candidates.map((candidate) =>
    reviewCandidate(input, candidate, duplicateSlotIds(parsed.candidates)));
  const materializable = REQUIRED_MATERIALIZATION_SLOTS.every((slotId) =>
    candidates.some((candidate) => candidate.slotId === slotId && candidate.decision === "ADMISSIBLE"));
  return buildReviewedProposal(parsed.target, candidates, materializable);
}

export async function materializeProposal(input: CompileInput, value: unknown): Promise<CompileInput> {
  const review = await reviewProposal(input, value);
  if (review.status !== "REVIEWED" || !review.materializable) {
    throw new ProposalMaterializationError();
  }
  const materialized = structuredClone(input);
  const source = materialized.sources.find(({ id }) => id === "incoming-receipts");
  if (source === undefined) {
    throw new ProposalMaterializationError();
  }
  const travelerAckLine = proposalTravelerAckLine(review);
  const currentLines = normalizeText(source.content).split("\n");
  const existingTravelerLines = currentLines.filter(isSemanticTravelerAckLine);
  if (existingTravelerLines.length > 0) {
    if (existingTravelerLines.length !== 1 || !isProvenProposalTravelerAckLine(existingTravelerLines[0]!)) {
      throw new ProposalMaterializationError();
    }
    return materialized;
  }
  const separator = source.content.length === 0 || source.content.endsWith("\n") ? "" : "\n";
  source.content = `${source.content}${separator}${travelerAckLine}\n`;
  return materialized;
}
