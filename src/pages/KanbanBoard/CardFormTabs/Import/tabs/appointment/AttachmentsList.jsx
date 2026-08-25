import PropTypes from "prop-types";

/** Same upload UI as Operation tab (SABER Certificate Upload): drag-and-drop zone + file chips. */
const AttachmentsList = ({
  attachments = [],
  onRemove,
  cardColor,
  isDragging,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  fileInputRef,
  onFileInputChange,
  accept = "*/*",
  multiple = true,
  helperText,
}) => {
  return (
    <div className="attachment-list-wrapper">
      <div>
        <div
          className={`document-upload-zone ${isDragging ? "dragging" : ""}`}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ "--card-color": cardColor || "#00368c" }}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="file-input-hidden"
            accept={accept}
            multiple={multiple}
            onChange={onFileInputChange}
          />
          <div className="upload-zone-content">
            <div className="upload-text-content">
              <p className="upload-main-text">
                Drag and drop your files here, or{" "}
                <span className="upload-link">click to browse</span>
              </p>
              {helperText && <p className="upload-sub-text">{helperText}</p>}
            </div>

            {attachments.length > 0 && (
              <div className="upload-zone-files-list">
                {attachments.map((item, index) => (
                  <div key={index} className="upload-zone-file-item">
                    <span className="upload-zone-file-name">{item.name || item}</span>
                    <button
                      className="upload-zone-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(index);
                      }}
                      type="button"
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

AttachmentsList.propTypes = {
  attachments: PropTypes.array,
  onAdd: PropTypes.func,
  onRemove: PropTypes.func,
  cardColor: PropTypes.string,
  isDragging: PropTypes.bool,
  onDragEnter: PropTypes.func,
  onDragLeave: PropTypes.func,
  onDragOver: PropTypes.func,
  onDrop: PropTypes.func,
  fileInputRef: PropTypes.object,
  onFileInputChange: PropTypes.func,
  accept: PropTypes.string,
  multiple: PropTypes.bool,
  helperText: PropTypes.string,
};

export default AttachmentsList;
