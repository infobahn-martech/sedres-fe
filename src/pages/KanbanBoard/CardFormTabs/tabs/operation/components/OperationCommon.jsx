import { useRef } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { ensureHtmlForQuill } from "../operationReportMessageHtml";
import DateTimePickerField from "../../../components/DateTimePickerField";
import { isEventFieldRequired } from "../operationConstants";
import SearchableSelect, { deriveSearchPlaceholder } from "../../../../../../components/form/SearchableSelect";

export const FormSection = ({ icon, title, children }) => {
  return (
    <>
      {title && (
        <div className="cf-section-header">
          <span className="cf-section-icon">
            <img src={icon} alt={title} />
          </span>
          <span className="cf-section-title">{title}</span>
        </div>
      )}
      <div className="cf-section-body">{children}</div>
    </>
  );
};

FormSection.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export const FormField = ({ label, children, className = "" }) => {
  return (
    <div className={`cf-field ${className}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
};

FormField.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export const OperationFormCard = ({ className = "", children }) => {
  return <div className={`operation-form-card ${className}`.trim()}>{children}</div>;
};

OperationFormCard.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export const DynamicDateTimeFields = ({ eventFields = [], formValues, handleChange, isViewOnly = false }) => {
  if (!eventFields.length) return null;

  return eventFields.map((field) => {
    const keyPrefix = field.keyPrefix;
    const dateKey = `${keyPrefix}Date`;
    const timeKey = `${keyPrefix}Time`;
    const label = isEventFieldRequired(field) ? `${field.event_name} *` : field.event_name;

    return (
      <FormField key={`${field.stage_id || "stage"}-${field.event_name}-${keyPrefix}`} label={label}>
        <DateTimePickerField
          dateValue={formValues[dateKey] || ""}
          timeValue={formValues[timeKey] || ""}
          onDateChange={handleChange(dateKey)}
          onTimeChange={handleChange(timeKey)}
          dateFieldName={dateKey}
          timeFieldName={timeKey}
          disabled={isViewOnly}
        />
      </FormField>
    );
  });
};

DynamicDateTimeFields.propTypes = {
  eventFields: PropTypes.arrayOf(
    PropTypes.shape({
      stage_id: PropTypes.number,
      event_name: PropTypes.string,
      is_required: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
      keyPrefix: PropTypes.string,
    })
  ),
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  isViewOnly: PropTypes.bool,
};

export const FormInput = ({ type = "text", value, onChange, placeholder, className = "", disabled = false }) => {
  return (
    <div className={`cf-input ${className}`}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
};

FormInput.propTypes = {
  type: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export const FormSelect = ({
  value,
  onChange,
  options = [],
  placeholder,
  searchPlaceholder,
  className = "",
  disabled = false,
  hasError = false,
}) => {
  const normalizedValue = value === undefined || value === null ? "" : String(value);
  return (
    <SearchableSelect
      value={normalizedValue}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder ?? deriveSearchPlaceholder(placeholder)}
      className={className}
      disabled={disabled}
      hasError={hasError}
    />
  );
};

FormSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
};

export const FormTextarea = ({ value, onChange, placeholder, className = "", rows = 3, disabled = false }) => {
  return (
    <div className={`cf-textarea ${className}`}>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
      />
    </div>
  );
};

FormTextarea.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  rows: PropTypes.number,
  disabled: PropTypes.bool,
};

const OPERATION_EMAIL_MESSAGE_QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ color: [] }, { background: [] }],
    ["link", "image"],
    ["clean"],
  ],
  clipboard: {
    matchVisual: false,
  },
};

const OPERATION_EMAIL_MESSAGE_QUILL_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "bullet",
  "color",
  "background",
  "link",
  "image",
];

const IconSendReport = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M22 2L11 13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 2L15 22L11 13L2 9L22 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const OperationEmailPreviewPanel = ({
  reportType,
  reportTypeOptions,
  from,
  to,
  cc,
  subject,
  message,
  onChange,
  onReportTypeChange,
  onSend,
  isSending = false,
  isViewOnly = false,
}) => {
  const showSend = !isViewOnly && typeof onSend === "function";

  return (
    <div className="operation-email-preview-panel">
      <div className="operation-email-preview-header">
        <h4>Email Preview</h4>
        <div className="operation-email-preview-header-tools">
          {reportTypeOptions?.length > 0 && (
            <div className="operation-email-report-type">
              <label htmlFor="operation-report-type">Report Type</label>
              <select
                id="operation-report-type"
                value={reportType || reportTypeOptions[0]?.value}
                onChange={(e) => onReportTypeChange?.(e.target.value)}
              >
                {reportTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showSend && (
            <button
              type="button"
              className="operation-email-send-btn"
              onClick={onSend}
              disabled={isSending}
              title={isSending ? "Sending…" : "Save and send report"}
              aria-label={isSending ? "Sending report" : "Save and send report"}
            >
              <IconSendReport />
            </button>
          )}
        </div>
      </div>

      <div className="operation-email-preview-body">
        <FormField label="From">
          <FormInput type="text" value={from || ""} onChange={(e) => onChange?.("from", e.target.value)} placeholder="Sender email" />
        </FormField>
        <FormField label="To">
          <FormInput type="text" value={to || ""} onChange={(e) => onChange?.("to", e.target.value)} placeholder="Recipient emails" />
        </FormField>
        <FormField label="Cc">
          <FormInput type="text" value={cc || ""} onChange={(e) => onChange?.("cc", e.target.value)} placeholder="CC emails" />
        </FormField>
        <FormField label="Subject">
          <FormInput type="text" value={subject || ""} onChange={(e) => onChange?.("subject", e.target.value)} placeholder="Email subject" />
        </FormField>
        <FormField label="Message" className="operation-email-preview-message-field">
          <div className="react-quill-wrapper operation-email-preview-message-quill operation-email-quill">
            <ReactQuill
              theme="snow"
              value={ensureHtmlForQuill(message)}
              onChange={(html) => onChange?.("message", html ?? "")}
              modules={OPERATION_EMAIL_MESSAGE_QUILL_MODULES}
              formats={OPERATION_EMAIL_MESSAGE_QUILL_FORMATS}
              placeholder="Type email content here..."
              readOnly={isViewOnly}
            />
          </div>
        </FormField>
      </div>
    </div>
  );
};

OperationEmailPreviewPanel.propTypes = {
  reportType: PropTypes.string,
  reportTypeOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string,
      label: PropTypes.string,
    })
  ),
  from: PropTypes.string,
  to: PropTypes.string,
  cc: PropTypes.string,
  subject: PropTypes.string,
  message: PropTypes.string,
  attachments: PropTypes.array,
  onChange: PropTypes.func,
  onReportTypeChange: PropTypes.func,
  onSend: PropTypes.func,
  isSending: PropTypes.bool,
  isViewOnly: PropTypes.bool,
};

export const OperationFileUpload = ({
  files = [],
  onAddFiles,
  isViewOnly = false,
  ariaLabel = "Upload files",
  accept,
}) => {
  const inputRef = useRef(null);

  const handleInputChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    const mapped = selectedFiles.map((file) => ({
      name: file.name,
      file,
      size: file.size,
      type: file.type,
    }));
    onAddFiles(mapped);
    e.target.value = "";
  };

  return (
    <div
      className={`operation-compact-upload-zone${isViewOnly ? " operation-compact-upload-zone--disabled" : ""}`}
      role="button"
      tabIndex={isViewOnly ? -1 : 0}
      onClick={() => !isViewOnly && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (isViewOnly) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label={ariaLabel}
    >
      <p className="operation-compact-upload-text">
        Drag and drop your files here, or <span>click to browse</span>
      </p>
      {(files || []).length > 0 && <p className="operation-compact-upload-file">{files[0]?.name || `${files.length} file(s) selected`}</p>}
      <input
        ref={inputRef}
        type="file"
        className="operation-compact-upload-input"
        accept={accept}
        multiple
        onChange={handleInputChange}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
};

OperationFileUpload.propTypes = {
  files: PropTypes.array,
  onAddFiles: PropTypes.func.isRequired,
  isViewOnly: PropTypes.bool,
  ariaLabel: PropTypes.string,
  accept: PropTypes.string,
};

export const OperationSaveSection = ({ isViewOnly = false, onSave, isSaving = false, className = "" }) => {
  if (isViewOnly) return null;

  return (
    <div className={`operation-sticky-actions ${className}`.trim()}>
      <button type="button" className="form-save-button operation-save-button" onClick={onSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save"}
      </button>
    </div>
  );
};

OperationSaveSection.propTypes = {
  isViewOnly: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  isSaving: PropTypes.bool,
  className: PropTypes.string,
};
