import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiArrowRight, FiActivity, FiRefreshCw } from "react-icons/fi";
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

const getInitial = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

// Backend sends "YYYY-MM-DD HH:mm:ss" — make it ISO-parsable.
const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const humanize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function ActivityLog({ card }) {
  const cardId = getCardId(card);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState(null);
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

  const renderDetails = (entry) => {
    const details = entry?.details || {};
    if (entry?.type === "move" && (details.from_column || details.to_column)) {
      return (
        <div className="activity-log-move">
          <span className="activity-log-chip">{details.from_column || "—"}</span>
          <FiArrowRight className="activity-log-move-arrow" aria-hidden="true" />
          <span className="activity-log-chip activity-log-chip--to">{details.to_column || "—"}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="cardform-body cardform-body--feed-tab">
      <div className="activity-log-tab">
        <div className="activity-log-panel">
          <div className="activity-log-header">
            <div className="activity-log-title">
              <FiActivity aria-hidden="true" />
              <span>Activity Log</span>
              {pagination?.total != null && (
                <span className="activity-log-count">{pagination.total}</span>
              )}
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
            </button>
          </div>

          <div className="activity-log-body">
            {isLoading && entries.length === 0 ? (
              <p className="activity-log-status">Loading activity…</p>
            ) : error && entries.length === 0 ? (
              <p className="activity-log-status activity-log-status--error">{error}</p>
            ) : entries.length === 0 ? (
              <p className="activity-log-status">No activity recorded for this card yet.</p>
            ) : (
              <ol className="activity-log-timeline">
                {entries.map((entry, index) => {
                  const userName = entry?.user_name || "System";
                  const notes = entry?.details?.notes;
                  return (
                    <li
                      key={`${entry?.created_date ?? ""}-${entry?.action ?? ""}-${index}`}
                      className="activity-log-item"
                    >
                      <span
                        className="activity-log-avatar"
                        style={{ backgroundColor: getAvatarColor(userName) }}
                        aria-hidden="true"
                      >
                        {getInitial(userName)}
                      </span>
                      <div className="activity-log-content">
                        <div className="activity-log-meta">
                          <span className="activity-log-user">{userName}</span>
                          {entry?.action && (
                            <span className="activity-log-action">{humanize(entry.action)}</span>
                          )}
                          <span className="activity-log-time">{formatDateTime(entry?.created_date)}</span>
                        </div>
                        {entry?.description && (
                          <p className="activity-log-description">{entry.description}</p>
                        )}
                        {renderDetails(entry)}
                        {notes && <p className="activity-log-notes">{notes}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {hasMore && entries.length > 0 && (
              <div className="activity-log-more">
                <button
                  type="button"
                  className="activity-log-more-btn"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ActivityLog.propTypes = {
  card: PropTypes.object,
};

export default ActivityLog;
