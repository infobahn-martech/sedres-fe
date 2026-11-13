import PropTypes from "prop-types";

/** Placeholder rows shown while a documents list is loading. */
export function GroDocumentRowsSkeleton({ rows = 3 }) {
  return (
    <div className="gro-skeleton-rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="gro-skeleton-doc-row">
          <span className="gro-skeleton gro-skeleton-doc-icon" />
          <span className="gro-skeleton gro-skeleton-line" style={{ width: `${32 - i * 5}%` }} />
          <span className="gro-skeleton-doc-actions">
            <span className="gro-skeleton gro-skeleton-action" />
            <span className="gro-skeleton gro-skeleton-action" />
          </span>
        </div>
      ))}
    </div>
  );
}

GroDocumentRowsSkeleton.propTypes = {
  rows: PropTypes.number,
};

/** Full-layout skeleton mirroring GROCardView (summary cards + documents section). */
function GroCardViewSkeleton({ summaryCards = 6 }) {
  return (
    <div className="gro-card-view gro-card-view--skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">Loading card details…</span>
      <div className="gro-summary-grid gro-summary-grid--six-col" aria-hidden="true">
        {Array.from({ length: summaryCards }, (_, i) => (
          <div key={i} className="gro-summary-card">
            <span className="gro-skeleton gro-skeleton-label" />
            <span className="gro-skeleton gro-skeleton-value" />
          </div>
        ))}
      </div>
      <div className="gro-document-section" aria-hidden="true">
        <div className="gro-document-header">
          <span className="gro-skeleton gro-skeleton-heading" />
          <span className="gro-skeleton gro-skeleton-tabs" />
        </div>
        <div className="gro-document-list">
          <GroDocumentRowsSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}

GroCardViewSkeleton.propTypes = {
  summaryCards: PropTypes.number,
};

export default GroCardViewSkeleton;
