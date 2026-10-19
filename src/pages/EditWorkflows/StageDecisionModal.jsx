import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../../design/scss/structure/side-nav/AddDashboardModal.scss';

const StageDecisionModal = ({ show, stageName, initialValue = '', isSaving = false, onClose, onSave }) => {
  const [description, setDescription] = useState(initialValue);

  useEffect(() => {
    if (show) {
      setDescription(initialValue);
    }
  }, [show, initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSaving) return;
    onSave?.(description.trim());
  };

  const handleClose = () => {
    if (isSaving) return;
    onClose?.();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      className="add-dashboard-modal stage-decision-modal"
      centered
      backdrop="static"
      backdropClassName="add-dashboard-modal-backdrop"
      dialogClassName="add-dashboard-modal-dialog"
      contentClassName="add-dashboard-modal-content"
    >
      <form onSubmit={handleSubmit} className="add-dashboard-form" noValidate>
        <div className="add-dashboard-modal-header">
          <h2 className="add-dashboard-modal-title">
            {stageName ? `Description — ${stageName}` : 'Description'}
          </h2>
          <button
            type="button"
            className="add-dashboard-modal-close"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close"
          >
            <FiX size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="add-dashboard-modal-body">
          <div className="add-dashboard-field">
            <label htmlFor="stageDescription" className="add-dashboard-label">
              Description
            </label>
            <textarea
              id="stageDescription"
              className="add-dashboard-input stage-decision-textarea"
              placeholder="Enter description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>
        </div>

        <div className="add-dashboard-modal-footer">
          <button
            type="button"
            onClick={handleClose}
            className="add-dashboard-btn add-dashboard-btn--text"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="add-dashboard-btn add-dashboard-btn--text" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default StageDecisionModal;
