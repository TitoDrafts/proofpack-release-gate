import type {
  ClaimResult,
  ClaimStatus,
  CompiledPack,
  Observation,
  PackDiff,
} from "../../src/proofpack/types.ts";
import {
  formatStatusTransition,
  resolveDiffObservations,
} from "../release-gate-model.ts";

const STATUS_SYMBOL: Record<ClaimStatus, string> = {
  VERIFIED: "✓",
  INFERRED: "↗",
  NEEDS_CONFIRMATION: "△",
  CONFLICTED: "◆",
  BLOCKED: "■",
};

function statusLabel(status: ClaimStatus): string {
  return status === "NEEDS_CONFIRMATION" ? "NEEDS CONFIRMATION" : status;
}

interface ClaimRowProps {
  claim: ClaimResult;
  selected: boolean;
  changed: boolean;
  transition: string | null;
  onSelectClaim: (claimId: string) => void;
}

function ClaimRow({ claim, selected, changed, transition, onSelectClaim }: ClaimRowProps) {
  return (
    <li>
      <button
        className="claim-row"
        data-status={claim.status}
        type="button"
        aria-pressed={selected}
        onClick={() => onSelectClaim(claim.id)}
      >
        <span className="status-symbol" aria-hidden="true">{STATUS_SYMBOL[claim.status]}</span>
        <span className="claim-copy">
          <strong>{claim.title}</strong>
          <span>{claim.reasonCodes.join(" · ")}</span>
        </span>
        <span className="claim-meta">
          {changed ? <span className="changed-marker">{transition ?? "Evidence changed"}</span> : null}
          <span className="status-text">{statusLabel(claim.status)}</span>
          <span>{claim.evidenceIds.length} evidence</span>
        </span>
      </button>
    </li>
  );
}

interface EvidenceCardProps {
  observation: Observation;
  addedByProposal: boolean;
  onInspectEvidence: (sourceId: string) => void;
}

function EvidenceCard({ observation, addedByProposal, onInspectEvidence }: EvidenceCardProps) {
  return (
    <li>
      <button
        className="evidence-card"
        type="button"
        onClick={() => onInspectEvidence(observation.sourceId)}
      >
        <span className="evidence-route">
          <strong>{observation.sourceFile}</strong>
          <code>{observation.locator}</code>
        </span>
        {addedByProposal ? <span className="changed-marker">Added by proposal</span> : null}
        <code className="evidence-excerpt">{observation.excerpt}</code>
        <span className="evidence-tags">
          <span>{observation.strength}</span>
          <span>{observation.effect}</span>
          <span>{observation.safety}</span>
          <span>Open source →</span>
        </span>
      </button>
    </li>
  );
}

interface LedgerPanelProps {
  pack: CompiledPack | null;
  baseline: CompiledPack | null;
  diff: PackDiff | null;
  selectedClaimId: string;
  declaredClaimCount: number;
  isCompiling: boolean;
  onSelectClaim: (claimId: string) => void;
  onInspectEvidence: (sourceId: string) => void;
}

