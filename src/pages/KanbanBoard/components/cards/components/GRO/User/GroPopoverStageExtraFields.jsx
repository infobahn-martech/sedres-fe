import PropTypes from "prop-types";
import {
  GRO_CREW_IMMIGRATION_STATUS,
  GRO_CUSTOM_INSPECTION_STATUS,
  groStageHasExtraFields,
} from "./groStageExtraFields";

function PopoverFileUploadField({
  label,
  fieldKey,
  file,
  error,
  disabled,
  fileInputRefs,
  onFileChange,
  required = false,
}) {
  return (
    <div className={`gro-inward-popover-field${error ? " gro-inward-popover-field--error" : ""}`}>
      <span className="gro-inward-popover-label">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="gro-premium-upload">
        <input
          ref={(el) => {
            if (fileInputRefs?.current) {
              fileInputRefs.current[fieldKey] = el;
            }
          }}
          id={`gro-extra-stage-file-${fieldKey}`}
          type="file"
          className="gro-premium-upload-input-hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          disabled={disabled}
          onChange={(e) => onFileChange(fieldKey, e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="gro-premium-upload-btn"
          disabled={disabled}
          onClick={() => fileInputRefs?.current?.[fieldKey]?.click()}
        >
          Choose file
        </button>
        <span className="gro-premium-upload-filename" title={file?.name || ""}>
          {file?.name || "No file chosen"}
        </span>
      </div>
      {error ? <span className="gro-inward-popover-field-error">{error}</span> : null}
    </div>
  );
}

PopoverFileUploadField.propTypes = {
  label: PropTypes.string.isRequired,
  fieldKey: PropTypes.string.isRequired,
  file: PropTypes.any,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  fileInputRefs: PropTypes.shape({ current: PropTypes.object }),
  onFileChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
};

function GroPopoverStageExtraFields({
  stageId,
  values,
  errors,
  onFieldChange,
  onFileChange,
  fileInputRefs,
  disabled = false,
}) {
  if (!groStageHasExtraFields(stageId)) return null;

  if (stageId === 7) {
    const showOnHoldReason = values?.crew_immigration_status === GRO_CREW_IMMIGRATION_STATUS.ON_HOLD;
    return (
      <>
        <div className={`gro-inward-popover-field${errors?.crew_immigration_status ? " gro-inward-popover-field--error" : ""}`}>
          <span className="gro-inward-popover-label">Crew Immigration Status *</span>
          <select
            className="gro-inward-popover-select"
            value={values?.crew_immigration_status ?? ""}
            disabled={disabled}
            onChange={(e) => onFieldChange("crew_immigration_status", e.target.value)}
          >
            <option value="">Select status</option>
            <option value={GRO_CREW_IMMIGRATION_STATUS.ON_HOLD}>{GRO_CREW_IMMIGRATION_STATUS.ON_HOLD}</option>
            <option value={GRO_CREW_IMMIGRATION_STATUS.COMPLETED}>{GRO_CREW_IMMIGRATION_STATUS.COMPLETED}</option>
          </select>
          {errors?.crew_immigration_status ? (
            <span className="gro-inward-popover-field-error">{errors.crew_immigration_status}</span>
          ) : null}
        </div>
        {showOnHoldReason ? (
          <div className={`gro-inward-popover-field${errors?.on_hold_reason ? " gro-inward-popover-field--error" : ""}`}>
            <span className="gro-inward-popover-label">On Hold Reason *</span>
            <textarea
              className="gro-inward-popover-textarea"
              rows={3}
              placeholder="Enter on hold reason"
              value={values?.on_hold_reason ?? ""}
              disabled={disabled}
              onChange={(e) => onFieldChange("on_hold_reason", e.target.value)}
            />
            {errors?.on_hold_reason ? (
              <span className="gro-inward-popover-field-error">{errors.on_hold_reason}</span>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  if (stageId === 8) {
    return (
      <PopoverFileUploadField
        label="Inward Clearance Copy"
        fieldKey="inward_clearance_copy"
        file={values?.inward_clearance_copy}
        error={errors?.inward_clearance_copy}
        disabled={disabled}
        fileInputRefs={fileInputRefs}
        onFileChange={onFileChange}
        required
      />
    );
  }

  if (stageId === 9) {
    const showFailedReason = values?.custom_inspection_status === GRO_CUSTOM_INSPECTION_STATUS.FAILED;
    return (
      <>
        <div className={`gro-inward-popover-field${errors?.custom_inspection_status ? " gro-inward-popover-field--error" : ""}`}>
          <span className="gro-inward-popover-label">Custom Inspection Status *</span>
          <select
            className="gro-inward-popover-select"
            value={values?.custom_inspection_status ?? ""}
            disabled={disabled}
            onChange={(e) => onFieldChange("custom_inspection_status", e.target.value)}
          >
            <option value="">Select status</option>
            <option value={GRO_CUSTOM_INSPECTION_STATUS.PASSED}>{GRO_CUSTOM_INSPECTION_STATUS.PASSED}</option>
            <option value={GRO_CUSTOM_INSPECTION_STATUS.FAILED}>{GRO_CUSTOM_INSPECTION_STATUS.FAILED}</option>
          </select>
          {errors?.custom_inspection_status ? (
            <span className="gro-inward-popover-field-error">{errors.custom_inspection_status}</span>
          ) : null}
        </div>
        {showFailedReason ? (
          <div className={`gro-inward-popover-field${errors?.failed_reason ? " gro-inward-popover-field--error" : ""}`}>
            <span className="gro-inward-popover-label">Failed Reason *</span>
            <textarea
              className="gro-inward-popover-textarea"
              rows={3}
              placeholder="Enter failed reason"
              value={values?.failed_reason ?? ""}
              disabled={disabled}
              onChange={(e) => onFieldChange("failed_reason", e.target.value)}
            />
            {errors?.failed_reason ? (
              <span className="gro-inward-popover-field-error">{errors.failed_reason}</span>
            ) : null}
          </div>
        ) : null}
        <PopoverFileUploadField
          label="Initial Bayan Doc"
          fieldKey="initial_bayan_doc"
          file={values?.initial_bayan_doc}
          error={errors?.initial_bayan_doc}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
          required
        />
        <PopoverFileUploadField
          label="Final Bayan Doc"
          fieldKey="final_bayan_doc"
          file={values?.final_bayan_doc}
          error={errors?.final_bayan_doc}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
          required
        />
      </>
    );
  }

  if (stageId === 10) {
    return (
      <>
        <PopoverFileUploadField
          label="Inward Clearance Copy"
          fieldKey="inward_clearance_copy"
          file={values?.inward_clearance_copy}
          error={errors?.inward_clearance_copy}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
          required
        />
        <div className={`gro-inward-popover-field${errors?.mwp_application_no ? " gro-inward-popover-field--error" : ""}`}>
          <span className="gro-inward-popover-label">MWP Application No *</span>
          <input
            type="text"
            className="gro-inward-popover-input"
            placeholder="Enter MWP application no"
            value={values?.mwp_application_no ?? ""}
            disabled={disabled}
            onChange={(e) => onFieldChange("mwp_application_no", e.target.value)}
          />
          {errors?.mwp_application_no ? (
            <span className="gro-inward-popover-field-error">{errors.mwp_application_no}</span>
          ) : null}
        </div>
        <div className={`gro-inward-popover-field${errors?.sadad_no ? " gro-inward-popover-field--error" : ""}`}>
          <span className="gro-inward-popover-label">SADAD No *</span>
          <input
            type="text"
            className="gro-inward-popover-input"
            placeholder="Enter SADAD no"
            value={values?.sadad_no ?? ""}
            disabled={disabled}
            onChange={(e) => onFieldChange("sadad_no", e.target.value)}
          />
          {errors?.sadad_no ? (
            <span className="gro-inward-popover-field-error">{errors.sadad_no}</span>
          ) : null}
        </div>
        <PopoverFileUploadField
          label="SADAD Doc"
          fieldKey="sadad_doc"
          file={values?.sadad_doc}
          error={errors?.sadad_doc}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
          required
        />
        <PopoverFileUploadField
          label="MWP Copy"
          fieldKey="mwp_copy"
          file={values?.mwp_copy}
          error={errors?.mwp_copy}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
          required
        />
      </>
    );
  }

  return null;
}

GroPopoverStageExtraFields.propTypes = {
  stageId: PropTypes.number,
  values: PropTypes.object,
  errors: PropTypes.object,
  onFieldChange: PropTypes.func.isRequired,
  onFileChange: PropTypes.func.isRequired,
  fileInputRefs: PropTypes.shape({ current: PropTypes.object }),
  disabled: PropTypes.bool,
};

export default GroPopoverStageExtraFields;
