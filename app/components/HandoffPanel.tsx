import type { FormEvent } from "react";
import type { CompiledPack, PackDiff } from "../../src/proofpack/types.ts";
import type {
  HumanDecisionKind,
  HumanDecisionRecord,
} from "../release-gate-model.ts";

export type ArtifactKind = "operator" | "shareable";

interface ExportPreviewProps {
  kind: ArtifactKind;
  title: string;
  description: string;
  markdown: string;
  disabled: boolean;
  onCopy: (kind: ArtifactKind) => void;
  onDownload: (kind: ArtifactKind) => void;
}

function ExportPreview({
  kind,
  title,
  description,
  markdown,
  disabled,
  onCopy,
  onDownload,
}: ExportPreviewProps) {
  return (
    <details className="export-card">
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span aria-hidden="true">＋</span>
      </summary>
      <pre tabIndex={0} aria-label={`${title} Markdown preview`}>
        <code>{markdown}</code>
      </pre>
      <div className="button-row">
        <button className="button button-secondary" type="button" disabled={disabled} onClick={() => onCopy(kind)}>
          Copy Markdown
        </button>
        <button className="button button-secondary" type="button" disabled={disabled} onClick={() => onDownload(kind)}>
          Download .md
        </button>
      </div>
    </details>
  );
}

interface HandoffPanelProps {
  pack: CompiledPack | null;
  diff: PackDiff | null;
  isCompiling: boolean;
  humanDecision: HumanDecisionRecord | null;
  onRecordDecision: (kind: HumanDecisionKind, reason: string) => void;
  onCopy: (kind: ArtifactKind) => void;
  onDownload: (kind: ArtifactKind) => void;
}

