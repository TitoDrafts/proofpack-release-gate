import type {
  ClaimStatus,
  CompileInput,
  Observation,
} from "../src/proofpack/types.ts";
import {
  PROPOSAL_TRAVELER_ACK_PREFIX,
  type ProposalReview,
} from "../src/proofpack/proposal.ts";

export type HumanDecisionKind = "HOLD" | "EXCEPTION";

export interface HumanDecisionRecord {
  kind: HumanDecisionKind;
  reason: string;
  inputDigest: string;
}

export type HumanDecisionResult =
  | { ok: true; record: HumanDecisionRecord }
  | { ok: false; message: string };

export function proposalDecisionCounts(review: ProposalReview | null): {
  admissible: number;
  rejected: number;
} {
  const decisions = review?.candidates.map(({ decision }) => decision) ?? [];
  return {
    admissible: decisions.filter((decision) => decision === "ADMISSIBLE").length,
    rejected: decisions.filter((decision) => decision === "REJECTED").length,
  };
}

export function proposalCanApply(review: ProposalReview | null): boolean {
  return review?.status === "REVIEWED" && review.materializable;
}

export function hasProposalMaterialization(input: CompileInput): boolean {
  return input.sources
    .find(({ id }) => id === "incoming-receipts")
    ?.content.replaceAll("\r\n", "\n")
    .split("\n")
    .some((line) => line.startsWith(`${PROPOSAL_TRAVELER_ACK_PREFIX} origin=proposal_gate `)) ?? false;
}

export function buildHumanDecision(
  kind: HumanDecisionKind,
  reason: string,
  inputDigest: string,
): HumanDecisionResult {
  const normalizedReason = reason.trim();
  if (kind === "EXCEPTION" && normalizedReason.length === 0) {
    return {
      ok: false,
      message: "Add a reason before recording an exception request.",
    };
  }
  return {
    ok: true,
    record: { kind, reason: normalizedReason, inputDigest },
  };
}

export function formatStatusTransition(
  before: ClaimStatus | undefined,
  after: ClaimStatus,
): string | null {
  return before === undefined || before === after ? null : `${before} → ${after}`;
}

export function resolveDiffObservations(
  observationIds: readonly string[],
  observations: readonly Observation[],
): Observation[] {
  const observationById = new Map(observations.map((observation) => [observation.id, observation]));
  return observationIds
    .map((id) => observationById.get(id))
    .filter((observation): observation is Observation => observation !== undefined);
}
