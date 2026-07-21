import type { ProposalReview, ReviewedProposalCandidate } from "../../src/proofpack/proposal.ts";
import type { RecordedProposalArtifact } from "../../src/proofpack/demo-bundle.ts";
import { proposalCanApply, proposalDecisionCounts } from "../release-gate-model.ts";

interface ProposalGateProps {
  artifact: RecordedProposalArtifact;
  review: ProposalReview | null;
  applied: boolean;
  isBusy: boolean;
  onReview: () => void;
  onApply: () => void;
  onReset: () => void;
  onInspectSource: (sourceId: string) => void;
}

function CandidateCard({
  candidate,
  isBusy,
  onInspectSource,
}: {
  candidate: ReviewedProposalCandidate;
  isBusy: boolean;
  onInspectSource: (sourceId: string) => void;
}) {
  return (
    <li className="proposal-candidate" data-decision={candidate.decision}>
      <div className="proposal-candidate-heading">
        <div>
          <strong>{candidate.slotId}</strong>
          <code>{candidate.id}</code>
        </div>
        <span className="proposal-decision">{candidate.decision}</span>
      </div>
      <p className="proposal-reasons">{candidate.reasonCodes.join(" · ")}</p>
      <div className="proposal-anchors" aria-label={`Exact anchors for ${candidate.slotId}`}>
        {candidate.anchors.length === 0 ? (
          <span>No exact anchor admitted.</span>
        ) : candidate.anchors.map((anchor) => (
          <button
            key={`${anchor.sourceId}:${anchor.locator}`}
            type="button"
            disabled={isBusy}
            onClick={() => onInspectSource(anchor.sourceId)}
          >
            <code>{anchor.sourceId} · {anchor.locator}</code>
            <span>{anchor.excerpt}</span>
          </button>
        ))}
      </div>
      <p className="proposal-rationale">
        <span>Untrusted rationale</span>
        {candidate.rationale}
      </p>
    </li>
  );
}

export function ProposalGate({
  artifact,
  review,
  applied,
  isBusy,
  onReview,
  onApply,
  onReset,
  onInspectSource,
}: ProposalGateProps) {
  const counts = proposalDecisionCounts(review);
  const reviewed = review?.status === "REVIEWED";
  const reviewRejected = review?.status === "REJECTED";

  return (
    <section className="proposal-gate" aria-labelledby="proposal-gate-heading">
      <header className="proposal-gate-heading">
        <div>
          <p className="eyebrow">AI / AUTHORITY FIREWALL</p>
          <h2 id="proposal-gate-heading">GPT-5.6 proposes. ProofPack proves—or rejects.</h2>
        </div>
        <div className="proposal-badges" aria-label="Proposal provenance">
          <span>{artifact.recorded ? "Recorded artifact" : "Live artifact"}</span>
          <span>{artifact.trust}</span>
          <span>{artifact.authority.replace("_", " ")}</span>
        </div>
      </header>

      <div className="proposal-stages">
        <section aria-labelledby="ai-proposal-heading">
          <span className="proposal-stage-number">01</span>
          <div>
            <h3 id="ai-proposal-heading">AI proposal</h3>
            <p>
              A recorded <code>{artifact.model}</code> run proposed three bounded bindings from the
              synthetic operator email.
            </p>
            <dl className="proposal-binding">
              <div><dt>Packet</dt><dd>{artifact.proposal.target.packetId}</dd></div>
              <div><dt>Fingerprint</dt><dd>{artifact.proposal.target.packetFingerprint.slice(0, 12)}</dd></div>
              <div><dt>Proposal</dt><dd title={artifact.proposalDigest}>{artifact.proposalDigest.slice(0, 12)}</dd></div>
              <div><dt>Runner</dt><dd>Codex {artifact.cliVersion} · {artifact.authMode}</dd></div>
            </dl>
          </div>
        </section>

        <section aria-labelledby="deterministic-review-heading">
          <span className="proposal-stage-number">02</span>
          <div>
            <h3 id="deterministic-review-heading">Deterministic review</h3>
            <p className="proposal-legend">
              <strong>ADMISSIBLE</strong> requires exact allowlisted authority. <strong>REJECTED</strong>
              {" "}stays inert—for example <code>UNAUTHORIZED_AUTHORITY</code>.
            </p>
            {review === null ? (
              <p className="proposal-awaiting">Awaiting local review. No packet input has changed.</p>
            ) : reviewRejected ? (
              <div className="proposal-review-error" role="alert">
                <strong>Proposal rejected</strong>
                <span>{review.reasonCodes.join(" · ")}</span>
              </div>
            ) : (
              <>
                <div className="proposal-review-summary" role="status">
                  <span><strong>{counts.admissible}</strong> admissible</span>
                  <span><strong>{counts.rejected}</strong> rejected</span>
                  <code title={review.reviewDigest}>review {review.reviewDigest.slice(0, 12)}</code>
                </div>
                <ol className="proposal-candidates" aria-label="Deterministically reviewed proposal candidates">
                  {review.candidates.map((candidate) => (
                    <CandidateCard
                      candidate={candidate}
                      isBusy={isBusy}
                      key={candidate.id}
                      onInspectSource={onInspectSource}
                    />
                  ))}
                </ol>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="human-application-heading">
          <span className="proposal-stage-number">03</span>
          <div>
            <h3 id="human-application-heading">Human application</h3>
            <p>
              A human may apply only the two admitted bindings. Model output cannot set readiness,
              claim status, or the fabrication decision.
            </p>
            <p className="proposal-application-state" role="status">
              {applied
                ? "Applied through the deterministic compiler; the remaining sample blocker keeps HOLD."
                : reviewed
                  ? "Review complete. Application still requires an explicit human action."
                  : "Review first; applying is disabled until both traveler bindings are admitted."}
            </p>
            <div className="button-row proposal-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={isBusy || review !== null}
                onClick={onReview}
              >
                Review GPT-5.6 proposal
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={isBusy || applied || !proposalCanApply(review)}
                onClick={onApply}
              >
                Apply 2 admissible bindings
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={isBusy || (review === null && !applied)}
                onClick={onReset}
              >
                Reset proposal gate
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
