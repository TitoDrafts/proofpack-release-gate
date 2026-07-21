import { canonicalStringify, normalizeText, sha256Hex } from "./canonical.ts";
import type {
  CompiledPackStages,
  Observation,
  Receipt,
  ShareableDigestMaterial,
  ShareableOutcome,
  ShareablePack,
} from "./types.ts";

export type ShareableExportErrorCode =
  | "SHAREABLE_LINEAGE_AMBIGUOUS"
  | "SHAREABLE_DIGEST_INVALID"
  | "SHAREABLE_MARKUP_REJECTED";

export class ShareableExportError extends Error {
  readonly code: ShareableExportErrorCode;

  constructor(code: ShareableExportErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "ShareableExportError";
    this.code = code;
  }
}

type OperatorPack = CompiledPackStages & { receipt: Receipt };

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareOutcome(left: ShareableOutcome, right: ShareableOutcome): number {
  return compareText(left.title, right.title) || compareText(left.nextStep, right.nextStep);
}

function normalizeOutcome(outcome: ShareableOutcome): ShareableOutcome {
  return {
    title: normalizeText(outcome.title),
    nextStep: normalizeText(outcome.nextStep),
  };
}

const rawHtmlPattern = /<(?:\/?[A-Za-z][^>]*|![^>]*|\?[^>]*\?)>|<!--[\s\S]*?-->/u;
const markdownLinkPattern = /!?\[[^\]\r\n]*\]\s*(?:\([^\)\r\n]*\)|\[[^\]\r\n]*\])|^\s*\[[^\]\r\n]+\]:\s*\S+/mu;
const linkLikePattern = /(?:https?:\/\/|javascript\s*:|data\s*:|www\.)/iu;

function assertPlainPublicText(value: string): void {
  if (rawHtmlPattern.test(value) || markdownLinkPattern.test(value) || linkLikePattern.test(value)) {
    throw new ShareableExportError(
      "SHAREABLE_MARKUP_REJECTED",
      "Public projection fields cannot contain raw HTML, links, or images.",
    );
  }
}

