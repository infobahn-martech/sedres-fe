import PropTypes from "prop-types";
import { Fragment, useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { FiChevronLeft, FiChevronRight, FiChevronDown, FiEye } from "react-icons/fi";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { groupPassRequestRows } from "../../../../../../../services/cgAndZwailpassService";
import { PremiumCardHeader, CrewCell, WorkOrderChip } from "./Husbandry.components";

const DEFAULT_PAGE_SIZE = 10;
const EMPTY_LIST = [];

const parseRequestedDate = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const normalized = value.replace(" ", "T");
    const parsed = parseISO(normalized);
    if (isValid(parsed)) return parsed;
  }
  const d = new Date(value);
  return isValid(d) ? d : null;
};

const formatRequestedDate = (value) => {
  const parsed = parseRequestedDate(value);
  if (!parsed) {
    return <span className="crew-pass-requests-table__empty-cell">—</span>;
  }
  return format(parsed, "dd/MM/yyyy");
};

const statusToneClass = (status) => {
  const raw = String(status ?? "").trim().toLowerCase();
  if (raw === "pending") return "crew-pass-requests-table__badge--pending";
  if (raw === "documents pending" || (raw.includes("document") && raw.includes("pending"))) {
    return "crew-pass-requests-table__badge--docs-pending";
  }
  if (raw === "completed" || raw === "done") return "crew-pass-requests-table__badge--done";
  return "crew-pass-requests-table__badge--default";
};

const pickDocumentUrl = (row) =>
  row?.document_url ?? row?.documentUrl ?? row?.document_URL ?? "";

const CellText = ({ value }) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return <span className="crew-pass-requests-table__empty-cell">—</span>;
  }
  return value;
};

CellText.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const StatusBadge = ({ status }) => {
  const isEmpty = status === undefined || status === null || String(status).trim() === "";
  if (isEmpty) {
    return <span className="crew-pass-requests-table__empty-cell">—</span>;
  }
  return (
    <span className={`crew-pass-requests-table__badge ${statusToneClass(status)}`}>{status}</span>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

/** The 7 crew-detail cells shared by both a single-crew work order's own row and an expanded crew sub-row. */
const CrewRowCells = ({ row, index, onOpenDocument }) => {
  const docUrl = pickDocumentUrl(row);
  return (
    <>
      <td>
        <CrewCell name={row?.crew_name} index={index} />
      </td>
      <td>
        <CellText value={row?.passport_no} />
      </td>
      <td>
        <CellText value={row?.movement_type} />
      </td>
      <td>
        <StatusBadge status={row?.status} />
      </td>
      <td>
        <CellText value={row?.assigned_gro_name} />
      </td>
      <td>{formatRequestedDate(row?.requested_date)}</td>
      <td className="crew-pass-requests-table__doc-cell">
        {docUrl ? (
          <button
            type="button"
            className="crew-pass-requests-table__doc-btn"
            onClick={() => onOpenDocument(docUrl)}
            aria-label="View document"
          >
            <FiEye size={15} />
          </button>
        ) : (
          <span className="crew-pass-requests-table__empty-cell">—</span>
        )}
      </td>
    </>
  );
};

CrewRowCells.propTypes = {
  row: PropTypes.object,
  index: PropTypes.number,
  onOpenDocument: PropTypes.func.isRequired,
};

const earliestRequestedDate = (crewList) => {
  const dates = (crewList || [])
    .map((c) => parseRequestedDate(c?.requested_date))
    .filter(Boolean);
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min));
};

