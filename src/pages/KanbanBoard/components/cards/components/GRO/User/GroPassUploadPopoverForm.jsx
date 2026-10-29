import PropTypes from "prop-types";
import DateTimePickerField from "../../../../../CardFormTabs/shared/components/DateTimePickerField";

/**
 * Same structure/classes as Inward clearance popover — pass no / datetime / file / footer.
 */
export default function GroPassUploadPopoverForm({
  title,
  passNo,
  onPassNoChange,
  issuePickerParts,
  onIssueDateTimeChange,
  fileInputRef,
  fileName,
  onFileInputChange,
  onCancel,
  onSubmit,
  submitting,
  formLevelError,
  hasIssueDateError,
  datetimePopperClassName,
}) {
  return (
    <div className="gro-inward-popover gro-inward-popover--pass-upload" role="dialog" aria-label={title}>
      <div className="gro-inward-popover-header">{title}</div>
      <form onSubmit={onSubmit}>
        <div className="gro-inward-popover-body">
          <div className="gro-inward-popover-field">
            <span className="gro-inward-popover-label">Pass no</span>
            <input
              type="text"
              className="gro-inward-premium-input gro-pass-upload-passno-input"
              value={passNo}
              disabled={submitting}
              onChange={onPassNoChange}
              autoComplete="off"
            />
          </div>

          <div className="gro-inward-popover-field gro-inward-popover-datetime-full">
            <span className="gro-inward-popover-label">Date & Time</span>
            <DateTimePickerField
              dateValue={issuePickerParts.date}
              timeValue={issuePickerParts.time}
              onDateTimeChange={onIssueDateTimeChange}
              placeholder="YYYY-MM-DD hh:mm"
              disabled={submitting}
              hasError={hasIssueDateError}
              popperClassName={datetimePopperClassName || "gro-pass-upload-datetime-popper"}
            />
          </div>

          <div className="gro-inward-popover-field">
            <span className="gro-inward-popover-label">Document copy</span>
            <div className="gro-premium-upload">
              <input
                ref={fileInputRef}
                type="file"
                className="gro-premium-upload-input-hidden"
                disabled={submitting}
                onChange={onFileInputChange}
              />
              <button type="button" className="gro-premium-upload-btn" disabled={submitting} onClick={() => fileInputRef?.current?.click()}>
                Choose file
              </button>
              <span className="gro-premium-upload-filename" title={fileName || ""}>
                {fileName || "No file chosen"}
              </span>
            </div>
          </div>

          {formLevelError ? <p className="gro-pass-upload-popover-error">{formLevelError}</p> : null}
        </div>
        <div className="gro-inward-popover-footer">
          <button type="button" className="gro-inward-popover-btn-cancel" disabled={submitting} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="gro-inward-popover-btn-submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

GroPassUploadPopoverForm.propTypes = {
  title: PropTypes.string.isRequired,
  passNo: PropTypes.string.isRequired,
  onPassNoChange: PropTypes.func.isRequired,
  issuePickerParts: PropTypes.shape({
    date: PropTypes.string,
    time: PropTypes.string,
  }).isRequired,
  onIssueDateTimeChange: PropTypes.func.isRequired,
  fileInputRef: PropTypes.shape({ current: PropTypes.any }),
  fileName: PropTypes.string,
  onFileInputChange: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  formLevelError: PropTypes.string,
  hasIssueDateError: PropTypes.bool,
  datetimePopperClassName: PropTypes.string,
};
