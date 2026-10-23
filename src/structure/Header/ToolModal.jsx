import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import '../../design/scss/structure/header/ToolModals.scss';

// Keeps at least this much of the window inside the viewport while dragging.
const EDGE_GAP = 8;

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Floating, draggable tool window (no backdrop), so the page — including an open
 * card — stays usable behind it. Opens at the bottom-right corner (see ToolModals.scss);
 * dragging the header switches it to explicit top/left coordinates.
 * `docked` instead fills the content area between the header and kanban sidebar (not draggable).
 */
function ToolModal({ show, onClose, title, icon, className = '', docked = false, children }) {
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const [position, setPosition] = useState(null);

  // Focus the window on open so keyboard-driven tools (calculator) work straight away.
  useEffect(() => {
    if (show) panelRef.current?.focus({ preventScroll: true });
    else setPosition(null);
  }, [show]);

  // Keep a dragged window on screen when the viewport shrinks.
  useEffect(() => {
    if (!show || !position) return undefined;
    const handleResize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      setPosition((prev) => prev && {
        left: clamp(prev.left, EDGE_GAP, window.innerWidth - panel.offsetWidth - EDGE_GAP),
        top: clamp(prev.top, EDGE_GAP, window.innerHeight - panel.offsetHeight - EDGE_GAP),
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [show, position]);

  const handlePointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const panel = panelRef.current;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    panel.focus({ preventScroll: true });
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    setPosition({
      left: clamp(event.clientX - drag.offsetX, EDGE_GAP, window.innerWidth - panel.offsetWidth - EDGE_GAP),
      top: clamp(event.clientY - drag.offsetY, EDGE_GAP, window.innerHeight - panel.offsetHeight - EDGE_GAP),
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') onClose();
  };

  // Safari doesn't focus buttons on click; keep focus inside the window so its keyboard shortcuts apply.
  const handlePanelPointerDown = () => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
  };

  if (!show) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className={`tool-modal ${className} ${docked ? 'is-docked' : ''} ${position ? 'is-positioned' : ''}`}
      style={position ? { left: position.left, top: position.top } : undefined}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePanelPointerDown}
    >
      {/* Docked windows drop the title bar so the content fills the area; a floating close button remains. */}
      {docked ? (
        <button type="button" className="tool-modal-dock-close" onClick={onClose} aria-label={`Close ${title}`}>
          <FiX />
        </button>
      ) : (
        <div
          className="tool-modal-header"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <span className="tool-modal-icon">{icon}</span>
          <h2 className="tool-modal-title">{title}</h2>
          <button type="button" className="tool-modal-close" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>
      )}
      <div className="tool-modal-body">{children}</div>
    </div>,
    document.body
  );
}

export default ToolModal;
