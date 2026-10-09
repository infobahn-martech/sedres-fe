import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiMail, FiSend, FiUser, FiCalendar, FiFileText, FiInbox, FiSearch, FiUsers, FiLayers } from "react-icons/fi";
import reportsService from "../../../../../../services/reportsService";
import "../../../../../../design/scss/operations.scss";

const mapReportRow = (raw, index) => ({
  id: raw.email_log_id ?? raw.emailLogId ?? `report-${index}`,
  reportType: String(raw.report_type ?? raw.reportType ?? "").trim() || "Other",
  reportTypeId: raw.report_type_id ?? raw.reportTypeId,
  subject: String(raw.subject ?? "").trim(),
  body: raw.body != null ? String(raw.body) : "",
  fromEmail: String(raw.from_email ?? raw.fromEmail ?? "").trim(),
  toEmail: String(raw.to_email ?? raw.toEmail ?? "").trim(),
  ccEmails: raw.cc_emails ?? raw.ccEmails ?? "",
  createdAt: raw.created_at ?? raw.createdAt ?? "",
  createdBy: String(raw.created_by ?? raw.createdBy ?? "").trim(),
});

const extractReportsArray = (body) => {
  if (!body || typeof body !== "object") return [];
  const data = body.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.reports)) {
    return data.reports;
  }
  if (Array.isArray(body.reports)) {
    return body.reports;
  }
  return [];
};

const formatCcDisplay = (cc) => {
  if (cc == null || cc === "") return "";
  if (Array.isArray(cc)) return cc.filter(Boolean).join(", ");
  return String(cc);
};

