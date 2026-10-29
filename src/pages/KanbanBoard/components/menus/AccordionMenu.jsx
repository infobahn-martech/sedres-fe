import { useEffect } from 'react';
import PropTypes from 'prop-types';
import '../../../../design/scss/pages/kanban-board/accordionMenu.scss';

function AccordionMenu({
  position,
  onClose,
  onExpand,
  onCollapse,
  onTogglePin,
  isExpanded,
  isPinned,
}) {
  if (!position) return null;

  const handleClick = (e) => {
    e.stopPropagation();
  };

  const handleExpand = () => {
    if (onExpand) {
      onExpand();
    }
    onClose();
  };

  const handleCollapse = () => {
    if (onCollapse) {
      onCollapse();
    }
    onClose();
  };

  const handleTogglePin = () => {
    if (onTogglePin) {
      onTogglePin();
    }
    onClose();
  };

  // Calculate position to keep menu within viewport
  const getMenuPosition = () => {
    if (!position) return { x: 0, y: 0 };

    const menuWidth = 180;
    const menuHeight = 140; // Approximate height with three options
    const padding = 10;

    let x = position.x;
    let y = position.y;

    // Adjust if menu would go off right edge
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }

    // Adjust if menu would go off bottom edge
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }

    // Ensure menu doesn't go off left or top edges
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    return { x, y };
  };

  const menuPosition = getMenuPosition();

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <>
      <div
        className="accordion-menu-overlay"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="accordion-menu"
        style={{
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`,
        }}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {isExpanded ? (
          <div className="accordion-menu-item" onClick={handleCollapse}>
            <span className="accordion-menu-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Collapse icon - arrows pointing inward to center */}
                <rect x="5" y="5" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" rx="0.5"/>
                {/* Top arrow pointing down */}
                <path d="M8 2L8 5M6 4L8 5L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Bottom arrow pointing up */}
                <path d="M8 11L8 14M6 12L8 11L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Left arrow pointing right */}
                <path d="M2 8L5 8M4 6L5 8L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Right arrow pointing left */}
                <path d="M11 8L14 8M12 6L11 8L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="accordion-menu-text">Collapse</span>
          </div>
        ) : (
          <div className="accordion-menu-item" onClick={handleExpand}>
            <span className="accordion-menu-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Expand icon - arrows pointing outward from center */}
                <rect x="5" y="5" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" rx="0.5"/>
                {/* Top arrow pointing up */}
                <path d="M8 5L8 2M6 4L8 5L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Bottom arrow pointing down */}
                <path d="M8 11L8 14M6 12L8 11L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Left arrow pointing left */}
                <path d="M5 8L2 8M4 6L5 8L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Right arrow pointing right */}
                <path d="M11 8L14 8M12 6L11 8L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="accordion-menu-text">Expand</span>
          </div>
        )}
        <div className="accordion-menu-item" onClick={handleTogglePin}>
          <span className="accordion-menu-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2.5L9.25 5H12C12.55 5 13 5.45 13 6V7C13 7.55 12.55 8 12 8H11L9 14L7 9L3.5 12V10.5L6 8H4C3.45 8 3 7.55 3 7V6C3 5.45 3.45 5 4 5H6.75L8 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="accordion-menu-text">{isPinned ? 'Unpin' : 'Pin'}</span>
        </div>
      </div>
    </>
  );
}

AccordionMenu.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  onClose: PropTypes.func.isRequired,
  onExpand: PropTypes.func,
  onCollapse: PropTypes.func,
  onTogglePin: PropTypes.func,
  isExpanded: PropTypes.bool,
  isPinned: PropTypes.bool,
};

export default AccordionMenu;

