import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  FiActivity,
  FiArrowRight,
  FiEdit2,
  FiFlag,
  FiMessageSquare,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiShuffle,
  FiTrash2,
  FiClock,
} from "react-icons/fi";
import "@/design/scss/activityLog.scss";
import activityLogService from "@/services/activityLogService";

const PAGE_LIMIT = 20;

const getCardId = (card) => card?.id || card?.card_id || card?.call_id;

const AVATAR_COLORS = ["#00368C", "#0E7C7B", "#8552C6", "#C25E2E", "#2E7D32", "#B23B6B"];

const getAvatarColor = (name) => {
  const source = name || "?";
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
};

// Backend sends "YYYY-MM-DD HH:mm:ss" — make it ISO-parsable.
const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatDayLabel = (date) => {
  if (!date) return "Unknown date";
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (date) =>
  date ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

const formatFull = (date) =>
  date
    ? date.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";

const formatRelative = (date) => {
  if (!date) return "";
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return "";
};

const humanize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Visual treatment per activity kind: icon, tone and the verb used in the sentence.
const getActionMeta = (entry) => {
  const key = String(entry?.type || entry?.action || "").toLowerCase();
  if (key.includes("move")) return { Icon: FiShuffle, tone: "move", verb: "moved this card" };
  if (key.includes("create") || key.includes("add")) return { Icon: FiPlus, tone: "create", verb: "created this card" };
  if (key.includes("delete") || key.includes("remove")) return { Icon: FiTrash2, tone: "delete", verb: "removed an item" };
  if (key.includes("comment")) return { Icon: FiMessageSquare, tone: "info", verb: "commented" };
  if (key.includes("attach") || key.includes("upload") || key.includes("document"))
    return { Icon: FiPaperclip, tone: "info", verb: "added an attachment" };
  if (key.includes("status") || key.includes("flag")) return { Icon: FiFlag, tone: "warn", verb: "changed the status" };
  if (key.includes("update") || key.includes("edit")) return { Icon: FiEdit2, tone: "warn", verb: "updated this card" };
  return { Icon: FiActivity, tone: "neutral", verb: null };
};

function ActivityLogSkeleton() {
  return (
    <div className="activity-log-skeleton" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="activity-log-skeleton-row">
          <span className="activity-log-skeleton-node" />
          <div className="activity-log-skeleton-card">
            <span className="activity-log-skeleton-line activity-log-skeleton-line--short" />
            <span className="activity-log-skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

// sampleEntries: static rows for read-only previews (e.g. the Custom Template
// builder) — with no card id nothing is fetched, so these stay as shown.
function ActivityLog({ card, sampleEntries }) {
  const cardId = getCardId(card);
  const [entries, setEntries] = useState(() => sampleEntries ?? []);
  const [pagination, setPagination] = useState(() =>
    sampleEntries ? { page: 1, total_pages: 1, total: sampleEntries.length } : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(
    async (page) => {
      const { data } = await activityLogService.getCardActivity(cardId, { page, limit: PAGE_LIMIT });
      return {
        rows: Array.isArray(data?.data) ? data.data : [],
        pagination: data?.pagination ?? null,
      };
    },
    [cardId]
  );

  const loadFirstPage = useCallback(async () => {
    if (!cardId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchPage(1);
      setEntries(result.rows);
      setPagination(result.pagination);
    } catch {
      setEntries([]);
      setPagination(null);
      setError("Couldn't load activity log.");
    } finally {
      setIsLoading(false);
    }
  }, [cardId, fetchPage]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const currentPage = Number(pagination?.page) || 1;
  const totalPages = Number(pagination?.total_pages) || 1;
  const hasMore = currentPage < totalPages;

  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchPage(currentPage + 1);
      setEntries((prev) => [...prev, ...result.rows]);
      setPagination(result.pagination);
    } catch {
      setError("Couldn't load more activity.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Group consecutive entries by calendar day (entries arrive newest-first).
  const groups = useMemo(() => {
    const result = [];
    entries.forEach((entry, index) => {
      const date = parseDate(entry?.created_date);
      const label = formatDayLabel(date);
      const last = result[result.length - 1];
      const item = { entry, date, index };
      if (last && last.label === label) last.items.push(item);
      else result.push({ label, items: [item] });
    });
    return result;
  }, [entries]);

  const renderMove = (details) => (
    <div className="activity-log-move">
      <span className="activity-log-stage activity-log-stage--from">{details.from_column || "—"}</span>
      <FiArrowRight className="activity-log-move-arrow" aria-hidden="true" />
      <span className="activity-log-stage activity-log-stage--to">
        <span className="activity-log-stage-dot" aria-hidden="true" />
        {details.to_column || "—"}
      </span>
    </div>
  );

  const renderEntry = ({ entry, date, index }) => {
    const userName = entry?.user_name || "System";
    const details = entry?.details || {};
    const notes = details.notes;
    const { Icon, tone, verb } = getActionMeta(entry);
    const isMove = tone === "move" && (details.from_column || details.to_column);
    const relative = formatRelative(date);
    // For moves the stage chips already say "from → to", so skip the duplicated sentence.
    const showDescription = entry?.description && !isMove;

    return (
      <li
        key={`${entry?.created_date ?? ""}-${entry?.action ?? ""}-${index}`}
        className={`activity-log-item activity-log-item--${tone}`}
      >
        <span className="activity-log-node" aria-hidden="true">
          <Icon />
        </span>

        <article className="activity-log-card">
          <header className="activity-log-card-head">
            <span
              className="activity-log-avatar"
              style={{ backgroundColor: getAvatarColor(userName) }}
              aria-hidden="true"
            >
              {getInitials(userName)}
            </span>
            <p className="activity-log-sentence">
              <span className="activity-log-user">{userName}</span>{" "}
              <span className="activity-log-verb">{verb || humanize(entry?.action) || "made a change"}</span>
            </p>
            <time
              className="activity-log-time"
              dateTime={date ? date.toISOString() : undefined}
              title={formatFull(date)}
            >
              <FiClock aria-hidden="true" />
              {formatTime(date)}
              {relative && <span className="activity-log-time-rel">· {relative}</span>}
            </time>
          </header>

          {(isMove || showDescription || notes) && (
            <div className="activity-log-card-body">
              {isMove && renderMove(details)}
              {showDescription && <p className="activity-log-description">{entry.description}</p>}
              {notes && <blockquote className="activity-log-notes">{notes}</blockquote>}
            </div>
          )}
        </article>
      </li>
    );
  };

  return (
    <div className="cardform-body cardform-body--feed-tab">
      <div className="activity-log-tab">
        <div className="activity-log-panel">
          <div className="activity-log-header">
            <div className="activity-log-heading">
              <span className="activity-log-heading-icon" aria-hidden="true">
                <FiActivity />
              </span>
              <div>
                <div className="activity-log-title">
                  Activity Log
                  {pagination?.total != null && (
                    <span className="activity-log-count">{pagination.total}</span>
                  )}
                </div>
                <p className="activity-log-subtitle">Every change made to this card, newest first</p>
              </div>
            </div>
            <button
              type="button"
              className="activity-log-refresh"
              onClick={loadFirstPage}
              disabled={isLoading}
              title="Refresh"
              aria-label="Refresh activity log"
            >
              <FiRefreshCw className={isLoading ? "is-spinning" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="activity-log-body">
            <div className="activity-log-inner">
              {isLoading && entries.length === 0 ? (
                <ActivityLogSkeleton />
              ) : error && entries.length === 0 ? (
                <div className="activity-log-empty activity-log-empty--error">
                  <span className="activity-log-empty-icon" aria-hidden="true">
                    <FiActivity />
                  </span>
                  <p className="activity-log-empty-title">{error}</p>
                  <button type="button" className="activity-log-more-btn" onClick={loadFirstPage}>
                    Try again
                  </button>
                </div>
              ) : entries.length === 0 ? (
                <div className="activity-log-empty">
                  <span className="activity-log-empty-icon" aria-hidden="true">
                    <FiActivity />
                  </span>
                  <p className="activity-log-empty-title">No activity yet</p>
                  <p className="activity-log-empty-text">
                    Moves, edits and other changes to this card will show up here.
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <section key={`${group.label}-${group.items[0].index}`} className="activity-log-group">
                    <h4 className="activity-log-day">
                      <span>{group.label}</span>
                    </h4>
                    <ol className="activity-log-timeline">{group.items.map(renderEntry)}</ol>
                  </section>
                ))
              )}

              {hasMore && entries.length > 0 && (
                <div className="activity-log-more">
                  <button
                    type="button"
                    className="activity-log-more-btn"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading…" : "Load older activity"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ActivityLog.propTypes = {
  card: PropTypes.object,
  sampleEntries: PropTypes.arrayOf(PropTypes.object),
};

export default ActivityLog;
