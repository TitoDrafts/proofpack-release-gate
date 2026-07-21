import type {
  ClaimStatus,
  CompileInput,
  Observation,
} from "../src/proofpack/types.ts";

export const SYNTHETIC_RECEIPT_LINE =
  "traveler_ack rfi=RFI-042 rev=C finish=PL-18 cut_started=false";

export type HumanDecisionKind = "HOLD" | "EXCEPTION";

export interface HumanDecisionRecord {
  kind: HumanDecisionKind;
  reason: string;
  inputDigest: string;
}

export type HumanDecisionResult =
  | { ok: true; record: HumanDecisionRecord }
  | { ok: false; message: string };

export function appendSyntheticReceipt(input: CompileInput): CompileInput {
  const receiptSource = input.sources.find(({ id }) => id === "incoming-receipts");
  if (receiptSource === undefined) {
    throw new Error("DEMO_INCOMING_RECEIPTS_MISSING");
  }
  const existingLines = receiptSource.content.replaceAll("\r\n", "\n").split("\n");
  if (existingLines.includes(SYNTHETIC_RECEIPT_LINE)) {
    return input;
  }
  const separator = receiptSource.content.length === 0 || receiptSource.content.endsWith("\n")
    ? ""
    : "\n";
  const content = `${receiptSource.content}${separator}${SYNTHETIC_RECEIPT_LINE}\n`;
  return {
    ...input,
    sources: input.sources.map((source) =>
      source.id === receiptSource.id ? { ...source, content } : source),
  };
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
