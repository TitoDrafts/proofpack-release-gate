"use client";

import { useEffect, useRef, useState } from "react";
import { LedgerPanel } from "./components/LedgerPanel.tsx";
import {
  HandoffPanel,
  type ArtifactKind,
} from "./components/HandoffPanel.tsx";
import { SourcePanel } from "./components/SourcePanel.tsx";
import {
  appendSyntheticReceipt,
  buildHumanDecision,
  SYNTHETIC_RECEIPT_LINE,
  type HumanDecisionKind,
  type HumanDecisionRecord,
} from "./release-gate-model.ts";
import { compileProofPack } from "../src/proofpack/compile.ts";
import { createDemoInput } from "../src/proofpack/demo-bundle.ts";
import { diffCompiledPacks } from "../src/proofpack/diff.ts";
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
  const replayAppended = input.sources
    .find(({ id }) => id === "incoming-receipts")
    ?.content.replaceAll("\r\n", "\n")
    .split("\n")
    .includes(SYNTHETIC_RECEIPT_LINE) ?? false;

  function handleSelectClaim(claimId: string) {
    setSelectedClaimId(claimId);
    const firstEvidence = compiled?.observations.find(({ claimId: observationClaimId }) =>
      observationClaimId === claimId);
    if (firstEvidence !== undefined) {
      setSelectedSourceId(firstEvidence.sourceId);
    }
  }

  async function handleReplay() {
    if (compiled === null || baseline === null || isCompiling || replayAppended) return;
    const replayInput = appendSyntheticReceipt(input);
    setInput(replayInput);
    setHumanDecision(null);
    setSelectedSourceId("incoming-receipts");
    setIsCompiling(true);
    setLiveStatus("Rev C receipt appended to raw input. Recompiling through the shared core…");
    try {
      const replayPack = await compileProofPack(replayInput);
      const replayDiff = diffCompiledPacks(baseline, replayPack);
      setCompiled(replayPack);
      setDiff(replayDiff);
      setCompileError(null);
      setLiveStatus(
        `Replay compiled: ${replayDiff.changedClaimIds.length} causal claims changed. Fabrication remains ${replayPack.claims.find(({ id }) => id === "fabrication-release")?.status ?? "unresolved"}.`,
      );
    } catch (error: unknown) {
      setCompileError(formatCompileError(error));
      setLiveStatus("Replay compilation failed. The previous valid handoff remains displayed.");
    } finally {
      setIsCompiling(false);
    }
  }

  async function handleReset() {
    if (isCompiling || !replayAppended) return;
    const resetInput = createDemoInput();
    setInput(resetInput);
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
      setLiveStatus(`Replay reset. Original fingerprint ${resetPack.receipt.inputDigest.slice(0, 12)} restored.`);
    } catch (error: unknown) {
      setCompileError(formatCompileError(error));
      setLiveStatus("Reset compilation failed. The previous valid handoff remains displayed.");
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

      <div className="triptych">
        <SourcePanel
          sources={input.sources}
          selectedSourceId={selectedSourceId}
          selectedClaimTitle={selectedClaim?.title}
          observations={selectedObservations}
          isCompiling={isCompiling}
          replayAppended={replayAppended}
          sourceViewerRef={sourceViewerRef}
          onSelectSource={setSelectedSourceId}
          onReplay={handleReplay}
          onReset={handleReset}
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
