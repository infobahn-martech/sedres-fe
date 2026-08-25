import { useEffect } from 'react';
import PropTypes from 'prop-types';
import '../../../../design/scss/pages/kanban-board/contextMenu.scss';

function ContextMenu({ position, onClose, onCreateCard }) {
    if (!position) return null;

    // Calculate position to keep menu within viewport
    const getMenuPosition = () => {
        if (!position) return { x: 0, y: 0 };

        const menuWidth = 200;
        const menuHeight = 50; // Approximate height for single item
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
                className="context-menu-overlay"
                onClick={onClose}
                onContextMenu={(e) => e.preventDefault()}
            />
            {/* <div
                className="context-menu"
                style={{
                    left: `${menuPosition.x}px`,
                    top: `${menuPosition.y}px`,
                }}
                onClick={handleClick}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div className="context-menu-item" onClick={handleMenuItemClick}>
                    <span className="context-menu-icon">+</span>
                    <span className="context-menu-text">Create new card</span>
                </div>
            </div> */}
        </>
    );
}

ContextMenu.propTypes = {
    position: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
    }),
    onClose: PropTypes.func.isRequired,
    onCreateCard: PropTypes.func,
};

export default ContextMenu;

