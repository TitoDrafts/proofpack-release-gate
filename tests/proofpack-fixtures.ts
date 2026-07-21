import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type {
  AnchorRule,
  ClaimRule,
  CompileInput,
  PacketManifest,
  RuleSet,
  SourceDocument,
  SourceMediaType,
} from "../src/proofpack/types.ts";

const alderDirectory = fileURLToPath(new URL("../fixtures/project-alder/", import.meta.url));

export async function loadProjectAlder(): Promise<CompileInput> {
  const manifest = JSON.parse(
    await readFile(`${alderDirectory}/packet.json`, "utf8"),
  ) as PacketManifest;
  const rules = JSON.parse(
    await readFile(`${alderDirectory}/${manifest.rulesFile}`, "utf8"),
  ) as RuleSet;
  const sources = await Promise.all(manifest.sources.map(async (source): Promise<SourceDocument> => ({
    ...source,
    content: await readFile(`${alderDirectory}/${source.file}`, "utf8"),
  })));
  return { manifest, rules, sources };
}

export function appendReceipt(input: CompileInput, receipt: string): CompileInput {
  const replay = structuredClone(input);
  const source = replay.sources.find(({ id }) => id === "incoming-receipts");
  if (source === undefined) {
    throw new Error("TEST_FIXTURE_INCOMING_RECEIPTS_MISSING");
  }
  source.content = `${source.content}${source.content.length === 0 || source.content.endsWith("\n") ? "" : "\n"}${receipt}\n`;
  return replay;
}

export function addRestrictedSentinelSource(input: CompileInput, sentinel: string): CompileInput {
  const seeded = structuredClone(input);
  const source: SourceDocument = {
    id: "restricted-sentinel",
    file: "restricted-sentinel.log",
    mediaType: "text/plain",
    capturedAt: "2026-07-21T04:30:00.000Z",
    safety: "RESTRICTED",
    content: `internal_note value=${sentinel}\n`,
  };
  seeded.sources.push(source);
  seeded.manifest.sources.push({
    id: source.id,
    file: source.file,
    mediaType: source.mediaType,
    capturedAt: source.capturedAt,
    safety: source.safety,
  });
  return seeded;
}

export function makeSource(
  id: string,
  content: string,
  mediaType: SourceMediaType = "text/plain",
): SourceDocument {
  const extension = mediaType === "application/json" ? "json" : mediaType === "text/markdown" ? "md" : "log";
  return {
    id,
    file: `${id}.${extension}`,
    mediaType,
    capturedAt: "2026-07-21T05:00:00.000Z",
    safety: "PUBLIC",
    content,
  };
}

export function makeAnchor(overrides: Partial<AnchorRule> = {}): AnchorRule {
  return {
    id: "evidence-anchor",
    sourceId: "evidence",
    selector: { kind: "line", contains: "MATCH" },
    effect: "SUPPORT",
    strength: "DIRECT",
    safety: "PUBLIC",
    ...overrides,
  };
}

export function makeClaim(overrides: Partial<ClaimRule> = {}): ClaimRule {
  const id = overrides.id ?? "claim";
  return {
    id,
    title: `Internal ${id}`,
    publicTitle: `Public ${id}`,
    kind: "direct",
    critical: true,
    anchors: [makeAnchor({ id: `${id}-anchor` })],
    nextAction: `Resolve ${id}.`,
    publicNextAction: `Complete public next step for ${id}.`,
    publicEligibleWhenVerified: true,
    ...overrides,
  };
}

export function makeCompileInput(
  claims: ClaimRule[],
  sources: SourceDocument[] = [makeSource("evidence", "MATCH")],
): CompileInput {
  return {
    manifest: {
      schemaVersion: "proofpack.packet/v1",
      packetId: "status-fixture",
      title: "Status Fixture",
      publicAlias: "Synthetic status fixture",
      asOf: "2026-07-21T05:00:00.000Z",
      rulesFile: "release-rules.json",
      sources: sources.map(({ id, file, mediaType, capturedAt, safety }) => ({
        id,
        file,
        mediaType,
        capturedAt,
        safety,
      })),
    },
    rules: {
      schemaVersion: "proofpack.rules/v1",
      rulesetId: "status-rules",
      rulesetVersion: "1.0.0",
      engineVersion: "1.0.0",
      claims,
    },
    sources,
  };
}
