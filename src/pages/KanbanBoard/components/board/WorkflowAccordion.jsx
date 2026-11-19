import { useEffect, useRef } from "react";

export default function WorkflowAccordion({
  workflow,
  isDarkMode,
  isExpanded,
  onToggle,
  onMenuClick,
  headerAction,
  /** Extra controls rendered at the start of the right-hand actions (e.g. the card scope toggle). */
  headerExtra,
  children,
}) {
  const headerRef = useRef(null);
  const titleRef = useRef(null);
  const actionsRef = useRef(null);

  // The board scrolls horizontally on `.main-layout` (not a sticky-compatible ancestor), so offset
  // the title (centred) and actions (right edge) to stay in the visible area, expanded or collapsed.
  useEffect(() => {
    const header = headerRef.current;
    const title = titleRef.current;
    const actions = actionsRef.current;
    const row = title?.parentElement;
    const scroller = header?.closest(".main-layout");
    if (!header || !title || !actions || !row || !scroller) return undefined;

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
    const resizeObserver = new ResizeObserver(syncHeader);
    resizeObserver.observe(scroller);
    resizeObserver.observe(header);
    return () => {
      scroller.removeEventListener("scroll", syncHeader);
      resizeObserver.disconnect();
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
          style={{ flex: 1, justifyContent: "flex-start" }}
        >
          <h2 ref={titleRef} className="kanban-accordion-title" style={{ fontWeight: 700 }}>
            {workflow.title}
          </h2>
        </div>
        <div ref={actionsRef} className="kanban-accordion-actions">
          {headerExtra}
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
