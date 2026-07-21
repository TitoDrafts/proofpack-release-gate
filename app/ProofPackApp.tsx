"use client";

import { useEffect, useRef, useState } from "react";
import { LedgerPanel } from "./components/LedgerPanel.tsx";
import {
  HandoffPanel,
  type ArtifactKind,
} from "./components/HandoffPanel.tsx";
import { SourcePanel } from "./components/SourcePanel.tsx";
import { ProposalGate } from "./components/ProposalGate.tsx";
import {
  buildHumanDecision,
  hasProposalMaterialization,
  type HumanDecisionKind,
  type HumanDecisionRecord,
} from "./release-gate-model.ts";
import { compileProofPack } from "../src/proofpack/compile.ts";
import {
  createDemoInput,
  createRecordedProposalArtifact,
} from "../src/proofpack/demo-bundle.ts";
import { diffCompiledPacks } from "../src/proofpack/diff.ts";
import {
  materializeProposal,
  reviewProposal,
  type ProposalReview,
} from "../src/proofpack/proposal.ts";
import type {
  CompiledPack,
  CompileInput,
  PackDiff,
} from "../src/proofpack/types.ts";

const DEFAULT_SOURCE_ID = "finish-schedule";
const DEFAULT_CLAIM_ID = "finish-coordinated";
const ARTIFACT_FILENAME: Record<ArtifactKind, string> = {
  operator: "proofpack-operator-handoff.md",
  shareable: "proofpack-allowlisted-shareable.md",
};

function formatCompileError(error: unknown): string {
  return error instanceof Error ? error.message : "Compilation failed for an unknown reason.";
}

function artifactFor(pack: CompiledPack, kind: ArtifactKind): string {
  return kind === "operator"
    ? pack.artifacts.operatorMarkdown
    : pack.artifacts.shareableMarkdown;
}