export function LedgerPanel({
  pack,
  baseline,
  diff,
  selectedClaimId,
  declaredClaimCount,
  isCompiling,
  onSelectClaim,
  onInspectEvidence,
}: LedgerPanelProps) {
  const changedClaimIds = new Set(diff?.changedClaimIds ?? []);
  const addedObservationIds = new Set(diff?.addedObservationIds ?? []);
  const observationById = new Map(pack?.observations.map((observation) => [observation.id, observation]) ?? []);
  const baselineClaimById = new Map(baseline?.claims.map((claim) => [claim.id, claim]) ?? []);
  const addedObservations = resolveDiffObservations(diff?.addedObservationIds ?? [], pack?.observations ?? []);
  const removedObservations = resolveDiffObservations(diff?.removedObservationIds ?? [], baseline?.observations ?? []);
  const selectedClaim = pack?.claims.find(({ id }) => id === selectedClaimId) ?? pack?.claims[0];
  const selectedEvidence = selectedClaim?.evidenceIds
    .map((id) => observationById.get(id))
    .filter((observation): observation is Observation => observation !== undefined) ?? [];

  return (
    <section className="panel ledger-panel" aria-labelledby="evidence-ledger-heading">
      <div className="panel-heading">
        <div>
          <p className="panel-number">02 / PROOF</p>
          <h2 id="evidence-ledger-heading">Evidence ledger</h2>
        </div>
        <span className="count-badge">{pack?.claims.length ?? declaredClaimCount} claims</span>
      </div>

      {pack === null ? (
        <div className="panel-loading" aria-hidden="true">
          <span className="loading-rule" />
          <span className="loading-rule" />
          <span className="loading-rule" />
          <p>Resolving exact anchors through the shared compiler…</p>
        </div>
      ) : (
        <>
          {isCompiling ? (
            <p className="pending-run-label">Previous compiled ledger shown while the updated raw packet recompiles.</p>
          ) : null}
          <ol className="claim-list" aria-label="Compiled claim statuses">
            {pack.claims.map((claim) => (
              <ClaimRow
                claim={claim}
                changed={changedClaimIds.has(claim.id)}
                key={claim.id}
                selected={claim.id === selectedClaim?.id}
                transition={formatStatusTransition(baselineClaimById.get(claim.id)?.status, claim.status)}
                onSelectClaim={onSelectClaim}
              />
            ))}
          </ol>

          {diff === null ? null : (
            <aside className="diff-strip" aria-labelledby="causal-diff-heading">
              <div>
                <span className="micro-label" id="causal-diff-heading">Causal application diff</span>
                <strong>{diff.changedClaimIds.length} claims changed</strong>
              </div>
              <p>
                +{diff.addedObservationIds.length} observations · Handoff: {diff.changedHandoffFields.join(", ") || "unchanged"}
              </p>
              <p>
                {diff.unchangedClaimIds.length} unrelated claims unchanged
                {diff.unchangedClaimIds.includes("fabrication-release")
                  ? ", including fabrication release."
                  : "."}
              </p>
              {addedObservations.length === 0 && removedObservations.length === 0 ? null : (
                <ul className="diff-observation-list" aria-label="Affected observations">
                  {addedObservations.map((observation) => (
                    <li key={`added-${observation.id}`}>
                      <button type="button" onClick={() => onInspectEvidence(observation.sourceId)}>
                        <span className="changed-marker">Added observation</span>
                        <strong>{observation.sourceFile}</strong>
                        <code>{observation.locator}</code>
                        <small>{observation.claimId} · {observation.anchorId}</small>
                        <span>{observation.excerpt}</span>
                      </button>
                    </li>
                  ))}
                  {removedObservations.map((observation) => (
                    <li key={`removed-${observation.id}`}>
                      <button type="button" onClick={() => onInspectEvidence(observation.sourceId)}>
                        <span className="removed-marker">Removed observation</span>
                        <strong>{observation.sourceFile}</strong>
                        <code>{observation.locator}</code>
                        <small>{observation.claimId} · {observation.anchorId}</small>
                        <span>{observation.excerpt}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          )}

          {selectedClaim === undefined ? null : (
            <article className="claim-inspector" aria-labelledby="selected-claim-heading">
              <div className="inspector-heading">
                <div>
                  <span className="micro-label">Selected rule trace</span>
                  <h3 id="selected-claim-heading">{selectedClaim.title}</h3>
                </div>
                <span className="rule-version">
                  {selectedClaim.ruleId} @ {selectedClaim.ruleVersion}
                </span>
              </div>

              <dl className="claim-facts">
                <div>
                  <dt>Status</dt>
                  <dd data-status={selectedClaim.status}>
                    <span aria-hidden="true">{STATUS_SYMBOL[selectedClaim.status]}</span>{" "}
                    {statusLabel(selectedClaim.status)}
                  </dd>
                </div>
                <div>
                  <dt>Reason codes</dt>
                  <dd>{selectedClaim.reasonCodes.join(", ")}</dd>
                </div>
                <div>
                  <dt>Missing predicates</dt>
                  <dd>
                    {selectedClaim.missingPredicates.length === 0
                      ? "None"
                      : selectedClaim.missingPredicates.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Critical gate</dt>
                  <dd>{selectedClaim.critical ? "Yes" : "No"}</dd>
                </div>
              </dl>

              <div className="trace-action">
                <span className="micro-label">Next action</span>
                <p>{selectedClaim.nextAction}</p>
                {selectedClaim.stopCondition === undefined ? null : (
                  <p className="stop-line"><strong>Stop:</strong> {selectedClaim.stopCondition}</p>
                )}
              </div>

              <div className="evidence-heading">
                <span className="micro-label">Exact evidence</span>
                <span>{selectedEvidence.length} resolved</span>
              </div>
              {selectedEvidence.length === 0 ? (
                <p className="empty-evidence">No admissible evidence resolved for this predicate.</p>
              ) : (
                <ul className="evidence-list">
                  {selectedEvidence.map((observation) => (
                    <EvidenceCard
                      addedByProposal={addedObservationIds.has(observation.id)}
                      key={observation.id}
                      observation={observation}
                      onInspectEvidence={onInspectEvidence}
                    />
                  ))}
                </ul>
              )}
            </article>
          )}
        </>
      )}
    </section>
  );
}
