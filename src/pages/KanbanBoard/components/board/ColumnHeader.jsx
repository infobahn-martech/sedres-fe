import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";

/**
 * Single column title bar (workflow stage). Rendered once per column in the top header row.
 */
export default function ColumnHeader({
  column,
  wipDisplay,
  isCollapsed = false,
  onHeaderClick,
  isDarkMode = false,
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
};
