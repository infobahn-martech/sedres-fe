import PropTypes from "prop-types";
import { FiUsers, FiFileText } from "react-icons/fi";

const VIEWS = [
  { key: "list", label: "Crew List", icon: <FiUsers aria-hidden /> },
  { key: "form", label: "Form", icon: <FiFileText aria-hidden /> },
];

/** "YYYY-MM-DD HH:mm" -> "DD/MM/YYYY HH:mm" for the batch status strip. */
const formatTimelineValue = (value) => {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/);
  if (!match) return value || "";
  const [, y, m, d, t] = match;
  return `${d}/${m}/${y}${t ? ` ${t}` : ""}`;
};

/**
 * Crew Immigration tab. Batch is the primary selector; everything else — the crew list,
 * the Entry / Return letters (Form) and Update Status — is scoped to the selected batch.
 */
export default function CrewImmigrationPanel({
  rows,
  batchOptions,
  batchCounts,
  activeBatch,
  onSelectBatch,
  loading,
  pagination,
  onPageChange,
  view = "list",
  onViewChange,
  formContent = null,
  actions = null,
  batchTimeline = [],
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeBatchOptions = Array.isArray(batchOptions) ? batchOptions : [];
  const safeBatchCounts = batchCounts && typeof batchCounts === "object" ? batchCounts : {};
  const safeTimeline = Array.isArray(batchTimeline) ? batchTimeline : [];

  const currentPage = pagination?.page ?? 1;
  const limit = pagination?.limit || safeRows.length || 1;
  const total = pagination?.total ?? safeRows.length;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const pageStartDisplay = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const pageEndDisplay = Math.min(currentPage * limit, total);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const goToPage = (pageNo) => {
    if (loading || pageNo < 1 || pageNo > totalPages || pageNo === currentPage) return;
    onPageChange?.(pageNo);
  };

  const isFormView = view === "form" && formContent;

  return (
    <div className="gro-crew-immigration-panel">
      <div className="gro-crew-immigration-toolbar gro-crew-imm-toolbar">
        <div className="gro-crew-imm-toolbar-group">
          {safeBatchOptions.length > 0 ? (
            <div className="gro-pass-segments" role="tablist" aria-label="Batch">
              {safeBatchOptions.map((b) => (
                <div key={b} className="gro-pass-segment-wrap">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeBatch === b}
                    className={`gro-pass-segment${activeBatch === b ? " gro-pass-segment--active" : ""}`}
                    onClick={() => onSelectBatch?.(b)}
                    disabled={loading}
                  >
                    {b}
                  </button>
                  {safeBatchCounts[b] != null ? (
                    <span className="gro-pass-segment-count">{safeBatchCounts[b]}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <span className="gro-crew-imm-toolbar-empty">No batches</span>
          )}
        </div>

        <div className="gro-crew-imm-toolbar-group gro-crew-imm-toolbar-group--end">
          {formContent ? (
            <div className="gro-pass-segments" role="tablist" aria-label="Batch view">
              {VIEWS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  className={`gro-pass-segment gro-crew-imm-view-btn${view === key ? " gro-pass-segment--active" : ""}`}
                  onClick={() => onViewChange?.(key)}
                  disabled={!activeBatch}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {actions ? <div className="gro-pass-segments gro-crew-imm-actions">{actions}</div> : null}
        </div>
      </div>

      {activeBatch && safeTimeline.length > 0 ? (
        <div className="gro-crew-imm-status-strip" aria-label={`${activeBatch} status`}>
          {safeTimeline.map((item) => (
            <span
              key={item.key}
              className={`gro-crew-imm-status-item${item.value ? " gro-crew-imm-status-item--done" : ""}`}
            >
              <span className="gro-crew-imm-status-dot" aria-hidden />
              <span className="gro-crew-imm-status-label">{item.label}</span>
              <span className="gro-crew-imm-status-value">
                {item.value ? formatTimelineValue(item.value) : "Pending"}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      {isFormView ? (
        formContent
      ) : (
        <>
          <div className="gro-crew-immigration-table-wrap">
            <table className="gro-crew-immigration-table">
              <thead>
                <tr>
                  <th>Crew Name</th>
                  <th>Date of Birth</th>
                  <th>Nationality</th>
                  <th>Rank</th>
                  <th>Passport / Iqama</th>
                  <th>Visa</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Loading…</td>
                  </tr>
                ) : safeRows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No crew found.</td>
                  </tr>
                ) : (
                  safeRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.crewName}</td>
                      <td>{row.dateOfBirth}</td>
                      <td>{row.nationality}</td>
                      <td>{row.rank}</td>
                      <td>{row.passportIqama}</td>
                      <td>{row.visa}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="gro-crew-immigration-pagination">
            <p className="gro-crew-immigration-pagination-text">
              {`Showing ${pageStartDisplay}-${pageEndDisplay} of ${total}`}
            </p>
            <div className="gro-crew-immigration-pagination-controls">
              <button
                type="button"
                className="gro-crew-immigration-page-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={loading || currentPage === 1}
              >
                Previous
              </button>
              {pageNumbers.map((pageNo) => (
                <button
                  key={pageNo}
                  type="button"
                  className={`gro-crew-immigration-page-btn${pageNo === currentPage ? " gro-crew-immigration-page-btn--active" : ""}`}
                  onClick={() => goToPage(pageNo)}
                  disabled={loading}
                >
                  {pageNo}
                </button>
              ))}
              <button
                type="button"
                className="gro-crew-immigration-page-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={loading || currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

CrewImmigrationPanel.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object),
  batchOptions: PropTypes.arrayOf(PropTypes.string),
  batchCounts: PropTypes.objectOf(PropTypes.number),
  activeBatch: PropTypes.string,
  onSelectBatch: PropTypes.func,
  loading: PropTypes.bool,
  pagination: PropTypes.shape({
    page: PropTypes.number,
    limit: PropTypes.number,
    total: PropTypes.number,
    totalPages: PropTypes.number,
  }),
  onPageChange: PropTypes.func,
  view: PropTypes.oneOf(["list", "form"]),
  onViewChange: PropTypes.func,
  formContent: PropTypes.node,
  actions: PropTypes.node,
  batchTimeline: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, value: PropTypes.string })
  ),
};
