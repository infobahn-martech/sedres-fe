import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import "../../../../design/scss/pages/kanban-board/columnAction.scss";

/* Batch action icon: mirrors a batch group on the board, a title bar with four cards under it. */
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
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M2 7.5h20M5.5 4.75h5" />
      <rect x="5" y="10.5" width="6" height="4" rx="1" />
      <rect x="13" y="10.5" width="6" height="4" rx="1" />
      <rect x="5" y="16" width="6" height="4" rx="1" />
      <rect x="13" y="16" width="6" height="4" rx="1" />
    </svg>
  );
}

/**
 * Single column title bar (workflow stage). Rendered once per column in the top header row.
 */
export default function ColumnHeader({
  column,
  wipDisplay,
  isCollapsed = false,
  onHeaderClick,
  isDarkMode = false,
  actionLabel,
  onActionClick,
}) {
  const columnColor = column.color || "#2A00FF";
  const tooltipId = `column-title-${column.id}`;

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
          <BatchCardsIcon />
        </button>
      )}
      {typeof onActionClick === "function" && <Tooltip id={tooltipId} place="top" />}
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
  onActionClick: PropTypes.func,
};
