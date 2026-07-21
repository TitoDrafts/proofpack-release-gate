import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  compileProofPack,
  reviewProposal,
  type CompileInput,
  type ProposalEnvelope,
  type ProposalReview,
} from "../src/proofpack/index.ts";
import { hydrateCompileInput } from "./proofpack-demo.ts";

const repository = resolve(import.meta.dirname, "..");
const packetPath = resolve(repository, "fixtures/project-alder/packet.json");
const proposalPath = resolve(repository, "fixtures/project-alder/recorded-proposal.json");

function cloneProposal(proposal: ProposalEnvelope): ProposalEnvelope {
  return structuredClone(proposal);
}

function candidateReason(review: ProposalReview, id: string): string {
  if (review.status === "REJECTED") return review.reasonCodes.join(",");
  const candidate = review.candidates.find((item) => item.id === id);
  return candidate?.reasonCodes.join(",") ?? "CANDIDATE_MISSING";
}

function candidateDecision(review: ProposalReview, id: string): string {
  if (review.status === "REJECTED") return "REJECTED";
  return review.candidates.find((item) => item.id === id)?.decision ?? "REJECTED";
}

function printCase(name: string, decision: string, reason: string): void {
  process.stdout.write(`${name.padEnd(22)} ${decision.padEnd(9)} ${reason}\n`);
}

async function runAttackCases(input: CompileInput, proposal: ProposalEnvelope): Promise<void> {
  const baseline = await compileProofPack(input);
  const authorityReview = await reviewProposal(input, proposal);
  const authorityCandidate = authorityReview.status === "REVIEWED"
    ? authorityReview.candidates.find(({ slotId }) => slotId === "sample-approval")
    : undefined;
  printCase(
    "unauthorized-approval",
    authorityCandidate?.decision ?? "REJECTED",
    authorityCandidate?.reasonCodes.join(",") ?? authorityReview.reasonCodes.join(","),
  );

  const invented = cloneProposal(proposal);
  const inventedCandidate = invented.candidates.find(({ slotId }) => slotId === "traveler-rfi-revision");
  if (inventedCandidate === undefined) throw new Error("CHALLENGE_CANDIDATE_MISSING");
  inventedCandidate.exactLines = ["Traveler revision: Z", "RFI incorporated: RFI-999"];
  const inventedReview = await reviewProposal(input, invented);
  printCase(
    "invented-line",
    candidateDecision(inventedReview, inventedCandidate.id),
    candidateReason(inventedReview, inventedCandidate.id),
  );

  const stale = cloneProposal(proposal);
  stale.target.packetFingerprint = "0".repeat(64);
  const staleReview = await reviewProposal(input, stale);
  printCase("stale-target", staleReview.status, staleReview.reasonCodes.join(","));

  const safe = authorityCandidate?.decision === "REJECTED"
    && authorityCandidate.reasonCodes.includes("UNAUTHORIZED_AUTHORITY")
    && candidateDecision(inventedReview, inventedCandidate.id) === "REJECTED"
    && candidateReason(inventedReview, inventedCandidate.id) === "ANCHOR_MISSING"
    && staleReview.status === "REJECTED"
    && staleReview.reasonCodes.includes("PACKET_FINGERPRINT_MISMATCH")
    && baseline.handoff.decision === "HOLD";
  if (!safe) throw new Error("CHALLENGE_DID_NOT_FAIL_CLOSED");
  process.stdout.write(`Final decision: ${baseline.handoff.decision}\n`);
}

async function runCustomEdit(
  input: CompileInput,
  proposal: ProposalEnvelope,
  operatorEmailPath: string,
): Promise<void> {
  const edited = structuredClone(input);
  const operatorEmail = edited.sources.find(({ id }) => id === "operator-email");
  if (operatorEmail === undefined) throw new Error("CHALLENGE_SOURCE_MISSING");
  operatorEmail.content = await readFile(resolve(operatorEmailPath), "utf8");
  const review = await reviewProposal(edited, proposal);
  printCase("scratch-source-edit", review.status, review.reasonCodes.join(","));
  const compiled = await compileProofPack(edited);
  if (
    review.status !== "REJECTED"
    || !review.reasonCodes.includes("PACKET_FINGERPRINT_MISMATCH")
    || compiled.handoff.decision !== "HOLD"
  ) {
    throw new Error("CHALLENGE_EDIT_DID_NOT_FAIL_CLOSED");
  }
  process.stdout.write(`Final decision: ${compiled.handoff.decision}\n`);
}

function operatorEmailArgument(argv: readonly string[]): string | undefined {
  const index = argv.indexOf("--operator-email");
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error("CHALLENGE_ARGUMENT_INVALID");
  return value;
}

async function main(): Promise<void> {
  const { input } = await hydrateCompileInput(packetPath);
  const proposalText = await readFile(proposalPath, "utf8");
  const proposal = JSON.parse(proposalText) as ProposalEnvelope;
  const customPath = operatorEmailArgument(process.argv.slice(2));
  process.stdout.write("ProofPack fail-closed challenge\n");
  if (customPath === undefined) {
    await runAttackCases(input, proposal);
  } else {
    await runCustomEdit(input, proposal, customPath);
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "CHALLENGE_FAILED";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
