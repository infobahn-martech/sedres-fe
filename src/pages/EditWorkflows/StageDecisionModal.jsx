import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../../design/scss/structure/side-nav/AddDashboardModal.scss';

const StageDecisionModal = ({ show, stageName, initialValue = '', onClose, onSave }) => {
  const [description, setDescription] = useState(initialValue);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setDescription(initialValue);
      setError('');
    }
  }, [show, initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) {
      setError('Description is required.');
      return;
    }
    onSave?.(trimmed);
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
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
          <button type="button" className="add-dashboard-modal-close" onClick={onClose} aria-label="Close">
            <FiX size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="add-dashboard-modal-body">
          <div className="add-dashboard-field">
            <label htmlFor="stageDescription" className="add-dashboard-label">
              Description <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="stageDescription"
              className={`add-dashboard-input stage-decision-textarea${error ? ' add-dashboard-input--invalid' : ''}`}
              placeholder="Enter description"
              rows={6}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError('');
              }}
              required
              aria-required="true"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'stageDescription-error' : undefined}
              autoFocus
            />
            {error ? (
              <div id="stageDescription-error" className="add-dashboard-field-error" role="alert">
                {error}
              </div>
            ) : null}
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
