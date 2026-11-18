import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { FiChevronLeft, FiChevronRight, FiChevronDown, FiEye, FiSearch, FiCalendar, FiUser, FiX } from "react-icons/fi";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { groupPassRequestRows } from "@/services/cgAndZwailpassService";
import { PremiumCardHeader, WorkOrderChip } from "./Husbandry.components";

const DEFAULT_PAGE_SIZE = 10;
const EMPTY_LIST = [];
const ALL_STATUSES = "__all__";

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

const parseRequestedDate = (value) => {
  if (isBlank(value)) return null;
  if (typeof value === "string") {
    const parsed = parseISO(value.replace(" ", "T"));
    if (isValid(parsed)) return parsed;
  }
  const d = new Date(value);
  return isValid(d) ? d : null;
};

const earliestRequestedDate = (crewList) => {
  const dates = (crewList || []).map((c) => parseRequestedDate(c?.requested_date)).filter(Boolean);
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min));
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

const movementToneClass = (movement) => {
  const raw = String(movement ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (raw === "signon") return "cpr-movement--on";
  if (raw === "signoff") return "cpr-movement--off";
  return "cpr-movement--default";
};

const pickDocumentUrl = (row) => row?.document_url ?? row?.documentUrl ?? row?.document_URL ?? "";

const initialsOf = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

/** First GRO named on any crew row of the work order (they are assigned per request). */
const groupGroName = (group) => group.crew.map((c) => c?.assigned_gro_name).find((name) => !isBlank(name)) || "";

const groupStatus = (group) => (isBlank(group.woStatus) ? group.crew[0]?.status : group.woStatus);

const StatusBadge = ({ status }) => {
  if (isBlank(status)) return null;
  return <span className={`crew-pass-requests-table__badge ${statusToneClass(status)}`}>{status}</span>;
};

StatusBadge.propTypes = {
  status: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const defaultCrewMeta = (row) => (
  <>Passport: {isBlank(row?.passport_no) ? <span className="cpr-muted">Not provided</span> : row.passport_no}</>
);

const CrewItem = ({ row, requestStatus, onOpenDocument, getCrewMeta = defaultCrewMeta }) => {
  const docUrl = pickDocumentUrl(row);
  const ownStatus = row?.status;
  // A crew-level status is only worth showing when it differs from the request's status.
  const showOwnStatus = !isBlank(ownStatus) && String(ownStatus).trim().toLowerCase() !== String(requestStatus ?? "").trim().toLowerCase();

  return (
    <li className="cpr-crew">
      <span className="cpr-crew__avatar" aria-hidden="true">
        {initialsOf(row?.crew_name)}
      </span>
      <div className="cpr-crew__main">
        <span className="cpr-crew__name" title={row?.crew_name || ""}>
          {isBlank(row?.crew_name) ? "Unnamed crew" : row.crew_name}
        </span>
        <span className="cpr-crew__meta">{getCrewMeta(row)}</span>
      </div>
      <div className="cpr-crew__tags">
        {!isBlank(row?.movement_type) && (
          <span className={`cpr-movement ${movementToneClass(row.movement_type)}`}>{row.movement_type}</span>
        )}
        {showOwnStatus && <StatusBadge status={ownStatus} />}
      </div>
      {docUrl ? (
        <button
          type="button"
          className="crew-pass-requests-table__doc-btn cpr-crew__doc"
          onClick={() => onOpenDocument(docUrl)}
          title="View document"
          aria-label={`View document for ${row?.crew_name || "crew"}`}
        >
          <FiEye size={15} />
        </button>
      ) : (
        <span className="cpr-crew__doc cpr-crew__doc--none" title="No document yet" aria-hidden="true" />
      )}
    </li>
  );
};

CrewItem.propTypes = {
  row: PropTypes.object,
  requestStatus: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onOpenDocument: PropTypes.func.isRequired,
  getCrewMeta: PropTypes.func,
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
  // Optional overrides so other services (e.g. Transport) can reuse this card list:
  groups: groupsProp,
  renderGroupTitle,
  getGroupFacts,
  getGroupDocumentUrl,
  getGroupSearchText,
  getCrewMeta,
  searchPlaceholder = "Search crew name, passport or WO no.",
}) => {
  const groups = useMemo(() => {
    if (Array.isArray(groupsProp)) return groupsProp;
    const source = Array.isArray(requests) ? requests : EMPTY_LIST;
    return groupPassRequestRows(source);
  }, [groupsProp, requests]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [page, setPage] = useState(1);
  // Cards start closed; ids here are the ones the user opened.
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  // Status filter chips, built from the statuses actually present.
  const statusOptions = useMemo(() => {
    const counts = new Map();
    groups.forEach((group) => {
      const status = groupStatus(group);
      if (isBlank(status)) return;
      const label = String(status).trim();
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()].map(([label, count]) => ({ label, count }));
  }, [groups]);

  // Search matches the WO number (whole request) or crew name / passport (only those crew).
  const visibleGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    return groups
      .filter((group) => statusFilter === ALL_STATUSES || String(groupStatus(group) ?? "").trim() === statusFilter)
      .map((group) => {
        if (!term) return group;
        const groupText = getGroupSearchText ? getGroupSearchText(group) : group.woNumber;
        if (String(groupText ?? "").toLowerCase().includes(term)) return group;
        const crew = group.crew.filter(
          (c) =>
            String(c?.crew_name ?? "").toLowerCase().includes(term) ||
            String(c?.passport_no ?? "").toLowerCase().includes(term)
        );
        return crew.length > 0 ? { ...group, crew, matchedCrewOnly: true, totalCrew: group.crew.length } : null;
      })
      .filter(Boolean);
  }, [groups, query, statusFilter, getGroupSearchText]);

  const visibleCount = visibleGroups.length;
  const totalPages = Math.max(1, Math.ceil(visibleCount / pageSize) || 1);

  const listSignature = useMemo(() => groups.map((g) => String(g.woId)).join(","), [groups]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
    setExpandedIds(new Set());
  }, [listSignature]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleGroups.slice(start, start + pageSize);
  }, [visibleGroups, page, pageSize]);

  const rangeStart = visibleCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = visibleCount === 0 ? 0 : Math.min(page * pageSize, visibleCount);
  const isFiltering = query.trim() !== "" || statusFilter !== ALL_STATUSES;

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

  const clearFilters = () => {
    setQuery("");
    setStatusFilter(ALL_STATUSES);
  };

  const searchBox = (
    <label className="cpr-search">
      <FiSearch size={14} aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Search requests"
      />
      {query && (
        <button type="button" className="cpr-search__clear" onClick={() => setQuery("")} aria-label="Clear search">
          <FiX size={13} />
        </button>
      )}
    </label>
  );

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
        headerClassName="crew-pass-requests-table-card__header"
        titleClassName="crew-pass-requests-table-card__title"
        actions={!loading && groups.length > 0 ? searchBox : null}
      />

      <div className="crew-pass-requests-table-card__body">
        {loading ? (
          <div className="crew-pass-requests-table-card__skeleton" aria-busy="true">
            <Skeleton height={34} borderRadius={8} style={{ marginBottom: 14 }} />
            <Skeleton height={96} borderRadius={12} count={3} style={{ marginBottom: 10 }} />
          </div>
        ) : groups.length === 0 ? (
          <div className="crew-pass-requests-table-card__empty">{emptyMessage}</div>
        ) : (
          <>
            {statusOptions.length > 1 && (
            <div className="cpr-toolbar">
                <div className="cpr-filters" role="group" aria-label="Filter by status">
                  <button
                    type="button"
                    className={`cpr-filter${statusFilter === ALL_STATUSES ? " is-active" : ""}`}
                    onClick={() => setStatusFilter(ALL_STATUSES)}
                    aria-pressed={statusFilter === ALL_STATUSES}
                  >
                    All <span className="cpr-filter__count">{groups.length}</span>
                  </button>
                  {statusOptions.map(({ label, count }) => (
                    <button
                      key={label}
                      type="button"
                      className={`cpr-filter${statusFilter === label ? " is-active" : ""}`}
                      onClick={() => setStatusFilter(label)}
                      aria-pressed={statusFilter === label}
                    >
                      {label} <span className="cpr-filter__count">{count}</span>
                    </button>
                  ))}
                </div>
            </div>
            )}

            <div className="crew-pass-requests-table-scroll crew-pass-thin-scrollbar">
              {visibleCount === 0 ? (
                <div className="cpr-no-match">
                  No requests match your filters.
                  {isFiltering && (
                    <button type="button" className="cpr-no-match__reset" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <ul className="cpr-list">
                  {pageSlice.map((group) => {
                    const status = groupStatus(group);
                    const requestedDate = earliestRequestedDate(group.crew);
                    const groName = groupGroName(group);
                    const crewTotal = group.totalCrew ?? group.crew.length;
                    // A search that matched crew opens the card so the matches are visible.
                    const isOpen = expandedIds.has(group.woId) || Boolean(group.matchedCrewOnly);
                    const crewListId = `cpr-crew-${String(group.woId)}`;
                    const groupDocUrl = getGroupDocumentUrl ? getGroupDocumentUrl(group) : "";

                    return (
                      <li key={`wo-${group.woId}`} className={`cpr-request${isOpen ? " is-open" : ""}`}>
                        <div className="cpr-request__head">
                        <button
                          type="button"
                          className="cpr-request__header"
                          onClick={() => toggleGroup(group.woId)}
                          aria-expanded={isOpen}
                          aria-controls={crewListId}
                        >
                          <div className="cpr-request__top">
                            {renderGroupTitle ? renderGroupTitle(group) : <WorkOrderChip value={group.woNumber} />}
                            <StatusBadge status={status} />
                            <span className="cpr-request__chevron" aria-hidden="true">
                              <FiChevronDown size={16} />
                            </span>
                          </div>
                          <div className="cpr-request__facts">
                            <span className="cpr-fact">
                              <FiUser size={12} aria-hidden="true" />
                              {group.matchedCrewOnly
                                ? `${group.crew.length} of ${crewTotal} crew`
                                : `${crewTotal} crew member${crewTotal === 1 ? "" : "s"}`}
                            </span>
                            {getGroupFacts ? (
                              getGroupFacts(group).map((fact, factIdx) => (
                                <span className="cpr-fact" key={factIdx}>
                                  {fact}
                                </span>
                              ))
                            ) : (
                              <>
                                <span className="cpr-fact">
                                  <FiCalendar size={12} aria-hidden="true" />
                                  {requestedDate ? `Requested ${format(requestedDate, "dd MMM yyyy")}` : "Request date not set"}
                                </span>
                                <span className="cpr-fact">
                                  GRO: {groName || <span className="cpr-muted">Not assigned</span>}
                                </span>
                              </>
                            )}
                          </div>
                        </button>
                        {groupDocUrl && (
                          <button
                            type="button"
                            className="crew-pass-requests-table__doc-btn cpr-request__doc"
                            onClick={() => openDocument(groupDocUrl)}
                            title="View request email"
                            aria-label="View request email"
                          >
                            <FiEye size={15} />
                          </button>
                        )}
                        </div>

                        {isOpen && (
                          <ul className="cpr-crew-list" id={crewListId}>
                            {group.crew.map((row, idx) => (
                              <CrewItem
                                key={row.id ?? `${group.woId}-crew-${idx}`}
                                row={row}
                                requestStatus={status}
                                onOpenDocument={openDocument}
                                getCrewMeta={getCrewMeta}
                              />
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="crew-pass-requests-table-card__pagination crew-pass-requests-pagination">
              <span className="crew-pass-requests-pagination__info">
                Showing {rangeStart}-{rangeEnd} of {visibleCount} request{visibleCount === 1 ? "" : "s"}
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
  /** Pre-grouped requests: [{ woId, woNumber, woStatus, crew: [] , ...anything the callbacks need }]. */
  groups: PropTypes.array,
  /** Replaces the WO chip at the top of each card. */
  renderGroupTitle: PropTypes.func,
  /** Returns the facts (nodes) shown after the crew count; replaces requested date / GRO. */
  getGroupFacts: PropTypes.func,
  /** Request-level document (opened from the eye button on the card header). */
  getGroupDocumentUrl: PropTypes.func,
  /** Text a search should match for the whole request (default: WO number). */
  getGroupSearchText: PropTypes.func,
  /** Second line under each crew name (default: passport). */
  getCrewMeta: PropTypes.func,
  searchPlaceholder: PropTypes.string,
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
