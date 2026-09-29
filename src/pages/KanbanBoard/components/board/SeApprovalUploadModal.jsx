import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiLayers, FiPaperclip, FiUpload, FiUploadCloud, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import "../../../../design/scss/pages/kanban-board/seApprovalUploadModal.scss";

const ACCEPTED_FILE_TYPES = ".pdf,.eml,.msg,.jpg,.jpeg,.png";
const ACCEPTED_FORMATS_HINT = "PDF, EML, MSG, JPG, PNG";
const DEFAULT_FIELD_NAME = "files";

const buildEmptyFiles = (fields) => Object.fromEntries(fields.map((field) => [field.name, []]));

// Opened from a batch group's "Upload SE Approval" / "Upload Invoice" action on the Kanban board.
// Renders one dropzone per entry in `fields`; without `fields` it is a single attachments dropzone.
const SeApprovalUploadModal = ({
  show,
  onClose,
  onUpload,
  isSubmitting = false,
  batchTitle = "",
  title = "Upload SE Approval",
  subtitle = "Attach the service entry approval for this batch",
  submitLabel = "Upload SE Approval",
  multiple = true,
  fields,
}) => {
  const uploadFields = fields ?? [
    {
      name: DEFAULT_FIELD_NAME,
      accept: ACCEPTED_FILE_TYPES,
      formatsHint: ACCEPTED_FORMATS_HINT,
      multiple,
    },
  ];
  const hasMultipleFields = uploadFields.length > 1;

  const [filesByField, setFilesByField] = useState(() => buildEmptyFiles(uploadFields));
  const [draggingField, setDraggingField] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setFilesByField(buildEmptyFiles(uploadFields));
    setDraggingField("");
    setErrors({});
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, batchTitle]);

  const handleFilesSelected = (field, fileList) => {
    const selected = Array.from(fileList || []).filter(Boolean);
    if (!selected.length) return;
    setFilesByField((prev) => ({
      ...prev,
      [field.name]: field.multiple ? [...(prev[field.name] ?? []), ...selected] : selected.slice(0, 1),
    }));
    setErrors((prev) => ({ ...prev, [field.name]: "" }));
    setError("");
  };

  const removeFile = (fieldName, index) => {
    setFilesByField((prev) => ({
      ...prev,
      [fieldName]: (prev[fieldName] ?? []).filter((_, i) => i !== index),
    }));
  };

  const handleOpenFile = (file) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const getInputId = (fieldName) => `se-approval-upload-input-${fieldName}`;

  const openFilePicker = (fieldName) => {
    if (!isSubmitting) document.getElementById(getInputId(fieldName))?.click();
  };

  const handleUpload = () => {
    if (isSubmitting) return;
    const fieldErrors = {};
    uploadFields.forEach((field) => {
      if (field.required && !filesByField[field.name]?.length) {
        fieldErrors[field.name] = `Please select the ${field.label ?? "file"}.`;
      }
    });
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    if (!uploadFields.some((field) => filesByField[field.name]?.length)) {
      setError("Please select at least one file.");
      return;
    }
    onUpload?.(fields ? filesByField : filesByField[DEFAULT_FIELD_NAME]);
  };

  const renderHeader = () => (
    <div className="se-approval-header">
      <span className="se-approval-header__icon">
        <FiUploadCloud />
      </span>
      <div className="se-approval-header__text">
        <h5 className="se-approval-header__title">{title}</h5>
        <p className="se-approval-header__subtitle">{subtitle}</p>
      </div>
      <button
        type="button"
        className="se-approval-header__close"
        onClick={onClose}
        disabled={isSubmitting}
        aria-label="Close"
      >
        <FiX />
      </button>
    </div>
  );

  const renderField = (field) => {
    const files = filesByField[field.name] ?? [];
    const isDragging = draggingField === field.name;
    const fieldError = errors[field.name] || (!hasMultipleFields ? error : "");

    return (
      <div key={field.name} className="se-approval-field">
        {field.label && (
          <span className="se-approval-field__label">
            {field.label}
            {field.required && <span className="se-approval-field__required">*</span>}
          </span>
        )}

        <div
          className={`se-approval-dropzone${isDragging ? " se-approval-dropzone--active" : ""}${
            fieldError ? " se-approval-dropzone--error" : ""
          }${hasMultipleFields ? " se-approval-dropzone--compact" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDraggingField(field.name);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDraggingField("");
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingField("");
            if (!isSubmitting) handleFilesSelected(field, e.dataTransfer?.files);
          }}
          onClick={() => openFilePicker(field.name)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker(field.name);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <input
            id={getInputId(field.name)}
            type="file"
            multiple={Boolean(field.multiple)}
            className="d-none"
            accept={field.accept}
            disabled={isSubmitting}
            onChange={(e) => {
              handleFilesSelected(field, e.target.files);
              e.target.value = "";
            }}
          />
          <FiUploadCloud className="se-approval-dropzone__icon" />
          <span className="se-approval-dropzone__text">
            {isDragging ? "Drop your files here" : "Drag and drop your files here"}
          </span>
          <span className="se-approval-dropzone__hint">or click to browse</span>
          <span className="se-approval-dropzone__formats">{field.formatsHint}</span>
        </div>
        {fieldError && <div className="se-approval-dropzone__error">{fieldError}</div>}

        {field.multiple ? (
          <div className="se-approval-attachments">
            <span className="se-approval-attachments__label">
              <FiPaperclip className="se-approval-attachments__clip" />
              Attachments ({files.length})
            </span>
            {renderFileItems(field.name, files)}
          </div>
        ) : (
          <div className="se-approval-attachments se-approval-attachments--inline">
            {renderFileItems(field.name, files)}
          </div>
        )}
      </div>
    );
  };

  // Single-file fields skip the "Attachments (n)" panel and just show the picked file under the dropzone.
  const renderFileItems = (fieldName, files) =>
    files.length > 0 && (
      <div className="se-approval-attachments__items">
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="se-approval-attachments__item">
            <button
              type="button"
              className="se-approval-attachments__name"
              onClick={() => handleOpenFile(file)}
              title={`Open ${file.name}`}
              disabled={isSubmitting}
            >
              {file.name}
            </button>
            <button
              type="button"
              className="se-approval-attachments__remove"
              onClick={() => removeFile(fieldName, index)}
              aria-label={`Remove ${file.name}`}
              disabled={isSubmitting}
            >
              <FiX />
            </button>
          </div>
        ))}
      </div>
    );

  const renderBody = () => (
    <div className="modal-body se-approval-body">
      <div className="se-approval-batch">
        <FiLayers className="se-approval-batch__icon" />
        <span className="se-approval-batch__caption">Batch:</span>
        <span className="se-approval-batch__title" title={batchTitle}>
          {batchTitle || "-"}
        </span>
      </div>

      {uploadFields.map(renderField)}
      {hasMultipleFields && error && <div className="se-approval-dropzone__error">{error}</div>}
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-approval-footer">
      <button type="button" className="se-approval-footer__cancel" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button type="button" className="se-approval-footer__upload" onClick={handleUpload} disabled={isSubmitting}>
        <FiUpload />
        {isSubmitting ? "Uploading..." : submitLabel}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="se-approval-modal-root"
      dialgName="se-approval-dialog"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

SeApprovalUploadModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpload: PropTypes.func,
  isSubmitting: PropTypes.bool,
  batchTitle: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  submitLabel: PropTypes.string,
  multiple: PropTypes.bool,
  fields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string,
      accept: PropTypes.string,
      formatsHint: PropTypes.string,
      required: PropTypes.bool,
      multiple: PropTypes.bool,
    })
  ),
};

export default SeApprovalUploadModal;