const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  const normalized =
    typeof dateString === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(dateString)
      ? dateString.replace(" ", "T")
      : dateString;
  const date = new Date(/** @type {string|number|Date} */ (normalized));
  if (Number.isNaN(date.getTime())) return "N/A";
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${month} ${day}, ${year}, ${time}`;
};

const sanitizeFilename = (name) => {
  const base = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim() || "report";
  return base.slice(0, 120);
};

const TYPE_TAG_COLORS = ["#00368C", "#0E7C7B", "#8552C6", "#C25E2E", "#2E7D32", "#B23B6B"];

const getTypeTagColor = (type) => {
  const source = type || "?";
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TYPE_TAG_COLORS[Math.abs(hash) % TYPE_TAG_COLORS.length];
};

// Fallback typography for unstyled email HTML; inline styles in the email still win.
const EMAIL_BASE_STYLE = `<style>
  body { margin: 0; padding: 28px 36px; font-family: "Segoe UI", -apple-system, Roboto, Arial, sans-serif;
    font-size: 13.5px; line-height: 1.6; color: #1f2937; }
  p { margin: 0 0 10px; }
  table { border-collapse: collapse; }
  a { color: #1d4ed8; }
</style>`;

const matchesSearch =(report, query) => {
  if (!query) return true;
  return [report.subject, report.reportType, report.fromEmail, report.toEmail, report.createdBy]
    .some((value) => value && value.toLowerCase().includes(query));
};

const reportShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  reportType: PropTypes.string,
  subject: PropTypes.string,
  body: PropTypes.string,
  fromEmail: PropTypes.string,
  toEmail: PropTypes.string,
  ccEmails: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  createdAt: PropTypes.string,
  createdBy: PropTypes.string,
});

const ReportListItem = ({ report, accentColor, isActive, onSelect }) => {
  const title = report.subject || report.reportType || "Report";

  return (
    <button
      type="button"
      className={`reports-list-item${isActive ? " is-active" : ""}`}
      onClick={() => onSelect(report.id)}
      aria-pressed={isActive}
      style={{ "--report-accent": accentColor }}
    >
      <span className="reports-doc-icon">
        <FiFileText size={15} />
      </span>
      <span className="reports-list-item-content">
        <span className="reports-list-item-title" title={title}>
          {title}
        </span>
        <span className="reports-list-item-meta">
          {formatDateTime(report.createdAt)}
          {report.createdBy ? ` · ${report.createdBy}` : ""}
        </span>
      </span>
    </button>
  );
};

ReportListItem.propTypes = {
  report: reportShape.isRequired,
  accentColor: PropTypes.string,
  isActive: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

const ReportPreview = ({ report, accentColor, onDownload }) => {
  if (!report) {
    return (
      <div className="reports-preview reports-preview--empty">
        <p>Select a report to preview</p>
      </div>
    );
  }

  const title = report.subject || report.reportType || "Report";
  const metaRows = [
    { label: "Sent at", value: formatDateTime(report.createdAt), icon: <FiCalendar size={13} /> },
    { label: "Sent by", value: report.createdBy, icon: <FiUser size={13} /> },
    { label: "From", value: report.fromEmail, icon: <FiSend size={13} /> },
    { label: "To", value: report.toEmail, icon: <FiMail size={13} /> },
    { label: "CC", value: formatCcDisplay(report.ccEmails), icon: <FiUsers size={13} />, wide: true },
  ].filter((row) => row.value);

  return (
    <div className="reports-preview" style={{ "--report-accent": accentColor }}>
      <div className="reports-preview-header">
        <span className="reports-preview-avatar" aria-hidden="true">
          <FiFileText size={20} />
        </span>
        <div className="reports-preview-heading">
          <span className="reports-preview-type">{report.reportType}</span>
          <h3 className="reports-preview-title" title={title}>
            {title}
          </h3>
        </div>
        <button
          type="button"
          className="reports-preview-download-btn"
          onClick={() => onDownload(report)}
          title="Download body as HTML"
        >
          <FiDownload size={14} />
          <span>Download</span>
        </button>
      </div>

      <dl className="reports-preview-meta">
        {metaRows.map(({ label, value, icon, wide }) => (
          <div
            className={`reports-preview-meta-row${wide ? " reports-preview-meta-row--wide" : ""}`}
            key={label}
          >
            <dt aria-label={label}>{icon}</dt>
            <dd>
              <span className="reports-preview-meta-label">{label}</span>
              <span className="reports-preview-meta-value" title={value}>
                {value}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="reports-preview-body">
        <div className="reports-preview-paper">
          {report.body ? (
            <iframe
              className="reports-preview-frame"
              srcDoc={EMAIL_BASE_STYLE + report.body}
              title={title}
              sandbox=""
            />
          ) : (
            <p className="reports-preview-no-body">This report has no content.</p>
          )}
        </div>
      </div>
    </div>
  );
};

ReportPreview.propTypes = {
  report: reportShape,
  accentColor: PropTypes.string,
  onDownload: PropTypes.func.isRequired,
};

const ReportsEmptyState = ({ message }) => (
  <div className="reports-empty-state">
    <span className="reports-empty-state-icon">
      <FiInbox size={26} />
    </span>
    <p className="reports-empty-state-text">{message}</p>
  </div>
);

ReportsEmptyState.propTypes = {
  message: PropTypes.string.isRequired,
};

const ReportsSkeleton = () => (
  <div className="reports-library reports-skeleton-card" aria-hidden="true">
    <aside className="reports-library__panel reports-library__panel--list">
      <div className="reports-list-toolbar">
        <span className="reports-skeleton-bar reports-skeleton-bar--label" />
      </div>
      <div className="reports-list-scroll">
        {[0, 1, 2, 3].map((rowIdx) => (
          <div className="reports-list-item" key={rowIdx}>
            <span className="reports-skeleton-icon" />
            <span className="reports-list-item-content">
              <span className="reports-skeleton-bar reports-skeleton-bar--title" />
              <span className="reports-skeleton-bar reports-skeleton-bar--meta" />
            </span>
          </div>
        ))}
      </div>
    </aside>
    <section className="reports-library__panel reports-library__panel--preview" />
  </div>
);

function Reports({ card, formValues }) {
  const cardColor = card?.color || "#2A00FF";

  const callId = useMemo(() => {
    const raw = card?.call_id ?? formValues?.call_id ?? card?.callId;
    if (raw === undefined || raw === null) return "";
    return String(raw).trim();
  }, [card?.call_id, card?.callId, formValues?.call_id]);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(null);

  useEffect(() => {
    if (!callId) {
      setReports([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    reportsService
      .getReports(callId)
      .then((res) => {
        if (cancelled) return;
        const body = res?.data;
        if (body?.status !== true) {
          setReports([]);
          setError(body?.message || "Failed to load reports.");
          return;
        }
        const rawList = extractReportsArray(body);
        setReports(rawList.map((row, i) => mapReportRow(row && typeof row === "object" ? row : {}, i)));
      })
      .catch((err) => {
        if (cancelled) return;
        setReports([]);
        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to load reports."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [callId]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const groupedByType = useMemo(() => {
    const map = {};
    reports
      .filter((r) => matchesSearch(r, normalizedQuery))
      .forEach((r) => {
        const key = r.reportType || "Other";
        if (!map[key]) map[key] = [];
        map[key].push(r);
      });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });
    });
    return map;
  }, [reports, normalizedQuery]);

  const categoryKeys = useMemo(() => Object.keys(groupedByType).sort((a, b) => a.localeCompare(b)), [groupedByType]);

  // Falls back to the first visible report so a selection always exists after load / search.
  const selectedReport = useMemo(() => {
    const visible = categoryKeys.flatMap((key) => groupedByType[key]);
    return visible.find((r) => r.id === selectedReportId) ?? visible[0] ?? null;
  }, [categoryKeys, groupedByType, selectedReportId]);

  const handleDownload = (report) => {
    const html = report.body || "";
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(report.subject || report.reportType || "report")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cardform-body">
      <div className="cardform-left-full reports-view" style={{ "--card-color": cardColor }}>
        {!callId ? (
          <ReportsEmptyState message="No call identifier available for reports." />
        ) : loading ? (
          <ReportsSkeleton />
        ) : error ? (
          <ReportsEmptyState message={error} />
        ) : reports.length === 0 ? (
          <ReportsEmptyState message="No reports available." />
        ) : (
          <div className="reports-library">
            <aside className="reports-library__panel reports-library__panel--list">
              <div className="reports-list-toolbar">
                <div className="reports-list-toolbar-title">
                  <span className="reports-list-toolbar-icon" aria-hidden="true">
                    <FiLayers size={16} />
                  </span>
                  <div className="reports-list-toolbar-text">
                    <h4 className="reports-list-toolbar-heading">Reports</h4>
                    <span className="reports-list-toolbar-sub">
                      {reports.length} sent {reports.length === 1 ? "report" : "reports"}
                    </span>
                  </div>
                </div>
                <label className="reports-search">
                  <FiSearch size={13} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search reports"
                    aria-label="Search reports"
                  />
                </label>
              </div>

              <div className="reports-list-scroll">
                {categoryKeys.length === 0 ? (
                  <p className="reports-list-no-match">No reports match your search.</p>
                ) : (
                  categoryKeys.map((category) => {
                    const items = groupedByType[category];
                    const accentColor = getTypeTagColor(category);
                    return (
                      <div className="reports-list-group" key={category} style={{ "--report-accent": accentColor }}>
                        <div className="reports-list-group-header">
                          <span className="reports-list-group-dot" />
                          <span className="reports-list-group-label">{category}</span>
                          <span className="reports-list-group-count">{items.length}</span>
                        </div>
                        {items.map((report) => (
                          <ReportListItem
                            key={report.id}
                            report={report}
                            accentColor={accentColor}
                            isActive={selectedReport?.id === report.id}
                            onSelect={setSelectedReportId}
                          />
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            <section className="reports-library__panel reports-library__panel--preview">
              <ReportPreview
                report={selectedReport}
                accentColor={selectedReport ? getTypeTagColor(selectedReport.reportType) : undefined}
                onDownload={handleDownload}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

Reports.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  isDAModule: PropTypes.bool,
};

export default Reports;
