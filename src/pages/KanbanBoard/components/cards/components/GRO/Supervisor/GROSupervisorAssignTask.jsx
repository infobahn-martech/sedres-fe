import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import SearchableSelect, { deriveSearchPlaceholder } from "../../../../../../../components/form/SearchableSelect";
import DateTimePickerField from "../../../../../CardFormTabs/shared/components/DateTimePickerField";
import {
  resolveGroSupervisorTaskStatus,
  formatGroSupervisorTaskRemarks,
} from "./groSupervisorStaticTasks";

const PAGE_SIZE = 10;

function GROSupervisorAssignTask({ tasks, assignments, onAssignmentChange, userOptions, usersLoading }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageTasks = useMemo(() => tasks.slice(pageStart, pageStart + PAGE_SIZE), [tasks, pageStart]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [tasks]);

  const updateTask = useCallback(
    (taskId, patch) => {
      onAssignmentChange(taskId, patch);
    },
    [onAssignmentChange]
  );

  const rangeStart = tasks.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, tasks.length);

  return (
    <div className="gro-supervisor-assign-panel" role="tabpanel" aria-label="Assign Task">
      {/* <div className="gro-supervisor-panel-head">
        <h3 className="gro-supervisor-panel-title">Assign Task</h3>
        <span className="gro-supervisor-panel-meta">{tasks.length} tasks</span>
      </div> */}

      <div className="gro-supervisor-task-table-panel">
        <div className="gro-supervisor-task-table-scroll">
          <table className="gro-supervisor-task-table">
            <colgroup>
              <col className="gro-supervisor-col-name" />
              <col className="gro-supervisor-col-remarks" />
              <col className="gro-supervisor-col-user" />
              <col className="gro-supervisor-col-due" />
              <col className="gro-supervisor-col-status" />
            </colgroup>
            <thead>
              <tr>
                <th className="gro-supervisor-task-th-name">Task Name</th>
                <th className="gro-supervisor-task-th-remarks">Remarks</th>
                <th className="gro-supervisor-task-th-user">Assigned User</th>
                <th className="gro-supervisor-task-th-due">Due Date</th>
                <th className="gro-supervisor-task-th-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="gro-supervisor-task-empty">
                    No tasks available.
                  </td>
                </tr>
              ) : (
                pageTasks.map((task) => {
                  const state = assignments[task.id] ?? {};
                  const statusMeta = resolveGroSupervisorTaskStatus(task, state);
                  const remarksText = formatGroSupervisorTaskRemarks(task);

                  return (
                    <tr key={task.id}>
                      <td className="gro-supervisor-task-td-name">
                        <span className="gro-supervisor-task-name-text" title={task.title}>
                          {task.title}
                        </span>
                      </td>
                      <td className="gro-supervisor-task-td-remarks">
                        <span
                          className={`gro-supervisor-task-remarks-text${remarksText === "—" ? " gro-supervisor-task-remarks-text--empty" : ""}`}
                          title={remarksText}
                        >
                          {remarksText}
                        </span>
                      </td>
                      <td className="gro-supervisor-task-td-user">
                        <div className="gro-supervisor-table-control gro-supervisor-table-control--select">
                          <SearchableSelect
                            value={state.assignedUserId ?? ""}
                            onChange={(e) => updateTask(task.id, { assignedUserId: e?.target?.value ?? "" })}
                            options={userOptions}
                            placeholder={usersLoading ? "Loading…" : "Select user"}
                            searchPlaceholder={deriveSearchPlaceholder("Select user")}
                            disabled={usersLoading}
                            className="gro-supervisor-searchable-select"
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                          />
                        </div>
                      </td>
                      <td className="gro-supervisor-task-td-due">
                        <div
                          className="gro-supervisor-table-control gro-supervisor-table-control--datetime"
                          onClick={(e) => {
                            if (e.target.closest("button")) return;
                            const openBtn = e.currentTarget.querySelector(
                              'button[aria-label*="Choose"], button[aria-label*="Open"]'
                            );
                            openBtn?.click();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.currentTarget
                                .querySelector('button[aria-label*="Choose"], button[aria-label*="Open"]')
                                ?.click();
                            }
                          }}
                          role="presentation"
                        >
                          <DateTimePickerField
                            dateValue={state.dueDate ?? ""}
                            timeValue={state.dueTime ?? ""}
                            onDateTimeChange={({ date, time }) =>
                              updateTask(task.id, {
                                dueDate: date || "",
                                dueTime: time != null && time !== "" ? String(time).slice(0, 5) : "",
                              })
                            }
                            placeholder="YYYY-MM-DD hh:mm"
                            popperClassName="gro-supervisor-datetime-popper"
                          />
                        </div>
                      </td>
                      <td className="gro-supervisor-task-td-status">
                        <span className={`gro-supervisor-task-status ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="gro-supervisor-task-table-footer" aria-label="Task list pagination">
          <div className="gro-pass-pagination gro-supervisor-pagination">
            <span className="gro-pass-pagination__info">
              {tasks.length > 0
                ? `Showing ${rangeStart}–${rangeEnd} of ${tasks.length} · Page ${safePage} of ${totalPages}`
                : "No tasks"}
            </span>
            <div className="gro-pass-pagination__nav">
              <button
                type="button"
                className="gro-pass-page-btn"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <FiChevronLeft aria-hidden />
              </button>
              <button
                type="button"
                className="gro-pass-page-btn"
                aria-label="Next page"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <FiChevronRight aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

GROSupervisorAssignTask.propTypes = {
  tasks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      remarks: PropTypes.string,
      statusKey: PropTypes.string,
    })
  ).isRequired,
  assignments: PropTypes.object.isRequired,
  onAssignmentChange: PropTypes.func.isRequired,
  userOptions: PropTypes.array.isRequired,
  usersLoading: PropTypes.bool,
};

export default GROSupervisorAssignTask;
