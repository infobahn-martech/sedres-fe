import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiDownload, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import "../../../../design/scss/blockers-modal.scss";
import "../../../../design/scss/pages/kanban-board/seReviewMoveModal.scss";

// Opened from the "Consolidated" column's "Create Submission Documents" action: takes the consolidated
// invoice number the submission documents are built under. Same Blockers-style CustomModal shell as
// Review and Move / Invoice Review (blockers-modal-* + se-review-move-* classes).
const SubmissionDocumentsModal = ({ show, onClose, onCreate, isSubmitting = false, cardCount = 0 }) => {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setInvoiceNo("");
    setError("");
  }, [show]);

  const handleCreate = () => {
    if (isSubmitting) return;
    if (!invoiceNo.trim()) {
      setError("Please enter the invoice number.");
      return;
    }
    onCreate?.(invoiceNo.trim());
  };

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Create Submission Documents</h5>
        <p className="blockers-modal-subtitle">
          {cardCount} {cardCount === 1 ? "card" : "cards"} selected
        </p>
      </div>
      <button
        type="button"
        className="blockers-modal-close"
        onClick={onClose}
        disabled={isSubmitting}
        aria-label="Close"
      >
        <FiX size={20} />
      </button>
    </div>
  );

  const renderBody = () => (
    <div className="blockers-toolbar-section">
      <div className="submission-documents-field">
        <label className="submission-documents-field__label" htmlFor="submission-documents-invoice-no">
          Invoice No <span className="text-danger">*</span>
        </label>
        <input
          id="submission-documents-invoice-no"
          type="text"
          className={`form-control submission-documents-field__input${error ? " is-invalid" : ""}`}
          value={invoiceNo}
          onChange={(e) => {
            setInvoiceNo(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="e.g. SA26-00124926"
          disabled={isSubmitting}
        />
        {error && <div className="submission-documents-field__error">{error}</div>}
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-review-move-footer">
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={isSubmitting}>
        <FiDownload className="me-2" />
        {isSubmitting ? "Creating..." : "Create Documents"}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="blockers-modal se-review-move-modal submission-documents-modal"
      backdropClassName="blockers-modal-backdrop"
      createModal
      bodyClassname="blockers-modal-body"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

SubmissionDocumentsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func,
  isSubmitting: PropTypes.bool,
  cardCount: PropTypes.number,
};

export default SubmissionDocumentsModal;
