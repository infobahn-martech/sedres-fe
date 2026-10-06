import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../../design/scss/structure/side-nav/AddDashboardModal.scss';

const StageDecisionModal = ({ show, stageName, initialValue = '', onClose, onSave }) => {
  const [decision, setDecision] = useState(initialValue);

  useEffect(() => {
    if (show) setDecision(initialValue);
  }, [show, initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.(decision.trim());
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="add-dashboard-modal"
      centered
      backdrop="static"
      backdropClassName="add-dashboard-modal-backdrop"
      dialogClassName="add-dashboard-modal-dialog"
      contentClassName="add-dashboard-modal-content"
    >
      <form onSubmit={handleSubmit} className="add-dashboard-form">
        <div className="add-dashboard-modal-header">
          <h2 className="add-dashboard-modal-title">
            {stageName ? `Decision — ${stageName}` : 'Decision'}
          </h2>
          <button type="button" className="add-dashboard-modal-close" onClick={onClose} aria-label="Close">
            <FiX size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="add-dashboard-modal-body">
          <div className="add-dashboard-field">
            <label htmlFor="stageDecision" className="add-dashboard-label">
              Decision
            </label>
            <input
              type="text"
              id="stageDecision"
              className="add-dashboard-input"
              placeholder="Enter decision"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="add-dashboard-modal-footer">
          <button type="button" onClick={onClose} className="add-dashboard-btn add-dashboard-btn--text">
            Cancel
          </button>
          <button type="submit" className="add-dashboard-btn add-dashboard-btn--text">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default StageDecisionModal;
