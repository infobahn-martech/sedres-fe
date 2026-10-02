import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiDownload, FiFileText, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import "../../../../design/scss/pages/kanban-board/seCreationEmailModal.scss";

// Opened from the "Consolidated" column's "Create Submission Documents" action: takes the consolidated
// invoice number the submission documents are built under. Reuses the SE creation email modal's styling.
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
    <div className="se-email-header">
      <span className="se-email-header__icon">
        <FiFileText />
      </span>
      <div className="se-email-header__text">
        <h5 className="se-email-header__title">Create Submission Documents</h5>
        <p className="se-email-header__subtitle">
          {cardCount} {cardCount === 1 ? "card" : "cards"} selected
        </p>
      </div>
      <button
        type="button"
        className="se-email-header__close"
        onClick={onClose}
        disabled={isSubmitting}
        aria-label="Close"
      >
        <FiX />
      </button>
    </div>
  );

  const renderBody = () => (
    <div className="modal-body se-email-body">
      <div className="se-email-field">
        <label className="se-email-field__label">Invoice No</label>
        <div className="se-email-field__control">
          <input
            type="text"
            className="se-email-field__input"
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
          {error && <div className="se-email-field__error">{error}</div>}
        </div>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-email-footer">
      <button type="button" className="se-email-footer__cancel" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button type="button" className="se-email-footer__send" onClick={handleCreate} disabled={isSubmitting}>
        <FiDownload />
        {isSubmitting ? "Creating..." : "Create Documents"}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="se-email-modal-root submission-documents-modal-root"
      dialgName="se-email-dialog"
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
