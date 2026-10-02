import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FiCheck, FiFileText, FiMail, FiPaperclip, FiPlus, FiSend, FiUploadCloud, FiX } from "react-icons/fi";
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

const EMPTY_LIST = [];

const DEFAULT_MESSAGE_HTML =
  "<p>Greetings from Sedres.</p>" +
  "<p><br></p>" +
  "<p>Please find the attached Sales Orders with supporting documents. Kindly review our sales order and confirm so we can submit our final invoice.</p>";

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The draft body is plain text with "\n" line breaks; Quill needs one paragraph per line.
const plainTextToHtml = (text) =>
  text
    .split("\n")
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>"))
    .join("");

const getFileNameFromUrl = (url) => {
  const name = url.split("?")[0].split("/").pop();
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

// Opened from a batch group's "Send For SE creation" action on the Kanban board, and from the
// "Consolidated" column's "Send For Final Submission" (with its own title / subject / send label).
// `documents` lists files the backend already holds for the email (opened, not re-sent; one with a `label`
// gets its own labelled row, like the pickers); `fileFields`
// replaces "Add files" with one labelled picker per file the send route takes.
const SeCreationEmailModal = ({
  show,
  onClose,
  onSend,
  isSubmitting = false,
  batchTitle = "",
  defaultTo = "",
  defaultCc = "",
  defaultSubject = "",
  defaultBody = "",
  documentUrl = "",
  title = "New SE Creation Email",
  subtitle = "Compose sales order confirmation",
  sendLabel = "Send for SE Creation",
  subjectPrefix = "Sent for SE Creation",
  documents = EMPTY_LIST,
  fileFields = null,
}) => {
  const [toValue, setToValue] = useState("");
  const [ccValue, setCcValue] = useState("");
  const [subjectValue, setSubjectValue] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [fieldFiles, setFieldFiles] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!show) return;
    setToValue(defaultTo);
    setCcValue(defaultCc);
    setSubjectValue(defaultSubject || `${subjectPrefix}${batchTitle ? ` — ${batchTitle}` : ""}`);
    setMessage(defaultBody ? plainTextToHtml(defaultBody) : DEFAULT_MESSAGE_HTML);
    setAttachments([]);
    setFieldFiles({});
    setErrors({});
  }, [show, batchTitle, defaultTo, defaultCc, defaultSubject, defaultBody, subjectPrefix]);

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

  const handleFieldFilesSelected = (field, fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setFieldFiles((prev) => ({
      ...prev,
      [field.name]: field.multiple ? [...(prev[field.name] ?? []), ...files] : files.slice(0, 1),
    }));
    clearError(`file_${field.name}`);
  };

  const removeFieldFile = (fieldName, index) => {
    setFieldFiles((prev) => ({ ...prev, [fieldName]: (prev[fieldName] ?? []).filter((_, i) => i !== index) }));
  };

  const unlabelledDocuments = documents.filter((document) => !document.label);
  const labelledDocuments = documents.filter((document) => document.label);

  const attachmentCount =
    attachments.length +
    documents.length +
    (documentUrl ? 1 : 0) +
    Object.values(fieldFiles).reduce((sum, files) => sum + files.length, 0);

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
    (fileFields ?? []).forEach((field) => {
      if (field.required && !fieldFiles[field.name]?.length) {
        nextErrors[`file_${field.name}`] = `Please attach the ${field.label.toLowerCase()}.`;
      }
    });
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
      fieldFiles,
    });
  };

  const renderHeader = () => (
    <div className="se-email-header">
      <span className="se-email-header__icon">
        <FiMail />
      </span>
      <div className="se-email-header__text">
        <h5 className="se-email-header__title">{title}</h5>
        <p className="se-email-header__subtitle">{subtitle}</p>
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
            Attachments ({attachmentCount})
          </span>
          {!fileFields && (
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
          )}
        </div>
        {(documentUrl || unlabelledDocuments.length > 0 || attachments.length > 0) && (
          <div className="se-email-attachments__items">
            {unlabelledDocuments.map((document) => (
              <div key={document.url} className="se-email-attachments__item">
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="se-email-attachments__name"
                  title={`Open ${document.name}`}
                >
                  {document.name}
                </a>
              </div>
            ))}
            {documentUrl && (
              <div className="se-email-attachments__item">
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="se-email-attachments__name"
                  title={`Open ${getFileNameFromUrl(documentUrl)}`}
                >
                  {getFileNameFromUrl(documentUrl)}
                </a>
              </div>
            )}
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
        {(labelledDocuments.length > 0 || fileFields?.length > 0) && (
          <div className="se-email-slots">
            {labelledDocuments.map((document) => (
              <div key={document.url} className="se-email-slot se-email-slot--filled">
                <div className="se-email-slot__head">
                  <span className="se-email-slot__icon">
                    <FiFileText />
                  </span>
                  <div className="se-email-slot__text">
                    <span className="se-email-slot__label" title={document.label}>
                      {document.label}
                    </span>
                    <span className="se-email-slot__hint">Included automatically</span>
                  </div>
                </div>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="se-email-slot__file"
                  title={`Open ${document.name}`}
                >
                  <span className="se-email-slot__file-name">{document.name}</span>
                </a>
              </div>
            ))}
            {(fileFields ?? []).map((field) => {
              const files = fieldFiles[field.name] ?? [];
              const error = errors[`file_${field.name}`];
              const canPick = field.multiple || files.length === 0;
              return (
                <div
                  key={field.name}
                  className={`se-email-slot${files.length ? " se-email-slot--filled" : ""}${
                    error ? " se-email-slot--error" : ""
                  }`}
                >
                  <div className="se-email-slot__head">
                    <span className="se-email-slot__icon">{files.length ? <FiCheck /> : <FiUploadCloud />}</span>
                    <div className="se-email-slot__text">
                      <span className="se-email-slot__label" title={field.label}>
                        {field.label}
                        {field.required && <span className="se-email-slot__required">*</span>}
                      </span>
                      <span className="se-email-slot__hint">
                        {field.required ? "Required" : "Optional"} · {field.multiple ? "1 or more files" : "1 file"}
                      </span>
                    </div>
                  </div>
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="se-email-slot__file">
                      <button
                        type="button"
                        className="se-email-slot__file-name"
                        onClick={() => handleOpenAttachment(file)}
                        title={`Open ${file.name}`}
                        disabled={isSubmitting}
                      >
                        {file.name}
                      </button>
                      <button
                        type="button"
                        className="se-email-slot__file-remove"
                        onClick={() => removeFieldFile(field.name, index)}
                        aria-label={`Remove ${file.name}`}
                        disabled={isSubmitting}
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                  {canPick && (
                    <label className={`se-email-slot__pick${isSubmitting ? " se-email-slot__pick--disabled" : ""}`}>
                      <FiPlus />
                      {files.length ? "Add more" : "Choose file"}
                      <input
                        type="file"
                        multiple={field.multiple}
                        accept={field.accept}
                        className="d-none"
                        disabled={isSubmitting}
                        onChange={(e) => {
                          handleFieldFilesSelected(field, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  {error && <div className="se-email-slot__error">{error}</div>}
                </div>
              );
            })}
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
        {isSubmitting ? "Sending..." : sendLabel}
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
  defaultSubject: PropTypes.string,
  defaultBody: PropTypes.string,
  documentUrl: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  sendLabel: PropTypes.string,
  subjectPrefix: PropTypes.string,
  documents: PropTypes.arrayOf(
    PropTypes.shape({ name: PropTypes.string, url: PropTypes.string, label: PropTypes.string })
  ),
  fileFields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      required: PropTypes.bool,
      multiple: PropTypes.bool,
      accept: PropTypes.string,
    })
  ),
};

export default SeCreationEmailModal;
