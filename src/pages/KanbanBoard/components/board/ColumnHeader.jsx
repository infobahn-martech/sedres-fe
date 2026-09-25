import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import { FiGrid } from "react-icons/fi";
import "react-tooltip/dist/react-tooltip.css";
import "../../../../design/scss/pages/kanban-board/columnAction.scss";

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
          <FiGrid size={14} aria-hidden />
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
