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
const SoApprovalEmailModal = ({ show, onClose, onCreate, isSubmitting = false, soCustomerName = "", stageLabel = "SO Approval", actionLabel = "", defaultTo = "", preLoadedDocuments = [] }) => {
  const [fromValue, setFromValue] = useState("operations@shipping.com");
  const [toValue, setToValue] = useState("");
  const [ccValue, setCcValue] = useState("");
  const [subjectValue, setSubjectValue] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [toError, setToError] = useState("");
  const [messageError, setMessageError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (show) {
      // Subject always mirrors the footer step button's own action text (actionLabel, e.g.
      // "Closed Paid", "Send for SO approval") instead of a generic "{stageLabel} Request" —
      // the two used to drift apart (e.g. footer said "Closed Paid" while the subject read
      // "Closed paid Request"), so this keeps them in sync for every stage.
      setSubjectValue(`${actionLabel || stageLabel}${soCustomerName ? ` — ${soCustomerName}` : ""}`);
      setToValue(defaultTo);
      setToError("");
      // Prefilled (not just a placeholder) — api/da/da_send_action_email requires a non-empty
      // body and rejects the whole request otherwise ({"status":"error","message":"call_id,
      // to, subject and body are required"}), so an empty Quill editor used to let staff submit
      // a doomed request with no warning. Still freely editable before sending.
      setMessage(
        `<p>Please review and ${stageLabel.toLowerCase()}${soCustomerName ? ` for ${soCustomerName}` : ""}.</p>`
      );
      setMessageError("");
      // Pre-load documents from verified SO line items' Supporting Documents field
      setAttachments(preLoadedDocuments || []);
    }
  }, [show, soCustomerName, stageLabel, actionLabel, defaultTo, preLoadedDocuments]);

  const handleFilesSelected = (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file);
    if (files.length) setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenAttachment = (file) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleCreate = () => {
    if (isSubmitting) return;
    if (!toValue.trim()) {
      setToError("Please enter at least one recipient.");
      return;
    }
    // Quill's empty state isn't "" once touched (e.g. "<p><br></p>"), so strip tags before
    // checking — otherwise a cleared/whitespace-only message would still pass as non-empty
    // and hit the same backend rejection this validation exists to prevent.
    if (!message.replace(/<[^>]*>/g, "").trim()) {
      setMessageError("Please enter a message.");
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
      <h5 className="modal-title m-0">New {stageLabel} Email</h5>
    </div>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="so-approval-email-compose">
        {/* Email fields - simplified */}
        <div className="so-approval-email-fields">
          <div className="so-approval-email-field">
            <label className="so-approval-email-field-label">From</label>
            <input
              type="text"
              className="so-approval-email-field-input"
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
              placeholder="sender@example.com"
              disabled={isSubmitting}
            />
          </div>
          <div className="so-approval-email-field">
            <label className="so-approval-email-field-label">To</label>
            <input
              type="text"
              className="so-approval-email-field-input"
              value={toValue}
              onChange={(e) => {
                setToValue(e.target.value);
                if (toError) setToError("");
              }}
              placeholder="recipient@example.com"
              disabled={isSubmitting}
            />
            {toError && <div className="so-approval-email-field-error">{toError}</div>}
          </div>
          <div className="so-approval-email-field">
            <label className="so-approval-email-field-label">Cc</label>
            <input
              type="text"
              className="so-approval-email-field-input"
              value={ccValue}
              onChange={(e) => setCcValue(e.target.value)}
              placeholder="cc@example.com"
              disabled={isSubmitting}
            />
          </div>
          <div className="so-approval-email-field">
            <label className="so-approval-email-field-label">Subject</label>
            <input
              type="text"
              className="so-approval-email-field-input"
              value={subjectValue}
              onChange={(e) => setSubjectValue(e.target.value)}
              placeholder="Email subject"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Attachments section */}
        <div className="so-approval-email-attachments">
          <div className="so-approval-email-attachments-toolbar">
            <span className="so-approval-email-attachments-label">Attachments ({attachments.length})</span>
            <button
              type="button"
              className="so-approval-email-attachments-btn"
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
          {attachments.length > 0 && (
            <div className="so-approval-email-attachments-items">
              {attachments.map((file, index) => (
                <div key={`${file.name}-${index}`} className="so-approval-email-attachment-item">
                  <button
                    type="button"
                    className="so-approval-email-attachment-name"
                    onClick={() => handleOpenAttachment(file)}
                    title={`Open ${file.name}`}
                    disabled={isSubmitting}
                  >
                    {file.name}
                  </button>
                  <button
                    type="button"
                    className="so-approval-email-attachment-remove"
                    onClick={() => removeAttachment(index)}
                    aria-label={`Remove ${file.name}`}
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message area */}
        <div className="so-approval-email-message">
          <div className="so-approval-email-quill-wrap">
            <ReactQuill
              theme="snow"
              value={message}
              onChange={(value) => {
                setMessage(value);
                if (messageError) setMessageError("");
              }}
              modules={{ toolbar: MESSAGE_QUILL_TOOLBAR }}
              formats={MESSAGE_QUILL_FORMATS}
              placeholder="Type your message..."
              readOnly={isSubmitting}
            />
            {messageError && <div className="so-approval-email-field-error">{messageError}</div>}
          </div>
        </div>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleCreate}
        disabled={isSubmitting}
      >
        <FiSend className="me-2" />
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
  actionLabel: PropTypes.string,
  defaultTo: PropTypes.string,
  preLoadedDocuments: PropTypes.arrayOf(PropTypes.object),
};

export default SoApprovalEmailModal;
