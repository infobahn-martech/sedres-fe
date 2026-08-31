export default function WorkflowAccordion({
  workflow,
  isDarkMode,
  isExpanded,
  isPinned = false,
  onToggle,
  onMenuClick,
  onPinClick,
  children,
}) {
  return (
    <div
      key={workflow.id}
      id={`workflow-accordion-${workflow.id}`}
      className={`kanban-accordion ${isDarkMode ? "kanban-dark-mode" : ""}`}
    >
      <div className="kanban-accordion-header" onClick={onToggle}>
        <div
          className="kanban-accordion-title-row"
          style={{ flex: 1, justifyContent: "center" }}
        >
          <h2 className="kanban-accordion-title" style={{ fontWeight: 700 }}>
            {workflow.title}
          </h2>
        </div>
        <div className="kanban-accordion-actions">
          <button
            type="button"
            className={`accordion-menu-button accordion-pin-button ${isPinned ? "accordion-pin-button--active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onPinClick?.(event);
            }}
            aria-label={isPinned ? "Unpin workflow" : "Pin workflow to top"}
            title={isPinned ? "Unpin workflow" : "Pin workflow to top"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2.5L9.25 5H12C12.55 5 13 5.45 13 6V7C13 7.55 12.55 8 12 8H11L9 14L7 9L3.5 12V10.5L6 8H4C3.45 8 3 7.55 3 7V6C3 5.45 3.45 5 4 5H6.75L8 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill={isPinned ? "currentColor" : "none"} />
            </svg>
          </button>
          <button
            type="button"
            className="accordion-menu-button"
            onClick={(event) => {
              event.stopPropagation();
              onMenuClick(event);
            }}
            aria-label="Menu"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="9" cy="4.5" r="1.5" fill="currentColor" />
              <circle cx="9" cy="9" r="1.5" fill="currentColor" />
              <circle cx="9" cy="13.5" r="1.5" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
      {isExpanded && children}
    </div>
  );
}
