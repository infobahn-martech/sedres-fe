import { useCallback, useEffect, useRef } from "react";

const DRAG_THRESHOLD_PX = 5;
const SELECTABLE_CARD_SELECTOR = "[data-select-card-id]";
/* A press on a card or any control keeps its own behavior (open card, tick, buttons, inputs). */
const IGNORE_TARGET_SELECTOR =
  ".kanban-card, button, a, input, textarea, select, label, [contenteditable='true'], [role='button'], [role='menu']";
const BODY_DRAGGING_CLASS = "kanban-marquee-selecting";

const isIntersecting = (rect, box) =>
  rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;

/**
 * Rubber-band drag-select on the board: press on empty board space and drag in any direction;
 * every selectable card the box touches is added to the selection. Shrinking the box drops the
 * cards it leaves again, while cards ticked before the drag always stay selected.
 *
 * `marqueeRef` is a fixed-position overlay positioned from here (not via JSX) so a pointer move
 * never re-renders the board just to redraw the box.
 */
export default function useKanbanMarqueeSelect({ selectedCardIds, onSelectionChange }) {
  const marqueeRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const frameRef = useRef(null);
  const selectedIdsRef = useRef(selectedCardIds);
  selectedIdsRef.current = selectedCardIds;

  const updateSelection = useCallback(() => {
    frameRef.current = null;
    const drag = dragRef.current;
    const marquee = marqueeRef.current;
    if (!drag?.isActive || !marquee || !containerRef.current) return;

    const box = {
      left: Math.min(drag.startX, drag.currentX),
      top: Math.min(drag.startY, drag.currentY),
      right: Math.max(drag.startX, drag.currentX),
      bottom: Math.max(drag.startY, drag.currentY),
    };
    marquee.style.left = `${box.left}px`;
    marquee.style.top = `${box.top}px`;
    marquee.style.width = `${box.right - box.left}px`;
    marquee.style.height = `${box.bottom - box.top}px`;

    const hitIds = [];
    containerRef.current.querySelectorAll(SELECTABLE_CARD_SELECTOR).forEach((node) => {
      if (isIntersecting(node.getBoundingClientRect(), box)) hitIds.push(node.dataset.selectCardId);
    });
    const nextIds = [...drag.baseIds, ...hitIds.filter((id) => !drag.baseIds.includes(id))];
    const nextKey = nextIds.join("|");
    if (nextKey === drag.lastKey) return;
    drag.lastKey = nextKey;
    onSelectionChange(nextIds);
  }, [onSelectionChange]);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current == null) frameRef.current = window.requestAnimationFrame(updateSelection);
  }, [updateSelection]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    marqueeRef.current?.classList.remove("is-active");
    document.body.classList.remove(BODY_DRAGGING_CLASS);
  }, []);

  const handleMouseDown = useCallback((event) => {
    if (event.button !== 0 || event.target.closest(IGNORE_TARGET_SELECTOR)) return;
    if (!event.currentTarget.querySelector(SELECTABLE_CARD_SELECTOR)) return;
    containerRef.current = event.currentTarget;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      isActive: false,
      baseIds: selectedIdsRef.current,
      lastKey: selectedIdsRef.current.join("|"),
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.currentX = event.clientX;
      drag.currentY = event.clientY;
      if (!drag.isActive) {
        const distance = Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY);
        if (distance < DRAG_THRESHOLD_PX) return;
        drag.isActive = true;
        window.getSelection()?.removeAllRanges();
        document.body.classList.add(BODY_DRAGGING_CLASS);
        marqueeRef.current?.classList.add("is-active");
      }
      event.preventDefault();
      scheduleUpdate();
    };
    /* Scrolling the board mid-drag moves the cards under a still box, so re-check the hits. */
    const handleScroll = () => {
      if (dragRef.current?.isActive) scheduleUpdate();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", endDrag);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("blur", endDrag);
      window.removeEventListener("scroll", handleScroll, true);
      endDrag();
    };
  }, [endDrag, scheduleUpdate]);

  return { marqueeRef, handleMarqueeMouseDown: handleMouseDown };
}
