import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FiMail, FiPaperclip, FiPlus, FiSend, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import "../../../../design/scss/pages/kanban-board/seCreationEmailModal.scss";

const MESSAGE_QUILL_TOOLBAR = [
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

const MESSAGE_QUILL_FORMATS = ["bold", "italic", "underline", "list", "bullet", "link", "image"];

const DEFAULT_FROM = "operations@shipping.com";

const DEFAULT_MESSAGE_HTML =
  "<p>Greetings from Sedres.</p>" +
  "<p><br></p>" +
  "<p>Please find the attached Sales Orders with supporting documents. Kindly review our sales order and confirm so we can submit our final invoice.</p>";

// Opened from a batch group's "Sent for SE creation" action on the Kanban board.
const SeCreationEmailModal = ({ show, onClose, onSend, isSubmitting = false, batchTitle = "", defaultTo = "", defaultCc = "" }) => {
  const [toValue, setToValue] = useState("");
  const [ccValue, setCcValue] = useState("");
  const [subjectValue, setSubjectValue] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!show) return;
    setToValue(defaultTo);
    setCcValue(defaultCc);
    setSubjectValue(`Sent for SE Creation${batchTitle ? ` — ${batchTitle}` : ""}`);
    setMessage(DEFAULT_MESSAGE_HTML);
    setAttachments([]);
    setErrors({});
  }, [show, batchTitle, defaultTo, defaultCc]);

  const clearError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleFilesSelected = (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
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

  const handleSend = () => {
    if (isSubmitting) return;
    const nextErrors = {};
    if (!toValue.trim()) nextErrors.to = "Please enter at least one recipient.";
    if (!subjectValue.trim()) nextErrors.subject = "Please enter a subject.";
    // Quill keeps markup like "<p><br></p>" when cleared, so check the text content only.
    if (!message.replace(/<[^>]*>/g, "").trim()) nextErrors.message = "Please enter a message.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSend?.({
      from: DEFAULT_FROM,
      to: toValue,
      cc: ccValue,
      subject: subjectValue,
      message,
      attachments,
    });
  };

  const renderHeader = () => (
    <div className="se-email-header">
      <span className="se-email-header__icon">
        <FiMail />
      </span>
      <div className="se-email-header__text">
        <h5 className="se-email-header__title">New SE Creation Email</h5>
        <p className="se-email-header__subtitle">Compose sales order confirmation</p>
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
        <label className="se-email-field__label">From</label>
        <input type="text" className="se-email-field__input se-email-field__input--readonly" value={DEFAULT_FROM} readOnly />
      </div>
      <div className="se-email-field">
        <label className="se-email-field__label">To</label>
        <div className="se-email-field__control">
          <input
            type="text"
            className="se-email-field__input"
            value={toValue}
            onChange={(e) => {
              setToValue(e.target.value);
              clearError("to");
            }}
            placeholder="recipient@example.com"
            disabled={isSubmitting}
          />
          {errors.to && <div className="se-email-field__error">{errors.to}</div>}
        </div>
      </div>
      <div className="se-email-field">
        <label className="se-email-field__label">Cc</label>
        <input
          type="text"
          className="se-email-field__input"
          value={ccValue}
          onChange={(e) => setCcValue(e.target.value)}
          placeholder="cc@example.com"
          disabled={isSubmitting}
        />
      </div>
      <div className="se-email-field">
        <label className="se-email-field__label">Subject</label>
        <div className="se-email-field__control">
          <input
            type="text"
            className="se-email-field__input"
            value={subjectValue}
            onChange={(e) => {
              setSubjectValue(e.target.value);
              clearError("subject");
            }}
            placeholder="Email subject"
            disabled={isSubmitting}
          />
          {errors.subject && <div className="se-email-field__error">{errors.subject}</div>}
        </div>
      </div>

      <div className="se-email-attachments">
        <div className="se-email-attachments__toolbar">
          <span className="se-email-attachments__label">
            <FiPaperclip className="se-email-attachments__clip" />
            Attachments ({attachments.length})
          </span>
          <label className={`se-email-attachments__add${isSubmitting ? " se-email-attachments__add--disabled" : ""}`}>
            <FiPlus />
            Add files
            <input
              type="file"
              multiple
              className="d-none"
              disabled={isSubmitting}
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {attachments.length > 0 && (
          <div className="se-email-attachments__items">
            {attachments.map((file, index) => (
              <div key={`${file.name}-${index}`} className="se-email-attachments__item">
                <button
                  type="button"
                  className="se-email-attachments__name"
                  onClick={() => handleOpenAttachment(file)}
                  title={`Open ${file.name}`}
                  disabled={isSubmitting}
                >
                  {file.name}
                </button>
                <button
                  type="button"
                  className="se-email-attachments__remove"
                  onClick={() => removeAttachment(index)}
                  aria-label={`Remove ${file.name}`}
                  disabled={isSubmitting}
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="se-email-message">
        <ReactQuill
          theme="snow"
          value={message}
          onChange={(value) => {
            setMessage(value);
            clearError("message");
          }}
          modules={{ toolbar: MESSAGE_QUILL_TOOLBAR }}
          formats={MESSAGE_QUILL_FORMATS}
          placeholder="Type your message..."
          readOnly={isSubmitting}
        />
        {errors.message && <div className="se-email-field__error">{errors.message}</div>}
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-email-footer">
      <button type="button" className="se-email-footer__cancel" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button type="button" className="se-email-footer__send" onClick={handleSend} disabled={isSubmitting}>
        <FiSend />
        {isSubmitting ? "Sending..." : "Send for SE Creation"}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="se-email-modal-root"
      dialgName="se-email-dialog"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

SeCreationEmailModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSend: PropTypes.func,
  isSubmitting: PropTypes.bool,
  batchTitle: PropTypes.string,
  defaultTo: PropTypes.string,
  defaultCc: PropTypes.string,
};

export default SeCreationEmailModal;
