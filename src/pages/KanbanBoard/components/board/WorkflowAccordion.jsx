import { useEffect, useRef } from "react";

export default function WorkflowAccordion({
  workflow,
  isDarkMode,
  isExpanded,
  isPinned = false,
  onToggle,
  onMenuClick,
  onPinClick,
  headerAction,
  children,
}) {
  const headerRef = useRef(null);
  const titleRef = useRef(null);
  const actionsRef = useRef(null);

  // The board scrolls horizontally on `.main-layout` (not a sticky-compatible ancestor), so while
  // expanded, offset the title (centred) and actions (right edge) to stay in the visible area.
  useEffect(() => {
    const header = headerRef.current;
    const title = titleRef.current;
    const actions = actionsRef.current;
    const row = title?.parentElement;
    const scroller = header?.closest(".main-layout");
    if (!header || !title || !actions || !row || !scroller || !isExpanded) return undefined;

    let actionsX = 0;

    const syncHeader = () => {
      const { scrollLeft, clientWidth } = scroller;
      const toContentX = (x) => x - scroller.getBoundingClientRect().left + scrollLeft;

      const rowLeft = toContentX(row.getBoundingClientRect().left);
      const centreOffset = Math.max(0, (clientWidth - rowLeft - title.offsetWidth) / 2);
      title.style.transform = `translateX(${scrollLeft + centreOffset}px)`;

      const actionsRight = toContentX(actions.getBoundingClientRect().right) - actionsX;
      const rightGap = toContentX(header.getBoundingClientRect().right) - actionsRight;
      actionsX = Math.min(0, scrollLeft + clientWidth - rightGap - actionsRight);
      actions.style.transform = `translateX(${actionsX}px)`;
    };
    syncHeader();
    scroller.addEventListener("scroll", syncHeader, { passive: true });
    window.addEventListener("resize", syncHeader);
    return () => {
      scroller.removeEventListener("scroll", syncHeader);
      window.removeEventListener("resize", syncHeader);
      title.style.transform = "";
      actions.style.transform = "";
    };
  }, [isExpanded]);

  return (
    <div
      key={workflow.id}
      id={`workflow-accordion-${workflow.id}`}
      className={`kanban-accordion ${isExpanded ? "kanban-accordion--expanded" : ""} ${isDarkMode ? "kanban-dark-mode" : ""}`}
    >
      <div ref={headerRef} className="kanban-accordion-header" onClick={onToggle}>
        <div
          className="kanban-accordion-title-row"
          style={{ flex: 1, justifyContent: isExpanded ? "flex-start" : "center" }}
        >
          <h2 ref={titleRef} className="kanban-accordion-title" style={{ fontWeight: 700 }}>
            {workflow.title}
          </h2>
        </div>
        <div ref={actionsRef} className="kanban-accordion-actions">
          {headerAction && (
            <button
              type="button"
              className="accordion-menu-button"
              onClick={(event) => {
                event.stopPropagation();
                headerAction.onClick(event);
              }}
              aria-label={headerAction.label}
              title={headerAction.label}
            >
              {headerAction.icon}
            </button>
          )}
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
