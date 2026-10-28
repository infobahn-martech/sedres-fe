import React from 'react';
import useKPIDashboardReducer from '../../../store/KPIDashboard';
import '../../../design/scss/pages/kpi-dashboard/components/TaskListCard.scss';

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const getTaskStatusLabel = (task) =>
  task?.status_label ?? task?.status ?? task?.task_status ?? '';

const getTaskStatusColor = (task) =>
  task?.status_color ?? task?.statusColor ?? task?.color ?? '';

const normalizeStatus = (statusLabel) => {
  const label = (statusLabel || '').toUpperCase().replace(/_/g, ' ').trim();
  if (label === 'COMPLETED' || label === 'DONE') return 'completed';
  if (label === 'IN PROGRESS' || label === 'INPROGRESS' || label === 'STARTED') return 'in-progress';
  return 'pending';
};

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) return null;
  return { red, green, blue };
};

const parseColorToRgb = (statusColor) => {
  const color = (statusColor || '').toLowerCase().trim();
  if (!color) return null;

  if (color.startsWith('#')) return hexToRgb(color);

  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      red: Number(rgbMatch[1]),
      green: Number(rgbMatch[2]),
      blue: Number(rgbMatch[3]),
    };
  }

  const namedColors = {
    red: { red: 239, green: 68, blue: 68 },
    orange: { red: 245, green: 158, blue: 11 },
    yellow: { red: 234, green: 179, blue: 8 },
    green: { red: 16, green: 185, blue: 129 },
    blue: { red: 59, green: 130, blue: 246 },
  };

  return namedColors[color] ?? null;
};

const getStatusFromColor = (statusColor) => {
  const rgb = parseColorToRgb(statusColor);
  if (!rgb) return null;

  const { red, green, blue } = rgb;

  if (green > 130 && green > red + 25 && green >= blue) return 'completed';
  if (blue > 120 && blue >= red && blue >= green - 40) return 'in-progress';
  if (red > 150 && red > green) return 'in-progress';
  if (red > 170 && green > 90 && green < 200 && blue < 100) return 'in-progress';

  return null;
};

const resolveTaskStatus = (task) => {
  const statusLabel = getTaskStatusLabel(task);
  if (hasValue(statusLabel)) {
    const normalized = normalizeStatus(statusLabel);
    if (normalized !== 'pending') return normalized;
  }

  if (hasValue(task?.completed_time)) return 'completed';
  if (hasValue(task?.start_time)) return 'in-progress';

  const colorStatus = getStatusFromColor(getTaskStatusColor(task));
  if (colorStatus) return colorStatus;

  return hasValue(statusLabel) ? normalizeStatus(statusLabel) : 'pending';
};

const getStatusDisplayText = (status) => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in-progress':
      return 'In Progress';
    default:
      return 'Pending';
  }
};

const getPriorityClass = (statusColor) => {
  const rgb = parseColorToRgb(statusColor);
  if (!rgb) return null;

  const { red, green, blue } = rgb;
  if (red > 170 && green < 120 && blue < 120) return 'high';
  if (red > 170 && green > 90 && green < 190 && blue < 100) return 'medium';
  if (green > 130 && red < 130) return 'low';

  return null;
};

const shouldShowPriorityAlert = (task) => {
  if (hasValue(task?.delay_text)) return true;
  return getPriorityClass(getTaskStatusColor(task)) === 'high';
};

const CompletedStatusIcon = () => (
  <svg className="task-list-item__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12.5L9.5 17L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const InProgressStatusIcon = () => (
  <svg className="task-list-item__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PendingStatusIcon = () => (
  <svg className="task-list-item__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const getStatusIcon = (status) => {
  switch (status) {
    case 'completed':
      return <CompletedStatusIcon />;
    case 'in-progress':
      return <InProgressStatusIcon />;
    case 'pending':
    default:
      return <PendingStatusIcon />;
  }
};

const TaskListCard = () => {
  const assignedTasks = useKPIDashboardReducer((state) => state.assignedTasks);
  const isLoadingTasks = useKPIDashboardReducer((state) => state.isLoadingTasks);

  return (
    <div className="kpi-task-list-card">
      <div className="kpi-task-list-card__header">
        <h3 className="kpi-task-list-card__title">Task List</h3>
        <span className="kpi-task-list-card__count">{assignedTasks.length} Tasks</span>
      </div>
      <div className="kpi-task-list-card__content">
        <div className="kpi-task-list-card__list">
          {isLoadingTasks && assignedTasks.length === 0 && (
            <div className="kpi-task-list-card__empty">Loading tasks...</div>
          )}
          {!isLoadingTasks && assignedTasks.length === 0 && (
            <div className="kpi-task-list-card__empty">No tasks assigned</div>
          )}
          {assignedTasks.map((task, index) => {
            const status = resolveTaskStatus(task);
            const showPriorityAlert = shouldShowPriorityAlert(task);

            return (
              <div
                key={`${task.call_id}-${task.task_name}-${task.call_initiated_date}-${index}`}
                className={`task-list-item task-list-item--${status}`}
              >
                <div className="task-list-item__icon-wrapper">
                  {getStatusIcon(status)}
                </div>
                <div className="task-list-item__title" title={task.task_name}>{task.task_name}</div>
                <span className="task-list-item__status">{getStatusDisplayText(status)}</span>
                {showPriorityAlert && (
                  <div
                    className="task-list-item__priority task-list-item__priority--high"
                    role="img"
                    aria-label="Needs attention"
                  >
                    <span aria-hidden="true">!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TaskListCard;
