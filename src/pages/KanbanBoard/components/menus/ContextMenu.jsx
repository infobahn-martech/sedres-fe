import { useEffect } from 'react';
import PropTypes from 'prop-types';
import '@/design/scss/pages/kanban-board/contextMenu.scss';

function ContextMenu({ position, onClose }) {
    // Close on Escape key
    useEffect(() => {
        if (!position) return undefined;

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [position, onClose]);

    if (!position) return null;

    return (
        <div
            className="context-menu-overlay"
            onClick={onClose}
            onContextMenu={(e) => e.preventDefault()}
        />
    );
}

ContextMenu.propTypes = {
    position: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
    }),
    onClose: PropTypes.func.isRequired,
};

export default ContextMenu;
