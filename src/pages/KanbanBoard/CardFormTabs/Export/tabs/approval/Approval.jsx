  import { useState, useCallback, useEffect, useMemo, useRef } from "react";
  import PropTypes from "prop-types";
  import { debounce } from "lodash";
  import { FiCheckCircle, FiArrowRight, FiClock, FiLoader, FiAlertCircle, FiPauseCircle } from "react-icons/fi";
  import DateTimePickerField from "../../../shared/components/DateTimePickerField";
  import { FormSelect } from "../../../Import/tabs/husbandry/components/Husbandry.components";
  import useExportApprovalReducer from "../../../../../../store/ExportApprovalReducer";
  import useAuthReducer from "../../../../../../store/AuthReducer";
  import useAlertReducer from "../../../../../../store/AlertReducer";
  import { splitApiDateTimeParts, buildApiDateTime } from "../../../../../../shared/helpers/dateTimeFieldUtils";
  import "../../../../../../design/scss/general.scss";
  import "../../../../../../design/css/common/CardForm.css";
  import "../../../../../../design/scss/approval.scss";

  const AUTO_SAVE_DEBOUNCE_MS = 1200;

  const formatToday = () =>
    new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatApiDate = (raw) => {
    if (!raw) return "";
    const { date } = splitApiDateTimeParts(raw);
    if (!date) return "";
    const [year, month, day] = date.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getCallId = (card, formValues) =>
    formValues?.call_id ?? formValues?.callId ?? card?.call_id ?? card?.callId ?? null;

  const APPROVAL_STAGE_ORDER = ["credit_controller", "manager_ofm", "ceo"];

  const APPROVAL_STAGE_LABELS = {
    credit_controller: "Credit Controller",
    manager_ofm: "Manager",
    ceo: "CEO",
  };

  // workflow.current_stage from the backend is unreliable — confirmed via a
  // live get_details response where current_stage was null even though the
  // process was clearly mid-flow (credit_controller.status:
  // "proceed_to_operator", manager_ofm.status: "proceed_to_ceo",
  // ceo.status: "on_hold"). The per-section status fields are the only
  // trustworthy signal, so the "current stage" is derived from those instead
  // of trusting workflow.current_stage. Returns null once the process is
  // fully terminal (CEO approved or put on hold) — nobody has an "active"
  // turn at that point.
  const getEffectiveStage = (details) => {
    const ceoStatus = details?.ceo?.status;
    if (ceoStatus === "on_hold" || ceoStatus === "approved") return null;
    if (details?.manager_ofm?.status === "proceed_to_ceo") return "ceo";
    if (details?.credit_controller?.status === "proceed_to_operator") return "manager_ofm";
    return "credit_controller";
  };

  // Buttons disable silently with no explanation otherwise — this tells a
  // section's viewer (of any role) which earlier stage still needs to act
  // before this section's own buttons unlock. Only the stage immediately
  // next in line shows this — e.g. while Credit Controller is still active,
  // the Manager card says "Waiting for Credit Controller" but the CEO card
  // (two steps away) stays silent until it's actually Manager's turn, since
  // a message about a stage that isn't even next yet is just premature noise.
  const getStageWaitMessage = (effectiveStage, stage) => {
    if (!effectiveStage || effectiveStage === stage) return null;
    const currentIndex = APPROVAL_STAGE_ORDER.indexOf(effectiveStage);
    const stageIndex = APPROVAL_STAGE_ORDER.indexOf(stage);
    if (currentIndex === -1 || stageIndex !== currentIndex + 1) return null;
    return `Waiting for ${APPROVAL_STAGE_LABELS[effectiveStage]} to proceed`;
  };

  // Only the effective current stage should have live action buttons —
  // earlier stages are already actioned (locked), later stages haven't been
  // reached yet (locked). A terminal effectiveStage (null — CEO approved or
  // on hold) locks all three.
  const getApprovalStageGating = (effectiveStage) => {
    const currentIndex = APPROVAL_STAGE_ORDER.indexOf(effectiveStage);
    return APPROVAL_STAGE_ORDER.reduce((acc, stage, index) => {
      acc[stage] = index === currentIndex;
      return acc;
    }, {});
  };

  // Distinguishes "hasn't reached this stage yet" from "already moved past
  // it" — stageActive[stage] alone can't tell those apart (both read false),
  // which matters for gating whether a later stage's card should reveal
  // itself yet to a role that hasn't proceeded past their own stage.
  const isStagePassed = (effectiveStage, stage) => {
    // Terminal (CEO approved or on hold) only happens once every earlier
    // stage has already proceeded, so treat it as past everything.
    if (!effectiveStage) return true;
    const currentIndex = APPROVAL_STAGE_ORDER.indexOf(effectiveStage);
    const stageIndex = APPROVAL_STAGE_ORDER.indexOf(stage);
    if (currentIndex === -1 || stageIndex === -1) return false;
    return currentIndex > stageIndex;
  };

const createEmptyPartySection = () => ({
  details: "",
  vesselCountUnderAgency: "",
  outstandingBalanceSoa: "",
  latestPayment: "",
  latestPaymentDate: "",
  latestPaymentTime: "",
});

  const mapPartySection = (section, detailsKey) => {
    if (!section) return createEmptyPartySection();
    const { date, time } = splitApiDateTimeParts(section.latest_payment_received_date);
    return {
      details: section[detailsKey] ?? "",
      vesselCountUnderAgency:
        section.no_of_vessels_chartered != null ? String(section.no_of_vessels_chartered) : "",
      outstandingBalanceSoa:
        section.outstanding_balance_soa != null ? String(section.outstanding_balance_soa) : "",
      latestPayment:
        section.latest_payment_amount != null ? String(section.latest_payment_amount) : "",
      latestPaymentDate: date,
      latestPaymentTime: time,
    };
  };

  const getInitialBasicDetails = (formValues, card) => ({
    date: formatToday(),
    requestedBy: formValues?.requested_by || formValues?.created_by || "",
    branch: "",
    vesselName: formValues?.vessel_name || card?.name || "",
    vesselEtdDate: "",
    vesselEtdTime: "",
    billingEntity: formValues?.billing_entity || "",
  });

  // Per the confirmed API spec, basic_details only accepts branch_id — Date,
  // Requested by, Vessel Name, Vessel's ETD and Billing entity are all
  // read-only display fields in this form and aren't part of this endpoint's
  // save contract, so they're intentionally not sent here.
  const buildBasicDetailsPayload = (basicDetails) => ({
    branch_id: basicDetails.branch || "",
  });

  const buildPartySectionPayload = (values, detailsKey) => ({
    [detailsKey]: values.details || "",
    no_of_vessels_chartered: values.vesselCountUnderAgency || "",
    outstanding_balance_soa: values.outstandingBalanceSoa || "",
    latest_payment_amount: values.latestPayment || "",
    latest_payment_received_date: buildApiDateTime(values.latestPaymentDate, values.latestPaymentTime),
  });

  const buildRoleSectionPayload = (textKey, text, action) => {
    const section = { [textKey]: text || "" };
    if (action) section.action = action;
    return section;
  };

  // Backend requires multipart/form-data always (confirmed via its own error:
  // "requires multipart/form-data ... Send fields as vessel_owner[owner_details]=...,
  // not as a JSON body") — each section must be exploded into PHP-style bracket
  // fields, not JSON-stringified under one key. Gateway strips the Content-Type
  // header for FormData automatically so the browser sets the multipart boundary.
  const appendFormDataSection = (formData, sectionKey, section) => {
    Object.entries(section).forEach(([fieldKey, value]) => {
      formData.append(`${sectionKey}[${fieldKey}]`, value ?? "");
    });
  };

  const buildExportApprovalSavePayload = ({
    callId,
    basicDetails,
    vesselOwner,
    vesselPrincipal,
    vesselCharterer,
    vesselOwnerImages,
    vesselPrincipalImages,
    vesselChartererImages,
    creditControllerRemarks,
    creditControllerDocuments,
    managerComments,
    managerDocuments,
    ceoComments,
    ceoDocuments,
    actionOverride,
  }) => {
    const overrideSections = actionOverride?.sections || {};
    const creditControllerAction = overrideSections.credit_controller;
    const managerAction = overrideSections.manager_ofm;
    const ceoAction = overrideSections.ceo;

    const payload = {
      call_id: callId,
      basic_details: buildBasicDetailsPayload(basicDetails),
      vessel_owner: buildPartySectionPayload(vesselOwner, "owner_details"),
      vessel_principal: buildPartySectionPayload(vesselPrincipal, "principal_details"),
      vessel_charterer: buildPartySectionPayload(vesselCharterer, "charterer_details"),
      credit_controller: buildRoleSectionPayload("remarks", creditControllerRemarks, creditControllerAction),
      manager_ofm: buildRoleSectionPayload("comments", managerComments, managerAction),
      ceo: buildRoleSectionPayload("comments", ceoComments, ceoAction),
    };

    const files = {
      vessel_owner_images: vesselOwnerImages,
      vessel_principal_images: vesselPrincipalImages,
      vessel_charterer_images: vesselChartererImages,
      credit_controller_documents: creditControllerDocuments,
      manager_ofm_documents: managerDocuments,
      ceo_documents: ceoDocuments,
    };

    const formData = new FormData();
    formData.append("call_id", callId == null ? "" : String(callId));
    appendFormDataSection(formData, "basic_details", payload.basic_details);
    appendFormDataSection(formData, "vessel_owner", payload.vessel_owner);
    appendFormDataSection(formData, "vessel_principal", payload.vessel_principal);
    appendFormDataSection(formData, "vessel_charterer", payload.vessel_charterer);
    appendFormDataSection(formData, "credit_controller", payload.credit_controller);
    appendFormDataSection(formData, "manager_ofm", payload.manager_ofm);
    appendFormDataSection(formData, "ceo", payload.ceo);
    Object.entries(files).forEach(([key, fileList]) => {
      (fileList || []).forEach((file) => formData.append(`${key}[]`, file));
    });
    return formData;
  };

  function AutoSaveStatus({ status }) {
    if (status === "saving") {
      return (
        <span className="approval-save-status approval-save-status--saving">
          <FiLoader size={13} className="approval-save-status-spin" /> Saving…
        </span>
      );
    }
    if (status === "saved") {
      return (
        <span className="approval-save-status approval-save-status--saved">
          <FiCheckCircle size={13} /> All changes saved
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="approval-save-status approval-save-status--error">
          <FiAlertCircle size={13} /> Couldn't save changes
        </span>
      );
    }
    return null;
  }

  AutoSaveStatus.propTypes = {
    status: PropTypes.oneOf(["idle", "saving", "saved", "error"]),
  };

  function FormField({ label, children, className = "", fullWidth = false }) {
    return (
      <div
        className={`cf-field approval-field ${fullWidth ? "approval-field--full" : ""} ${className}`.trim()}
      >
        {label ? <label>{label}</label> : null}
        {children}
      </div>
    );
  }

  FormField.propTypes = {
    label: PropTypes.node,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    fullWidth: PropTypes.bool,
  };

  function FormInput({ type = "text", value, onChange, placeholder, readOnly = false }) {
    return (
      <div className="cf-input">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </div>
    );
  }

  FormInput.propTypes = {
    type: PropTypes.string,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    readOnly: PropTypes.bool,
  };

  function FormTextarea({
    value,
    onChange,
    placeholder,
    rows = 4,
    className = "",
    disabled = false,
  }) {
    return (
      <div className={`cf-input approval-textarea-wrap ${className}`.trim()}>
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
        />
      </div>
    );
  }

  FormTextarea.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    rows: PropTypes.number,
    className: PropTypes.string,
    disabled: PropTypes.bool,
  };

  function ApprovalActionButtons({
    primaryLabel,
    secondaryLabel,
    onPrimaryClick,
    onSecondaryClick,
    primaryDisabled,
    secondaryDisabled,
  }) {
    const secondaryButtonClass =
      secondaryLabel === "On Hold" ? "btn-onhold" : "btn-proceed";

    return (
      <div className="approval-actions">
        <button
          type="button"
          className="action-btn btn-approved"
          onClick={onPrimaryClick}
          disabled={primaryDisabled}
        >
          <FiCheckCircle size={22} />
          {primaryLabel}
        </button>

        <button
          type="button"
          className={`action-btn ${secondaryButtonClass}`}
          onClick={onSecondaryClick}
          disabled={secondaryDisabled}
        >
          {secondaryLabel === "On Hold" ? (
            <FiClock size={22} />
          ) : (
            <FiArrowRight size={22} />
          )}
          {secondaryLabel}
        </button>
      </div>
    );
  }

  ApprovalActionButtons.propTypes = {
    primaryLabel: PropTypes.string.isRequired,
    secondaryLabel: PropTypes.string.isRequired,
    onPrimaryClick: PropTypes.func.isRequired,
    onSecondaryClick: PropTypes.func.isRequired,
    primaryDisabled: PropTypes.bool,
    secondaryDisabled: PropTypes.bool,
  };

  function ApprovalStatusBadge({ type, children }) {
    const icon =
      type === "hold" ? (
        <FiPauseCircle size={14} />
      ) : type === "proceeded" ? (
        <FiArrowRight size={14} />
      ) : type === "pending" ? (
        <FiLoader size={14} />
      ) : (
        <FiCheckCircle size={14} />
      );
    return (
      <div className={`approval-status-badge approval-status-badge--${type}`}>
        {icon}
        <span>{children}</span>
      </div>
    );
  }

  ApprovalStatusBadge.propTypes = {
    type: PropTypes.oneOf(["approved", "hold", "proceeded", "pending"]).isRequired,
    children: PropTypes.node.isRequired,
  };

  // Backend accepts multiple files per section (e.g. credit_controller_documents[]
  // can hold more than one upload), so the picker must accumulate files across
  // multiple browse actions rather than replacing the previous selection.
  function DocumentUploadField({ files, onChange, disabled = false, accept, dropzoneText = "Drag and drop your file here, or" }) {
    const inputRef = useRef(null);

    const handleFileChange = (event) => {
      if (disabled) return;
      const picked = Array.from(event.target.files || []);
      if (picked.length === 0) return;
      onChange([...files, ...picked]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    };

    const handleBrowseClick = () => {
      if (disabled) return;
      inputRef.current?.click();
    };

    const handleRemove = (event, index) => {
      event.stopPropagation();
      if (disabled) return;
      onChange(files.filter((_, i) => i !== index));
    };

    return (
      <div className="approval-document-upload approval-upload-field document-upload">
        <div
          className={`approval-document-upload-zone approval-upload-dropzone ${
            files.length > 1 ? "approval-document-upload-zone--multi" : ""
          } ${disabled ? "approval-document-upload-zone--disabled" : ""}`.trim()}
          onClick={handleBrowseClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleBrowseClick();
            }
          }}
          role="button"
          tabIndex={disabled ? -1 : 0}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            disabled={disabled}
            className="approval-file-input-hidden"
            onChange={handleFileChange}
            onClick={(event) => event.stopPropagation()}
          />
          {files.length > 0 ? (
            <div className="approval-document-upload-file-list">
              {files.map((file, index) => (
                <div className="approval-document-upload-file" key={`${file.name}-${file.lastModified}-${index}`}>
                  <span className="approval-document-upload-filename" title={file.name}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="approval-document-upload-remove"
                    onClick={(event) => handleRemove(event, index)}
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="approval-document-upload-text">
              {dropzoneText}{" "}
              <span className="approval-document-upload-link">click to browse</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  DocumentUploadField.propTypes = {
    files: PropTypes.arrayOf(PropTypes.instanceOf(File)).isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    accept: PropTypes.string,
    dropzoneText: PropTypes.string,
  };

  function ExistingDocumentsList({ documents }) {
    if (!documents || documents.length === 0) return null;
    return (
      <ul className="approval-existing-documents">
        {documents.map((doc) => (
          <li key={doc.stage_document_id}>
            <a href={doc.attachment_url} target="_blank" rel="noopener noreferrer">
              {doc.attachment || doc.document_name}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  ExistingDocumentsList.propTypes = {
    documents: PropTypes.arrayOf(
      PropTypes.shape({
        stage_document_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        document_name: PropTypes.string,
        attachment: PropTypes.string,
        attachment_url: PropTypes.string,
      })
    ),
  };

  function ApprovalCard({
    title,
    commentsLabel,
    commentsValue,
    onCommentsChange,
    commentsPlaceholder,
    commentsClassName = "",
    documents,
    onDocumentsChange,
    existingDocuments,
    primaryActionLabel,
    secondaryActionLabel,
    onPrimaryAction,
    onSecondaryAction,
    helperText,
    actionsDisabled,
    primaryDisabled,
    fieldsDisabled = false,
    stageWaitMessage,
    statusBadge,
    hideActions = false,
    isActiveStage = false,
  }) {
    return (
      <section
        className={`approval-form-card approval-party-card approval-action-card ${
          isActiveStage ? "approval-action-card--active" : ""
        }`.trim()}
      >
        <h3 className="form-group-title">{title}</h3>
        <div className="approval-card-body approval-fields-stack">
          <FormField label={commentsLabel}>
            <FormTextarea
              value={commentsValue}
              onChange={onCommentsChange}
              placeholder={commentsPlaceholder}
              rows={3}
              className={commentsClassName}
              disabled={fieldsDisabled}
            />
            {helperText ? <p className="approval-helper-text">{helperText}</p> : null}
          </FormField>
          <FormField label="Document Upload">
            <ExistingDocumentsList documents={existingDocuments} />
            <DocumentUploadField files={documents} onChange={onDocumentsChange} disabled={fieldsDisabled} />
          </FormField>
        </div>
        <div className="approval-card-actions">
          {statusBadge ? (
            <ApprovalStatusBadge type={statusBadge.type}>{statusBadge.text}</ApprovalStatusBadge>
          ) : null}
          {!hideActions ? (
            <ApprovalActionButtons
              primaryLabel={primaryActionLabel}
              secondaryLabel={secondaryActionLabel}
              onPrimaryClick={onPrimaryAction}
              onSecondaryClick={onSecondaryAction}
              primaryDisabled={primaryDisabled !== undefined ? primaryDisabled : actionsDisabled}
              secondaryDisabled={actionsDisabled}
            />
          ) : null}
          {stageWaitMessage ? <p className="approval-stage-wait-text">{stageWaitMessage}</p> : null}
        </div>
      </section>
    );
  }

  ApprovalCard.propTypes = {
    title: PropTypes.string.isRequired,
    commentsLabel: PropTypes.node.isRequired,
    commentsValue: PropTypes.string.isRequired,
    onCommentsChange: PropTypes.func.isRequired,
    commentsPlaceholder: PropTypes.string,
    commentsClassName: PropTypes.string,
    documents: PropTypes.arrayOf(PropTypes.instanceOf(File)).isRequired,
    onDocumentsChange: PropTypes.func.isRequired,
    existingDocuments: ExistingDocumentsList.propTypes.documents,
    primaryActionLabel: PropTypes.string.isRequired,
    secondaryActionLabel: PropTypes.string.isRequired,
    onPrimaryAction: PropTypes.func.isRequired,
    onSecondaryAction: PropTypes.func.isRequired,
    helperText: PropTypes.string,
    fieldsDisabled: PropTypes.bool,
    actionsDisabled: PropTypes.bool,
    primaryDisabled: PropTypes.bool,
    stageWaitMessage: PropTypes.string,
    statusBadge: PropTypes.shape({
      type: PropTypes.oneOf(["approved", "hold", "proceeded", "pending"]).isRequired,
      text: PropTypes.string.isRequired,
    }),
    hideActions: PropTypes.bool,
    isActiveStage: PropTypes.bool,
  };

  function PartySectionCard({ title, fields, values, onChange, imageFiles, onImageFilesChange, imagesDisabled, showImageUpload = true }) {
    return (
      <section className="approval-form-card approval-party-card">
        <h3 className="form-group-title">{title}</h3>
        <div className="approval-card-body approval-fields-stack">
          <FormField label={fields.detailsLabel}>
            <FormTextarea
              value={values.details}
              onChange={(e) => onChange("details", e.target.value)}
              placeholder={fields.detailsPlaceholder}
              rows={3}
            />
          </FormField>
          <FormField label={fields.vesselCountLabel}>
            <FormInput
              value={values.vesselCountUnderAgency}
              onChange={(e) => onChange("vesselCountUnderAgency", e.target.value)}
              placeholder={fields.vesselCountPlaceholder}
            />
          </FormField>
          <FormField label={fields.outstandingLabel}>
            <FormInput
              value={values.outstandingBalanceSoa}
              onChange={(e) => onChange("outstandingBalanceSoa", e.target.value)}
              placeholder={fields.outstandingPlaceholder}
            />
          </FormField>
          <FormField label={fields.latestPaymentLabel}>
            <FormInput
              value={values.latestPayment}
              onChange={(e) => onChange("latestPayment", e.target.value)}
              placeholder={fields.latestPaymentPlaceholder}
            />
          </FormField>
          <FormField label={fields.latestPaymentDateLabel}>
            <DateTimePickerField
              dateValue={values.latestPaymentDate}
              timeValue={values.latestPaymentTime}
              onDateTimeChange={(value) => {
                onChange("latestPaymentDate", value.date);
                onChange("latestPaymentTime", value.time);
              }}
              placeholder="Select date and time"
            />
          </FormField>
          {showImageUpload ? (
            <FormField label="Image Upload">
              <DocumentUploadField
                files={imageFiles}
                onChange={onImageFilesChange}
                disabled={imagesDisabled}
                accept="image/*"
                dropzoneText="Drag and drop your image here, or"
              />
            </FormField>
          ) : null}
        </div>
      </section>
    );
  }

  PartySectionCard.propTypes = {
    title: PropTypes.string.isRequired,
    fields: PropTypes.shape({
      detailsLabel: PropTypes.string.isRequired,
      detailsPlaceholder: PropTypes.string,
      vesselCountLabel: PropTypes.string.isRequired,
      vesselCountPlaceholder: PropTypes.string,
      outstandingLabel: PropTypes.string.isRequired,
      outstandingPlaceholder: PropTypes.string,
      latestPaymentLabel: PropTypes.string.isRequired,
      latestPaymentPlaceholder: PropTypes.string,
      latestPaymentDateLabel: PropTypes.string.isRequired,
    }).isRequired,
    values: PropTypes.shape({
      details: PropTypes.string,
      vesselCountUnderAgency: PropTypes.string,
      outstandingBalanceSoa: PropTypes.string,
      latestPayment: PropTypes.string,
      latestPaymentDate: PropTypes.string,
      latestPaymentTime: PropTypes.string,
    }).isRequired,
    onChange: PropTypes.func.isRequired,
    imageFiles: PropTypes.arrayOf(PropTypes.instanceOf(File)).isRequired,
    onImageFilesChange: PropTypes.func.isRequired,
    imagesDisabled: PropTypes.bool,
    showImageUpload: PropTypes.bool,
  };

  const VESSEL_OWNER_FIELDS = {
    detailsLabel: "Vessel Owner's details",
    detailsPlaceholder: "Enter vessel owner's details",
    vesselCountLabel: "No. of owner's vessel chartered under our agency",
    vesselCountPlaceholder: "Enter number of vessels",
    outstandingLabel: "Vessel Owners Outstanding Balance with SOA",
    outstandingPlaceholder: "Enter outstanding balance",
    latestPaymentLabel: "Latest payment received from vessel owners",
    latestPaymentPlaceholder: "Enter latest payment amount",
    latestPaymentDateLabel: "Latest Payment Received Date",
  };

  const VESSEL_PRINCIPAL_FIELDS = {
    detailsLabel: "Vessel Principal/Manager details",
    detailsPlaceholder: "Enter vessel principal/manager details",
    vesselCountLabel: "No. of vessel Principal/Manager under our agency",
    vesselCountPlaceholder: "Enter number of vessels",
    outstandingLabel: "Vessel Principal/Manager Outstanding Balance with SOA",
    outstandingPlaceholder: "Enter outstanding balance",
    latestPaymentLabel: "Latest payment received from Vessel Principal/Manager",
    latestPaymentPlaceholder: "Enter latest payment amount",
    latestPaymentDateLabel: "Latest Payment Received Date",
  };

  const VESSEL_CHARTERER_FIELDS = {
    detailsLabel: "Owner vessel chartered to / By",
    detailsPlaceholder: "Enter charterer details",
    vesselCountLabel: "Charterer no. of the vessel under our agency",
    vesselCountPlaceholder: "Enter number of vessels",
    outstandingLabel: "Charterers outstanding balance with SOA",
    outstandingPlaceholder: "Enter outstanding balance",
    latestPaymentLabel: "Latest payment received from charterer / client",
    latestPaymentPlaceholder: "Enter latest payment amount",
    latestPaymentDateLabel: "Latest Payment Received Date",
  };

  function Approval({ card, formValues, onWorkflowActionCompleted }) {
    const [basicDetails, setBasicDetails] = useState(() =>
      getInitialBasicDetails(formValues, card)
    );
    const [vesselOwner, setVesselOwner] = useState(createEmptyPartySection);
    const [vesselPrincipal, setVesselPrincipal] = useState(createEmptyPartySection);
    const [vesselCharterer, setVesselCharterer] = useState(createEmptyPartySection);
    const [vesselOwnerImages, setVesselOwnerImages] = useState([]);
    const [vesselPrincipalImages, setVesselPrincipalImages] = useState([]);
    const [vesselChartererImages, setVesselChartererImages] = useState([]);
    const [creditControllerRemarks, setCreditControllerRemarks] = useState("");
    const [creditControllerDocuments, setCreditControllerDocuments] = useState([]);
    const [managerComments, setManagerComments] = useState("");
    const [managerDocuments, setManagerDocuments] = useState([]);
    const [ceoComments, setCeoComments] = useState("");
    const [ceoDocuments, setCeoDocuments] = useState([]);

    // "saving" | "saved" | "error" | "idle" — drives the inline autosave indicator
    const [saveStatus, setSaveStatus] = useState("idle");

    const callId = getCallId(card, formValues);
    const details = useExportApprovalReducer((state) => state.details);
    const branches = useExportApprovalReducer((state) => state.branches);
    const loadingBranches = useExportApprovalReducer((state) => state.loadingBranches);
    const fetchBranches = useExportApprovalReducer((state) => state.fetchBranches);
    const getExportApprovalDetails = useExportApprovalReducer(
      (state) => state.getExportApprovalDetails
    );
    const saveExportApprovalDetails = useExportApprovalReducer(
      (state) => state.saveExportApprovalDetails
    );

    const branchOptions = useMemo(
      () =>
        branches.map((b) => ({
          value: String(b?.invoice_branch_id ?? ""),
          label: b?.branch_name ?? "",
        })),
      [branches]
    );

    const userRoleId = useAuthReducer((state) => state.profileData?.role?.role_id);
    // Each role owns exactly one section — Port Operator (Credit Controller),
    // Port Manager (Manager - OFM), Port Admin (CEO). Every other role gets
    // all three sections locked (view-only), regardless of workflow stage.
    // Manager/Controller/CEO checks use "1"/"2"/"23" directly (not
    // ROLE_IDS.PORT_MANAGER="5" / ROLE_IDS.PORT_OPERATOR="4" /
    // ROLE_IDS.PORT_ADMIN="3") because the user confirmed via live login test
    // that role_id 1 is Port Manager, role_id 2 is Credit Controller, and role_id
    // 23 is CEO in this environment's actual data, which does not match
    // rolePermissions.js's assumed mapping (used app-wide for routing, left
    // untouched here).
    const isControllerRole = String(userRoleId) === "2";
    const isManagerRole = String(userRoleId) === "1";
    // TEMPORARY: role_id "3" (Port Supervisor) is also being let in as CEO
    // for testing, alongside the real CEO role_id "23" — per explicit user
    // request. Remove `|| String(userRoleId) === "3"` once CEO testing
    // is done.
    const isCeoRole = String(userRoleId) === "23" || String(userRoleId) === "3";
    // Vessel party image uploads are restricted to Credit Controller and CEO
    // only, per user confirmation — not Manager, unlike the section gating above.
    const canEditPartyImages = isControllerRole || isCeoRole;

    // CEO's "On Hold" action records ceo.status as "on_hold" — read directly
    // off that section instead of workflow.current_stage, which the backend
    // sends back as null even mid-flow (see getEffectiveStage above).
    const isOnHold = details?.ceo?.status === "on_hold";
    const effectiveStage = useMemo(() => getEffectiveStage(details), [details]);
    const stageActive = useMemo(
      () => getApprovalStageGating(effectiveStage),
      [effectiveStage]
    );
    // While on hold, effectiveStage is null (terminal), so stageActive.ceo
    // alone would lock the CEO out of their own card. The CEO needs to stay
    // able to act — enter values, upload documents, and hit Approved — to
    // resolve the hold; only the "On Hold" button itself should disable once
    // already on hold, since re-clicking it is a no-op.
    const isCeoStageUsable = stageActive.ceo || isOnHold;

    // Only the real Credit Controller can edit this section — DA (and every
    // other role) is view-only here, seeing just the status badge (e.g.
    // "Still processing by Credit Controller") once Controller has
    // approved/proceeded, same as the Manager/CEO cards below.
    const canEditCreditControllerSection = isControllerRole;

    // "Approved" doesn't advance the effective stage (only "proceed_to_*"
    // does), so stageActive alone can't stop the Approved button from being
    // clicked again — check the section's own persisted status instead.
    const creditControllerApproved = details?.credit_controller?.status === "approved";
    const managerApproved = details?.manager_ofm?.status === "approved";
    const ceoApproved = details?.ceo?.status === "approved";

    useEffect(() => {
      if (callId) {
        getExportApprovalDetails(callId);
      }
    }, [callId, getExportApprovalDetails]);

    useEffect(() => {
      fetchBranches();
    }, [fetchBranches]);

    // Skips the very next autosave-triggering effect run — used whenever form
    // state is being programmatically hydrated (initial mount, data reload)
    // rather than typed by the user.
    const skipNextAutoSaveRef = useRef(true);

    useEffect(() => {
      if (!details) return;
      skipNextAutoSaveRef.current = true;

      const basic = details.basic_details || {};
      const { date: vesselEtdDate, time: vesselEtdTime } = splitApiDateTimeParts(
        basic.vessel_etd
      );

      setBasicDetails({
        date: formatApiDate(basic.date) || formatToday(),
        requestedBy: basic.requested_by || "",
        branch: basic.branch_id != null ? String(basic.branch_id) : "",
        vesselName: basic.vessel_name || "",
        vesselEtdDate,
        vesselEtdTime,
        billingEntity: basic.billing_entity || "",
      });
      setVesselOwner(mapPartySection(details.vessel_owner, "owner_details"));
      setVesselPrincipal(mapPartySection(details.vessel_principal, "principal_details"));
      setVesselCharterer(mapPartySection(details.vessel_charterer, "charterer_details"));
      setCreditControllerRemarks(details.credit_controller?.remarks || "");
      setManagerComments(details.manager_ofm?.comments || "");
      setCeoComments(details.ceo?.comments || "");
    }, [details]);

    // Always holds the latest form values so the debounced save (and the
    // action-button saves) read current data without recreating the debounce
    // timer on every keystroke.
    const latestFormRef = useRef(null);
    latestFormRef.current = {
      basicDetails,
      vesselOwner,
      vesselPrincipal,
      vesselCharterer,
      vesselOwnerImages,
      vesselPrincipalImages,
      vesselChartererImages,
      creditControllerRemarks,
      creditControllerDocuments,
      managerComments,
      managerDocuments,
      ceoComments,
      ceoDocuments,
    };

    const runSave = useCallback(
      (actionOverride) => {
        if (!callId) return Promise.resolve();
        const payload = buildExportApprovalSavePayload({
          callId,
          ...latestFormRef.current,
          actionOverride,
        });
        setSaveStatus("saving");
        // A custom successMessage overrides the backend's generic "Saved
        // successfully" toast with action-specific wording — silence the
        // reducer's own toast in that case so only one shows.
        const hasCustomMessage = Boolean(actionOverride?.successMessage);
        return saveExportApprovalDetails(callId, payload, { silent: !actionOverride || hasCustomMessage })
          .then(() => {
            setSaveStatus("saved");
            if (hasCustomMessage) {
              const { success } = useAlertReducer.getState();
              success(actionOverride.successMessage);
            }
            // Action clicks move the workflow forward server-side — refresh so
            // the tab reflects the new stage/documents. Plain field autosave
            // stays local-only to avoid the form fighting the user's typing.
            if (actionOverride) {
              getExportApprovalDetails(callId);
              // CEO's "Approved" flips export_approval_status on the call
              // record itself (a separate endpoint/snapshot CardForm owns,
              // gating the "Operation" tab) — that snapshot has no other
              // reason to refetch while this modal stays open, so nudge the
              // parent to pull a fresh one after any action, not just CEO's,
              // since we can't assume exactly which action the backend keys
              // the flag off of.
              onWorkflowActionCompleted?.();
            }
          })
          .catch(() => {
            setSaveStatus("error");
          });
      },
      [callId, saveExportApprovalDetails, getExportApprovalDetails, onWorkflowActionCompleted]
    );

    const debouncedAutoSave = useMemo(
      () => debounce(() => runSave(), AUTO_SAVE_DEBOUNCE_MS),
      [runSave]
    );

    // Flush (not cancel) on unmount — if the user closes the tab/modal while
    // a debounced autosave is still pending, the edit must still be sent
    // instead of silently dropped.
    useEffect(() => () => debouncedAutoSave.flush(), [debouncedAutoSave]);

    useEffect(() => {
      if (skipNextAutoSaveRef.current) {
        skipNextAutoSaveRef.current = false;
        return;
      }
      debouncedAutoSave();
    }, [
      basicDetails,
      vesselOwner,
      vesselPrincipal,
      vesselCharterer,
      vesselOwnerImages,
      vesselPrincipalImages,
      vesselChartererImages,
      creditControllerRemarks,
      creditControllerDocuments,
      managerComments,
      managerDocuments,
      ceoComments,
      ceoDocuments,
      debouncedAutoSave,
    ]);

    const handleCreditControllerApproved = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ sections: { credit_controller: "approved" } });
    }, [debouncedAutoSave, runSave]);

    const handleCreditControllerProceedToOperator = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ sections: { credit_controller: "proceed_to_operator" } });
    }, [debouncedAutoSave, runSave]);

    const handleManagerApproved = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ sections: { manager_ofm: "approved" } });
    }, [debouncedAutoSave, runSave]);

    const handleManagerProceedToCeo = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ sections: { manager_ofm: "proceed_to_ceo" } });
    }, [debouncedAutoSave, runSave]);

    const handleCeoApproved = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ sections: { ceo: "approved" } });
    }, [debouncedAutoSave, runSave]);

    const handleCeoOnHold = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ sections: { ceo: "on_hold" } });
    }, [debouncedAutoSave, runSave]);

    const handleBasicChange = useCallback((field, value) => {
      setBasicDetails((prev) => ({ ...prev, [field]: value }));
    }, []);

    const handleVesselOwnerChange = useCallback((field, value) => {
      setVesselOwner((prev) => ({ ...prev, [field]: value }));
    }, []);

    const handleVesselPrincipalChange = useCallback((field, value) => {
      setVesselPrincipal((prev) => ({ ...prev, [field]: value }));
    }, []);

    const handleVesselChartererChange = useCallback((field, value) => {
      setVesselCharterer((prev) => ({ ...prev, [field]: value }));
    }, []);

    return (
      <div className="general-tab-content approval-tab-content">
        <div className="cardform-body card-form-panel general-tab-body">
          <div className="approval-sections-wrapper">
            {isOnHold ? (
              <div className="approval-hold-banner">
                <FiPauseCircle size={18} />
                On Hold by CEO — approval is paused until CEO resumes it
              </div>
            ) : null}
            <section className="approval-form-card approval-section--full">
              <div className="approval-section-header">
                <h3 className="form-group-title">Basic Details</h3>
                <AutoSaveStatus status={saveStatus} />
              </div>
              <div className="approval-fields-grid approval-basic-fields-grid">
                <FormField label="Date">
                  <FormInput
                    value={basicDetails.date}
                    onChange={(e) => handleBasicChange("date", e.target.value)}
                    placeholder="DD-MMM-YYYY"
                    readOnly
                  />
                </FormField>
                <FormField label="Requested by">
                  <FormInput
                    value={basicDetails.requestedBy}
                    onChange={(e) => handleBasicChange("requestedBy", e.target.value)}
                    placeholder="Requested by"
                    readOnly
                  />
                </FormField>
                <FormField label="Branch">
                  <FormSelect
                    value={basicDetails.branch}
                    onChange={(e) => handleBasicChange("branch", e.target.value)}
                    options={branchOptions}
                    placeholder={loadingBranches ? "Loading..." : "Select branch..."}
                    disabled={loadingBranches}
                  />
                </FormField>
                <FormField label="Vessel Name">
                  <FormInput
                    value={basicDetails.vesselName}
                    onChange={(e) => handleBasicChange("vesselName", e.target.value)}
                    placeholder="Vessel name"
                    readOnly
                  />
                </FormField>
                <FormField label="Vessel's ETD">
                  <DateTimePickerField
                    dateValue={basicDetails.vesselEtdDate}
                    timeValue={basicDetails.vesselEtdTime}
                    onDateTimeChange={(value) => {
                      setBasicDetails((prev) => ({
                        ...prev,
                        vesselEtdDate: value.date,
                        vesselEtdTime: value.time,
                      }));
                    }}
                    dateFieldName="vessel_etd_date"
                    timeFieldName="vessel_etd_time"
                    placeholder="Select date and time"
                    disabled
                  />
                </FormField>
                <FormField label="Billing entity">
                  <FormInput
                    value={basicDetails.billingEntity}
                    onChange={(e) => handleBasicChange("billingEntity", e.target.value)}
                    placeholder="Billing entity"
                    readOnly
                  />
                </FormField>
              </div>
            </section>

            <div className="approval-party-cards-row">
              <PartySectionCard
                title="Vessel Owner's"
                fields={VESSEL_OWNER_FIELDS}
                values={vesselOwner}
                onChange={handleVesselOwnerChange}
                imageFiles={vesselOwnerImages}
                onImageFilesChange={setVesselOwnerImages}
                imagesDisabled={!canEditPartyImages}
                showImageUpload={false}
              />

              <PartySectionCard
                title="Vessel Principal/Manager"
                fields={VESSEL_PRINCIPAL_FIELDS}
                values={vesselPrincipal}
                onChange={handleVesselPrincipalChange}
                imageFiles={vesselPrincipalImages}
                onImageFilesChange={setVesselPrincipalImages}
                imagesDisabled={!canEditPartyImages}
                showImageUpload={false}
              />

              <PartySectionCard
                title="Vessel Charterer"
                fields={VESSEL_CHARTERER_FIELDS}
                values={vesselCharterer}
                onChange={handleVesselChartererChange}
                imageFiles={vesselChartererImages}
                onImageFilesChange={setVesselChartererImages}
                imagesDisabled={!canEditPartyImages}
                showImageUpload={false}
              />
            </div>

            <div className="approval-action-cards-row">
              <ApprovalCard
                title="Remarks / Recommendation"
                commentsLabel={
                  <>
                    Remarks / recommendation from Credit Controller <span className="text-danger">*</span>
                  </>
                }
                commentsValue={creditControllerRemarks}
                onCommentsChange={(e) => setCreditControllerRemarks(e.target.value)}
                commentsPlaceholder="Enter remarks / recommendation from Credit Controller"
                documents={creditControllerDocuments}
                onDocumentsChange={setCreditControllerDocuments}
                existingDocuments={details?.documents?.credit_controller}
                primaryActionLabel="Approved"
                secondaryActionLabel="Proceed to Manager"
                onPrimaryAction={handleCreditControllerApproved}
                onSecondaryAction={handleCreditControllerProceedToOperator}
                actionsDisabled={
                  saveStatus === "saving" ||
                  !canEditCreditControllerSection ||
                  !creditControllerRemarks.trim()
                }
                primaryDisabled={
                  saveStatus === "saving" ||
                  !canEditCreditControllerSection ||
                  !creditControllerRemarks.trim()
                }
                fieldsDisabled={
                  !canEditCreditControllerSection ||
                  creditControllerApproved ||
                  !stageActive.credit_controller
                }
                stageWaitMessage={getStageWaitMessage(effectiveStage, "credit_controller")}
                statusBadge={
                  creditControllerApproved
                    ? { type: "approved", text: "Approved by Credit Controller" }
                    : !stageActive.credit_controller
                    ? { type: "proceeded", text: "Proceeded to Manager" }
                    : { type: "pending", text: "Still processing by Credit Controller" }
                }
                hideActions={creditControllerApproved || !stageActive.credit_controller}
                isActiveStage={stageActive.credit_controller && canEditCreditControllerSection}
              />

              {/* Nobody — Controller, Manager, CEO (including the TEMPORARY
                  role_id "3" CEO-tester), DA, or generic viewers — sees the
                  Manager card until Credit Controller has actually clicked
                  "Proceed to Manager" (workflow moved past credit_controller).
                  Credit Controller clicking "Approved" alone does not count;
                  effectiveStage only leaves "credit_controller" once its
                  status is "proceed_to_operator" (see getEffectiveStage).
                  Once proceeded, the card becomes visible to everyone, locked
                  (view-only) via the existing fieldsDisabled/actionsDisabled
                  role checks below for anyone who isn't the Manager. */}
              {!stageActive.credit_controller ? (
                <ApprovalCard
                  title="Manager - Offshore Marine Logistics Comments"
                  commentsLabel={
                    <>
                      Manager - Offshore Marine Logistics comments <span className="text-danger">*</span>
                    </>
                  }
                  commentsValue={managerComments}
                  onCommentsChange={(e) => setManagerComments(e.target.value)}
                  commentsPlaceholder="Enter manager comments"
                  commentsClassName="approval-textarea--blue"
                  documents={managerDocuments}
                  onDocumentsChange={setManagerDocuments}
                  existingDocuments={details?.documents?.manager_ofm}
                  primaryActionLabel="Approved"
                  secondaryActionLabel="Proceed to CEO"
                  onPrimaryAction={handleManagerApproved}
                  onSecondaryAction={handleManagerProceedToCeo}
                  helperText="Require Digital Signature of OFM department Manager"
                  actionsDisabled={
                    saveStatus === "saving" || !isManagerRole || !managerComments.trim()
                  }
                  primaryDisabled={
                    saveStatus === "saving" || !isManagerRole || !managerComments.trim()
                  }
                  fieldsDisabled={
                    !isManagerRole ||
                    managerApproved ||
                    isStagePassed(effectiveStage, "manager_ofm")
                  }
                  stageWaitMessage={getStageWaitMessage(effectiveStage, "manager_ofm")}
                  statusBadge={
                    managerApproved
                      ? { type: "approved", text: "Approved by Manager" }
                      : isStagePassed(effectiveStage, "manager_ofm")
                      ? { type: "proceeded", text: "Proceeded to CEO" }
                      : stageActive.manager_ofm
                      ? { type: "pending", text: "Still processing by Manager" }
                      : null
                  }
                  // Non-Manager viewers (CEO, DA, Controller, generic
                  // viewers) never see these buttons at all — only the
                  // "Still processing by Manager" badge/wait text — since
                  // they could never click them anyway (actionsDisabled
                  // already locks them via !isManagerRole); showing greyed
                  // buttons to everyone just read as confusing dead UI.
                  hideActions={
                    !isManagerRole ||
                    managerApproved ||
                    isStagePassed(effectiveStage, "manager_ofm")
                  }
                  isActiveStage={stageActive.manager_ofm && isManagerRole}
                />
              ) : null}

              {/* Same phased reveal as the Manager card above, applied to
                  every non-Controller viewer (Manager, CEO, DA, generic
                  viewers alike): the CEO card only appears once Manager has
                  actually proceeded to CEO (isStagePassed handles the
                  "Manager clicked Approved but didn't proceed" case
                  correctly — that keeps effectiveStage at "manager_ofm", so
                  it stays hidden). Controller never sees it at all. */}
              {!isControllerRole && isStagePassed(effectiveStage, "manager_ofm") ? (
                <ApprovalCard
                  title="CEO Comments"
                  commentsLabel={
                    <>
                      CEO comments <span className="text-danger">*</span>
                    </>
                  }
                  commentsValue={ceoComments}
                  onCommentsChange={(e) => setCeoComments(e.target.value)}
                  commentsPlaceholder="Enter CEO comments"
                  commentsClassName="approval-textarea--blue"
                  documents={ceoDocuments}
                  onDocumentsChange={setCeoDocuments}
                  existingDocuments={details?.documents?.ceo}
                  primaryActionLabel="Approved"
                  secondaryActionLabel="On Hold"
                  onPrimaryAction={handleCeoApproved}
                  onSecondaryAction={handleCeoOnHold}
                  helperText="Require Digital Signature of CEO"
                  actionsDisabled={
                    saveStatus === "saving" ||
                    !stageActive.ceo ||
                    !isCeoRole ||
                    !ceoComments.trim()
                  }
                  // Being on hold locks stageActive.ceo (it's not any of the three
                  // named stages), but the CEO is the one who put it on hold and
                  // must still be able to click Approved to resume — isCeoStageUsable
                  // (stageActive.ceo || isOnHold) covers that case, unlike the
                  // secondary "On Hold" button above which stays locked via
                  // actionsDisabled/stageActive.ceo alone.
                  primaryDisabled={
                    saveStatus === "saving" ||
                    !isCeoRole ||
                    ceoApproved ||
                    !isCeoStageUsable ||
                    !ceoComments.trim()
                  }
                  // ceoApproved locks fields once CEO is done — not isOnHold,
                  // since the CEO must still be able to edit comments/upload
                  // documents while on hold to actually resolve it (same
                  // reasoning as primaryDisabled/isCeoStageUsable above).
                  fieldsDisabled={!isCeoRole || ceoApproved}
                  stageWaitMessage={
                    isOnHold || ceoApproved ? null : getStageWaitMessage(effectiveStage, "ceo")
                  }
                  statusBadge={
                    isOnHold
                      ? { type: "hold", text: "On hold by CEO" }
                      : ceoApproved
                      ? { type: "approved", text: "Approved by CEO" }
                      : null
                  }
                  // Only the terminal "approved" outcome hides the buttons —
                  // on hold must keep both visible/enabled so the CEO can
                  // still click Approved to resume (see primaryDisabled note
                  // above).
                  hideActions={ceoApproved}
                  isActiveStage={isCeoStageUsable && isCeoRole}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  Approval.propTypes = {
    card: PropTypes.shape({
      name: PropTypes.string,
      call_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
    formValues: PropTypes.shape({
      call_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      requested_by: PropTypes.string,
      created_by: PropTypes.string,
      port_name: PropTypes.string,
      port: PropTypes.string,
      vessel_name: PropTypes.string,
      billing_entity: PropTypes.string,
    }),
    onWorkflowActionCompleted: PropTypes.func,
  };

  export default Approval;
