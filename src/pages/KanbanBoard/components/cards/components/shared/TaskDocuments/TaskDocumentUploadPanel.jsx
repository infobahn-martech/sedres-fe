import { useRef } from "react";
import PropTypes from "prop-types";
import DateTimePickerField from "../../../../../CardFormTabs/components/DateTimePickerField";

/** Task document upload popover (anchored beside segmented tabs). */
function TaskDocumentUploadPanel({
  anchorRef,
  fileInputRef,
  isOpen,
  onToggle,
  actionLabel = "Task Documents",
  panelTitle = "Task Documents",
  showMainFileUpload = true,
  file,
  onFileChange,
  pickerParts,
  onDateTimeChange,
  timeObjectFields,
  timeObjectsLoading = false,
  extraStageFieldsContent = null,
  onCancel,
  onSubmit,
  isSaving,
  isDisabled,
}) {
  const fallbackFileInputRef = useRef(null);
  const effectiveFileInputRef = fileInputRef ?? fallbackFileInputRef;
  const hasLegacyDateTime = pickerParts != null && typeof onDateTimeChange === "function";
  const hasDynamicTimeFields = Array.isArray(timeObjectFields) && timeObjectFields.length > 0;
  return (
    <div className="gro-inward-anchor" ref={anchorRef}>
      <button
        type="button"
        className={`gro-pass-segment${isOpen ? " gro-pass-segment--popover-open" : ""}`}
        aria-expanded={isOpen}
        disabled={isDisabled}
        onClick={onToggle}
      >
        {actionLabel}
      </button>
      {isOpen ? (
        <div className="gro-inward-popover" role="dialog" aria-label={panelTitle}>
          <div className="gro-inward-popover-header">{panelTitle}</div>
          <div className="gro-inward-popover-body">
            {showMainFileUpload ? (
              <div className="gro-inward-popover-field">
                <span className="gro-inward-popover-label">File upload</span>
                <div className="gro-premium-upload">
                  <input
                    ref={effectiveFileInputRef}
                    id="gro-inward-file-input"
                    type="file"
                    className="gro-premium-upload-input-hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    disabled={isSaving}
                    onChange={onFileChange}
                  />
                  <button
                    type="button"
                    className="gro-premium-upload-btn"
                    disabled={isSaving}
                    onClick={() => effectiveFileInputRef.current?.click()}
                  >
                    Choose file
                  </button>
                  <span className="gro-premium-upload-filename" title={file?.name || ""}>
                    {file?.name || "No file chosen"}
                  </span>
                </div>
              </div>
            ) : null}
            {timeObjectsLoading ? (
              <div className="gro-inward-popover-field">
                <span className="gro-inward-popover-label gro-inward-popover-loading">Loading time fields…</span>
              </div>
            ) : hasDynamicTimeFields ? (
              timeObjectFields.map((field) => (
                  <div
                    key={field.fieldKey}
                    className={`gro-inward-popover-field gro-inward-popover-datetime-full${field.error ? " gro-inward-popover-field--error" : ""}`}
                  >
                    <span className="gro-inward-popover-label">
                      {field.label}
                      {field.isRequired ? " *" : ""}
                    </span>
                    <DateTimePickerField
                      dateValue={field.pickerParts?.date ?? ""}
                      timeValue={field.pickerParts?.time ?? ""}
                      onDateTimeChange={field.onDateTimeChange}
                      placeholder="YYYY-MM-DD hh:mm"
                      popperClassName="gro-inward-datetime-popper"
                      disabled={isSaving}
                      hasError={Boolean(field.error)}
                    />
                    {field.error ? <span className="gro-inward-popover-field-error">{field.error}</span> : null}
                  </div>
              ))
            ) : hasLegacyDateTime ? (
                  <div className="gro-inward-popover-field gro-inward-popover-datetime-full">
                    <span className="gro-inward-popover-label">Date & Time</span>
                    <DateTimePickerField
                      dateValue={pickerParts.date}
                      timeValue={pickerParts.time}
                      onDateTimeChange={onDateTimeChange}
                      placeholder="YYYY-MM-DD hh:mm"
                      popperClassName="gro-inward-datetime-popper"
                    />
                  </div>
                ) : null}
            {extraStageFieldsContent}
          </div>
          <div className="gro-inward-popover-footer">
            <button type="button" className="gro-inward-popover-btn-cancel" disabled={isSaving} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="gro-inward-popover-btn-submit" disabled={isSaving} onClick={onSubmit}>
              {isSaving ? "Saving..." : "Submit"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

TaskDocumentUploadPanel.propTypes = {
  anchorRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  fileInputRef: PropTypes.shape({ current: PropTypes.any }),
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  actionLabel: PropTypes.string,
  panelTitle: PropTypes.string,
  showMainFileUpload: PropTypes.bool,
  file: PropTypes.any,
  onFileChange: PropTypes.func,
  pickerParts: PropTypes.shape({
    date: PropTypes.string,
    time: PropTypes.string,
  }),
  onDateTimeChange: PropTypes.func,
  timeObjectsLoading: PropTypes.bool,
  extraStageFieldsContent: PropTypes.node,
  timeObjectFields: PropTypes.arrayOf(
    PropTypes.shape({
      fieldKey: PropTypes.string.isRequired,
      label: PropTypes.string,
      isRequired: PropTypes.bool,
      pickerParts: PropTypes.shape({
        date: PropTypes.string,
        time: PropTypes.string,
      }),
      onDateTimeChange: PropTypes.func.isRequired,
      error: PropTypes.string,
    })
  ),
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isSaving: PropTypes.bool.isRequired,
  isDisabled: PropTypes.bool.isRequired,
};

export default TaskDocumentUploadPanel;
