import { useState, useRef } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { FormSection, FormField, FormSelect, ReactQuillEditor } from "./Husbandry.components";

const OnStationContent = ({ formValues, handleChange, cardColor }) => {
  const [isDraggingOnStationDocuments, setIsDraggingOnStationDocuments] = useState(false);
  const onStationDocumentsFileInputRef = useRef(null);



  // Handle file upload for On Station Documents
  const handleOnStationDocumentsFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const syntheticEvent = { target: { value: files } };
    handleChange("onStationDocuments")(syntheticEvent);
  };

  // Handle drag and drop for On Station Documents
  const handleOnStationDocumentsDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOnStationDocuments(true);
  };

  const handleOnStationDocumentsDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOnStationDocuments(false);
  };

  const handleOnStationDocumentsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOnStationDocuments(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const syntheticEvent = { target: { value: files } };
      handleChange("onStationDocuments")(syntheticEvent);
    }
  };

  const handleOnStationDocumentsBrowseClick = () => {
    onStationDocumentsFileInputRef.current?.click();
  };

  const handleRemoveOnStationDocumentsFile = (index) => {
    const files = Array.from(formValues.onStationDocuments || []);
    files.splice(index, 1);
    const syntheticEvent = { target: { value: files } };
    handleChange("onStationDocuments")(syntheticEvent);
  };

  // Get selected files
  const onStationDocumentsFiles = formValues.onStationDocuments || [];
  const onStationDocumentsFilesCount = onStationDocumentsFiles.length;

  // Document Type options
  const documentTypeOptions = [
    { value: "port_clearance", label: "Port clearance" },
    { value: "arrival_notice", label: "Arrival notice" },
    { value: "on_station_confirmation", label: "On-station confirmation" },
    { value: "authority_approvals", label: "Authority approvals" },
  ];

  // Handle save
  const handleSave = () => {
    // Add your save logic here
  };

  // File upload component renderer
  const renderFileUpload = (
    files,
    filesCount,
    isDragging,
    fileInputRef,
    onDragOver,
    onDragLeave,
    onDrop,
    onBrowseClick,
    onRemoveFile,
    fieldName,
    accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png"
  ) => {
    return (
      <div
        className={`document-upload-zone ${isDragging ? "dragging" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          id={fieldName}
          multiple
          onChange={fieldName === "onStationRequestEmailDocuments" ? handleRequestEmailFileChange : handleOnStationDocumentsFileChange}
          className="file-input-hidden"
          accept={accept}
        />

        {filesCount === 0 ? (
          <div className="upload-zone-content">
            <div className="upload-icon-wrapper">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="4"
                  y="4"
                  width="40"
                  height="40"
                  rx="8"
                  stroke={cardColor || "#00368c"}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />
                <path
                  d="M24 16V32M24 16L18 22M24 16L30 22M12 36H36"
                  stroke={cardColor || "#00368c"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="upload-text-content">
              <p className="upload-main-text">
                Drag & drop files here, or <span className="upload-link">browse</span>
              </p>
              <p className="upload-sub-text">
                Supports: PDF, DOC, DOCX, JPG, PNG (Max 10MB per file)
              </p>
            </div>
          </div>
        ) : (
          <div className="uploaded-files-list">
            <div className="files-header">
              <span className="files-count">{filesCount} file(s) uploaded</span>
              <button
                type="button"
                className="add-more-files-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onBrowseClick();
                }}
              >
                + Add
              </button>
            </div>
            <div className="files-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5 2H11L15 6V16C15 17.1 14.1 18 13 18H5C3.9 18 3 17.1 3 16V4C3 2.9 3.9 2 5 2Z"
                        stroke={cardColor || "#00368c"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M11 2V6H15"
                        stroke={cardColor || "#00368c"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="file-info">
                    <span className="file-name">
                      {file.name || `File ${index + 1}`}
                    </span>
                    <span className="file-size">
                      {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="file-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(index);
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 4L4 12M4 4L12 12"
                        stroke="#999"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form on-station-form">
          <div className="general-info-two-column">
            <div className="general-info-left">
              <FormField label="Document Type" className="cf-field-full">
                <FormSelect
                  value={formValues.onStationDocumentType || ""}
                  onChange={handleChange("onStationDocumentType")}
                  options={documentTypeOptions}
                  placeholder="Select document type..."
                />
              </FormField>

              <FormField label="On Station Documents" className="cf-field-full">
                {renderFileUpload(
                  onStationDocumentsFiles,
                  onStationDocumentsFilesCount,
                  isDraggingOnStationDocuments,
                  onStationDocumentsFileInputRef,
                  handleOnStationDocumentsDragOver,
                  handleOnStationDocumentsDragLeave,
                  handleOnStationDocumentsDrop,
                  handleOnStationDocumentsBrowseClick,
                  handleRemoveOnStationDocumentsFile,
                  "onStationDocuments"
                )}
              </FormField>

              <div className="form-save-button-wrapper">
                <button
                  type="button"
                  className="form-save-button"
                  onClick={handleSave}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="general-info-right">
              <div className="card-description-wrapper">
                <FormField label="Remarks">
                  <ReactQuillEditor
                    value={formValues?.onStationDescription || ""}
                    onChange={handleChange("onStationDescription")}
                    placeholder="Enter remarks..."
                    name="onStationDescription"
                  />
                </FormField>
              </div>
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

OnStationContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default OnStationContent;

