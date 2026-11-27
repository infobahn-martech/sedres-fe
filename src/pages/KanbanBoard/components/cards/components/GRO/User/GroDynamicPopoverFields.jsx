import PropTypes from "prop-types";
import { FiClock } from "react-icons/fi";
import DateTimePickerField from "@/pages/KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";
import { PopoverFileUploadField } from "./GroPopoverStageExtraFields";
import { GRO_FIELD_SOURCE, isGroDateTimeFieldType, isGroFileFieldType } from "./groDynamicTaskFields";
import { resolveGroTimeObjectValueKey } from "./groCardUtils";

const FieldShell = ({ label, required, error, className = "", children }) => (
  <div className={`gro-inward-popover-field${className ? ` ${className}` : ""}${error ? " gro-inward-popover-field--error" : ""}`}>
    <span className="gro-inward-popover-label">
      {label}
      {required ? <span className="text-danger"> *</span> : null}
    </span>
    {children}
    {error ? <span className="gro-inward-popover-field-error">{error}</span> : null}
  </div>
);

FieldShell.propTypes = {
  label: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

/** One time-object field (built by GROCardView's buildInwardTimeObjectField). */
export function GroPopoverTimeObjectField({ field, disabled = false }) {
  return (
    <FieldShell
      label={field.label}
      required={field.isRequired}
      error={field.error}
      className="gro-inward-popover-datetime-full"
    >
      <div className="gro-inward-popover-datetime-row">
        <DateTimePickerField
          dateValue={field.pickerParts?.date ?? ""}
          timeValue={field.pickerParts?.time ?? ""}
          onDateTimeChange={field.onDateTimeChange}
          placeholder="DD/MM/YYYY HH:mm"
          popperClassName="gro-inward-datetime-popper"
          disabled={disabled}
          hasError={Boolean(field.error)}
        />
        {field.onCaptureNow ? (
          <button
            type="button"
            className="gro-inward-time-capture-btn"
            title={`Set ${field.label} to now`}
            aria-label={`Set ${field.label} to now`}
            disabled={disabled || field.capturing}
            onClick={field.onCaptureNow}
          >
            <FiClock size={16} />
          </button>
        ) : null}
      </div>
    </FieldShell>
  );
}

GroPopoverTimeObjectField.propTypes = {
  field: PropTypes.object.isRequired,
  disabled: PropTypes.bool,
};

function GroTaskFieldInput({ field, value, error, existingFile, disabled, fileInputRefs, onChange }) {
  const key = field.field_key;
  const type = field.field_type;
  const placeholder = field.placeholder || `Enter ${field.label.toLowerCase()}`;

  if (isGroFileFieldType(type)) {
    return (
      <PopoverFileUploadField
        label={field.label}
        fieldKey={key}
        file={value}
        existingFile={existingFile}
        error={error}
        disabled={disabled}
        fileInputRefs={fileInputRefs}
        onFileChange={onChange}
        required={field.is_required}
      />
    );
  }

  if (isGroDateTimeFieldType(type)) {
    return (
      <FieldShell label={field.label} required={field.is_required} error={error} className="gro-inward-popover-datetime-full">
        <div className="gro-inward-popover-datetime-row">
          <DateTimePickerField
            dateValue={value?.date ?? ""}
            timeValue={value?.time ?? ""}
            onDateTimeChange={({ date, time }) =>
              onChange(key, { date: date || "", time: time ? String(time).slice(0, 5) : "" })
            }
            placeholder="DD/MM/YYYY HH:mm"
            popperClassName="gro-inward-datetime-popper"
            disabled={disabled}
            hasError={Boolean(error)}
          />
        </div>
      </FieldShell>
    );
  }

  if (type === "checkbox" || type === "boolean") {
    return (
      <FieldShell label={field.label} required={field.is_required} error={error}>
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(key, e.target.checked)}
        />
      </FieldShell>
    );
  }

  if (type === "select" || type === "dropdown" || type === "radio" || field.options.length > 0) {
    return (
      <FieldShell label={field.label} required={field.is_required} error={error}>
        <select
          className="gro-inward-popover-select"
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(key, e.target.value)}
        >
          <option value="">{`Select ${field.label.toLowerCase()}`}</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (type === "textarea" || type === "remarks" || type === "longtext") {
    return (
      <FieldShell label={field.label} required={field.is_required} error={error}>
        <textarea
          className="gro-inward-popover-textarea"
          rows={3}
          placeholder={placeholder}
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(key, e.target.value)}
        />
      </FieldShell>
    );
  }

  const inputType = ["number", "date", "time", "email"].includes(type) ? type : "text";
  return (
    <FieldShell label={field.label} required={field.is_required} error={error}>
      <input
        type={inputType}
        className="gro-inward-popover-input"
        placeholder={placeholder}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(key, e.target.value)}
      />
    </FieldShell>
  );
}

GroTaskFieldInput.propTypes = {
  field: PropTypes.object.isRequired,
  value: PropTypes.any,
  error: PropTypes.string,
  existingFile: PropTypes.object,
  disabled: PropTypes.bool,
  fileInputRefs: PropTypes.shape({ current: PropTypes.object }),
  onChange: PropTypes.func.isRequired,
};

/**
 * Renders every popover field from get_call_detail_by_id `task.fields`, in API order:
 * time objects via the time-object state, task fields by their `field_type`.
 */
function GroDynamicPopoverFields({
  order,
  timeObjectFieldsByKey,
  timeObjectsLoading = false,
  values,
  errors,
  existingFiles,
  onChange,
  fileInputRefs,
  disabled = false,
}) {
  if (timeObjectsLoading) {
    return (
      <div className="gro-inward-popover-field">
        <span className="gro-inward-popover-label gro-inward-popover-loading">Loading fields…</span>
      </div>
    );
  }

  return (
    <>
      {(Array.isArray(order) ? order : []).map(({ source, item }) => {
        if (source === GRO_FIELD_SOURCE.TIME_OBJECT) {
          const valueKey = resolveGroTimeObjectValueKey(item);
          const field = timeObjectFieldsByKey?.[valueKey];
          return field ? (
            <GroPopoverTimeObjectField key={`to-${valueKey}`} field={field} disabled={disabled} />
          ) : null;
        }
        const key = item.field_key;
        return (
          <GroTaskFieldInput
            key={`tf-${key}`}
            field={item}
            value={values?.[key]}
            error={errors?.[key]}
            existingFile={existingFiles?.[key]}
            disabled={disabled}
            fileInputRefs={fileInputRefs}
            onChange={onChange}
          />
        );
      })}
    </>
  );
}

GroDynamicPopoverFields.propTypes = {
  order: PropTypes.arrayOf(PropTypes.shape({ source: PropTypes.string, item: PropTypes.object })),
  timeObjectFieldsByKey: PropTypes.object,
  timeObjectsLoading: PropTypes.bool,
  values: PropTypes.object,
  errors: PropTypes.object,
  existingFiles: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  fileInputRefs: PropTypes.shape({ current: PropTypes.object }),
  disabled: PropTypes.bool,
};

export default GroDynamicPopoverFields;