const CrewPassRequestsTable = ({
  title,
  subtitle,
  icon,
  requests,
  loading,
  passType,
  pageSize,
  emptyMessage = "No pass requests found",
  accent = "blue",
}) => {
  const groups = useMemo(() => {
    const source = Array.isArray(requests) ? requests : EMPTY_LIST;
    return groupPassRequestRows(source);
  }, [requests]);
  const groupCount = groups.length;
  const totalCrewCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.crew.length, 0),
    [groups]
  );

  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const totalPages = Math.max(1, Math.ceil(groupCount / pageSize) || 1);

  const listSignature = useMemo(
    () => `${groupCount}|${groups.map((g) => String(g.woId)).join(",")}`,
    [groups, groupCount]
  );

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
    setExpandedIds(new Set());
  }, [listSignature]);

  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return groups.slice(start, start + pageSize);
  }, [groups, page, pageSize]);

  const rangeStart = groupCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = groupCount === 0 ? 0 : Math.min(page * pageSize, groupCount);

  const openDocument = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const toggleGroup = (woId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(woId)) next.delete(woId);
      else next.add(woId);
      return next;
    });
  };

  return (
    <div
      className={`crew-pass-requests-table-card husb-accent-${accent}`}
      data-pass-type={passType}
      role="region"
      aria-label={title}
    >
      <PremiumCardHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        count={loading ? "…" : totalCrewCount}
        headerClassName="crew-pass-requests-table-card__header"
        titleClassName="crew-pass-requests-table-card__title"
      />

      <div className="crew-pass-requests-table-card__body">
        {loading ? (
          <div className="crew-pass-requests-table-card__skeleton" aria-busy="true">
            <Skeleton height={14} borderRadius={6} count={1} style={{ marginBottom: 12 }} />
            <Skeleton height={36} borderRadius={6} count={6} />
          </div>
        ) : groupCount === 0 ? (
          <div className="crew-pass-requests-table-card__empty">{emptyMessage}</div>
        ) : (
          <>
            <div className="crew-pass-requests-table-scroll crew-pass-thin-scrollbar">
              <table className="crew-pass-requests-table">
                <thead>
                  <tr>
                    <th>Wo No</th>
                    <th>Crew Name</th>
                    <th>Passport No</th>
                    <th>SignOn/SignOff</th>
                    <th>Status</th>
                    <th>Gro</th>
                    <th>Requested Date</th>
                    <th>Document</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map((group, groupIdx) => {
                    const crewCount = group.crew.length;
                    const isSingle = crewCount <= 1;
                    const isExpanded = expandedIds.has(group.woId);
                    const rowIndexBase = (page - 1) * pageSize + groupIdx;

                    if (isSingle) {
                      const soleRow = group.crew[0];
                      return (
                        <tr key={`wo-${group.woId}`}>
                          <td>
                            <WorkOrderChip value={group.woNumber} />
                          </td>
                          <CrewRowCells row={soleRow} index={rowIndexBase} onOpenDocument={openDocument} />
                        </tr>
                      );
                    }

                    return (
                      <Fragment key={`wo-${group.woId}`}>
                        <tr
                          className={`crew-pass-requests-table__wo-row${
                            isExpanded ? " crew-pass-requests-table__wo-row--expanded" : ""
                          }`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onClick={() => toggleGroup(group.woId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleGroup(group.woId);
                            }
                          }}
                        >
                          <td>
                            <span className="crew-pass-requests-table__wo-cell">
                              <span
                                className={`crew-pass-requests-table__expand-icon${
                                  isExpanded ? " crew-pass-requests-table__expand-icon--open" : ""
                                }`}
                                aria-hidden="true"
                              >
                                <FiChevronDown size={14} />
                              </span>
                              <WorkOrderChip value={group.woNumber} />
                            </span>
                          </td>
                          <td colSpan={3} className="crew-pass-requests-table__wo-summary">
                            {crewCount} crew members
                          </td>
                          <td>
                            <StatusBadge status={group.woStatus} />
                          </td>
                          <td>
                            <span className="crew-pass-requests-table__empty-cell">—</span>
                          </td>
                          <td>{formatRequestedDate(earliestRequestedDate(group.crew))}</td>
                          <td className="crew-pass-requests-table__doc-cell">
                            <span className="crew-pass-requests-table__empty-cell">—</span>
                          </td>
                        </tr>
                        {isExpanded &&
                          group.crew.map((row, idx) => (
                            <tr
                              key={row.id ?? `${group.woId}-crew-${idx}`}
                              className="crew-pass-requests-table__crew-row"
                            >
                              <td />
                              <CrewRowCells row={row} index={idx} onOpenDocument={openDocument} />
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="crew-pass-requests-table-card__pagination crew-pass-requests-pagination">
              <span className="crew-pass-requests-pagination__info">
                Showing {rangeStart}-{rangeEnd} of {groupCount}
              </span>
              <div className="crew-pass-requests-pagination__actions">
                <button
                  type="button"
                  className="crew-pass-requests-pagination__btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  className="crew-pass-requests-pagination__btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <FiChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

CrewPassRequestsTable.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  icon: PropTypes.string,
  requests: PropTypes.array,
  loading: PropTypes.bool,
  passType: PropTypes.string,
  pageSize: PropTypes.number,
  emptyMessage: PropTypes.string,
  accent: PropTypes.oneOf(["blue", "teal", "purple", "amber", "rose", "slate", "green", "pink"]),
};

CrewPassRequestsTable.defaultProps = {
  icon: "list",
  requests: [],
  loading: false,
  passType: "",
  pageSize: DEFAULT_PAGE_SIZE,
  emptyMessage: "No pass requests found",
};

export default CrewPassRequestsTable;
