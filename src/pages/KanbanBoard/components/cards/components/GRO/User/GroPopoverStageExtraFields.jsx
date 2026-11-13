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
  existingFile,
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
        {file ? (
          <span className="gro-premium-upload-filename" title={file.name}>
            {file.name}
          </span>
        ) : existingFile ? (
          <a
            className="gro-premium-upload-filename gro-premium-upload-filename--uploaded"
            href={existingFile.file_url}
            target="_blank"
            rel="noopener noreferrer"
            title={existingFile.file_name}
          >
            {existingFile.file_name}
          </a>
        ) : (
          <span className="gro-premium-upload-filename">No file chosen</span>
        )}
      </div>
      {error ? <span className="gro-inward-popover-field-error">{error}</span> : null}
    </div>
  );
}

PopoverFileUploadField.propTypes = {
  label: PropTypes.string.isRequired,
  fieldKey: PropTypes.string.isRequired,
  file: PropTypes.any,
  existingFile: PropTypes.shape({
    file_name: PropTypes.string,
    file_url: PropTypes.string,
  }),
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
  existingFiles,
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
            <span className="gro-inward-popover-label">Remarks *</span>
            <textarea
              className="gro-inward-popover-textarea"
              rows={3}
              placeholder="Enter remarks"
              value={values?.on_hold_reason ?? ""}
              disabled={disabled}
              onChange={(e) => onFieldChange("on_hold_reason", e.target.value)}
            />
            {errors?.on_hold_reason ? (
              <span className="gro-inward-popover-field-error">{errors.on_hold_reason}</span>
            ) : null}
          </div>
        ) : null}
        <PopoverFileUploadField
          label="Crew Immigration"
          fieldKey="immigration_doc"
          file={values?.immigration_doc}
          existingFile={existingFiles?.immigration_doc}
          error={errors?.immigration_doc}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
        />
      </>
    );
  }

  if (stageId === 8) {
    const showFailedReason = values?.custom_inspection_status === GRO_CUSTOM_INSPECTION_STATUS.FAILED;
    return (
      <>
        <PopoverFileUploadField
          label="Inward Clearance Copy"
          fieldKey="inward_clearance_copy"
          file={values?.inward_clearance_copy}
          existingFile={existingFiles?.inward_clearance_copy}
          error={errors?.inward_clearance_copy}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
          required
        />
        <div className={`gro-inward-popover-field${errors?.custom_inspection_status ? " gro-inward-popover-field--error" : ""}`}>
          <span className="gro-inward-popover-label">Customs Status *</span>
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
      </>
    );
  }

  if (stageId === 9) {
    return (
      <>
        <PopoverFileUploadField
          label="Initial Bayan"
          fieldKey="initial_bayan_doc"
          file={values?.initial_bayan_doc}
          existingFile={existingFiles?.initial_bayan_doc}
          error={errors?.initial_bayan_doc}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
          required
        />
        <PopoverFileUploadField
          label="Final Bayan"
          fieldKey="final_bayan_doc"
          file={values?.final_bayan_doc}
          existingFile={existingFiles?.final_bayan_doc}
          error={errors?.final_bayan_doc}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
        />
      </>
    );
  }

  if (stageId === 10) {
    return (
      <>
        <div className={`gro-inward-popover-field${errors?.sadad_no ? " gro-inward-popover-field--error" : ""}`}>
          <span className="gro-inward-popover-label">SADAD No</span>
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
          label="SADAD"
          fieldKey="sadad_doc"
          file={values?.sadad_doc}
          existingFile={existingFiles?.sadad_doc}
          error={errors?.sadad_doc}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
        />
        <div className={`gro-inward-popover-field${errors?.mwp_subscription_sadad_no ? " gro-inward-popover-field--error" : ""}`}>
          <span className="gro-inward-popover-label">MWP Subscription SADAD No</span>
          <input
            type="text"
            className="gro-inward-popover-input"
            placeholder="Enter MWP subscription SADAD no"
            value={values?.mwp_subscription_sadad_no ?? ""}
            disabled={disabled}
            onChange={(e) => onFieldChange("mwp_subscription_sadad_no", e.target.value)}
          />
          {errors?.mwp_subscription_sadad_no ? (
            <span className="gro-inward-popover-field-error">{errors.mwp_subscription_sadad_no}</span>
          ) : null}
        </div>
        <PopoverFileUploadField
          label="MWP Subscription SADAD"
          fieldKey="mwp_subscription_sadad_doc"
          file={values?.mwp_subscription_sadad_doc}
          existingFile={existingFiles?.mwp_subscription_sadad_doc}
          error={errors?.mwp_subscription_sadad_doc}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
        />
        <PopoverFileUploadField
          label="MWP Copy"
          fieldKey="mwp_copy"
          file={values?.mwp_copy}
          existingFile={existingFiles?.mwp_copy}
          error={errors?.mwp_copy}
          disabled={disabled}
          fileInputRefs={fileInputRefs}
          onFileChange={onFileChange}
        />
      </>
    );
  }

  if (stageId === 11) {
    return (
      <PopoverFileUploadField
        label="MWP Subscription Tax Invoice"
        fieldKey="mwp_subscription_tax_invoice"
        file={values?.mwp_subscription_tax_invoice}
        existingFile={existingFiles?.mwp_subscription_tax_invoice}
        error={errors?.mwp_subscription_tax_invoice}
        disabled={disabled}
        fileInputRefs={fileInputRefs}
        onFileChange={onFileChange}
      />
    );
  }

  if (stageId === 13) {
    return (
      <PopoverFileUploadField
        label="Outward Clearance Copy"
        fieldKey="outward_clearance_copy"
        file={values?.outward_clearance_copy}
        existingFile={existingFiles?.outward_clearance_copy}
        error={errors?.outward_clearance_copy}
        disabled={disabled}
        fileInputRefs={fileInputRefs}
        onFileChange={onFileChange}
        required
      />
    );
  }

  if (stageId === 15) {
    return (
      <PopoverFileUploadField
        label="MWP Cancellation"
        fieldKey="mwp_cancellation_doc"
        file={values?.mwp_cancellation_doc}
        existingFile={existingFiles?.mwp_cancellation_doc}
        error={errors?.mwp_cancellation_doc}
        disabled={disabled}
        fileInputRefs={fileInputRefs}
        onFileChange={onFileChange}
        required
      />
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
  existingFiles: PropTypes.objectOf(
    PropTypes.shape({
      file_name: PropTypes.string,
      file_url: PropTypes.string,
    })
  ),
  disabled: PropTypes.bool,
};

export default GroPopoverStageExtraFields;
