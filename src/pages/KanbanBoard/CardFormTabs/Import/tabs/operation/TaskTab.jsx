import { useState } from "react";
import PropTypes from "prop-types";
import { TASK_STATUS } from "./operationTasksMapper";
import "../../../../../../design/scss/operations.scss";

const STATUS_CLASS_MAP = {
  [TASK_STATUS.PENDING]: "operation-task-status--pending",
  [TASK_STATUS.IN_PROGRESS]: "operation-task-status--in-progress",
  [TASK_STATUS.COMPLETED]: "operation-task-status--completed",
  [TASK_STATUS.REJECTED]: "operation-task-status--rejected",
};

const STATUS_PROGRESS_MAP = {
  [TASK_STATUS.PENDING]: 0,
  [TASK_STATUS.IN_PROGRESS]: 50,
  [TASK_STATUS.COMPLETED]: 100,
  [TASK_STATUS.REJECTED]: 0,
};

const DOCUMENT_STATUS_CLASS_MAP = {
  Pending: "operation-task-doc-status--pending",
  Uploaded: "operation-task-doc-status--uploaded",
  Verified: "operation-task-doc-status--verified",
  Rejected: "operation-task-doc-status--rejected",
};

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getStatusProgress(status) {
  return STATUS_PROGRESS_MAP[status] ?? 0;
}

function formatSadadExpiry(value) {
  if (!value) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (!match) return String(value);
  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  const monthLabel = MONTH_ABBREVIATIONS[monthIndex];
  if (!monthLabel) return String(value);
  return `${day}-${monthLabel}-${year}`;
}

