import {
  canonicalStringify,
  normalizeCompileInput,
  normalizeTimestamp,
  sha256Hex,
} from "./canonical.ts";
import { shareableDigestMaterial } from "./safety.ts";
import type {
  ClaimResult,
  Observation,
  Receipt,
  ReceiptStages,
  CompileInput,
} from "./types.ts";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => compareText(left.id, right.id));
}

async function digest(value: unknown): Promise<string> {
  return sha256Hex(canonicalStringify(value));
}

export async function buildReceipt(stages: ReceiptStages): Promise<Receipt> {
  const input = normalizeCompileInput(stages.input);
  const shareableMaterial = shareableDigestMaterial(stages.shareable);
  const shareableDigest = await digest(shareableMaterial);
  if (shareableDigest !== stages.shareable.digest) {
    throw new TypeError("SHAREABLE_DIGEST_INVARIANT_FAILED");
  }
  const observations: Observation[] = sortById(stages.observations).map((observation) => ({
    ...observation,
    capturedAt: normalizeTimestamp(observation.capturedAt),
  }));
  const claims: ClaimResult[] = sortById(stages.claims);
  const [inputDigest, observationDigest, ledgerDigest, handoffDigest] = await Promise.all([
    digest(input),
    digest(observations),
    digest(claims),
    digest(stages.handoff),
  ]);
  return {
    schemaVersion: "proofpack.receipt/v1",
    algorithm: "SHA-256",
    packetId: input.manifest.packetId,
    rulesetId: input.rules.rulesetId,
    rulesetVersion: input.rules.rulesetVersion,
    engineVersion: input.rules.engineVersion,
    inputDigest,
    observationDigest,
    ledgerDigest,
    handoffDigest,
    shareableDigest,
  };
}

export function receiptsEqual(expected: Receipt, candidate: unknown): boolean {
  try {
    return canonicalStringify(candidate) === canonicalStringify(expected);
  } catch {
    return false;
  }
}

export async function verifyReceipt(input: CompileInput, receipt: Receipt): Promise<boolean> {
  try {
    const { compileProofPack } = await import("./compile.ts");
    const recomputed = await compileProofPack(input);
    return receiptsEqual(recomputed.receipt, receipt);
  } catch {
    return false;
  }
}
