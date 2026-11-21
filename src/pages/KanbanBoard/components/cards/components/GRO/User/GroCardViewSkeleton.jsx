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

// Fixed (not random) width patterns, so skeleton rows look natural but never jump on re-render.
const ROW_WIDTHS = [72, 58, 84, 64, 78, 52, 68, 88, 60, 74];
const widthAt = (index, offset = 0) => `${ROW_WIDTHS[(index + offset) % ROW_WIDTHS.length]}%`;

/** Crew table placeholder rows — mirrors the real row: #, avatar + name, date, chip, text, ids. */
export function GroCrewTableSkeletonRows({ rows = 10 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={`sk-${i}`} className="gro-skel-row" aria-hidden="true">
      <td className="gro-crew-imm-col-index">
        <span className="gro-skeleton gro-skel-num" />
      </td>
      <td>
        <span className="gro-skel-person">
          <span className="gro-skeleton gro-skel-avatar" />
          <span className="gro-skeleton gro-skel-text" style={{ width: widthAt(i) }} />
        </span>
      </td>
      <td>
        <span className="gro-skeleton gro-skel-text gro-skel-text--fixed" />
      </td>
      <td>
        <span className="gro-skeleton gro-skel-chip" />
      </td>
      <td>
        <span className="gro-skeleton gro-skel-text" style={{ width: widthAt(i, 3) }} />
      </td>
      <td>
        <span className="gro-skeleton gro-skel-text" style={{ width: widthAt(i, 5) }} />
      </td>
      <td>
        <span className="gro-skeleton gro-skel-text" style={{ width: widthAt(i, 7) }} />
      </td>
    </tr>
  ));
}

GroCrewTableSkeletonRows.propTypes = {
  rows: PropTypes.number,
};

/** Field | Value (Arabic) | Value (English) placeholder rows for the template-driven forms. */
export function GroFieldTableSkeletonRows({ rows = 8, columns = 3 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={`sk-${i}`} className="gro-skel-row" aria-hidden="true">
      <td>
        <span className="gro-skeleton gro-skel-text" style={{ width: widthAt(i) }} />
      </td>
      {Array.from({ length: columns - 1 }, (__, c) => (
        <td key={c}>
          <span className="gro-skeleton gro-skel-input" />
        </td>
      ))}
    </tr>
  ));
}

GroFieldTableSkeletonRows.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number,
};

/** Arabic letter placeholder: title, divider, right-aligned date block, paragraphs, table. */
export function GroLetterPreviewSkeleton() {
  return (
    <div className="gro-skel-paper" aria-hidden="true">
      <span className="gro-skeleton gro-skel-paper-title" />
      <span className="gro-skel-paper-divider" />
      <div className="gro-skel-paper-block gro-skel-paper-block--end">
        <span className="gro-skeleton gro-skel-text" style={{ width: "26%" }} />
        <span className="gro-skeleton gro-skel-text" style={{ width: "22%" }} />
      </div>
      <div className="gro-skel-paper-block gro-skel-paper-block--end">
        <span className="gro-skeleton gro-skel-text" style={{ width: "44%" }} />
        <span className="gro-skeleton gro-skel-text" style={{ width: "18%" }} />
        <span className="gro-skeleton gro-skel-text" style={{ width: "86%" }} />
      </div>
      <div className="gro-skel-paper-table">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="gro-skeleton gro-skel-paper-row" />
        ))}
      </div>
    </div>
  );
}

/** Date-time field placeholders for the Update Status popover. */
export function GroTimeFieldsSkeleton({ fields = 2 }) {
  return (
    <div className="gro-skel-fields" role="status" aria-live="polite">
      <span className="visually-hidden">Loading time fields…</span>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="gro-skel-field" aria-hidden="true">
          <span className="gro-skeleton gro-skel-text" style={{ width: widthAt(i, 2), maxWidth: 180 }} />
          <span className="gro-skeleton gro-skel-input gro-skel-input--tall" />
        </div>
      ))}
    </div>
  );
}

GroTimeFieldsSkeleton.propTypes = {
  fields: PropTypes.number,
};

/** Full-layout skeleton mirroring GROCardView (summary cards + documents section). */
function GroCardViewSkeleton({ summaryCards = 6 }) {
  return (
    <div className="gro-card-view gro-card-view--skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">Loading card details…</span>
      <div className="gro-summary-grid gro-summary-grid--six-col" aria-hidden="true">
        {Array.from({ length: summaryCards }, (_, i) => (
          <div key={i} className="gro-summary-card">
            <span className="gro-skeleton gro-skeleton-summary-icon" />
            <div className="gro-summary-body">
              <span className="gro-skeleton gro-skeleton-label" />
              <span className="gro-skeleton gro-skeleton-value" />
            </div>
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
