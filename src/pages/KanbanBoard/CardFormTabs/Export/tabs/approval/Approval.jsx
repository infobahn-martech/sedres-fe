  import { useState, useCallback, useEffect, useMemo, useRef } from "react";
  import PropTypes from "prop-types";
  import { debounce } from "lodash";
  import { FiCheckCircle, FiArrowRight, FiClock, FiLoader, FiAlertCircle, FiPauseCircle } from "react-icons/fi";
  import DateTimePickerField from "../../../shared/components/DateTimePickerField";
  import useExportApprovalReducer from "../../../../../../store/ExportApprovalReducer";
  import useAuthReducer from "../../../../../../store/AuthReducer";
  import { ROLE_IDS } from "../../../../../../router/rolePermissions";
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

  const MONTH_ABBR_TO_NUM = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  // basicDetails.date is kept as a display string ("20 Jul 2026") for the
  // free-text input; the API expects plain dates as YYYY-MM-DD like every
  // other date field in this payload, so convert before sending.
  const displayDateToApiDate = (raw) => {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return "";
    const match = trimmed.match(/^(\d{1,2})[\s-/]+([A-Za-z]{3,})[\s-/]+(\d{4})$/);
    if (!match) return trimmed;
    const [, day, monthName, year] = match;
    const month = MONTH_ABBR_TO_NUM[monthName.slice(0, 3).toLowerCase()];
    if (!month) return trimmed;
    return `${year}-${String(month).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
  };

  const getCallId = (card, formValues) =>
    formValues?.call_id ?? formValues?.callId ?? card?.call_id ?? card?.callId ?? null;

  const APPROVAL_STAGE_ORDER = ["credit_controller", "manager_ofm", "ceo"];

  const APPROVAL_STAGE_LABELS = {
    credit_controller: "Credit Controller",
    manager_ofm: "Manager",
    ceo: "CEO",
  };

  // Buttons disable silently with no explanation otherwise — this tells a
  // section's viewer (of any role) which earlier stage still needs to act
  // before this section's own buttons unlock. Sections already passed (stage
  // index before current) or the currently active one get no message; only
  // ones still pending do.
  const getStageWaitMessage = (workflow, stage) => {
    const currentStage = workflow?.current_stage;
    if (!currentStage || currentStage === stage) return null;
    const currentIndex = APPROVAL_STAGE_ORDER.indexOf(currentStage);
    const stageIndex = APPROVAL_STAGE_ORDER.indexOf(stage);
    if (currentIndex === -1 || stageIndex <= currentIndex) return null;
    return `Waiting for ${APPROVAL_STAGE_LABELS[currentStage]} to proceed`;
  };

  // Only the stage workflow.current_stage points at should have live action
  // buttons — earlier stages are already actioned (locked), later stages
  // haven't been reached yet (locked). No workflow data yet (e.g. first
  // load before get_details resolves) defaults to the first stage active;
  // an unrecognized/terminal stage (e.g. fully approved) locks all three.
  const getApprovalStageGating = (workflow) => {
    if (!workflow?.current_stage) {
      return { credit_controller: true, manager_ofm: false, ceo: false };
    }
    const currentIndex = APPROVAL_STAGE_ORDER.indexOf(workflow.current_stage);
    return APPROVAL_STAGE_ORDER.reduce((acc, stage, index) => {
      acc[stage] = index === currentIndex;
      return acc;
    }, {});
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
    branch: formValues?.port_name || formValues?.port || "",
    vesselName: formValues?.vessel_name || card?.name || "",
    vesselEtdDate: "",
    vesselEtdTime: "",
    billingEntity: formValues?.billing_entity || "",
  });

  const buildBasicDetailsPayload = (basicDetails) => ({
    date: displayDateToApiDate(basicDetails.date),
    requested_by: basicDetails.requestedBy || "",
    branch: basicDetails.branch || "",
    vessel_name: basicDetails.vesselName || "",
    vessel_etd: buildApiDateTime(basicDetails.vesselEtdDate, basicDetails.vesselEtdTime),
    billing_entity: basicDetails.billingEntity || "",
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
    creditControllerRemarks,
    creditControllerDocuments,
    managerComments,
    managerDocuments,
    ceoComments,
    ceoDocuments,
    actionOverride,
  }) => {
    const creditControllerAction =
      actionOverride?.section === "credit_controller" ? actionOverride.value : undefined;
    const managerAction = actionOverride?.section === "manager_ofm" ? actionOverride.value : undefined;
    const ceoAction = actionOverride?.section === "ceo" ? actionOverride.value : undefined;

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
    label: PropTypes.string,
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
    disabled,
  }) {
    const secondaryButtonClass =
      secondaryLabel === "On Hold" ? "btn-onhold" : "btn-proceed";

    return (
      <div className="approval-actions">
        <button
          type="button"
          className="action-btn btn-approved"
          onClick={onPrimaryClick}
          disabled={disabled}
        >
          <FiCheckCircle size={22} />
          {primaryLabel}
        </button>

        <button
          type="button"
          className={`action-btn ${secondaryButtonClass}`}
          onClick={onSecondaryClick}
          disabled={disabled}
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
    disabled: PropTypes.bool,
  };

  // Backend accepts multiple files per section (e.g. credit_controller_documents[]
  // can hold more than one upload), so the picker must accumulate files across
  // multiple browse actions rather than replacing the previous selection.
  function DocumentUploadField({ files, onChange, disabled = false }) {
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
              Drag and drop your file here, or{" "}
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
    fieldsDisabled = false,
    stageWaitMessage,
  }) {
    return (
      <section className="approval-form-card approval-party-card approval-action-card">
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
          <ApprovalActionButtons
            primaryLabel={primaryActionLabel}
            secondaryLabel={secondaryActionLabel}
            onPrimaryClick={onPrimaryAction}
            onSecondaryClick={onSecondaryAction}
            disabled={actionsDisabled}
          />
          {stageWaitMessage ? <p className="approval-stage-wait-text">{stageWaitMessage}</p> : null}
        </div>
      </section>
    );
  }

  ApprovalCard.propTypes = {
    title: PropTypes.string.isRequired,
    commentsLabel: PropTypes.string.isRequired,
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
    stageWaitMessage: PropTypes.string,
  };

  function PartySectionCard({ title, fields, values, onChange }) {
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

  function Approval({ card, formValues }) {
    const [basicDetails, setBasicDetails] = useState(() =>
      getInitialBasicDetails(formValues, card)
    );
    const [vesselOwner, setVesselOwner] = useState(createEmptyPartySection);
    const [vesselPrincipal, setVesselPrincipal] = useState(createEmptyPartySection);
    const [vesselCharterer, setVesselCharterer] = useState(createEmptyPartySection);
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
    const isLoadingDetails = useExportApprovalReducer((state) => state.isLoadingDetails);
    const getExportApprovalDetails = useExportApprovalReducer(
      (state) => state.getExportApprovalDetails
    );
    const saveExportApprovalDetails = useExportApprovalReducer(
      (state) => state.saveExportApprovalDetails
    );

    const userRoleId = useAuthReducer((state) => state.profileData?.role?.role_id);
    // Each role owns exactly one section — Port Operator (Credit Controller),
    // Port Manager (Manager - OFM), Port Admin (CEO). Every other role gets
    // all three sections locked (view-only), regardless of workflow stage.
    const isControllerRole = String(userRoleId) === ROLE_IDS.PORT_OPERATOR;
    const isManagerRole = String(userRoleId) === ROLE_IDS.PORT_MANAGER;
    const isCeoRole = String(userRoleId) === ROLE_IDS.PORT_ADMIN;

    const stageActive = useMemo(
      () => getApprovalStageGating(details?.workflow),
      [details?.workflow]
    );
    // CEO's "On Hold" action sets workflow.current_stage to "on_hold" (not one
    // of the three approval stages), which already locks every section via
    // getApprovalStageGating above — this just surfaces that state visibly to
    // every role viewing the tab, not only the CEO who put it on hold.
    const isOnHold = details?.workflow?.current_stage === "on_hold";

    useEffect(() => {
      if (callId) {
        getExportApprovalDetails(callId);
      }
    }, [callId, getExportApprovalDetails]);

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
        branch: basic.branch || "",
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
        return saveExportApprovalDetails(callId, payload, { silent: !actionOverride })
          .then(() => {
            setSaveStatus("saved");
            // Action clicks move the workflow forward server-side — refresh so
            // the tab reflects the new stage/documents. Plain field autosave
            // stays local-only to avoid the form fighting the user's typing.
            if (actionOverride) {
              getExportApprovalDetails(callId);
            }
          })
          .catch(() => {
            setSaveStatus("error");
          });
      },
      [callId, saveExportApprovalDetails, getExportApprovalDetails]
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
      runSave({ section: "credit_controller", value: "approved" });
    }, [debouncedAutoSave, runSave]);

    const handleCreditControllerProceedToOperator = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ section: "credit_controller", value: "proceed_to_operator" });
    }, [debouncedAutoSave, runSave]);

    const handleManagerApproved = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ section: "manager_ofm", value: "approved" });
    }, [debouncedAutoSave, runSave]);

    const handleManagerProceedToCeo = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ section: "manager_ofm", value: "proceed_to_ceo" });
    }, [debouncedAutoSave, runSave]);

    const handleCeoApproved = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ section: "ceo", value: "approved" });
    }, [debouncedAutoSave, runSave]);

    const handleCeoOnHold = useCallback(() => {
      debouncedAutoSave.cancel();
      runSave({ section: "ceo", value: "on_hold" });
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
          {isLoadingDetails ? (
            <div className="text-center text-muted py-4">
              <span className="spinner-border spinner-border-sm me-2" role="status" />
              Loading approval details...
            </div>
          ) : null}
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
                  <FormInput
                    value={basicDetails.branch}
                    onChange={(e) => handleBasicChange("branch", e.target.value)}
                    placeholder="Branch"
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
              />

              <PartySectionCard
                title="Vessel Principal/Manager"
                fields={VESSEL_PRINCIPAL_FIELDS}
                values={vesselPrincipal}
                onChange={handleVesselPrincipalChange}
              />

              <PartySectionCard
                title="Vessel Charterer"
                fields={VESSEL_CHARTERER_FIELDS}
                values={vesselCharterer}
                onChange={handleVesselChartererChange}
              />
            </div>

            <div className="approval-action-cards-row">
              <ApprovalCard
                title="Remarks / Recommendation"
                commentsLabel="Remarks / recommendation from Credit Controller"
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
                actionsDisabled={saveStatus === "saving" || !stageActive.credit_controller || !isControllerRole}
                fieldsDisabled={!isControllerRole}
              />

              <ApprovalCard
                title="Manager - Offshore Marine Logistics Comments"
                commentsLabel="Manager - Offshore Marine Logistics comments"
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
                actionsDisabled={saveStatus === "saving" || !stageActive.manager_ofm || !isManagerRole}
                fieldsDisabled={!isManagerRole}
                stageWaitMessage={getStageWaitMessage(details?.workflow, "manager_ofm")}
              />

              <ApprovalCard
                title="CEO Comments"
                commentsLabel="CEO comments"
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
                actionsDisabled={saveStatus === "saving" || !stageActive.ceo || !isCeoRole}
                fieldsDisabled={!isCeoRole}
                stageWaitMessage={getStageWaitMessage(details?.workflow, "ceo")}
              />
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
  };

  export default Approval;
