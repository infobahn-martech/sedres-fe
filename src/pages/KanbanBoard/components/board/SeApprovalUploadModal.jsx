import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiLayers, FiPaperclip, FiUpload, FiUploadCloud, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import "../../../../design/scss/pages/kanban-board/seApprovalUploadModal.scss";

const ACCEPTED_FILE_TYPES = ".pdf,.eml,.msg,.jpg,.jpeg,.png";
const ACCEPTED_FORMATS_HINT = "PDF, EML, MSG, JPG, PNG";
const FILE_INPUT_ID = "se-approval-upload-input";

// Opened from a batch group's "Upload SE Approval" action on the Kanban board.
const SeApprovalUploadModal = ({ show, onClose, onUpload, isSubmitting = false, batchTitle = "" }) => {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setFiles([]);
    setIsDragging(false);
    setError("");
  }, [show, batchTitle]);

  const handleFilesSelected = (fileList) => {
    const selected = Array.from(fileList || []).filter(Boolean);
    if (!selected.length) return;
    setFiles((prev) => [...prev, ...selected]);
    setError("");
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenFile = (file) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const openFilePicker = () => {
    if (!isSubmitting) document.getElementById(FILE_INPUT_ID)?.click();
  };

  const handleUpload = () => {
    if (isSubmitting) return;
    if (!files.length) {
      setError("Please select at least one file.");
      return;
    }
    onUpload?.(files);
  };

  const renderHeader = () => (
    <div className="se-approval-header">
      <span className="se-approval-header__icon">
        <FiUploadCloud />
      </span>
      <div className="se-approval-header__text">
        <h5 className="se-approval-header__title">Upload SE Approval</h5>
        <p className="se-approval-header__subtitle">Attach the service entry approval for this batch</p>
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

  const renderBody = () => (
    <div className="modal-body se-approval-body">
      <div className="se-approval-batch">
        <FiLayers className="se-approval-batch__icon" />
        <span className="se-approval-batch__caption">Batch:</span>
        <span className="se-approval-batch__title" title={batchTitle}>
          {batchTitle || "-"}
        </span>
      </div>

      <div
        className={`se-approval-dropzone${isDragging ? " se-approval-dropzone--active" : ""}${
          error ? " se-approval-dropzone--error" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!isSubmitting) handleFilesSelected(e.dataTransfer?.files);
        }}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <input
          id={FILE_INPUT_ID}
          type="file"
          multiple
          className="d-none"
          accept={ACCEPTED_FILE_TYPES}
          disabled={isSubmitting}
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
        <FiUploadCloud className="se-approval-dropzone__icon" />
        <span className="se-approval-dropzone__text">
          {isDragging ? "Drop your files here" : "Drag and drop your files here"}
        </span>
        <span className="se-approval-dropzone__hint">or click to browse</span>
        <span className="se-approval-dropzone__formats">{ACCEPTED_FORMATS_HINT}</span>
      </div>
      {error && <div className="se-approval-dropzone__error">{error}</div>}

      <div className="se-approval-attachments">
        <span className="se-approval-attachments__label">
          <FiPaperclip className="se-approval-attachments__clip" />
          Attachments ({files.length})
        </span>
        {files.length > 0 && (
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
                  onClick={() => removeFile(index)}
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
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-approval-footer">
      <button type="button" className="se-approval-footer__cancel" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button type="button" className="se-approval-footer__upload" onClick={handleUpload} disabled={isSubmitting}>
        <FiUpload />
        {isSubmitting ? "Uploading..." : "Upload SE Approval"}
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
};

export default SeApprovalUploadModal;
