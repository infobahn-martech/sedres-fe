import PropTypes from "prop-types";
import { FormField } from "./GeneralFormFields";

// Daily Task/Todo Component
const DailyTaskTodo = ({ tasks = [], accentColor, isLoading = false, error = "" }) => {
  const normalizedTasks = Array.isArray(tasks) ? tasks : [];
  const completedCount = normalizedTasks.filter((t) => String(t?.status || "").toUpperCase() === "COMPLETED").length;
  const totalCount = normalizedTasks.length;

  const formatTaskDateTime = (value) => {
    if (!value) return "";
    const normalized = String(value).trim().replace(" ", "T");
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="daily-task-todo-wrapper">
      <FormField label="Daily Tasks / Todo">
        <div className="daily-task-container">
          <div className="daily-task-list-scroll" aria-label="Task list">
            <div className="daily-task-list">
              {isLoading ? (
                <div className="daily-task-empty">
                  <p>Loading tasks...</p>
                </div>
              ) : error ? (
                <div className="daily-task-empty">
                  <p>{error}</p>
                </div>
              ) : normalizedTasks.length === 0 ? (
                <div className="daily-task-empty">
                  <p>No KPI tasks available.</p>
                </div>
              ) : (
                normalizedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="daily-task-item"
                  >
                    <div className="daily-task-checkbox-display">
                      <div
                        className="daily-task-checkbox-icon checked"
                        style={{ backgroundColor: task.statusColor || accentColor || "#1f7aec" }}
                      >
                        <span style={{ color: "#fff", fontSize: "10px", lineHeight: 1 }}>•</span>
                      </div>
                    </div>
                    <div className="daily-task-item-body">
                      <span className="daily-task-text">{task.text}</span>
                      <div className="daily-task-meta-line">
                        {task.startTime && <span>Start: {formatTaskDateTime(task.startTime)}</span>}
                        {task.dueTime && <span> | Due: {formatTaskDateTime(task.dueTime)}</span>}
                        {task.completedTime && <span> | Completed: {formatTaskDateTime(task.completedTime)}</span>}
                      </div>
                      <span
                        className={`daily-task-status-badge ${task.delayText ? "daily-task-status-badge--delayed" : ""}`}
                      >
                        <span
                          className="daily-task-status-dot"
                          style={{ backgroundColor: task.statusColor || "#666" }}
                        />
                        <span style={{ color: task.statusColor || "#666" }}>{task.status || "PENDING"}</span>
                        {task.delayText && <span className="daily-task-status-delay">{task.delayText}</span>}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {normalizedTasks.length > 0 && (
            <div className="daily-task-summary">
              <div className="daily-task-summary-row">
                <span className="daily-task-summary-text">
                  {completedCount} of {totalCount} completed
                </span>
                <span className="daily-task-summary-pct">
                  {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                </span>
              </div>
              <div className="daily-task-progress-bar">
                <div
                  className="daily-task-progress-fill"
                  style={{
                    width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </FormField>
    </div>
  );
};

DailyTaskTodo.propTypes = {
  tasks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      text: PropTypes.string.isRequired,
      status: PropTypes.string,
      statusColor: PropTypes.string,
      startTime: PropTypes.string,
      dueTime: PropTypes.string,
      completedTime: PropTypes.string,
      delayText: PropTypes.string,
    })
  ),
  accentColor: PropTypes.string,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
};
export default DailyTaskTodo;
