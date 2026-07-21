import fieldCheckText from "../../fixtures/project-alder/field-check.json?raw";
import finishScheduleText from "../../fixtures/project-alder/finish-schedule.md?raw";
import handoffDraftText from "../../fixtures/project-alder/handoff-draft.md?raw";
import incomingReceiptsText from "../../fixtures/project-alder/incoming-receipts.log?raw";
import operatorEmailText from "../../fixtures/project-alder/operator-email.md?raw";
import packetText from "../../fixtures/project-alder/packet.json?raw";
import recordedAiRunText from "../../fixtures/project-alder/recorded-ai-run.json?raw";
import recordedProposalText from "../../fixtures/project-alder/recorded-proposal.json?raw";
import rfi042Text from "../../fixtures/project-alder/rfi-042.json?raw";
import rulesText from "../../fixtures/project-alder/release-rules.json?raw";
import sampleRegisterText from "../../fixtures/project-alder/sample-register.json?raw";
import shopNotesText from "../../fixtures/project-alder/shop-notes.log?raw";
import type {
  CompileInput,
  PacketManifest,
  RuleSet,
  SourceDocument,
} from "./types.ts";
import type { ProposalEnvelope } from "./proposal.ts";
import { canonicalStringify } from "./canonical.ts";

export interface RecordedProposalArtifact {
  recorded: true;
  trust: "UNTRUSTED";
  authority: "NON_AUTHORITATIVE";
  model: "gpt-5.6-sol";
  cliVersion: "0.144.6";
  authMode: "CHATGPT";
  proposalDigest: string;
  requestDigest: string;
  recordedReviewDigest: string;
  label: "Recorded GPT-5.6 proposal";
  proposal: ProposalEnvelope;
}

const RAW_SOURCE_BY_FILE = new Map<string, string>([
  ["handoff-draft.md", handoffDraftText],
  ["finish-schedule.md", finishScheduleText],
  ["rfi-042.json", rfi042Text],
  ["shop-notes.log", shopNotesText],
  ["field-check.json", fieldCheckText],
  ["sample-register.json", sampleRegisterText],
  ["operator-email.md", operatorEmailText],
  ["incoming-receipts.log", incomingReceiptsText],
]);

function hydrateSources(manifest: PacketManifest): SourceDocument[] {
  return manifest.sources.map((declaration) => {
    const content = RAW_SOURCE_BY_FILE.get(declaration.file);
    if (content === undefined) {
      throw new Error(`DEMO_SOURCE_NOT_BUNDLED: ${declaration.file}`);
    }
    return { ...declaration, content };
  });
}

export function createDemoInput(): CompileInput {
  const manifest = JSON.parse(packetText) as PacketManifest;
  const rules = JSON.parse(rulesText) as RuleSet;
  return {
    manifest,
    rules,
    sources: hydrateSources(manifest),
  };
}

export function createRecordedProposalArtifact(): RecordedProposalArtifact {
  const run = JSON.parse(recordedAiRunText) as {
    schemaVersion?: unknown;
    requestedModel?: unknown;
    cliVersion?: unknown;
    authMode?: unknown;
    proposalDigest?: unknown;
    requestDigest?: unknown;
    labels?: { recorded?: unknown; untrusted?: unknown; nonAuthoritative?: unknown };
    proposal?: unknown;
    review?: { reviewDigest?: unknown };
  };
  const proposal = JSON.parse(recordedProposalText) as ProposalEnvelope;
  if (
    run.schemaVersion !== "proofpack.ai-run/v1"
    || run.requestedModel !== "gpt-5.6-sol"
    || run.cliVersion !== "0.144.6"
    || run.authMode !== "CHATGPT"
    || run.labels?.recorded !== true
    || run.labels.untrusted !== true
    || run.labels.nonAuthoritative !== true
    || typeof run.proposalDigest !== "string"
    || typeof run.requestDigest !== "string"
    || typeof run.review?.reviewDigest !== "string"
    || canonicalStringify(run.proposal) !== canonicalStringify(proposal)
  ) {
    throw new Error("DEMO_RECORDED_RUN_INVALID");
  }
  return {
    recorded: true,
    trust: "UNTRUSTED",
    authority: "NON_AUTHORITATIVE",
    model: "gpt-5.6-sol",
    cliVersion: "0.144.6",
    authMode: "CHATGPT",
    proposalDigest: run.proposalDigest,
    requestDigest: run.requestDigest,
    recordedReviewDigest: run.review.reviewDigest,
    label: "Recorded GPT-5.6 proposal",
    proposal,
  };
}