function ChevronIcon({ isOpen }) {
  return (
    <svg
      className={`operation-task-documents-chevron${isOpen ? " operation-task-documents-chevron--open" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

ChevronIcon.propTypes = {
  isOpen: PropTypes.bool.isRequired,
};

function TaskStatusBadge({ status }) {
  const normalizedStatus = status || TASK_STATUS.PENDING;
  const statusClass = STATUS_CLASS_MAP[normalizedStatus] || STATUS_CLASS_MAP[TASK_STATUS.PENDING];

  return (
    <span className={`operation-task-status ${statusClass}`}>
      {normalizedStatus}
    </span>
  );
}

TaskStatusBadge.propTypes = {
  status: PropTypes.string,
};

function DocumentStatusBadge({ status }) {
  const normalizedStatus = status || "Pending";
  const statusClass =
    DOCUMENT_STATUS_CLASS_MAP[normalizedStatus] || DOCUMENT_STATUS_CLASS_MAP.Pending;

  return (
    <span className={`operation-task-doc-status ${statusClass}`}>
      {normalizedStatus}
    </span>
  );
}

DocumentStatusBadge.propTypes = {
  status: PropTypes.string,
};

function TaskProgressIndicator({ status, progress }) {
  const percent =
    typeof progress === "number" && !Number.isNaN(progress)
      ? Math.min(100, Math.max(0, Math.round(progress)))
      : getStatusProgress(status || TASK_STATUS.PENDING);
  const progressClass =
    percent === 100
      ? "operation-task-progress-fill--completed"
      : percent > 0
        ? "operation-task-progress-fill--in-progress"
        : "operation-task-progress-fill--pending";

  return (
    <div className="operation-task-progress" aria-label={`Task progress ${percent}%`}>
      <span className="operation-task-detail-label">Progress:</span>
      <div className="operation-task-progress-body">
        <div
          className="operation-task-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className={`operation-task-progress-fill ${progressClass}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="operation-task-progress-pct">{percent}%</span>
      </div>
    </div>
  );
}

TaskProgressIndicator.propTypes = {
  status: PropTypes.string,
  progress: PropTypes.number,
};

function TaskDocumentsAccordion({ documents, taskId }) {
  const [isOpen, setIsOpen] = useState(false);
  const docList = Array.isArray(documents) ? documents : [];
  const count = docList.length;
  const panelId = `operation-task-documents-${taskId}`;

  return (
    <div className="operation-task-documents">
      <button
        type="button"
        className="operation-task-documents-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="operation-task-documents-trigger-label">
          Documents ({count})
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      <div
        id={panelId}
        className={`operation-task-documents-panel${isOpen ? " operation-task-documents-panel--open" : ""}`}
        aria-hidden={!isOpen}
      >
        <div className="operation-task-documents-panel-inner">
          {count === 0 ? (
            <p className="operation-task-documents-empty">No documents available</p>
          ) : (
            <ul className="operation-task-documents-list" role="list">
              {docList.map((doc) => (
                <li key={doc.id} className="operation-task-document-row" role="listitem">
                  <span className="operation-task-document-name">{doc.name}</span>
                  <DocumentStatusBadge status={doc.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

TaskDocumentsAccordion.propTypes = {
  documents: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      status: PropTypes.string,
    })
  ),
  taskId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

function SadadInfoTable({ sadadNo, sadadDocument, sadadExpiry }) {
  return (
    <div className="operation-task-sadad">
      <table className="operation-task-sadad-table">
        <thead>
          <tr>
            <th scope="col">Sadad No</th>
            <th scope="col">Sadad Document</th>
            <th scope="col">Sadad Expiry</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{sadadNo || "-"}</td>
            <td>
              {sadadDocument ? (
                <a
                  className="operation-task-sadad-link"
                  href={sadadDocument}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Document
                </a>
              ) : (
                "-"
              )}
            </td>
            <td>{formatSadadExpiry(sadadExpiry)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

SadadInfoTable.propTypes = {
  sadadNo: PropTypes.string,
  sadadDocument: PropTypes.string,
  sadadExpiry: PropTypes.string,
};

function OperationTasksPanel({
  cardColor,
  isViewOnly = false,
  embedded = false,
  taskSections = [],
  isLoading = false,
  error = "",
  className = "",
}) {
  const panelClassName = [
    embedded ? "operation-tasks-panel--embedded" : "operation-task-tab-body",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={panelClassName}
      style={cardColor ? { "--card-color": cardColor } : undefined}
    >
      <div className="operation-task-card">
        <div className="operation-task-card-header">
          <span className="operation-task-card-title">Import Call Operation Tasks</span>
        </div>

        <ul className="operation-task-list" role="list">
          {isLoading ? (
            <li className="operation-task-empty">
              <p>Loading operation tasks...</p>
            </li>
          ) : error ? (
            <li className="operation-task-empty">
              <p>{error}</p>
            </li>
          ) : taskSections.length === 0 ? (
            <li className="operation-task-empty">
              <p>No operation tasks available.</p>
            </li>
          ) : null}
          {!isLoading && !error && taskSections.map((section) => (
            <li key={section.id} className="operation-task-section">
              <div className="operation-task-section-head">
                <h4 className="operation-task-section-title" id={`operation-task-section-${section.id}`}>
                  {section.title}
                </h4>
              </div>

              <ul
                className="operation-task-section-list"
                role="list"
                aria-labelledby={`operation-task-section-${section.id}`}
              >
                {section.tasks.map((task) => (
                  <li key={task.id} className="operation-task-row operation-task-row--nested" role="listitem">
                    <div className="operation-task-row-main">
                      <span className="operation-task-name">{task.title}</span>
                      <TaskStatusBadge status={task.status} />
                    </div>
                    <div className="operation-task-row-details">
                      <p className="operation-task-detail-line">
                        <span className="operation-task-detail-label">Assigned User:</span>{" "}
                        <span className="operation-task-detail-value">
                          {task.assignedTo || "Unassigned"}
                        </span>
                      </p>
                      <p className="operation-task-detail-line">
                        <span className="operation-task-detail-label">Documents:</span>{" "}
                        <span className="operation-task-detail-value">
                          {task.documentCount ?? 0}
                        </span>
                      </p>
                      <TaskProgressIndicator status={task.status} progress={task.progress} />
                      {(String(task.id) === "6" || task.title === "Applying MWP") && (
                        <SadadInfoTable
                          sadadNo={task.sadadDocNo}
                          sadadDocument={task.sadadDocument}
                          sadadExpiry={task.sadadExpiry}
                        />
                      )}
                      <TaskDocumentsAccordion documents={task.documents} taskId={task.id} />
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}

OperationTasksPanel.propTypes = {
  cardColor: PropTypes.string,
  isViewOnly: PropTypes.bool,
  embedded: PropTypes.bool,
  taskSections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      title: PropTypes.string.isRequired,
      tasks: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
          title: PropTypes.string.isRequired,
          assignedTo: PropTypes.string,
          status: PropTypes.string,
          documentCount: PropTypes.number,
          progress: PropTypes.number,
          sadadDocNo: PropTypes.string,
          sadadDocument: PropTypes.string,
          sadadExpiry: PropTypes.string,
          documents: PropTypes.arrayOf(
            PropTypes.shape({
              id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
              name: PropTypes.string.isRequired,
              status: PropTypes.string,
            })
          ),
        })
      ).isRequired,
    })
  ),
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
};

export { mapTasksToSections } from "./operationTasksMapper";
export default OperationTasksPanel;
