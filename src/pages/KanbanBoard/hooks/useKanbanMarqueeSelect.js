import { useCallback, useEffect, useRef } from "react";

const DRAG_THRESHOLD_PX = 5;
const SELECTABLE_CARD_SELECTOR = "[data-select-card-id]";
/* A press on a card or any control keeps its own behavior (open card, tick, buttons, inputs). */
const IGNORE_TARGET_SELECTOR =
  ".kanban-card, button, a, input, textarea, select, label, [contenteditable='true'], [role='button'], [role='menu']";
const BODY_DRAGGING_CLASS = "kanban-marquee-selecting";
/* Pointer within this distance of a scroll area's edge auto-scrolls it; speed ramps up near the edge. */
const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_MAX_STEP_PX = 18;

const isIntersecting = (rect, box) =>
  rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;

const canScrollAxis = (overflow) => overflow === "auto" || overflow === "scroll" || overflow === "overlay";

/* Every scrollable ancestor of `node`, innermost first, ending with the page scroller. */
const getScrollChain = (node) => {
  const chain = [];
  const pageScroller = document.scrollingElement || document.documentElement;
  for (let el = node?.parentElement; el && el !== pageScroller && el !== document.body; el = el.parentElement) {
    const style = window.getComputedStyle(el);
    const scrollX = canScrollAxis(style.overflowX) && el.scrollWidth > el.clientWidth;
    const scrollY = canScrollAxis(style.overflowY) && el.scrollHeight > el.clientHeight;
    if (scrollX || scrollY) chain.push(el);
  }
  chain.push(pageScroller);
  return chain;
};

/* Visible rect of a scroller, clipped to the viewport (the page scroller is the viewport itself). */
const getVisibleRect = (el) => {
  const isPage = el === (document.scrollingElement || document.documentElement);
  const rect = isPage
    ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
    : el.getBoundingClientRect();
  return {
    left: Math.max(rect.left, 0),
    top: Math.max(rect.top, 0),
    right: Math.min(rect.right, window.innerWidth),
    bottom: Math.min(rect.bottom, window.innerHeight),
  };
};

const getEdgeStep = (pos, min, max) => {
  if (pos < min + AUTO_SCROLL_EDGE_PX) {
    return -Math.ceil(AUTO_SCROLL_MAX_STEP_PX * Math.min(1, (min + AUTO_SCROLL_EDGE_PX - pos) / AUTO_SCROLL_EDGE_PX));
  }
  if (pos > max - AUTO_SCROLL_EDGE_PX) {
    return Math.ceil(AUTO_SCROLL_MAX_STEP_PX * Math.min(1, (pos - (max - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX));
  }
  return 0;
};

/* How far the start point's scroll areas have scrolled since the drag began. */
const getScrollOffset = (drag) =>
  drag.startScrolls.reduce(
    (offset, { el, left, top }) => ({ x: offset.x + el.scrollLeft - left, y: offset.y + el.scrollTop - top }),
    { x: 0, y: 0 }
  );

/**
 * Rubber-band drag-select on the board: press on empty board space and drag in any direction;
 * every selectable card the box touches is added to the selection. Shrinking the box drops the
 * cards it leaves again, while cards ticked before the drag always stay selected.
 * Holding the pointer near a scroll area's edge auto-scrolls it, and the box's start corner stays
 * pinned to the content it was pressed on, so cards beyond the visible area can be reached.
 *
 * `marqueeRef` is a fixed-position overlay positioned from here (not via JSX) so a pointer move
 * never re-renders the board just to redraw the box.
 */
export default function useKanbanMarqueeSelect({ selectedCardIds, onSelectionChange }) {
  const marqueeRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const frameRef = useRef(null);
  const autoScrollFrameRef = useRef(null);
  const selectedIdsRef = useRef(selectedCardIds);
  selectedIdsRef.current = selectedCardIds;

  const updateSelection = useCallback(() => {
    frameRef.current = null;
    const drag = dragRef.current;
    const marquee = marqueeRef.current;
    if (!drag?.isActive || !marquee || !containerRef.current) return;

    const offset = getScrollOffset(drag);
    const anchorX = drag.startX - offset.x;
    const anchorY = drag.startY - offset.y;
    const box = {
      left: Math.min(anchorX, drag.currentX),
      top: Math.min(anchorY, drag.currentY),
      right: Math.max(anchorX, drag.currentX),
      bottom: Math.max(anchorY, drag.currentY),
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

  const autoScroll = useCallback(() => {
    autoScrollFrameRef.current = null;
    const drag = dragRef.current;
    if (!drag?.isActive) return;

    const pointerX = Math.min(Math.max(drag.currentX, 0), window.innerWidth - 1);
    const pointerY = Math.min(Math.max(drag.currentY, 0), window.innerHeight - 1);
    const underPointer = document.elementFromPoint(pointerX, pointerY);
    const scrollers = [...new Set([...getScrollChain(underPointer), ...drag.startScrolls.map(({ el }) => el)])];

    let scrolledX = false;
    let scrolledY = false;
    scrollers.forEach((el) => {
      if (scrolledX && scrolledY) return;
      const rect = getVisibleRect(el);
      if (!scrolledX && drag.currentY >= rect.top && drag.currentY <= rect.bottom) {
        const step = getEdgeStep(drag.currentX, rect.left, rect.right);
        const before = el.scrollLeft;
        if (step) el.scrollLeft += step;
        scrolledX = el.scrollLeft !== before;
      }
      if (!scrolledY && drag.currentX >= rect.left && drag.currentX <= rect.right) {
        const step = getEdgeStep(drag.currentY, rect.top, rect.bottom);
        const before = el.scrollTop;
        if (step) el.scrollTop += step;
        scrolledY = el.scrollTop !== before;
      }
    });

    /* Keep scrolling while the pointer rests at an edge (no mousemove fires then). */
    if (scrolledX || scrolledY) autoScrollFrameRef.current = window.requestAnimationFrame(autoScroll);
  }, []);

  const scheduleAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current == null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(autoScroll);
    }
  }, [autoScroll]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (autoScrollFrameRef.current != null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
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
      startScrolls: getScrollChain(event.target).map((el) => ({ el, left: el.scrollLeft, top: el.scrollTop })),
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
      scheduleAutoScroll();
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
  }, [endDrag, scheduleUpdate, scheduleAutoScroll]);

  return { marqueeRef, handleMarqueeMouseDown: handleMouseDown };
}
