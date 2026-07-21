import { canonicalStringify } from "./canonical.ts";
import type {
  ClaimResult,
  CompiledPack,
  Handoff,
  PackDiff,
  Receipt,
  ReceiptDigestFields,
} from "./types.ts";

export class PackDiffError extends Error {
  readonly code = "PACK_DIFF_IDENTITY_MISMATCH" as const;

  constructor() {
    super("PACK_DIFF_IDENTITY_MISMATCH: Causal diff requires matching packet and ruleset identities.");
    this.name = "PackDiffError";
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort(compareText);
}

function claimIndex(claims: readonly ClaimResult[]): Map<string, ClaimResult> {
  return new Map(claims.map((claim) => [claim.id, claim]));
}

function digestFields(receipt: Receipt): ReceiptDigestFields {
  return {
    inputDigest: receipt.inputDigest,
    observationDigest: receipt.observationDigest,
    ledgerDigest: receipt.ledgerDigest,
    handoffDigest: receipt.handoffDigest,
    shareableDigest: receipt.shareableDigest,
  };
}

export function diffCompiledPacks(before: CompiledPack, after: CompiledPack): PackDiff {
  const identityFields = ["packetId", "rulesetId", "rulesetVersion", "engineVersion"] as const;
  if (identityFields.some((field) => before[field] !== after[field])) {
    throw new PackDiffError();
  }
  const beforeObservationIds = new Set(before.observations.map(({ id }) => id));
  const afterObservationIds = new Set(after.observations.map(({ id }) => id));
  const beforeClaims = claimIndex(before.claims);
  const afterClaims = claimIndex(after.claims);
  const claimIds = new Set([...beforeClaims.keys(), ...afterClaims.keys()]);
  const changedClaimIds: string[] = [];
  const unchangedClaimIds: string[] = [];
  for (const id of claimIds) {
    const left = beforeClaims.get(id);
    const right = afterClaims.get(id);
    if (left !== undefined && right !== undefined && canonicalStringify(left) === canonicalStringify(right)) {
      unchangedClaimIds.push(id);
    } else {
      changedClaimIds.push(id);
    }
  }
  const handoffFields: Array<keyof Handoff> = [
    "decision",
    "summary",
    "done",
    "notDone",
    "nextAction",
    "stopConditions",
  ];
  const changedHandoffFields = handoffFields.filter((field) =>
    canonicalStringify(before.handoff[field]) !== canonicalStringify(after.handoff[field]))
    .sort(compareText);

  return {
    addedObservationIds: sorted([...afterObservationIds].filter((id) => !beforeObservationIds.has(id))),
    removedObservationIds: sorted([...beforeObservationIds].filter((id) => !afterObservationIds.has(id))),
    changedClaimIds: sorted(changedClaimIds),
    unchangedClaimIds: sorted(unchangedClaimIds),
    changedHandoffFields,
    beforeReceiptDigests: digestFields(before.receipt),
    afterReceiptDigests: digestFields(after.receipt),
  };
}
