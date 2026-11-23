import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { FiUsers, FiFileText, FiSearch, FiX, FiCheck, FiClock } from "react-icons/fi";
import { GroCrewTableSkeletonRows } from "./GroCardViewSkeleton";

const VIEWS = [
  { key: "list", label: "Crew List", icon: <FiUsers aria-hidden /> },
  { key: "form", label: "Form", icon: <FiFileText aria-hidden /> },
];

const BATCH_STATUS_META = {
  done: { icon: <FiCheck aria-hidden />, label: "Completed" },
  progress: { icon: <FiClock aria-hidden />, label: "In progress" },
  pending: { icon: null, label: "Pending" },
};

const SKELETON_ROWS = 12;
const COLUMN_COUNT = 7;

const initialsOf = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const matchesSearch = (row, term) =>
  !term ||
  [row.crewName, row.nationality, row.rank, row.passportIqama, row.visa]
    .some((value) => String(value ?? "").toLowerCase().includes(term));

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
  batchStatus = {},
  batchesLoading = false,
}) {
  const [search, setSearch] = useState("");
  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const safeBatchOptions = Array.isArray(batchOptions) ? batchOptions : [];
  const safeBatchCounts = batchCounts && typeof batchCounts === "object" ? batchCounts : {};

  // A search belongs to the batch it was typed in.
  useEffect(() => {
    setSearch("");
  }, [activeBatch]);

  const term = search.trim().toLowerCase();
  const visibleRows = useMemo(() => safeRows.filter((row) => matchesSearch(row, term)), [safeRows, term]);

  const currentPage = pagination?.page ?? 1;
  const limit = pagination?.limit || safeRows.length || 1;
  const total = pagination?.total ?? safeRows.length;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const pageStartDisplay = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const pageEndDisplay = Math.min(currentPage * limit, total);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const rowOffset = (currentPage - 1) * limit;

  const goToPage = (pageNo) => {
    if (loading || pageNo < 1 || pageNo > totalPages || pageNo === currentPage) return;
    onPageChange?.(pageNo);
  };

  const isFormView = view === "form" && formContent;

  return (
    <div className="gro-crew-immigration-panel gro-crew-imm-panel">
      <div className="gro-crew-immigration-toolbar gro-crew-imm-toolbar">
        <div className="gro-crew-imm-toolbar-group">
          {safeBatchOptions.length > 0 ? (
            <div className="gro-pass-segments" role="tablist" aria-label="Batch">
              {safeBatchOptions.map((b) => {
                const status = batchStatus?.[b] ?? "pending";
                const meta = BATCH_STATUS_META[status] ?? BATCH_STATUS_META.pending;
                return (
                  <div key={b} className="gro-pass-segment-wrap">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeBatch === b}
                      title={`${b} · ${meta.label}`}
                      className={`gro-pass-segment gro-crew-imm-batch-btn${activeBatch === b ? " gro-pass-segment--active" : ""}`}
                      onClick={() => onSelectBatch?.(b)}
                    >
                      <span className={`gro-crew-imm-batch-mark gro-crew-imm-batch-mark--${status}`} aria-hidden>
                        {meta.icon}
                      </span>
                      {b}
                      <span className="visually-hidden">{`, ${meta.label}`}</span>
                    </button>
                    {safeBatchCounts[b] != null ? (
                      <span className="gro-pass-segment-count">{safeBatchCounts[b]}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : batchesLoading ? (
            <div className="gro-skel-batches" role="status" aria-live="polite">
              <span className="visually-hidden">Loading batches…</span>
              <span className="gro-skeleton gro-skel-on-brand gro-skel-pill" aria-hidden="true" />
              <span className="gro-skeleton gro-skel-on-brand gro-skel-pill" aria-hidden="true" />
            </div>
          ) : (
            <span className="gro-crew-imm-toolbar-empty">No batches</span>
          )}
        </div>

        <div className="gro-crew-imm-toolbar-group gro-crew-imm-toolbar-group--end">
          {activeBatch && !isFormView ? (
            <label className="gro-crew-imm-search">
              <FiSearch aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, passport, visa…"
                aria-label={`Search crew in ${activeBatch}`}
              />
              {search ? (
                <button
                  type="button"
                  className="gro-crew-imm-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <FiX />
                </button>
              ) : null}
            </label>
          ) : null}
          {formContent ? (
            <div className="gro-pass-segments gro-crew-imm-view-switch" role="tablist" aria-label="Batch view">
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

      {isFormView ? (
        <div className="gro-crew-imm-body">{formContent}</div>
      ) : (
        <>
          <div className="gro-crew-immigration-table-wrap gro-crew-imm-table-wrap">
            <table className="gro-crew-immigration-table gro-crew-imm-table">
              <thead>
                <tr>
                  <th className="gro-crew-imm-col-index">#</th>
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
                  <GroCrewTableSkeletonRows rows={SKELETON_ROWS} />
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="gro-crew-imm-empty">
                      {term ? `No crew match “${search.trim()}”.` : "No crew in this batch."}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td className="gro-crew-imm-col-index">{rowOffset + safeRows.indexOf(row) + 1}</td>
                      <td>
                        <span className="gro-crew-imm-person">
                          <span className="gro-crew-imm-avatar" aria-hidden>
                            {initialsOf(row.crewName)}
                          </span>
                          <span className="gro-crew-imm-person-name">{row.crewName}</span>
                        </span>
                      </td>
                      <td>{row.dateOfBirth}</td>
                      <td>
                        {row.nationality ? <span className="gro-crew-imm-chip">{row.nationality}</span> : null}
                      </td>
                      <td>{row.rank}</td>
                      <td className="gro-crew-imm-mono">{row.passportIqama}</td>
                      <td className="gro-crew-imm-mono">{row.visa}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="gro-crew-immigration-pagination">
            <p className="gro-crew-immigration-pagination-text" aria-live="polite">
              {loading ? (
                <span className="gro-skel-inline">
                  <span className="gro-skel-spinner" aria-hidden="true" />
                  {activeBatch ? `Loading ${activeBatch} crew…` : "Loading crew…"}
                </span>
              ) : term
                ? `${visibleRows.length} of ${safeRows.length} crew shown`
                : `Showing ${pageStartDisplay}-${pageEndDisplay} of ${total}`}
            </p>
            {totalPages > 1 ? (
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
            ) : null}
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
  batchStatus: PropTypes.objectOf(PropTypes.oneOf(["done", "progress", "pending"])),
  batchesLoading: PropTypes.bool,
};
