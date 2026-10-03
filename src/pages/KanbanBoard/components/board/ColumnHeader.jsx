import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import "../../../../design/scss/pages/kanban-board/columnAction.scss";

/* Batch action icon: a hierarchy (one box branching into two), the batch grouping its cards. */
function BatchCardsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="6" rx="1.5" />
      <rect x="2" y="16" width="6" height="6" rx="1.5" />
      <rect x="16" y="16" width="6" height="6" rx="1.5" />
      <path d="M12 8v4M5 16v-4h14v4" />
    </svg>
  );
}

/**
 * Single column title bar (workflow stage). Rendered once per column in the top header row.
 * `secondaryAction` ({ label, icon, onClick }) adds a second button before the main action.
 */
export default function ColumnHeader({
  column,
  wipDisplay,
  isCollapsed = false,
  onHeaderClick,
  isDarkMode = false,
  actionLabel,
  actionIcon,
  onActionClick,
  secondaryAction,
}) {
  const columnColor = column.color || "#2A00FF";
  const tooltipId = `column-title-${column.id}`;
  const secondaryTooltipId = `column-secondary-action-${column.id}`;

  if (isCollapsed) {
    return (
      <div
        className="column-header column-header--collapsed"
        style={{ "--column-color": columnColor }}
        onClick={onHeaderClick}
        data-tooltip-id={tooltipId}
        data-tooltip-content={column.title}
      >
        <span className="column-header--collapsed__count">{wipDisplay}</span>
        <span className="column-header--collapsed__title">{column.title}</span>
        <Tooltip id={tooltipId} place="top" />
      </div>
    );
  }

  return (
    <div
      className={`column-header ${isDarkMode ? "column-header-dark" : ""}`}
      style={{ "--column-color": columnColor }}
      onClick={onHeaderClick}
    >
      <div className="column-left">
        <h2 className="column-title">{column.title}</h2>
      </div>
      <span className="column-count">{wipDisplay}</span>
      {typeof onActionClick === "function" && (
        /* One flex item, so the header's space-between layout keeps the buttons on the right. */
        <div className="column-actions">
          {secondaryAction && (
            <button
              type="button"
              className="column-action"
              onClick={(e) => {
                e.stopPropagation();
                secondaryAction.onClick(column);
              }}
              data-tooltip-id={secondaryTooltipId}
              data-tooltip-content={secondaryAction.label}
              aria-label={secondaryAction.label}
            >
              {secondaryAction.icon}
            </button>
          )}
          <button
            type="button"
            className="column-action"
            onClick={(e) => {
              /* The header itself collapses the column — keep that off this button. */
              e.stopPropagation();
              onActionClick(column);
            }}
            data-tooltip-id={tooltipId}
            data-tooltip-content={actionLabel}
            aria-label={actionLabel}
          >
            {actionIcon ?? <BatchCardsIcon />}
          </button>
        </div>
      )}
      {typeof onActionClick === "function" && <Tooltip id={tooltipId} place="top" />}
      {typeof onActionClick === "function" && secondaryAction && <Tooltip id={secondaryTooltipId} place="top" />}
    </div>
  );
}

ColumnHeader.propTypes = {
  column: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    color: PropTypes.string,
    wipLimit: PropTypes.number,
  }).isRequired,
  wipDisplay: PropTypes.string.isRequired,
  isCollapsed: PropTypes.bool,
  onHeaderClick: PropTypes.func,
  isDarkMode: PropTypes.bool,
  actionLabel: PropTypes.string,
  actionIcon: PropTypes.node,
  onActionClick: PropTypes.func,
  secondaryAction: PropTypes.shape({
    label: PropTypes.string.isRequired,
    icon: PropTypes.node.isRequired,
    onClick: PropTypes.func.isRequired,
  }),
};
