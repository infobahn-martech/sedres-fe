import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FiSend } from "react-icons/fi";
import CustomModal from "../../../../../../components/CustomModal";

const MESSAGE_QUILL_TOOLBAR = [
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

const MESSAGE_QUILL_FORMATS = ["bold", "italic", "underline", "list", "bullet", "link", "image"];

// Opened from the SO Status stepper's "To Be Sent for SO Approval" step. Built on the
// app's common CustomModal (react-bootstrap Modal wrapper, used across ~80 other modals in
// this codebase) instead of a bespoke backdrop, so positioning/stacking (above the card's
// own header/footer, above everything else) is handled the same proven way as every other
// modal in the app. Local-only for now — no backend send endpoint yet; onCreate just
// advances the SO status.
// stageLabel is the real current stage name from api/da/status_timeline (e.g. "SO approval",
// "To be sent for SRF") — wording varies per call (see the "NOT name-matched" comment in
// SalesOrderList.jsx), so the modal title/subject/send button must echo that real label
// instead of a fixed "SO Approval" string that would be wrong on calls using different wording.
// defaultTo is the recipient from api/da/da_action_email_draft/{call_id} (fetched by
// SalesOrderList right before opening this modal) — prefills "To" with the backend's own
// suggested recipient instead of making staff type it every time; still freely editable.
const SoApprovalEmailModal = ({ show, onClose, onCreate, isSubmitting = false, soCustomerName = "", stageLabel = "SO Approval", defaultTo = "" }) => {
  const [fromValue, setFromValue] = useState("operations@shipping.com");
  const [toValue, setToValue] = useState("");
  const [ccValue, setCcValue] = useState("");
  const [subjectValue, setSubjectValue] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [toError, setToError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (show) {
      setSubjectValue(`${stageLabel} Request${soCustomerName ? ` — ${soCustomerName}` : ""}`);
      setToValue(defaultTo);
      setToError("");
    }
  }, [show, soCustomerName, stageLabel, defaultTo]);

  const handleFilesSelected = (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file);
    if (files.length) setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    if (isSubmitting) return;
    if (!toValue.trim()) {
      setToError("Please enter at least one recipient.");
      return;
    }
    onCreate?.({
      from: fromValue,
      to: toValue,
      cc: ccValue,
      subject: subjectValue,
      message,
      attachments,
    });
  };

  const renderHeader = () => (
    <div className="so-approval-email-header">
      <h1 className="modal-title">{stageLabel} Email</h1>
    </div>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="so-approval-email-card">
        <div className="so-approval-email-meta">
          <div className="so-approval-email-row">
            <div className="so-approval-email-row-label">From</div>
            <div className="so-approval-email-row-value">
              <input
                type="text"
                className="so-approval-email-input"
                value={fromValue}
                onChange={(e) => setFromValue(e.target.value)}
                placeholder="From email"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="so-approval-email-row">
            <div className="so-approval-email-row-label">To</div>
            <div className="so-approval-email-row-value">
              <input
                type="text"
                className="so-approval-email-input"
                value={toValue}
                onChange={(e) => {
                  setToValue(e.target.value);
                  if (toError) setToError("");
                }}
                placeholder="Recipients"
                disabled={isSubmitting}
              />
              {toError && <div className="so-approval-email-field-error">{toError}</div>}
            </div>
          </div>
          <div className="so-approval-email-row">
            <div className="so-approval-email-row-label">Cc</div>
            <div className="so-approval-email-row-value">
              <input
                type="text"
                className="so-approval-email-input"
                value={ccValue}
                onChange={(e) => setCcValue(e.target.value)}
                placeholder="Recipients"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="so-approval-email-row">
            <div className="so-approval-email-row-label">Subject</div>
            <div className="so-approval-email-row-value">
              <input
                type="text"
                className="so-approval-email-input"
                value={subjectValue}
                onChange={(e) => setSubjectValue(e.target.value)}
                placeholder="Email subject"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="so-approval-email-row so-approval-email-row--attachments">
            <div className="so-approval-email-row-label">Attachments</div>
            <div className="so-approval-email-row-value">
              <div className="so-approval-email-attachments-list">
                {attachments.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="so-approval-email-attachment-chip">
                    <span className="so-approval-email-attachment-name">{file.name}</span>
                    <button
                      type="button"
                      className="so-approval-email-attachment-remove"
                      onClick={() => removeAttachment(index)}
                      aria-label={`Remove ${file.name}`}
                      disabled={isSubmitting}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="so-approval-email-attachment-add"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  + Add
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="so-approval-email-file-input-hidden"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="so-approval-email-message-section">
          <div className="so-approval-email-message-title">Message</div>
          <div className="so-approval-email-quill-wrap">
            <ReactQuill
              theme="snow"
              value={message}
              onChange={setMessage}
              modules={{ toolbar: MESSAGE_QUILL_TOOLBAR }}
              formats={MESSAGE_QUILL_FORMATS}
              placeholder="Type email content here..."
              readOnly={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer">
      <button
        type="button"
        className="btn btn-secondary so-approval-email-footer-btn"
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-primary so-approval-email-footer-btn so-approval-email-footer-btn--send"
        onClick={handleCreate}
        disabled={isSubmitting}
      >
        <FiSend />
        {isSubmitting ? "Sending..." : `Send for ${stageLabel}`}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="so-approval-email-modal-root"
      dialgName="so-approval-email-dialog"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

SoApprovalEmailModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func,
  isSubmitting: PropTypes.bool,
  soCustomerName: PropTypes.string,
  stageLabel: PropTypes.string,
  defaultTo: PropTypes.string,
};

export default SoApprovalEmailModal;