export function escapeMarkdown(value: string): string {
  return normalizeText(value)
    .replace(/\n/gu, " ")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/([\\`*_[\]{}()#+\-.!|~:/])/gu, "\\$1");
}

export function shareableDigestMaterial(
  projection: ShareablePack | ShareableDigestMaterial,
): ShareableDigestMaterial {
  return {
    schemaVersion: "proofpack.shareable/v1",
    packetAlias: normalizeText(projection.packetAlias),
    verifiedOutcomes: projection.verifiedOutcomes.map(normalizeOutcome).sort(compareOutcome),
  };
}

function indexObservations(observations: readonly Observation[]): Map<string, Observation> {
  const byId = new Map<string, Observation>();
  for (const observation of observations) {
    if (byId.has(observation.id)) {
      throw new ShareableExportError(
        "SHAREABLE_LINEAGE_AMBIGUOUS",
        "A contributing observation identifier is ambiguous.",
      );
    }
    byId.set(observation.id, observation);
  }
  return byId;
}

export async function buildShareableProjection(pack: CompiledPackStages): Promise<ShareablePack> {
  const packetAlias = normalizeText(pack.publicAlias);
  assertPlainPublicText(packetAlias);
  const observations = indexObservations(pack.observations);
  const verifiedOutcomes: ShareableOutcome[] = [];

  for (const claim of pack.claims) {
    if (claim.lineageSafety !== "PUBLIC" && claim.lineageSafety !== "RESTRICTED") {
      throw new ShareableExportError(
        "SHAREABLE_LINEAGE_AMBIGUOUS",
        "A compiled claim has unresolved closed safety lineage.",
      );
    }
    if (claim.status !== "VERIFIED" || !claim.publicEligible) {
      continue;
    }
    if (claim.lineageSafety === "RESTRICTED") {
      continue;
    }
    if (claim.evidenceIds.length === 0) {
      throw new ShareableExportError(
        "SHAREABLE_LINEAGE_AMBIGUOUS",
        "A public-eligible verified claim has no contributing observation lineage.",
      );
    }
    const evidence = claim.evidenceIds.map((id) => {
      const observation = observations.get(id);
      if (observation === undefined || (observation.safety !== "PUBLIC" && observation.safety !== "RESTRICTED")) {
        throw new ShareableExportError(
          "SHAREABLE_LINEAGE_AMBIGUOUS",
          "A public-eligible verified claim has unresolved safety lineage.",
        );
      }
      return observation;
    });
    if (evidence.some(({ safety }) => safety === "RESTRICTED")) {
      continue;
    }
    const outcome = normalizeOutcome({ title: claim.publicTitle, nextStep: claim.publicNextAction });
    assertPlainPublicText(outcome.title);
    assertPlainPublicText(outcome.nextStep);
    verifiedOutcomes.push(outcome);
  }

  const material = shareableDigestMaterial({
    schemaVersion: "proofpack.shareable/v1",
    packetAlias,
    verifiedOutcomes,
  });
  const projection: ShareablePack = {
    ...material,
    digest: await sha256Hex(canonicalStringify(material)),
  };
  projection.verifiedOutcomes.forEach(Object.freeze);
  Object.freeze(projection.verifiedOutcomes);
  return Object.freeze(projection);
}

function renderList(values: readonly string[], emptyText: string): string {
  return values.length === 0
    ? `- ${emptyText}`
    : values.map((value) => `- ${escapeMarkdown(value)}`).join("\n");
}

function renderReceipt(receipt: Receipt): string {
  const fields: Array<keyof Receipt> = [
    "schemaVersion",
    "algorithm",
    "packetId",
    "rulesetId",
    "rulesetVersion",
    "engineVersion",
    "inputDigest",
    "observationDigest",
    "ledgerDigest",
    "handoffDigest",
    "shareableDigest",
  ];
  return fields.map((field) => `- ${field}: ${escapeMarkdown(receipt[field])}`).join("\n");
}

export function renderOperatorMarkdown(pack: OperatorPack): string {
  const observationById = new Map(pack.observations.map((observation) => [observation.id, observation]));
  const ledger = pack.claims.map((claim) => {
    const evidence = claim.evidenceIds.flatMap((id) => {
      const observation = observationById.get(id);
      if (observation === undefined) {
        return [`  - Unresolved evidence reference: ${escapeMarkdown(id)}`];
      }
      return [
        `  - ${escapeMarkdown(observation.sourceFile)} @ ${escapeMarkdown(observation.locator)}`,
        `    - Evidence ID: ${escapeMarkdown(observation.id)}`,
        `    - Excerpt: ${escapeMarkdown(observation.excerpt)}`,
        `    - Excerpt digest: ${escapeMarkdown(observation.excerptDigest)}`,
        `    - Safety: ${observation.safety}`,
      ];
    });
    return [
      `### ${escapeMarkdown(claim.title)}`,
      `- Claim ID: ${escapeMarkdown(claim.id)}`,
      `- Status: ${claim.status}`,
      `- Rule: ${escapeMarkdown(claim.ruleId)} @ ${escapeMarkdown(claim.ruleVersion)}`,
      `- Reasons: ${escapeMarkdown(claim.reasonCodes.join(", "))}`,
      "- Evidence:",
      ...(evidence.length === 0 ? ["  - None"] : evidence),
    ].join("\n");
  }).join("\n\n");

  return [
    "# ProofPack operator handoff",
    "",
    `Packet: ${escapeMarkdown(pack.title)}`,
    "",
    "## Executive summary",
    "",
    `Decision: ${pack.handoff.decision}`,
    "",
    escapeMarkdown(pack.handoff.summary),
    "",
    "## Done",
    "",
    renderList(pack.handoff.done, "None"),
    "",
    "## Not done",
    "",
    renderList(pack.handoff.notDone, "None"),
    "",
    "## Next action",
    "",
    escapeMarkdown(pack.handoff.nextAction),
    "",
    "## Stop conditions",
    "",
    renderList(pack.handoff.stopConditions, "None"),
    "",
    "## Evidence ledger",
    "",
    ledger.length === 0 ? "No claims." : ledger,
    "",
    "## Reproducibility/integrity receipt",
    "",
    renderReceipt(pack.receipt),
    "",
  ].join("\n");
}

export async function renderShareableMarkdown(projection: ShareablePack): Promise<string> {
  let currentDigest: string | undefined;
  let material: ShareableDigestMaterial | undefined;
  try {
    material = shareableDigestMaterial(projection);
    currentDigest = await sha256Hex(canonicalStringify(material));
  } catch {
    currentDigest = undefined;
  }
  if (
    projection.schemaVersion !== "proofpack.shareable/v1"
    || !/^[a-f0-9]{64}$/u.test(projection.digest)
    || currentDigest !== projection.digest
    || material === undefined
  ) {
    throw new ShareableExportError(
      "SHAREABLE_DIGEST_INVALID",
      "The shareable projection digest must be lowercase SHA-256 hex.",
    );
  }
  assertPlainPublicText(material.packetAlias);
  for (const outcome of material.verifiedOutcomes) {
    assertPlainPublicText(outcome.title);
    assertPlainPublicText(outcome.nextStep);
  }
  const outcomes = material.verifiedOutcomes.length === 0
    ? "- No outcomes are eligible for this allowlisted export."
    : material.verifiedOutcomes.map(({ title, nextStep }) => [
      `- ${escapeMarkdown(title)}`,
      `  - Next step: ${escapeMarkdown(nextStep)}`,
    ].join("\n")).join("\n");
  return [
    "# Allowlisted shareable ProofPack",
    "",
    `Packet alias: ${escapeMarkdown(material.packetAlias)}`,
    "",
    "## Verified outcomes",
    "",
    outcomes,
    "",
    "## Projection digest",
    "",
    `SHA-256: ${projection.digest}`,
    "",
  ].join("\n");
}
