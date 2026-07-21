import type { RefObject } from "react";
import type { Observation, SourceDocument } from "../../src/proofpack/types.ts";

const SOURCE_TYPE_LABEL = {
  "application/json": "JSON",
  "text/markdown": "MD",
  "text/plain": "LOG",
} as const;

interface SourcePanelProps {
  sources: readonly SourceDocument[];
  selectedSourceId: string;
  selectedClaimTitle?: string;
  observations: readonly Observation[];
  isCompiling: boolean;
  sourceViewerRef: RefObject<HTMLDivElement | null>;
  onSelectSource: (sourceId: string) => void;
}

export function SourcePanel({
  sources,
  selectedSourceId,
  selectedClaimTitle,
  observations,
  isCompiling,
  sourceViewerRef,
  onSelectSource,
}: SourcePanelProps) {
  const selectedSource = sources.find(({ id }) => id === selectedSourceId) ?? sources[0];
  const evidenceForSource = selectedSource === undefined
    ? []
    : observations.filter(({ sourceId }) => sourceId === selectedSource.id);
  const evidenceSourceIds = new Set(observations.map(({ sourceId }) => sourceId));

  return (
    <section className="panel source-panel" aria-labelledby="release-packet-heading">
      <div className="panel-heading">
        <div>
          <p className="panel-number">01 / INPUT</p>
          <h2 id="release-packet-heading">Release packet</h2>
        </div>
        <span className="count-badge">{sources.length} sources</span>
      </div>

      <nav className="source-list" aria-label="Synthetic release packet sources">
        {sources.map((source, index) => {
          const supportsSelectedClaim = evidenceSourceIds.has(source.id);
          return (
            <button
              className="source-button"
              data-evidence-source={supportsSelectedClaim ? "true" : "false"}
              key={source.id}
              type="button"
              aria-pressed={source.id === selectedSource?.id}
              onClick={() => onSelectSource(source.id)}
            >
              <span className="source-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="source-name">{source.file}</span>
              <span className="source-type">{SOURCE_TYPE_LABEL[source.mediaType]}</span>
            </button>
          );
        })}
      </nav>

      <div
        className="source-viewer"
        ref={sourceViewerRef}
        tabIndex={-1}
        aria-label="Selected raw source and compiled anchors"
      >
        <div className="source-meta">
          <div>
            <span className="micro-label">Selected source</span>
            <strong>{selectedSource?.file ?? "No source"}</strong>
          </div>
          {selectedSource === undefined ? null : (
            <span className={`safety-label safety-${selectedSource.safety.toLowerCase()}`}>
              {selectedSource.safety}
            </span>
          )}
        </div>

        <div className="anchor-strip" aria-label="Evidence anchors in selected source">
          <span className="micro-label">Compiled anchors</span>
          {evidenceForSource.length === 0 ? (
            <p>
              {selectedClaimTitle === undefined
                ? "Exact anchors appear after local compilation."
                : `No resolved anchor for “${selectedClaimTitle}” in this source.`}
            </p>
          ) : (
            evidenceForSource.map((observation) => (
              <article className="anchor-callout" key={observation.id}>
                <code>{observation.locator}</code>
                <span>{observation.excerpt}</span>
              </article>
            ))
          )}
        </div>

        <pre className="source-code" tabIndex={0} aria-label={`Raw contents of ${selectedSource?.file ?? "source"}`}>
          <code>{selectedSource?.content || "(empty — no incoming receipt recorded)"}</code>
        </pre>
      </div>

      {isCompiling ? <p className="source-compiling-note">Raw sources are locked while the compiler runs.</p> : null}
    </section>
  );
}
