import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../../design/scss/structure/side-nav/AddDashboardModal.scss';
import '../../design/scss/Workspaces.scss';

const RenameBoardModal = ({ show, onClose, onSave, currentName, isSaving = false }) => {
    const [boardName, setBoardName] = useState('');

    useEffect(() => {
        if (show) {
            setBoardName(currentName || '');
        }
    }, [show, currentName]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (boardName.trim() && boardName !== currentName) {
            onSave(boardName.trim());
        } else {
            onClose();
        }
        // Modal closes via parent's callback on successful API response
    };

    const handleClose = () => {
        setBoardName(currentName || '');
        onClose();
    };

    return (
        <Modal
            show={show}
            onHide={handleClose}
            className="add-dashboard-modal board-rename-modal"
            centered
            backdrop="static"
            backdropClassName="add-dashboard-modal-backdrop"
            dialogClassName="add-dashboard-modal-dialog"
            contentClassName="add-dashboard-modal-content"
        >
            <form onSubmit={handleSubmit} className="add-dashboard-form">
                <div className="add-dashboard-modal-header">
                    <h2 className="add-dashboard-modal-title" id="rename-board-modal-title">
                        Rename Board
                    </h2>
                    <button
                        type="button"
                        className="add-dashboard-modal-close"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <FiX size={22} strokeWidth={2} />
                    </button>
                </div>

                <div className="add-dashboard-modal-body">
                    <label htmlFor="renameBoardName" className="add-dashboard-label">
                        Board name
                    </label>
                    <input
                        type="text"
                        id="renameBoardName"
                        className="add-dashboard-input"
                        placeholder="Enter board name"
                        value={boardName}
                        onChange={(e) => setBoardName(e.target.value)}
                        required
                        autoFocus
                    />
                </div>

                <div className="add-dashboard-modal-footer">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="add-dashboard-btn add-dashboard-btn--text"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="add-dashboard-btn add-dashboard-btn--text"
                        disabled={!boardName.trim() || boardName.trim() === currentName || isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default RenameBoardModal;