export function ProofPackApp() {
  const [input, setInput] = useState<CompileInput>(createDemoInput);
  const [proposalArtifact] = useState(createRecordedProposalArtifact);
  const [proposalReview, setProposalReview] = useState<ProposalReview | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState(DEFAULT_SOURCE_ID);
  const [selectedClaimId, setSelectedClaimId] = useState(DEFAULT_CLAIM_ID);
  const [compiled, setCompiled] = useState<CompiledPack | null>(null);
  const [baseline, setBaseline] = useState<CompiledPack | null>(null);
  const [diff, setDiff] = useState<PackDiff | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [humanDecision, setHumanDecision] = useState<HumanDecisionRecord | null>(null);
  const [isCompiling, setIsCompiling] = useState(true);
  const [liveStatus, setLiveStatus] = useState("Compiling the bundled packet locally…");
  const sourceViewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const initialInput = createDemoInput();
    void compileProofPack(initialInput)
      .then((pack) => {
        if (!active) return;
        setCompiled(pack);
        setBaseline(pack);
        setCompileError(null);
        setLiveStatus(`Baseline compiled: ${pack.handoff.decision}. ${pack.claims.length} claims evaluated.`);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCompileError(formatCompileError(error));
        setLiveStatus("Baseline compilation failed. No authoritative handoff was produced.");
      })
      .finally(() => {
        if (active) setIsCompiling(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedClaim = compiled?.claims.find(({ id }) => id === selectedClaimId);
  const selectedObservations = compiled?.observations.filter(
    ({ claimId }) => claimId === selectedClaim?.id,
  ) ?? [];
  const proposalApplied = hasProposalMaterialization(input);

  function handleSelectClaim(claimId: string) {
    setSelectedClaimId(claimId);
    const firstEvidence = compiled?.observations.find(({ claimId: observationClaimId }) =>
      observationClaimId === claimId);
    if (firstEvidence !== undefined) {
      setSelectedSourceId(firstEvidence.sourceId);
    }
  }

  async function handleProposalReview() {
    if (compiled === null || isCompiling || proposalReview !== null) return;
    setIsCompiling(true);
    setLiveStatus("Reviewing the recorded GPT-5.6 proposal against the current packet locally…");
    try {
      const review = await reviewProposal(input, proposalArtifact.proposal);
      setProposalReview(review);
      setCompileError(null);
      if (review.status === "REVIEWED") {
        const admitted = review.candidates.filter(({ decision }) => decision === "ADMISSIBLE").length;
        const rejected = review.candidates.length - admitted;
        setLiveStatus(
          `Deterministic review complete: ${admitted} admissible, ${rejected} rejected. No compiler input changed.`,
        );
      } else {
        setLiveStatus(`Proposal rejected: ${review.reasonCodes.join(", ")}. No compiler input changed.`);
      }
    } catch (error: unknown) {
      setCompileError(formatCompileError(error));
      setLiveStatus("Proposal review failed. No compiler input changed.");
    } finally {
      setIsCompiling(false);
    }
  }

  async function handleProposalApply() {
    if (
      compiled === null
      || baseline === null
      || isCompiling
      || proposalApplied
      || proposalReview?.status !== "REVIEWED"
      || !proposalReview.materializable
    ) return;
    setHumanDecision(null);
    setSelectedSourceId("incoming-receipts");
    setIsCompiling(true);
    setLiveStatus("Applying two admitted bindings through the deterministic proposal gate…");
    try {
      const materializedInput = await materializeProposal(input, proposalArtifact.proposal);
      const materializedPack = await compileProofPack(materializedInput);
      const materializedDiff = diffCompiledPacks(baseline, materializedPack);
      setInput(materializedInput);
      setCompiled(materializedPack);
      setDiff(materializedDiff);
      setCompileError(null);
      setLiveStatus(
        `Proposal applied: ${materializedDiff.changedClaimIds.length} causal claims changed. Fabrication remains ${materializedPack.claims.find(({ id }) => id === "fabrication-release")?.status ?? "unresolved"}.`,
      );
    } catch (error: unknown) {
      setCompileError(formatCompileError(error));
      setLiveStatus("Proposal application failed. The previous valid handoff remains displayed.");
    } finally {
      setIsCompiling(false);
    }
  }

  async function handleProposalReset() {
    if (isCompiling || (proposalReview === null && !proposalApplied)) return;
    const resetInput = createDemoInput();
    setInput(resetInput);
    setProposalReview(null);
    setHumanDecision(null);
    setSelectedSourceId(DEFAULT_SOURCE_ID);
    setSelectedClaimId(DEFAULT_CLAIM_ID);
    setIsCompiling(true);
    setLiveStatus("Original raw packet restored. Recompiling the baseline…");
    try {
      const resetPack = await compileProofPack(resetInput);
      setCompiled(resetPack);
      setBaseline(resetPack);
      setDiff(null);
      setCompileError(null);
      setLiveStatus(`Proposal gate reset. Original fingerprint ${resetPack.receipt.inputDigest.slice(0, 12)} restored.`);
    } catch (error: unknown) {
      setCompileError(formatCompileError(error));
      setLiveStatus("Proposal reset failed. The previous valid handoff remains displayed.");
    } finally {
      setIsCompiling(false);
    }
  }

  function handleRecordDecision(kind: HumanDecisionKind, reason: string) {
    if (compiled === null || isCompiling) return;
    const result = buildHumanDecision(kind, reason, compiled.receipt.inputDigest);
    if (!result.ok) {
      setLiveStatus(result.message);
      return;
    }
    setHumanDecision(() => result.record);
    setLiveStatus(
      result.record.kind === "HOLD"
        ? "Human HOLD acknowledgement recorded. Compiled evidence statuses are unchanged."
        : "Exception request recorded with reason. Machine HOLD and blockers remain unchanged.",
    );
  }

  function handleInspectEvidence(sourceId: string) {
    setSelectedSourceId(sourceId);
    window.requestAnimationFrame(() => {
      const viewer = sourceViewerRef.current;
      if (viewer === null) return;
      viewer.focus({ preventScroll: true });
      viewer.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  }

  async function handleCopy(kind: ArtifactKind) {
    if (compiled === null || isCompiling) return;
    try {
      await navigator.clipboard.writeText(artifactFor(compiled, kind));
      setLiveStatus(`${kind === "operator" ? "Operator" : "Allowlisted shareable"} Markdown copied.`);
    } catch {
      setLiveStatus("Copy failed. Use the visible Markdown preview instead.");
    }
  }

  function handleDownload(kind: ArtifactKind) {
    if (compiled === null || isCompiling) return;
    try {
      const blob = new Blob([artifactFor(compiled, kind)], { type: "text/markdown;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = ARTIFACT_FILENAME[kind];
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setLiveStatus(`${ARTIFACT_FILENAME[kind]} downloaded from the compiled artifact.`);
    } catch {
      setLiveStatus("Download failed. The compiled Markdown remains available in the preview.");
    }
  }

  return (
    <main className="proofpack-shell" aria-busy={isCompiling}>
      <header className="product-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span>PP</span></div>
          <div>
            <p className="eyebrow">Northstar Millworks Lab · Project Alder · AW-214</p>
            <h1>ProofPack Release Gate</h1>
            <p className="tagline">No source, no claim. No evidence, no release.</p>
          </div>
        </div>
        <div className="runtime-stamp" aria-label="Runtime properties">
          <span><i aria-hidden="true" /> Local</span>
          <span><i aria-hidden="true" /> Deterministic</span>
          <code>{compiled?.receipt.inputDigest.slice(0, 12) ?? "awaiting receipt"}</code>
        </div>
      </header>

      <div className="compile-bar">
        <nav className="pipeline" aria-label="Compilation stages">
          <span><strong>{input.sources.length}</strong> Sources</span>
          <b aria-hidden="true">→</b>
          <span>Exact anchors</span>
          <b aria-hidden="true">→</b>
          <span><strong>{compiled?.observations.length ?? "—"}</strong> Observations</span>
          <b aria-hidden="true">→</b>
          <span><strong>{input.rules.claims.length}</strong> Claims</span>
          <b aria-hidden="true">→</b>
          <span className="pipeline-decision">{compiled?.handoff.decision ?? "Handoff"}</span>
        </nav>
        <p className="live-status" role="status" aria-live="polite">{liveStatus}</p>
      </div>

      {compileError === null ? null : (
        <aside className="compile-error" role="alert">
          <strong>Compile error</strong>
          <p>{compileError}</p>
          {compiled === null ? null : <p>The last valid compiled handoff is still shown below.</p>}
        </aside>
      )}

      <ProposalGate
        applied={proposalApplied}
        artifact={proposalArtifact}
        isBusy={isCompiling}
        review={proposalReview}
        onApply={handleProposalApply}
        onInspectSource={handleInspectEvidence}
        onReset={handleProposalReset}
        onReview={handleProposalReview}
      />

      <div className="triptych">
        <SourcePanel
          sources={input.sources}
          selectedSourceId={selectedSourceId}
          selectedClaimTitle={selectedClaim?.title}
          observations={selectedObservations}
          isCompiling={isCompiling}
          sourceViewerRef={sourceViewerRef}
          onSelectSource={setSelectedSourceId}
        />
        <LedgerPanel
          pack={compiled}
          baseline={baseline}
          diff={diff}
          selectedClaimId={selectedClaimId}
          declaredClaimCount={input.rules.claims.length}
          isCompiling={isCompiling}
          onSelectClaim={handleSelectClaim}
          onInspectEvidence={handleInspectEvidence}
        />
        <HandoffPanel
          pack={compiled}
          diff={diff}
          isCompiling={isCompiling}
          humanDecision={humanDecision}
          onRecordDecision={handleRecordDecision}
          onCopy={handleCopy}
          onDownload={handleDownload}
        />
      </div>

      <footer className="product-footer">
        <span>ProofPack v0.1 · Synthetic fixtures only</span>
        <span>Reproducibility/integrity receipt · SHA-256</span>
        <span>Verified against packet + ruleset v{input.rules.rulesetVersion}</span>
      </footer>
    </main>
  );
}
