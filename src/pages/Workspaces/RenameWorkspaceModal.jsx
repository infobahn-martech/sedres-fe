import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../../design/scss/structure/side-nav/AddDashboardModal.scss';
import '../../design/scss/Workspaces.scss';

const RenameWorkspaceModal = ({ show, onClose, onSave, currentName, isSaving = false }) => {
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    if (show) {
      setWorkspaceName(currentName || '');
    }
  }, [show, currentName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (workspaceName.trim() && workspaceName !== currentName) {
      onSave(workspaceName.trim());
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    setWorkspaceName(currentName || '');
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
          <h2 className="add-dashboard-modal-title" id="rename-workspace-modal-title">
            Rename Workspace
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
          <label htmlFor="renameWorkspaceName" className="add-dashboard-label">
            Workspace name
          </label>
          <input
            type="text"
            id="renameWorkspaceName"
            className="add-dashboard-input"
            placeholder="Enter workspace name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
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
            disabled={!workspaceName.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RenameWorkspaceModal;