export function HandoffPanel({
  pack,
  diff,
  isCompiling,
  humanDecision,
  onRecordDecision,
  onCopy,
  onDownload,
}: HandoffPanelProps) {
  const claimTitleById = new Map(pack?.claims.map((claim) => [claim.id, claim.title]) ?? []);
  const changedHandoffFields = new Set(diff?.changedHandoffFields ?? []);

  function handleDecisionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawKind = formData.get("decision-kind");
    const kind: HumanDecisionKind = rawKind === "EXCEPTION" ? "EXCEPTION" : "HOLD";
    onRecordDecision(kind, String(formData.get("decision-reason") ?? ""));
  }

  return (
    <section className="panel handoff-panel" aria-labelledby="fabrication-handoff-heading">
      <div className="panel-heading">
        <div>
          <p className="panel-number">03 / RELEASE</p>
          <h2 id="fabrication-handoff-heading">Fabrication handoff</h2>
        </div>
        <span className="count-badge">Human control</span>
      </div>

      {pack === null ? (
        <div className="decision-summary decision-pending">
          <span className="decision-icon" aria-hidden="true">…</span>
          <div>
            <span className="micro-label">Release decision</span>
            <strong>{isCompiling ? "COMPILING" : "UNAVAILABLE"}</strong>
            <p>Waiting for the bundled packet to compile locally.</p>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`decision-summary ${changedHandoffFields.has("decision") || changedHandoffFields.has("summary") ? "handoff-changed" : ""}`}
            data-decision={pack.handoff.decision}
          >
            <span className="decision-icon" aria-hidden="true">
              {pack.handoff.decision === "HOLD" ? "■" : "✓"}
            </span>
            <div>
              <span className="micro-label">
                {isCompiling ? "Previous valid decision · recompiling" : "Fabrication decision"}
              </span>
              {changedHandoffFields.has("decision") || changedHandoffFields.has("summary")
                ? <span className="changed-marker">Changed from baseline</span>
                : null}
              <strong>{pack.handoff.decision}</strong>
              <p>{pack.handoff.summary}</p>
              <span className="fingerprint">
                Packet fingerprint {pack.receipt.inputDigest.slice(0, 12)}
              </span>
            </div>
          </div>

          <div className="handoff-columns">
            <section
              aria-labelledby="done-heading"
              className={changedHandoffFields.has("done") ? "handoff-changed" : undefined}
            >
              <h3 id="done-heading"><span aria-hidden="true">✓</span> Done</h3>
              {changedHandoffFields.has("done") ? <span className="changed-marker">Changed</span> : null}
              <ul>
                {pack.handoff.done.map((claimId) => (
                  <li key={claimId}>{claimTitleById.get(claimId) ?? claimId}</li>
                ))}
              </ul>
            </section>
            <section
              aria-labelledby="not-done-heading"
              className={changedHandoffFields.has("notDone") ? "handoff-changed" : undefined}
            >
              <h3 id="not-done-heading"><span aria-hidden="true">■</span> Not done</h3>
              {changedHandoffFields.has("notDone") ? <span className="changed-marker">Changed</span> : null}
              <ul>
                {pack.handoff.notDone.map((claimId) => (
                  <li key={claimId}>{claimTitleById.get(claimId) ?? claimId}</li>
                ))}
              </ul>
            </section>
          </div>

          <section
            className={`next-action ${changedHandoffFields.has("nextAction") ? "handoff-changed" : ""}`}
            aria-labelledby="next-action-heading"
          >
            <span className="micro-label" id="next-action-heading">Next safe action</span>
            {changedHandoffFields.has("nextAction") ? <span className="changed-marker">Changed</span> : null}
            <p>{pack.handoff.nextAction}</p>
          </section>

          <section
            className={`stop-conditions ${changedHandoffFields.has("stopConditions") ? "handoff-changed" : ""}`}
            aria-labelledby="stop-conditions-heading"
          >
            <h3 id="stop-conditions-heading">Active stop conditions</h3>
            {changedHandoffFields.has("stopConditions") ? <span className="changed-marker">Changed</span> : null}
            <ul>
              {pack.handoff.stopConditions.map((condition) => (
                <li key={condition}><span aria-hidden="true">■</span>{condition}</li>
              ))}
            </ul>
          </section>

          <section className="human-decision" aria-labelledby="human-decision-heading">
            <div className="section-heading-row">
              <div>
                <span className="micro-label">Operator record</span>
                <h3 id="human-decision-heading">Human decision</h3>
              </div>
              <span className="non-overriding-label">Does not override evidence</span>
            </div>
            <p id="decision-help">
              Acknowledge HOLD or document an exception request. An exception never clears compiled blockers or changes claim statuses.
            </p>
            <form onSubmit={handleDecisionSubmit} aria-describedby="decision-help">
              <fieldset disabled={isCompiling}>
                <legend>Decision type</legend>
                <label>
                  <input type="radio" name="decision-kind" value="HOLD" defaultChecked />
                  <span><strong>Acknowledge HOLD</strong><small>Keep the machine gate in force.</small></span>
                </label>
                <label>
                  <input type="radio" name="decision-kind" value="EXCEPTION" />
                  <span><strong>Request exception</strong><small>Requires a visible reason; blockers remain.</small></span>
                </label>
              </fieldset>
              <label className="reason-field" htmlFor="decision-reason">
                Exception reason
                <textarea
                  id="decision-reason"
                  name="decision-reason"
                  rows={3}
                  placeholder="Required when requesting an exception"
                  disabled={isCompiling}
                />
              </label>
              <button className="button button-primary" type="submit" disabled={isCompiling}>
                Record human decision
              </button>
            </form>

            <div className="decision-record" aria-label="Recorded human decision">
              {humanDecision === null ? (
                <p>No human decision recorded. Compiled evidence remains authoritative.</p>
              ) : humanDecision.kind === "HOLD" ? (
                <p>
                  <strong>HOLD acknowledged.</strong> All compiled evidence statuses remain unchanged.{" "}
                  <code>Packet {humanDecision.inputDigest.slice(0, 12)}</code>
                </p>
              ) : (
                <p>
                  <strong>Exception requested:</strong> {humanDecision.reason}{" "}
                  Machine HOLD and every active blocker remain in force.{" "}
                  <code>Packet {humanDecision.inputDigest.slice(0, 12)}</code>
                </p>
              )}
            </div>
          </section>

          <section className="exports" aria-labelledby="exports-heading">
            <div className="section-heading-row">
              <div>
                <span className="micro-label">Compiled artifacts</span>
                <h3 id="exports-heading">Markdown exports</h3>
              </div>
            </div>
            <p>These previews are the compiler artifacts exactly as produced—never rebuilt in the interface.</p>
            <ExportPreview
              kind="operator"
              title="Operator handoff"
              description="Internal evidence-linked packet"
              markdown={pack.artifacts.operatorMarkdown}
              disabled={isCompiling}
              onCopy={onCopy}
              onDownload={onDownload}
            />
            <ExportPreview
              kind="shareable"
              title="Allowlisted shareable export"
              description="Separately constructed public projection"
              markdown={pack.artifacts.shareableMarkdown}
              disabled={isCompiling}
              onCopy={onCopy}
              onDownload={onDownload}
            />
          </section>
        </>
      )}
    </section>
  );
}
