import PropTypes from "prop-types";
import { useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "../../../../../../design/scss/general.scss";
import "../../../../../../design/css/common/CardForm.css";
import AttachmentIcon from "../../../../../../assets/images/Attachment.svg";
import callFileService from "../../../../../../services/callFileService";
import mailService from "../../../../../../services/mailService";
import portService from "../../../../../../services/portService";
import CommonService from "../../../../../../services/commonService";
import billingEntityService from "../../../../../../services/billingEntityService";
import billingInstructionService from "../../../../../../services/billingInstructionService";
import vesselTypeService from "../../../../../../services/vesselTypeService";
import bargeTypeService from "../../../../../../services/bargeTypeService";
import vesselService from "../../../../../../services/vesselService";
import kpiTasksService from "../../../../../../services/kpiTasksService";
import useCallTaskReducer from "../../../../../../store/CallTaskReducer";
import OperationTasksPanel from "../operation/TaskTab";
import { mapTasksToSections } from "../operation/operationTasksMapper";
import stageTimeMappingService from "../../../../../../services/stageTimeMappingService";
import preArrivalInfoService from "../../../../../../services/preArrivalInfoService";
import {
  unwrapListResponse,
  mapOperatorsToOptions,
  mapPortsToOptions,
  mapCallTypesToOptions,
  mapBillingEntitiesToOptions,
  mapVesselTypesToOptions,
  mapBargeTypesToOptions,
  mergeOptionIfMissing,
} from "../../../../../../shared/helpers/callFileFormOptions";
import { buildCreateCallFileFormData } from "../../../../../../shared/helpers/createCallFilePayload";
import { notify } from "../../../../../../components/Toaster";
import Gateway from "../../../../../../gateway/gateway";
import SearchableSelect, { deriveSearchPlaceholder } from "../../../../../../components/form/SearchableSelect";
import DateTimePickerField from "../../../shared/components/DateTimePickerField";
import {
  extractTextFromFile,
  extractAppointmentDetailsWithGemini,
  formatToApiDateTime,
  normalizeAppointmentDateTime,
} from "../../../../../../shared/helpers/appointmentAiExtractor";
import * as MsgReaderModule from "msgreader";
import { FiDownload, FiEye } from "react-icons/fi";

const openAppointmentEmail = (url) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};

const downloadAppointmentEmail = (url, fileName) => {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "appointment-email";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const splitDateTime = (value) => {
  if (!value) return { date: "", time: "" };
  const normalized = String(value).trim().replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5),
  };
};

const splitApiDateTimeValue = (value) => {
  if (!value) return { date: "", time: "" };
  const normalized = String(value).trim();
  if (!normalized) return { date: "", time: "" };
  const [datePart, timePartRaw = ""] = normalized.replace("T", " ").split(" ");
  const timePart = String(timePartRaw).slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !/^\d{2}:\d{2}$/.test(timePart)) {
    return { date: "", time: "" };
  }
  return { date: datePart, time: timePart };
};

const msgHeadersToText = (headers) => {
  if (!headers) return "";
  if (typeof headers === "string") return headers;
  if (Array.isArray(headers)) {
    return headers.map((part) => String(part ?? "")).join("\n");
  }
  if (typeof headers === "object") {
    return Object.entries(headers)
      .map(([key, val]) => `${key}: ${String(val ?? "")}`)
      .join("\n");
  }
  return String(headers);
};

const extractEmailDateFromHeaders = (headers = "") => {
  const headerText = msgHeadersToText(headers);
  if (!headerText) return "";

  const dateMatch = headerText.match(/^Date:\s*(.+)$/im);
  if (dateMatch?.[1]?.trim()) return dateMatch[1].trim();

  const sentMatch = headerText.match(/^Sent:\s*(.+)$/im);
  return sentMatch?.[1]?.trim() || "";
};

const resolveMsgEmailDate = (msg = {}) => {
  const headerDate = extractEmailDateFromHeaders(
    msg?.headers || msg?.transportMessageHeaders || msg?.messageHeaders || ""
  );

  const candidates = [
    msg?.messageDeliveryTime,
    msg?.clientSubmitTime,
    msg?.creationTime,
    headerDate,
  ];

  for (const candidate of candidates) {
    if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return formatToApiDateTime(candidate);
    }
    const asString = String(candidate ?? "").trim();
    if (asString) return asString;
  }
  return "";
};

const extractFirstEmailFromText = (value = "") => {
  const source = String(value || "");
  const normalized = source.replace(/mailto:/gi, " ");
  const match = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? String(match[0] || "").replace(/[>),;:\s]+$/g, "").trim() : "";
};

const parseSenderFromText = (senderRaw = "") => {
  const fromText = String(senderRaw || "").trim();
  if (!fromText) return { extractedName: "", extractedEmail: "" };

  const emailMatch = fromText.match(/<([^>]+)>/);
  const extractedEmail = emailMatch?.[1]?.trim() || "";

  const extractedName = fromText
    .replace(/<[^>]+>/g, "")
    .replace(/["']/g, "")
    .trim();

  return { extractedName, extractedEmail };
};

const extractFromHeaderFromMsg = (msg = {}) => {
  const headerText = msgHeadersToText(
    msg?.headers || msg?.transportMessageHeaders || msg?.messageHeaders || ""
  );
  if (!headerText) return "";
  const fromMatch = headerText.match(/^From:\s*(.+)$/im);
  return fromMatch?.[1]?.trim() || "";
};

const parseMsgSenderDetails = (msg = {}) => {
  const fromHeader = extractFromHeaderFromMsg(msg);
  const senderCandidates = [msg?.senderName, msg?.from, fromHeader].filter((item) =>
    String(item ?? "").trim()
  );

  let extractedName = "";
  let extractedEmail = "";

  for (const candidate of senderCandidates) {
    const parsed = parseSenderFromText(candidate);
    if (parsed.extractedName && !extractedName) extractedName = parsed.extractedName;
    if (parsed.extractedEmail && !extractedEmail) extractedEmail = parsed.extractedEmail;
    if (extractedName && extractedEmail) break;
  }

  if (!extractedEmail) {
    const emailOnlyCandidates = [
      msg?.senderEmail,
      msg?.senderEmailAddress,
      msg?.senderSmtpAddress,
      msg?.fromEmail,
    ];
    for (const candidate of emailOnlyCandidates) {
      const email = extractFirstEmailFromText(candidate);
      if (email) {
        extractedEmail = email;
        break;
      }
    }
  }

  return { extractedName, extractedEmail };
};

const APPOINTMENT_TYPE_TUG = "tug";
const APPOINTMENT_TYPE_TUG_AND_BARGE = "tug_and_barge";
const APPOINTMENT_TYPE_VESSEL = "vessel";
const APPOINTMENT_TYPE_OPTIONS = [
  { value: APPOINTMENT_TYPE_TUG, label: "Tug" },
  { value: APPOINTMENT_TYPE_TUG_AND_BARGE, label: "Tug and barge" },
  { value: APPOINTMENT_TYPE_VESSEL, label: "Vessel" },
];

// Accepts a scalar, arrays, JSON array strings, or comma-separated strings; returns one option value.
const normalizeAppointmentTypeValue = (raw, fallback = "") => {
  let list = raw;
  if (typeof list === "string") {
    const trimmed = list.trim();
    if (!trimmed) {
      list = [];
    } else if (trimmed.startsWith("[")) {
      try {
        list = JSON.parse(trimmed);
      } catch {
        list = trimmed.split(",");
      }
    } else if (APPOINTMENT_TYPE_OPTIONS.some((o) => o.value === trimmed || o.label.toLowerCase() === trimmed.toLowerCase())) {
      list = [trimmed];
    } else {
      list = trimmed.split(",");
    }
  }
  if (!Array.isArray(list)) list = list === undefined || list === null ? [] : [list];
  const matched = list
    .map((item) => {
      const s = String(item ?? "").trim().toLowerCase();
      if (!s) return null;
      const option = APPOINTMENT_TYPE_OPTIONS.find(
        (o) => o.value === s || o.label.toLowerCase() === s
      );
      return option ? option.value : null;
    })
    .filter(Boolean);
  const unique = [...new Set(matched)];
  if (unique.includes(APPOINTMENT_TYPE_TUG_AND_BARGE)) return APPOINTMENT_TYPE_TUG_AND_BARGE;
  if (unique.includes(APPOINTMENT_TYPE_VESSEL)) return APPOINTMENT_TYPE_VESSEL;
  if (unique.includes(APPOINTMENT_TYPE_TUG)) return APPOINTMENT_TYPE_TUG;
  return fallback;
};

const appointmentTypeShowsTugFields = (value) =>
  value === APPOINTMENT_TYPE_TUG ||
  value === APPOINTMENT_TYPE_TUG_AND_BARGE ||
  value === APPOINTMENT_TYPE_VESSEL;

const appointmentTypeShowsBargeFields = (value) => value === APPOINTMENT_TYPE_TUG_AND_BARGE;

const getDetailAppointmentTypeFallback = (detail) =>
  detail?.barge_type_id || detail?.barge_name || detail?.barge_owner
    ? APPOINTMENT_TYPE_TUG_AND_BARGE
    : APPOINTMENT_TYPE_TUG;

const mapCallDetailToFormFields = (detail) => {
  const appointmentParts = splitDateTime(detail?.appointment_received_date);
  const dailyReportEmail = Array.isArray(detail?.daily_report_emails)
    ? detail.daily_report_emails
      .map((item) => String(item?.id ?? item?.email_id ?? item?.reference ?? "").trim())
      .filter(Boolean)
    : [];
  const billingInstructionEmails = Array.isArray(detail?.billing_instruction_emails)
    ? detail.billing_instruction_emails
      .map((item) => String(item?.id ?? item?.email_id ?? item?.reference ?? "").trim())
      .filter(Boolean)
    : [];

  return {
    callId: detail?.call_id ? String(detail.call_id) : "",
    call_id: detail?.call_id ? String(detail.call_id) : "",
    owner: detail?.owner_id ? String(detail.owner_id) : "",
    assignedOperator: detail?.assigned_operator_id ? String(detail.assigned_operator_id) : "",
    appointmentReceivedDate: appointmentParts.date,
    appointmentReceivedTime: appointmentParts.time,
    port: detail?.port_id ? String(detail.port_id) : "",
    call_type_id: detail?.call_type_id != null ? String(detail.call_type_id) : "",
    typeOfCall: detail?.call_type ? String(detail.call_type) : "",
    mainBillingEntity: detail?.main_billing_entity_id ? String(detail.main_billing_entity_id) : "",
    lastPort: detail?.last_port != null ? String(detail.last_port) : "",
    otherBillingEntity: detail?.other_billing_entity_id ? String(detail.other_billing_entity_id) : "",
    appointmentType: normalizeAppointmentTypeValue(
      detail?.appointment_type,
      getDetailAppointmentTypeFallback(detail)
    ),
    vesselType: detail?.vessel_type_id ? String(detail.vessel_type_id) : "",
    bargeType: detail?.barge_type_id ? String(detail.barge_type_id) : "",
    bargeName: detail?.barge_name ? String(detail.barge_name) : "",
    bargeOwner: detail?.barge_owner ? String(detail.barge_owner) : "",
    vesselName: detail?.vessel_id ? String(detail.vessel_id) : "",
    vesselOwner: detail?.vessel_owner ? String(detail.vessel_owner) : "",
    vesselPrincipal: detail?.vessel_principal ? String(detail.vessel_principal) : "",
    vesselManager: detail?.vessel_manager ? String(detail.vessel_manager) : "",
    serviceRequestorName: detail?.service_requestor_name ? String(detail.service_requestor_name) : "",
    serviceRequestorEmail: detail?.service_requestor_email ? String(detail.service_requestor_email) : "",
    poNumber: detail?.po_number ? String(detail.po_number) : "",
    srtNo: detail?.srt_number ? String(detail.srt_number) : "",
    srtPoWbs: detail?.srt_number ? String(detail.srt_number) : "",
    project: detail?.project_name ? String(detail.project_name) : "",
    dailyReportEmail,
    billingInstructionEmails,
    billingInstructions: detail?.billing_instruction_det
      ? String(detail.billing_instruction_det)
      : detail?.billing_instruction
        ? String(detail.billing_instruction)
        : "",
    cardDescription: detail?.card_description ? String(detail.card_description) : "",
    appointmentEmailName: detail?.appointment_email ? String(detail.appointment_email).trim() : "",
    appointmentEmailUrl: detail?.appointment_email_url ? String(detail.appointment_email_url).trim() : "",
  };
};

const hasMeaningfulDynamicValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const getDynamicFieldFallbackMap = (callDetailData, mappedCallDetail) => ({
  po_number: callDetailData?.po_number ?? mappedCallDetail?.poNumber,
  project_name: callDetailData?.project_name ?? mappedCallDetail?.project,
  project_code: callDetailData?.project_code,
  srt_number: callDetailData?.srt_number ?? mappedCallDetail?.srtNo ?? mappedCallDetail?.srtPoWbs,
});

const hasRenderableEntityFieldValue = (field, callDetailData, entityFieldValues, mappedCallDetail) => {
  const fieldId = field?.field_id;
  const fieldKey = field?.field_key ? String(field.field_key).trim() : "";

  if (hasMeaningfulDynamicValue(entityFieldValues?.[fieldId])) return true;

  if (!fieldKey) return false;

  if (hasMeaningfulDynamicValue(callDetailData?.[fieldKey])) return true;

  const fallbackMap = getDynamicFieldFallbackMap(callDetailData, mappedCallDetail);
  if (hasMeaningfulDynamicValue(fallbackMap[fieldKey])) return true;

  return false;
};

const AppointmentEmailFileActions = ({ fileUrl, fileName }) => {
  const urlMissing = !fileUrl || !String(fileUrl).trim();
  const unavailableTitle = "File URL not available";

  return (
    <div className="appointment-email-file-actions">
      <button
        type="button"
        className="appointment-email-file-action-btn"
        title={urlMissing ? unavailableTitle : "View appointment email"}
        disabled={urlMissing}
        onClick={(e) => {
          e.stopPropagation();
          openAppointmentEmail(fileUrl);
        }}
        aria-label="View appointment email"
      >
        <FiEye size={16} strokeWidth={2.2} aria-hidden />
      </button>
      {/* <button
        type="button"
        className="appointment-email-file-action-btn appointment-email-file-action-btn--download"
        title={urlMissing ? unavailableTitle : "Download appointment email"}
        disabled={urlMissing}
        onClick={(e) => {
          e.stopPropagation();
          downloadAppointmentEmail(fileUrl, fileName);
        }}
        aria-label="Download appointment email"
      >
        <FiDownload size={16} strokeWidth={2.2} aria-hidden />
      </button> */}
    </div>
  );
};

AppointmentEmailFileActions.propTypes = {
  fileUrl: PropTypes.string,
  fileName: PropTypes.string,
};

// Form Components
const FormField = ({ label, children, className = "", hasError = false }) => {
  return (
    <div className={`cf-field ${hasError ? "has-error" : ""} ${className}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
};

FormField.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  hasError: PropTypes.bool,
};

const FormInput = ({ type = "text", value, onChange, placeholder, className = "", readOnly = false, disabled = false, hasError = false }) => {
  return (
    <div className={`cf-input ${hasError ? "is-invalid" : ""} ${className}`}>
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
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
  readOnly: PropTypes.bool,
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
};

const FormSelect = ({
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
      searchPlaceholder={searchPlaceholder}
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

const UserOptionAvatar = ({ avatarUrl, label, className = "" }) => {
  const letterSource = label != null ? String(label).trim() : "";
  const displayLetter = letterSource ? letterSource.charAt(0).toUpperCase() : "U";
  const src = avatarUrl != null && String(avatarUrl).trim();
  const [imgFailed, setImgFailed] = useState(false);

  if (src && !imgFailed) {
    return (
      <div className={`cf-owner-avatar cf-owner-avatar--img ${className}`.trim()}>
        <img src={src} alt="" onError={() => setImgFailed(true)} />
      </div>
    );
  }
  return <div className={`cf-owner-avatar ${className}`.trim()}>{displayLetter}</div>;
};

UserOptionAvatar.propTypes = {
  avatarUrl: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
};

const OwnerField = ({
  label = "Owner",
  value,
  onChange,
  options = [],
  placeholder = "Select owner",
  disabled = false,
  error,
  hasError = false,
}) => {
  const selected = options.find((opt) => String(opt.value) === String(value ?? ""));
  const showErr = hasError || Boolean(error);
  const renderOption = (option) => (
    <div className="cf-searchable-option-with-avatar">
      <UserOptionAvatar avatarUrl={option.avatar} label={option.label} className="cf-owner-avatar--sm" />
      <span>{option.label}</span>
    </div>
  );
  return (
    <FormField label={label} hasError={showErr}>
      <div className={`cf-owner-row ${showErr ? "is-invalid" : ""}`}>
        <UserOptionAvatar avatarUrl={selected?.avatar} label={selected?.label} />
        <SearchableSelect
          value={value === undefined || value === null ? "" : String(value)}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          searchPlaceholder={deriveSearchPlaceholder(placeholder)}
          disabled={disabled}
          hasError={showErr}
          className="cf-owner-searchable-select"
          renderOption={renderOption}
        />
      </div>
      {error ? <div className="cf-field-error">{error}</div> : null}
    </FormField>
  );
};

OwnerField.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      avatar: PropTypes.string,
    })
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  hasError: PropTypes.bool,
};

// Document Upload Component
const DocumentUpload = ({
  attachments = [],
  onAdd,
  onRemove,
  cardColor,
  disabled = false,
  type = "",
  hasError = false,
  allowMultiple = true,
  onMultipleFiles,
  isLoading = false,
  loadingText = "Uploading...",
  fileUrl = "",
  showFileActions = false,
}) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const zoneDisabled = disabled || isLoading;

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (zoneDisabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (zoneDisabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onAdd) {
      if (!allowMultiple) {
        if (files.length > 1 && onMultipleFiles) onMultipleFiles(files);
        onAdd(files[0]);
        return;
      }
      files.forEach(file => onAdd(file));
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && onAdd) {
      if (!allowMultiple) {
        if (files.length > 1 && onMultipleFiles) onMultipleFiles(files);
        onAdd(files[0]);
      } else {
        files.forEach(file => onAdd(file));
      }
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index) => {
    if (onRemove) {
      onRemove(index);
    }
  };

  // When disabled and there are attachments, show only the file list with better UI
  if (disabled && attachments.length > 0) {
    return (
      <div className="document-upload-wrapper">
        <div className="document-file-display-list">
          {attachments.map((file, index) => {
            const displayName = file.name || file;
            return (
              <div key={index} className="appointment-email-file-row document-file-display-item">
                <div className="appointment-email-file-left">
                  <div className="document-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2V8H20"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M16 13H8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M16 17H8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 9H9H8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="appointment-email-file-name document-file-name">{displayName}</span>
                </div>
                {showFileActions && (
                  <AppointmentEmailFileActions fileUrl={fileUrl} fileName={displayName} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Helper function to get file icon based on file type
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconColor = type ? `var(--upload-type-color, #3e5cb6)` : `var(--card-color, #2A00FF)`;

    if (['pdf'].includes(extension)) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M14 2V8H20" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 13H8" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 17H8" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14 2V8H20" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="document-upload-wrapper">
      <div
        className={`document-upload-zone ${type ? `upload-type-${type.toLowerCase().replace(/\s+/g, '-')}` : ""} ${isDragging ? "dragging" : ""} ${hasError ? "has-error" : ""} ${isLoading ? "is-loading" : ""}`}
        onDragEnter={zoneDisabled ? undefined : handleDragEnter}
        onDragOver={zoneDisabled ? undefined : handleDragOver}
        onDragLeave={zoneDisabled ? undefined : handleDragLeave}
        onDrop={zoneDisabled ? undefined : handleDrop}
        onClick={zoneDisabled ? undefined : () => fileInputRef.current?.click()}
        style={{ "--card-color": "#3e5cb6" || "#2A00FF", pointerEvents: zoneDisabled ? "none" : "auto", opacity: zoneDisabled ? 0.6 : 1 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="file-input-hidden"
          multiple={allowMultiple}
          onChange={handleFileInputChange}
          disabled={zoneDisabled}
        />
        <div className="upload-zone-content">
          {isLoading ? (
            <div className="document-upload-loading-state">
              <span className="document-upload-spinner" aria-hidden="true" />
              <p className="upload-main-text">{loadingText}</p>
            </div>
          ) : (
            <>
              <div className="upload-icon-wrapper">
              </div>
              <div className="upload-text-content">
                <p className="upload-main-text">
                  Drag and drop your files here, or{" "}
                  <span className="upload-link">click to browse</span>
                </p>
                {/* <p className="upload-sub-text">Supports all file formats</p> */}
              </div>
            </>
          )}
        </div>
      </div>

      {/* File Preview List - Shows below upload zone */}
      {attachments.length > 0 && (
        <div className="document-file-preview-list">
          {attachments.map((file, index) => {
            const displayName = file.name || file;
            return (
              <div
                key={index}
                className={`document-file-preview-item ${showFileActions ? "appointment-email-file-row appointment-email-file-row--preview" : ""}`}
              >
                {showFileActions ? (
                  <div className="appointment-email-file-left">
                    <div className="document-file-preview-icon">
                      {getFileIcon(displayName)}
                    </div>
                    <span className="appointment-email-file-name document-file-preview-name">{displayName}</span>
                  </div>
                ) : (
                  <>
                    <div className="document-file-preview-icon">
                      {getFileIcon(displayName)}
                    </div>
                    <div className="document-file-preview-info">
                      <span className="document-file-preview-name">{displayName}</span>
                      <span className="document-file-preview-size">{formatFileSize(file.size)}</span>
                    </div>
                  </>
                )}
                {showFileActions && (
                  <AppointmentEmailFileActions fileUrl={fileUrl} fileName={displayName} />
                )}
                {!disabled && (
                  <button
                    className="document-file-preview-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                    type="button"
                    title="Remove file"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

DocumentUpload.propTypes = {
  attachments: PropTypes.array,
  onAdd: PropTypes.func,
  onRemove: PropTypes.func,
  cardColor: PropTypes.string,
  disabled: PropTypes.bool,
  type: PropTypes.string,
  hasError: PropTypes.bool,
  allowMultiple: PropTypes.bool,
  onMultipleFiles: PropTypes.func,
  isLoading: PropTypes.bool,
  loadingText: PropTypes.string,
  fileUrl: PropTypes.string,
  showFileActions: PropTypes.bool,
};

// Multi-Select Email Component
const MultiSelectEmail = ({ value = [], onChange, options = [], placeholder, onAddNew, disabled = false, name = "dailyReportEmail", hasError = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [isAddingNewEmail, setIsAddingNewEmail] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuPortalRef = useRef(null);
  const [portalMenuBox, setPortalMenuBox] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 320,
  });

  const updatePortalMenuPosition = useCallback(() => {
    if (!isOpen) return;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const viewportPad = 8;
    const maxMenu = 320;
    const spaceAbove = rect.top - gap - viewportPad;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
    const placeTop = spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableSpace = placeTop ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(maxMenu, Math.max(120, availableSpace));
    const top = placeTop ? Math.max(viewportPad, rect.top - gap - maxHeight) : rect.bottom + gap;

    setPortalMenuBox({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    updatePortalMenuPosition();
    const rafId = requestAnimationFrame(updatePortalMenuPosition);
    const onScrollOrResize = () => updatePortalMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [isOpen, updatePortalMenuPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isAddingNewEmail) return;
      const target = event.target;
      if (dropdownRef.current?.contains(target)) return;
      if (menuPortalRef.current?.contains(target)) return;
      setIsOpen(false);
      setShowAddInput(false);
      setFilterQuery("");
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAddingNewEmail]);

  const valuesEqual = (a, b) => String(a) === String(b);
  const valueToLabel = (val) => {
    const opt = options.find((o) => valuesEqual(o.value, val));
    return opt?.label ?? String(val);
  };

  useEffect(() => {
    if (!isOpen) setFilterQuery("");
  }, [isOpen]);

  const filterPlaceholder = useMemo(() => deriveSearchPlaceholder(placeholder), [placeholder]);

  const filteredOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, filterQuery]);

  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

  const pushSelectedValue = (optionValue) => {
    if (selectedValues.some((v) => valuesEqual(v, optionValue))) return;
    const syntheticEvent = {
      target: { value: [...selectedValues, optionValue], name }
    };
    onChange(syntheticEvent);
  };

  const handleToggle = (optionValue) => {
    const newValue = selectedValues.some((v) => valuesEqual(v, optionValue))
      ? selectedValues.filter((e) => !valuesEqual(e, optionValue))
      : [...selectedValues, optionValue];

    const syntheticEvent = {
      target: { value: newValue, name }
    };
    onChange(syntheticEvent);
  };

  const handleAddNewEmail = async () => {
    const email = newEmail.trim();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!email || !isValid || isAddingNewEmail) return;

    const selectedAlready = selectedValues.some((entry) => String(entry).trim().toLowerCase() === email.toLowerCase());
    if (selectedAlready) {
      setNewEmail("");
      setShowAddInput(false);
      return;
    }

    const existingOption = options.find((opt) => {
      const label = String(opt?.label ?? "").trim().toLowerCase();
      const rawValue = String(opt?.value ?? "").trim().toLowerCase();
      return label === email.toLowerCase() || rawValue === email.toLowerCase();
    });

    if (existingOption) {
      pushSelectedValue(existingOption.value);
      setNewEmail("");
      setShowAddInput(false);
      return;
    }

    try {
      setIsAddingNewEmail(true);
      pushSelectedValue(email);
      if (onAddNew) {
        await Promise.resolve(onAddNew(email));
      }
      setNewEmail("");
      setShowAddInput(false);
      setIsOpen(true);
    } finally {
      setIsAddingNewEmail(false);
    }
  };

  const handleRemoveEmail = (rawVal, e) => {
    e.stopPropagation();
    const newValue = selectedValues.filter((entry) => !valuesEqual(entry, rawVal));
    const syntheticEvent = {
      target: { value: newValue, name }
    };
    onChange(syntheticEvent);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddNewEmail();
    } else if (e.key === "Escape") {
      setNewEmail("");
      setShowAddInput(false);
    }
  };

  const dropdownPanel = (
    <div
      ref={menuPortalRef}
      className="cf-multi-select-dropdown cf-multi-select-dropdown--filterable cf-multi-select-dropdown--portal cf-searchable-select__menu-portal"
      style={{
        position: "fixed",
        top: portalMenuBox.top,
        left: portalMenuBox.left,
        width: portalMenuBox.width,
        maxWidth: portalMenuBox.width,
        minWidth: 0,
        right: "auto",
        margin: 0,
        maxHeight: portalMenuBox.maxHeight,
        zIndex: 13000,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div className="cf-multi-select-filter" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          className="cf-multi-select-filter-input"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder={filterPlaceholder}
          autoComplete="off"
        />
      </div>
      <div className="cf-multi-select-results">
        <div className="cf-multi-select-options-scroll">
          {filteredOptions.length === 0 ? (
            <div className="cf-multi-select-no-results">No results found</div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = selectedValues.some((v) => valuesEqual(v, option.value));
              return (
                <div
                  key={String(option.value)}
                  className={`cf-multi-select-option ${isSelected ? "selected" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleToggle(option.value);
                  }}
                >
                  <span className="cf-multi-select-checkbox">
                    {isSelected && "✓"}
                  </span>
                  <span>{option.label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="cf-multi-select-footer" onMouseDown={(e) => e.stopPropagation()}>
        {!showAddInput ? (
          <div
            className="cf-multi-select-option add-new"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowAddInput(true);
              setNewEmail("");
            }}
          >
            <span>+ Add New Email</span>
          </div>
        ) : (
          <div className="cf-multi-select-add-input" onMouseDown={(e) => e.stopPropagation()}>
            <input
              type="email"
              placeholder="Enter email address..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={handleKeyPress}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              className="cf-add-email-btn"
              onClick={handleAddNewEmail}
              disabled={isAddingNewEmail || !newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())}
            >
              {isAddingNewEmail ? "..." : "✓"}
            </button>
            <button
              type="button"
              className="cf-cancel-email-btn"
              disabled={isAddingNewEmail}
              onClick={() => {
                setNewEmail("");
                setShowAddInput(false);
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`cf-multi-select-email ${disabled ? "disabled" : ""} ${hasError ? "has-error" : ""}`} ref={dropdownRef}>
      <div
        ref={triggerRef}
        className={`cf-multi-select-email-input ${disabled ? "disabled" : ""} ${hasError ? "has-error" : ""}`}
        onClick={disabled ? undefined : () => setIsOpen(!isOpen)}
        style={{ pointerEvents: disabled ? "none" : "auto" }}
      >
        <div className="cf-multi-select-email-tags">
          {selectedValues.length > 0 ? (
            selectedValues.map((entryVal) => (
              <span key={String(entryVal)} className="cf-email-tag">
                {valueToLabel(entryVal)}
                {!disabled && (
                  <button
                    type="button"
                    className="cf-email-tag-remove"
                    onClick={(e) => handleRemoveEmail(entryVal, e)}
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="cf-multi-select-placeholder">{placeholder || "Select emails..."}</span>
          )}
        </div>
        <span className="cf-multi-select-arrow">▼</span>
      </div>
      {isOpen && typeof document !== "undefined" && createPortal(dropdownPanel, document.body)}
    </div>
  );
};

MultiSelectEmail.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  onAddNew: PropTypes.func,
  disabled: PropTypes.bool,
  name: PropTypes.string,
  hasError: PropTypes.bool,
};

// Generic multi-select with checkbox options (no add-new footer / filter).
const MultiSelectField = ({ value = [], onChange, options = [], placeholder, disabled = false, name, hasError = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const valuesEqual = (a, b) => String(a) === String(b);
  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
  const valueToLabel = (val) => options.find((o) => valuesEqual(o.value, val))?.label ?? String(val);

  const handleToggle = (optionValue) => {
    const newValue = selectedValues.some((v) => valuesEqual(v, optionValue))
      ? selectedValues.filter((entry) => !valuesEqual(entry, optionValue))
      : [...selectedValues, optionValue];
    onChange({ target: { value: newValue, name } });
  };

  const handleRemove = (rawVal, e) => {
    e.stopPropagation();
    onChange({ target: { value: selectedValues.filter((entry) => !valuesEqual(entry, rawVal)), name } });
  };

  return (
    <div className={`cf-multi-select-email ${disabled ? "disabled" : ""} ${hasError ? "has-error" : ""}`} ref={dropdownRef}>
      <div
        className={`cf-multi-select-email-input ${disabled ? "disabled" : ""} ${hasError ? "has-error" : ""}`}
        onClick={disabled ? undefined : () => setIsOpen((prev) => !prev)}
      >
        <div className="cf-multi-select-email-tags">
          {selectedValues.length > 0 ? (
            selectedValues.map((entryVal) => (
              <span key={String(entryVal)} className="cf-email-tag">
                {valueToLabel(entryVal)}
                {!disabled && (
                  <button
                    type="button"
                    className="cf-email-tag-remove"
                    onClick={(e) => handleRemove(entryVal, e)}
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="cf-multi-select-placeholder">{placeholder || "Select..."}</span>
          )}
        </div>
        <span className="cf-multi-select-arrow">▼</span>
      </div>
      {isOpen && !disabled && (
        <div className="cf-multi-select-dropdown">
          <div className="cf-multi-select-results">
            <div className="cf-multi-select-options-scroll">
              {options.map((option) => {
                const isSelected = selectedValues.some((v) => valuesEqual(v, option.value));
                return (
                  <div
                    key={String(option.value)}
                    className={`cf-multi-select-option ${isSelected ? "selected" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleToggle(option.value);
                    }}
                  >
                    <span className="cf-multi-select-checkbox">
                      {isSelected && "✓"}
                    </span>
                    <span>{option.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

MultiSelectField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  name: PropTypes.string,
  hasError: PropTypes.bool,
};

const createQuillImageUploadHandler = (quillRef) => () => {
  const input = document.createElement("input");
  input.setAttribute("type", "file");
  input.setAttribute("accept", "image/*");
  input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image_file", file);

    try {
      const response = await Gateway.post("/report_template/upload_image", formData);
      const fileUrl = response?.data?.file_url ?? response?.data?.data?.file_url;

      if (fileUrl) {
        const quill = quillRef.current?.getEditor();
        const range = quill?.getSelection(true);
        quill.insertEmbed(range?.index ?? 0, "image", fileUrl, "user");
        quill.setSelection((range?.index ?? 0) + 1);
      }
    } catch (error) {
      console.error("Image upload failed:", error);
      notify("Image upload failed.", "error");
    }
  };
};

const buildQuillModules = (toolbar, quillRef) => {
  const flatToolbar = toolbar.flat(Infinity);
  if (!flatToolbar.includes("image")) {
    return { toolbar };
  }

  return {
    toolbar: {
      container: toolbar,
      handlers: {
        image: createQuillImageUploadHandler(quillRef),
      },
    },
  };
};

// React Quill Editor Component
const ReactQuillEditor = ({ value, onChange, placeholder }) => {
  const quillRef = useRef(null);

  const toolbar = useMemo(
    () => [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      ["link", "image"],
      ["clean"],
    ],
    []
  );

  const modules = useMemo(() => buildQuillModules(toolbar, quillRef), [toolbar]);

  const formats = [
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

  const handleChange = (content) => {
    const syntheticEvent = { target: { value: content, name: "cardDescription" } };
    onChange(syntheticEvent);
  };

  return (
    <div className="react-quill-wrapper">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ""}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || "Enter card description..."}
      />
    </div>
  );
};

ReactQuillEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

// Daily Task/Todo Component
const DailyTaskTodo = ({ tasks = [], accentColor, isLoading = false, error = "" }) => {
  const normalizedTasks = Array.isArray(tasks) ? tasks : [];
  const completedCount = normalizedTasks.filter((t) => String(t?.status || "").toUpperCase() === "COMPLETED").length;
  const totalCount = normalizedTasks.length;

  const formatTaskDateTime = (value) => {
    if (!value) return "";
    const normalized = String(value).trim().replace(" ", "T");
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="daily-task-todo-wrapper">
      <FormField label="Daily Tasks / Todo">
        <div className="daily-task-container">
          <div className="daily-task-list-scroll" aria-label="Task list">
            <div className="daily-task-list">
              {isLoading ? (
                <div className="daily-task-empty">
                  <p>Loading tasks...</p>
                </div>
              ) : error ? (
                <div className="daily-task-empty">
                  <p>{error}</p>
                </div>
              ) : normalizedTasks.length === 0 ? (
                <div className="daily-task-empty">
                  <p>No KPI tasks available.</p>
                </div>
              ) : (
                normalizedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="daily-task-item"
                  >
                    <div className="daily-task-checkbox-display">
                      <div
                        className="daily-task-checkbox-icon checked"
                        style={{ backgroundColor: task.statusColor || accentColor || "#1f7aec" }}
                      >
                        <span style={{ color: "#fff", fontSize: "10px", lineHeight: 1 }}>•</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                      <span className="daily-task-text">{task.text}</span>
                      <div style={{ fontSize: "11px", color: "#666" }}>
                        {task.startTime && <span>Start: {formatTaskDateTime(task.startTime)}</span>}
                        {task.dueTime && <span> | Due: {formatTaskDateTime(task.dueTime)}</span>}
                        {task.completedTime && <span> | Completed: {formatTaskDateTime(task.completedTime)}</span>}
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: task.statusColor || "#666" }}>
                        {task.status || "PENDING"}
                        {task.delayText ? ` - ${task.delayText}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {normalizedTasks.length > 0 && (
            <div className="daily-task-summary">
              <span className="daily-task-summary-text">
                {completedCount} of {totalCount} completed
              </span>
              <div className="daily-task-progress-bar">
                <div
                  className="daily-task-progress-fill"
                  style={{
                    width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </FormField>
    </div>
  );
};

DailyTaskTodo.propTypes = {
  tasks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      text: PropTypes.string.isRequired,
      status: PropTypes.string,
      statusColor: PropTypes.string,
      startTime: PropTypes.string,
      dueTime: PropTypes.string,
      completedTime: PropTypes.string,
      delayText: PropTypes.string,
    })
  ),
  accentColor: PropTypes.string,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
};

const GeneralViewSectionShimmer = () => (
  <div className="general-info-three-column general-info-view-with-tasks general-tab-form-layout general-view-section-shimmer" aria-live="polite">
    <div className="general-info-left">
      <div className="general-view-form-scroll">
        <div className="general-shimmer-section">
          <div className="general-shimmer-line general-shimmer-line--heading" />
          <div className="general-shimmer-line general-shimmer-line--input" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
        </div>
        <div className="general-shimmer-section">
          <div className="general-shimmer-line general-shimmer-line--heading" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
        </div>
      </div>
    </div>
    <div className="general-info-middle">
      <div className="general-shimmer-panel">
        <div className="general-shimmer-line general-shimmer-line--heading" />
        <div className="general-shimmer-line general-shimmer-line--card" />
        <div className="general-shimmer-line general-shimmer-line--card" />
      </div>
    </div>
    <div className="general-info-right">
      <div className="general-shimmer-panel">
        <div className="general-shimmer-line general-shimmer-line--heading" />
        <div className="general-shimmer-line general-shimmer-line--card" />
        <div className="general-shimmer-line general-shimmer-line--card" />
      </div>
    </div>
  </div>
);


// Helper function to format date and time
const formatDateTime = (date, time) => {
  if (!date && !time) return "Not set";
  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const timeStr = time || '';
  return dateStr && timeStr ? `${dateStr} at ${timeStr}` : dateStr || timeStr || "Not set";
};

// Helper function to get status date/time from card/formValues
const getStatusDateTime = (card, formValues, statusKey) => {
  // Map status keys to potential date/time fields in card or formValues
  const dateTimeMap = {
    received: { date: formValues?.receivedDate || card?.receivedDate, time: formValues?.receivedTime || card?.receivedTime },
    expected: { date: formValues?.expectedDate || card?.expectedDate, time: formValues?.expectedTime || card?.expectedTime },
    arrived: { date: formValues?.arrivedDate || card?.arrivedDate, time: formValues?.arrivedTime || card?.arrivedTime },
    cleared: { date: formValues?.clearedDate || card?.clearedDate, time: formValues?.clearedTime || card?.clearedTime },
    sailed: { date: formValues?.sailedDate || card?.sailedDate, time: formValues?.sailedTime || card?.sailedTime },
  };

  return dateTimeMap[statusKey] || { date: null, time: null };
};

// Horizontal Progress Bar Component
const HorizontalProgressBar = ({ stages, currentStatus, accentColor, card, formValues }) => {
  const currentIndex = stages.findIndex(stage => stage.key === currentStatus);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  // Calculate progress width - reach the center of the active stage dot
  // Since dots are evenly distributed using flexbox with space-between,
  // the line spans from first dot center (0%) to last dot center (100%)
  // Each dot center is positioned at: (index / (totalStages - 1)) * 100
  const calculateProgressWidth = () => {
    if (stages.length <= 1) return 0;
    if (activeIndex === 0) {
      return 0;
    }
    if (activeIndex === stages.length - 1) {
      return 100;
    }

    // Calculate the exact percentage to reach the center of the active dot
    // Since dots are evenly spaced using flexbox with space-between,
    // the center of each dot is at: (index / (stages.length - 1)) * 100
    const dotCenterPosition = (activeIndex / (stages.length - 1)) * 100;

    // Add a visual offset to ensure the green line reaches the center of the dot
    // This accounts for:
    // 1. Dot width (28px) - line needs to extend to dot center
    // 2. Flexbox spacing calculations
    // 3. Subpixel rendering differences
    // For fewer stages (5), we need a larger offset to ensure proper connection
    const baseOffset = stages.length <= 5 ? 3.5 : 2.5;
    const offsetPercentage = activeIndex <= 2 ? baseOffset : baseOffset - 0.5;
    return Math.min(dotCenterPosition + offsetPercentage, 100);
  };

  const progressWidth = calculateProgressWidth();

  return (
    <div className="job-status-progress-container" style={{ "--progress-color": "#2e7d32" }}>
      <div className="job-status-progress-line">
        <div
          className="job-status-progress-fill"
          style={{
            width: `${progressWidth}%`,
            transition: "width 0.5s ease"
          }}
        />
      </div>
      <div className="job-status-progress-stages">
        {stages.map((stage, index) => {
          const isCompleted = index < activeIndex;
          const isActive = index === activeIndex;
          const isPending = index > activeIndex;
          const statusDateTime = getStatusDateTime(card, formValues, stage.key);
          const formattedDateTime = formatDateTime(statusDateTime.date, statusDateTime.time);

          return (
            <div
              key={stage.id}
              className={`job-status-progress-stage ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}
            >
              <div className="job-status-tooltip-content">
                <div className="tooltip-description">{stage.description}</div>
              </div>
              <div className={`job-status-progress-dot ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}>
                {isCompleted && <span className="check-icon">✓</span>}
                {isActive && <span className="active-dot"></span>}
                {isPending && <span className="pending-dot"></span>}
              </div>
              <div className="job-status-progress-label">
                {stage.title}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

HorizontalProgressBar.propTypes = {
  stages: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
    icon: PropTypes.string,
    description: PropTypes.string,
  })).isRequired,
  currentStatus: PropTypes.string,
  accentColor: PropTypes.string,
  card: PropTypes.object,
  formValues: PropTypes.object,
};

const normalizePreviewValue = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const getOptionLabel = (options = [], value = "") => {
  const normalizedValue = normalizePreviewValue(value);
  if (!normalizedValue || !Array.isArray(options)) return "";
  const match = options.find((item) => normalizePreviewValue(item?.value) === normalizedValue);
  return match?.label ? String(match.label).trim() : "";
};

const mapMultiValuesToLabels = (options = [], values = []) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => {
      const normalized = normalizePreviewValue(value);
      if (!normalized) return "";
      return getOptionLabel(options, normalized) || normalized;
    })
    .filter(Boolean);
};

const getPreviewRecipients = ({ dailyReportEmailOptions = [], dailyValues = [] }) => {
  const daily = mapMultiValuesToLabels(dailyReportEmailOptions, dailyValues);
  return daily.length ? daily.join(", ") : "—";
};

const getPreviewSubject = ({ cardTitle = "", typeOfCall = "", vesselName = "", port = "" }) => {
  const normalizedTitle = normalizePreviewValue(cardTitle);
  if (normalizedTitle) return normalizedTitle;
  const parts = [typeOfCall, vesselName, port].map((item) => normalizePreviewValue(item)).filter(Boolean);
  if (parts.length) return parts.join(" - ");
  return "Appointment Acceptance";
};

const htmlToPlainText = (html = "") =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
};

/** When the user has edited a preview field, use their value (including ""). Otherwise fall back to API/form defaults. */
const resolveEditablePreviewFieldValue = (isTouched, editedValue, ...fallbackValues) => {
  if (isTouched) return editedValue ?? "";
  return firstNonEmptyString(editedValue, ...fallbackValues);
};

/** Demo defaults for Email Preview Cc when no API/daily-report recipients exist. */
const EMAIL_PREVIEW_DEFAULT_CC_EMAILS = "supervisor@sedres.com, manager@sedres.com";

/** Shared Cc resolution for preview display and submit payload. */
const resolveAppointmentAcceptanceCcEmails = ({
  isTouched = false,
  editedValue,
  previewFromApiCc,
  dailyReportEmailOptions = [],
  dailyValues = [],
  forSubmit = false,
}) => {
  const fallbackCcValue = getPreviewRecipients({
    dailyReportEmailOptions,
    dailyValues,
  });
  const resolved = resolveEditablePreviewFieldValue(
    isTouched,
    editedValue,
    previewFromApiCc,
    fallbackCcValue
  );
  if (forSubmit) {
    return !resolved || resolved === "—" ? "" : String(resolved).trim();
  }
  if (isTouched) {
    return resolved ?? "";
  }
  const normalized = String(resolved || "").trim();
  if (!normalized || normalized === "—") {
    return EMAIL_PREVIEW_DEFAULT_CC_EMAILS;
  }
  return resolved;
};

const normalizeEmailFieldValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          return firstNonEmptyString(item.email, item.value, item.label);
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return firstNonEmptyString(value);
};

const resolveEmailPreviewPayload = (payload) => {
  const root = payload?.data?.data ?? payload?.data ?? payload ?? {};
  const data = Array.isArray(root) ? (root[0] ?? {}) : root;
  if (!data || typeof data !== "object") return null;
  const appointmentAcceptance =
    (data?.appointment_acceptance && typeof data.appointment_acceptance === "object")
      ? data.appointment_acceptance
      : null;
  const source = appointmentAcceptance ?? data;
  const rawBodyHtml = firstNonEmptyString(
    source.body,
    source.message,
    source.messageHtml,
    source.message_html,
    source.email_body,
    source.email_content,
    data.messageHtml,
    data.message_html
  );
  return {
    from: firstNonEmptyString(
      source.from,
      source.from_email,
      data.from_email,
      source.sender_email,
      source.sender
    ),
    to: normalizeEmailFieldValue(source.to ?? source.to_email ?? data.to_email ?? source.service_requestor_email),
    cc: normalizeEmailFieldValue(source.cc ?? source.cc_email ?? source.cc_emails),
    subject: htmlToPlainText(firstNonEmptyString(source.subject, source.email_subject)),
    messageHtml: rawBodyHtml,
    message: htmlToPlainText(rawBodyHtml),
  };
};

const buildPreviewTimeObjectsPayload = (timeObjects, timeObjectValues) =>
  (Array.isArray(timeObjects) ? timeObjects : [])
    .map((item) => {
      const timeObjectId = firstNonEmptyString(item?.time_object_id, item?.time_object_stage_id);
      if (!timeObjectId) return null;
      const valueLookupId = firstNonEmptyString(item?.time_object_id);
      const selected = valueLookupId ? timeObjectValues?.[valueLookupId] : null;
      const selectedDate = firstNonEmptyString(selected?.date);
      const selectedTime = firstNonEmptyString(selected?.time);
      if (!selectedDate || !selectedTime) return null;
      return {
        time_object_id: timeObjectId,
        field_key: firstNonEmptyString(item?.field_key, item?.time_object),
        time_object_value: `${selectedDate} ${selectedTime}:00`,
      };
    })
    .filter(Boolean);

const unwrapAllDetailResponse = (payload) => {
  const root = payload?.data?.data ?? payload?.data ?? payload ?? {};
  const data = Array.isArray(root) ? (root[0] ?? {}) : root;
  return data && typeof data === "object" ? data : null;
};

const ALL_DETAIL_SCALAR_FIELD_MAP = [
  ["vessel_id", "vesselName"],
  ["port_id", "port"],
  ["assigned_operator_id", "assignedOperator"],
  ["main_billing_entity_id", "mainBillingEntity"],
  ["other_billing_entity_id", "otherBillingEntity"],
  ["vessel_type_id", "vesselType"],
  ["barge_type_id", "bargeType"],
  ["barge_name", "bargeName"],
  ["barge_owner", "bargeOwner"],
  ["last_port", "lastPort"],
  ["vessel_owner", "vesselOwner"],
  ["vessel_principal", "vesselPrincipal"],
  ["vessel_manager", "vesselManager"],
  ["service_requestor_name", "serviceRequestorName"],
  ["service_requestor_email", "serviceRequestorEmail"],
  ["po_number", "poNumber"],
  ["srt_number", "srtNo"],
  ["project_name", "project"],
  ["billing_instruction_det", "billingInstructions"],
];

const formatPreviewDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

const EMAIL_PREVIEW_MESSAGE_QUILL_TOOLBAR = [
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

const EMAIL_PREVIEW_MESSAGE_QUILL_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "font",
  "size",
  "script",
  "blockquote",
  "code-block",
  "indent",
  "list",
  "bullet",
  "align",
  "direction",
  "link",
  "image",
];

const EMAIL_PREVIEW_DUMMY_ATTACHMENTS = [
  { id: "appointment-acceptance", name: "Appointment_Acceptance.pdf", size: "245K" },
  { id: "port-details", name: "Port_Details.xlsx", size: "128K" },
  { id: "vessel-image", name: "Vessel_Image.jpg", size: "932K" },
];

const EmailPreviewAttachmentChip = ({ attachment, onRemove }) => {
  const fileName = attachment?.name || "Untitled";
  const fileSize = attachment?.size || "";

  const handleOpen = () => {
    // Placeholder until API integration
    console.log("[Email Preview] Open attachment:", fileName);
  };

  const handleRemove = (event) => {
    event.stopPropagation();
    if (typeof onRemove === "function") {
      onRemove(attachment?.id);
    }
  };

  return (
    <div className="email-preview-attachment-chip" title={fileName}>
      <button type="button" className="email-preview-attachment-link" onClick={handleOpen}>
        <span className="email-preview-attachment-name">{fileName}</span>
        {fileSize ? <span className="email-preview-attachment-size"> ({fileSize})</span> : null}
      </button>
      <button
        type="button"
        className="email-preview-attachment-remove"
        onClick={handleRemove}
        aria-label={`Remove ${fileName}`}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
};

EmailPreviewAttachmentChip.propTypes = {
  attachment: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    size: PropTypes.string,
  }).isRequired,
  onRemove: PropTypes.func,
};

const EmailPreviewPanel = ({
  ownerOptions,
  formValues,
  dailyReportEmailOptions,
  callTypeOptions,
  vesselNameOptions,
  portSelectOptions,
  getFieldValue,
  previewData,
  editableFields,
  touchedFields,
  onEditableFieldChange,
  messageValue,
  messageEditorKey,
  onMessageChange,
}) => {
  const messageQuillRef = useRef(null);
  const [previewAttachments, setPreviewAttachments] = useState(() => [...EMAIL_PREVIEW_DUMMY_ATTACHMENTS]);
  const messageQuillModules = useMemo(
    () => ({
      ...buildQuillModules(EMAIL_PREVIEW_MESSAGE_QUILL_TOOLBAR, messageQuillRef),
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  );

  const previewFromApi = previewData && typeof previewData === "object" ? previewData : {};
  const ownerLabel = getOptionLabel(ownerOptions, getFieldValue("owner"));
  const fallbackFromValue = ownerLabel ? `${ownerLabel} <noreply@sedres.com>` : "operations@shipping.com";
  const fromValue = touchedFields?.from_email
    ? (editableFields?.from_email ?? "")
    : resolveEditablePreviewFieldValue(false, editableFields?.from_email, previewFromApi.from, fallbackFromValue) ||
    "operations@shipping.com";
  const fallbackToValue = normalizePreviewValue(getFieldValue("serviceRequestorEmail")) || "—";
  const toValue = resolveEditablePreviewFieldValue(
    touchedFields?.to_email,
    editableFields?.to_email,
    previewFromApi.to,
    fallbackToValue
  );
  const subjectFallback = getPreviewSubject({
    cardTitle: formValues?.cardTitle || "",
    typeOfCall: getOptionLabel(callTypeOptions, getFieldValue("typeOfCall")) || getFieldValue("typeOfCall"),
    vesselName: getOptionLabel(vesselNameOptions, getFieldValue("vesselName")) || getFieldValue("vesselName"),
    port: getOptionLabel(portSelectOptions, getFieldValue("port")) || getFieldValue("port"),
  });
  const ccValue = resolveAppointmentAcceptanceCcEmails({
    isTouched: touchedFields?.cc_emails,
    editedValue: editableFields?.cc_emails,
    previewFromApiCc: previewFromApi.cc,
    dailyReportEmailOptions,
    dailyValues: getFieldValue("dailyReportEmail"),
  });
  const subjectValue = touchedFields?.subject
    ? (editableFields?.subject ?? "")
    : resolveEditablePreviewFieldValue(false, editableFields?.subject, previewFromApi.subject, subjectFallback) ||
    "Appointment Update";
  return (
    <div className="general-add-preview-panel general-add-preview-panel--split-scroll">
      <div className="email-preview-topbar">
        <div className="email-preview-topbar-title">Email Preview</div>
        <div className="email-preview-topbar-status">
          <span className="email-preview-status-dot" />
          <span>{formatPreviewDate()}</span>
          {/* <button type="button" className="email-preview-topbar-action" aria-label="Copy preview">⧉</button>
          <button type="button" className="email-preview-topbar-action" aria-label="Expand preview">⛶</button> */}
        </div>
      </div>
      <div className="general-add-preview-scroll-inner">
        <div className="email-preview-card">
          <div className="email-preview-content">
            <div className="email-preview-meta">
              <div className="email-preview-row">
                <div className="email-preview-row-label">From</div>
                <div className="email-preview-row-value">
                  <input
                    type="text"
                    className="email-preview-inline-input"
                    value={fromValue}
                    onChange={onEditableFieldChange("from_email")}
                    placeholder="From email"
                  />
                </div>
              </div>
              <div className="email-preview-row">
                <div className="email-preview-row-label">To</div>
                <div className="email-preview-row-value">
                  <input
                    type="text"
                    className="email-preview-inline-input"
                    value={toValue}
                    onChange={onEditableFieldChange("to_email")}
                    placeholder="—"
                  />
                </div>
              </div>
              <div className="email-preview-row">
                <div className="email-preview-row-label">Cc</div>
                <div className="email-preview-row-value">
                  <input
                    type="text"
                    className="email-preview-inline-input"
                    value={ccValue}
                    onChange={onEditableFieldChange("cc_emails")}
                    placeholder="—"
                  />
                </div>
              </div>
              <div className="email-preview-row">
                <div className="email-preview-row-label">Subject</div>
                <div className="email-preview-row-value">
                  <input
                    type="text"
                    className="email-preview-inline-input"
                    value={subjectValue}
                    onChange={onEditableFieldChange("subject")}
                    placeholder="Email subject"
                  />
                </div>
              </div>
              <div className="email-preview-row email-preview-row--attachments">
                <div className="email-preview-row-label">Attachments</div>
                <div className="email-preview-row-value">
                  <div className="email-preview-attachments-list">
                    {previewAttachments.map((attachment) => (
                      <EmailPreviewAttachmentChip
                        key={attachment.id}
                        attachment={attachment}
                        onRemove={(attachmentId) => {
                          setPreviewAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="email-preview-message-section email-preview-message-section--quill">
              <div className="email-preview-message-title">Message</div>
              <div className="react-quill-wrapper email-preview-message-quill-react">
                <ReactQuill
                  ref={messageQuillRef}
                  key={messageEditorKey}
                  theme="snow"
                  value={messageValue ?? ""}
                  onChange={(html, _delta, source) => {
                    if (typeof onMessageChange === "function") {
                      onMessageChange(html ?? "", source);
                    }
                  }}
                  modules={messageQuillModules}
                  formats={EMAIL_PREVIEW_MESSAGE_QUILL_FORMATS}
                  placeholder="Type email content here..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

EmailPreviewPanel.propTypes = {
  ownerOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  formValues: PropTypes.object,
  dailyReportEmailOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  callTypeOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  vesselNameOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  portSelectOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  getFieldValue: PropTypes.func.isRequired,
  previewData: PropTypes.shape({
    from: PropTypes.string,
    to: PropTypes.string,
    cc: PropTypes.string,
    subject: PropTypes.string,
    messageHtml: PropTypes.string,
    message: PropTypes.string,
  }),
  editableFields: PropTypes.shape({
    from_email: PropTypes.string,
    to_email: PropTypes.string,
    cc_emails: PropTypes.string,
    subject: PropTypes.string,
  }),
  touchedFields: PropTypes.shape({
    from_email: PropTypes.bool,
    to_email: PropTypes.bool,
    cc_emails: PropTypes.bool,
    subject: PropTypes.bool,
  }),
  onEditableFieldChange: PropTypes.func.isRequired,
  messageValue: PropTypes.string,
  messageEditorKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Receives HTML from ReactQuill; second arg is Quill change source (e.g. "user"). */
  onMessageChange: PropTypes.func.isRequired,
};

function General({
  card,
  formValues,
  handleChange,
  onSave,
  isAddMode = false,
  isSimplifiedMode = false,
  isSavingGeneral = false,
  hasSubmitted = false,
  setHasSubmitted = () => { },
  setIsSavingGeneral = () => { },
}) {
  const accentColor = useMemo(
    () =>
      isAddMode
        ? formValues?.cardColor || card?.color || "#2A00FF"
        : card?.color || "#2A00FF",
    [isAddMode, formValues?.cardColor, card?.color]
  );
  const [vesselNameOptions, setVesselNameOptions] = useState([
    // Add vessel names here or fetch from API
  ]);
  const [vesselOptionsLoading, setVesselOptionsLoading] = useState(false);
  const [appointmentDocuments, setAppointmentDocuments] = useState([]);
  const [appointmentExtractionMode, setAppointmentExtractionMode] = useState("without_ai");
  const [isAiExtractingAppointment, setIsAiExtractingAppointment] = useState(false);
  const [isServerEmailReading, setIsServerEmailReading] = useState(false);
  const [aiExtractionError, setAiExtractionError] = useState("");
  const [previewMessageText, setPreviewMessageText] = useState("");
  const [previewMessageEditorKey, setPreviewMessageEditorKey] = useState(0);
  const [emailPreviewData, setEmailPreviewData] = useState(null);
  const [isPreviewMessageDirty, setIsPreviewMessageDirty] = useState(false);
  const [editablePreviewFields, setEditablePreviewFields] = useState({
    from_email: "",
    to_email: "",
    cc_emails: "",
    subject: "",
  });
  /** Unmodified appointment_acceptance from all_detail_by_vessel_id (preserves base64 logo in body). */
  const [appointmentAcceptanceFromApi, setAppointmentAcceptanceFromApi] = useState(null);
  const [touchedPreviewFields, setTouchedPreviewFields] = useState({
    from_email: false,
    to_email: false,
    cc_emails: false,
    subject: false,
  });
  const resetTouchedPreviewFields = useCallback(() => {
    setTouchedPreviewFields({
      from_email: false,
      to_email: false,
      cc_emails: false,
      subject: false,
    });
  }, []);
  // MWP RENEWAL document states
  const [appointmentEmailDocuments, setAppointmentEmailDocuments] = useState([]);
  const [mwpCopyDocuments, setMwpCopyDocuments] = useState([]);
  const [supportingDocuments, setSupportingDocuments] = useState([]);
  const [fdaDispatchProofDocuments, setFdaDispatchProofDocuments] = useState([]);
  const [copyOfSalesOrderDocuments, setCopyOfSalesOrderDocuments] = useState([]);
  // CREW CHANGE document states
  const [crewChangeAppointmentEmailDocuments, setCrewChangeAppointmentEmailDocuments] = useState([]);
  const [launchHireSlipsDocuments, setLaunchHireSlipsDocuments] = useState([]);
  const [zawilPassCopyDocuments, setZawilPassCopyDocuments] = useState([]);
  const [cgPermitCopyDocuments, setCgPermitCopyDocuments] = useState([]);
  const [crewSummarySheetDocuments, setCrewSummarySheetDocuments] = useState([]);
  const [crewChangeSupportingDocuments, setCrewChangeSupportingDocuments] = useState([]);
  const [crewChangeFdaDispatchProofDocuments, setCrewChangeFdaDispatchProofDocuments] = useState([]);
  const [hotelInvoiceDocuments, setHotelInvoiceDocuments] = useState([]);
  const [crewChangeCopyOfSalesOrderDocuments, setCrewChangeCopyOfSalesOrderDocuments] = useState([]);
  const [inwardClearanceDocuments, setInwardClearanceDocuments] = useState([]);
  const [outwardClearanceDocuments, setOutwardClearanceDocuments] = useState([]);
  // FLEET document states
  const [fleetAppointmentEmailDocuments, setFleetAppointmentEmailDocuments] = useState([]);
  const [fleetCopyOfSalesOrderDocuments, setFleetCopyOfSalesOrderDocuments] = useState([]);
  // ON STATION document states
  const [onStationAppointmentEmailDocuments, setOnStationAppointmentEmailDocuments] = useState([]);
  const [onStationSupportingDocuments, setOnStationSupportingDocuments] = useState([]);
  const [onStationFdaDispatchProofDocuments, setOnStationFdaDispatchProofDocuments] = useState([]);
  const [onStationCopyOfSalesOrderDocuments, setOnStationCopyOfSalesOrderDocuments] = useState([]);
  const [dailyReportEmailOptions, setDailyReportEmailOptions] = useState([]);
  const [dailyReportEmailLoading, setDailyReportEmailLoading] = useState(false);
  const [billingInstructionType, setBillingInstructionType] = useState("");
  const [billingInstructionEmailOptions, setBillingInstructionEmailOptions] = useState([]);
  const [billingInstructionLoading, setBillingInstructionLoading] = useState(false);

  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [portSelectOptions, setPortSelectOptions] = useState([]);
  const [callTypeOptions, setCallTypeOptions] = useState([]);
  const [billingEntitySelectOptions, setBillingEntitySelectOptions] = useState([]);
  const [vesselTypeSelectOptions, setVesselTypeSelectOptions] = useState([]);
  const [bargeTypeSelectOptions, setBargeTypeSelectOptions] = useState([]);
  const [entityFields, setEntityFields] = useState([]);
  const [entityFieldValues, setEntityFieldValues] = useState({});
  const [entityFieldErrors, setEntityFieldErrors] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [timeObjectErrors, setTimeObjectErrors] = useState({});
  const [entityFieldsLoading, setEntityFieldsLoading] = useState(false);
  const [entityFieldsError, setEntityFieldsError] = useState("");
  const [callDetailLoading, setCallDetailLoading] = useState(false);
  const [callDetailData, setCallDetailData] = useState(null);
  const [stageTimeObjects, setStageTimeObjects] = useState([]);
  const [stageTimeObjectValues, setStageTimeObjectValues] = useState({});
  const [stageTimeObjectsLoading, setStageTimeObjectsLoading] = useState(false);
  const [isEtaDependentTimesLoading, setIsEtaDependentTimesLoading] = useState(false);
  const etaDependentRequestIdRef = useRef(0);
  const etaDependentLastRequestKeyRef = useRef("");
  const allDetailByVesselRequestIdRef = useRef(0);
  const lastHydratedEntityFieldCallIdRef = useRef(null);
  const [operatorKpiTasks, setOperatorKpiTasks] = useState([]);
  const [operatorKpiLoading, setOperatorKpiLoading] = useState(false);
  const [operatorKpiError, setOperatorKpiError] = useState("");
  const callTasks = useCallTaskReducer((state) => state.callTasks);
  const isLoadingCallTasks = useCallTaskReducer((state) => state.isLoadingTasks);
  const callTasksError = useCallTaskReducer((state) => state.tasksErrorMessage);
  const getTasksByCall = useCallTaskReducer((state) => state.getTasksByCall);
  const clearCallTasks = useCallTaskReducer((state) => state.clearCallTasks);

  const currentCallId = useMemo(
    () => card?.call_id ?? formValues?.call_id ?? card?.callId ?? "",
    [card?.call_id, card?.callId, formValues?.call_id]
  );

  useEffect(() => {
    if (isAddMode || !currentCallId) {
      setCallDetailData(null);
      setCallDetailLoading(false);
      return;
    }

    let cancelled = false;

    const loadCallDetail = async () => {
      setCallDetailLoading(true);
      try {
        const { data } = await callFileService.getCallDetail(currentCallId);
        const detail = data?.data ?? null;
        if (!cancelled) {
          setCallDetailData(detail);
        }
      } catch (error) {
        console.error("[General] call detail fetch failed", error);
      } finally {
        if (!cancelled) {
          setCallDetailLoading(false);
        }
      }
    };

    loadCallDetail();
    return () => {
      cancelled = true;
    };
  }, [isAddMode, currentCallId]);

  const mappedCallDetail = useMemo(() => {
    if (!callDetailData) return {};
    return mapCallDetailToFormFields(callDetailData);
  }, [callDetailData]);

  const appointmentEmailUrl = useMemo(() => {
    const url = callDetailData?.appointment_email_url ?? mappedCallDetail?.appointmentEmailUrl;
    return url ? String(url).trim() : "";
  }, [callDetailData?.appointment_email_url, mappedCallDetail?.appointmentEmailUrl]);

  const viewModeTimeObjects = useMemo(() => {
    if (isAddMode) return [];
    const source = callDetailData?.time_objects;
    if (!Array.isArray(source)) return [];

    const flattened = source.flatMap((item) => (Array.isArray(item) ? item : [item]));
    const seen = new Set();

    return flattened
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const label = firstNonEmptyString(item?.time_object);
        const rawValue = firstNonEmptyString(item?.value, item?.time_object_value, item?.event_datetime);
        if (!label || !rawValue) return null;
        const dedupeKey = `${firstNonEmptyString(item?.time_object_id)}|${label}|${rawValue}`;
        if (seen.has(dedupeKey)) return null;
        seen.add(dedupeKey);
        return {
          key: dedupeKey,
          label,
          value: rawValue,
        };
      })
      .filter(Boolean);
  }, [callDetailData, isAddMode]);

  useEffect(() => {
    if (isAddMode) {
      lastHydratedEntityFieldCallIdRef.current = null;
      return;
    }
    if (!callDetailData) return;
    const detailCallIdRaw = callDetailData?.call_id ?? currentCallId;
    if (detailCallIdRaw === undefined || detailCallIdRaw === null || String(detailCallIdRaw).trim() === "") {
      return;
    }
    const detailCallId = String(detailCallIdRaw);
    if (!Array.isArray(entityFields) || entityFields.length === 0) return;

    const fallbackMap = {
      po_number: callDetailData?.po_number ?? mappedCallDetail?.poNumber ?? "",
      project_name: callDetailData?.project_name ?? mappedCallDetail?.project ?? "",
      project_code: callDetailData?.project_code ?? "",
    };

    setEntityFieldValues((prev) => {
      const hasExistingUserInput = Object.values(prev || {}).some(
        (value) => value !== undefined && value !== null && String(value).trim() !== ""
      );
      const sameCallAsLastHydration = lastHydratedEntityFieldCallIdRef.current === detailCallId;
      if (hasExistingUserInput && sameCallAsLastHydration) return prev;

      const nextValues = {};
      entityFields.forEach((field) => {
        const fieldId = field?.field_id;
        if (!fieldId) return;
        const key = field?.field_key ? String(field.field_key).trim() : "";
        if (!key) {
          nextValues[fieldId] = "";
          return;
        }
        const direct = callDetailData?.[key];
        const resolved = direct !== undefined && direct !== null && String(direct).trim() !== ""
          ? String(direct)
          : fallbackMap[key] !== undefined && fallbackMap[key] !== null
            ? String(fallbackMap[key])
            : "";
        nextValues[fieldId] = resolved;
      });

      lastHydratedEntityFieldCallIdRef.current = detailCallId;
      return nextValues;
    });
  }, [isAddMode, callDetailData, entityFields, mappedCallDetail, currentCallId]);

  const visibleDynamicEntityFields = useMemo(() => {
    if (isAddMode) return entityFields;
    return entityFields.filter((field) =>
      hasRenderableEntityFieldValue(field, callDetailData, entityFieldValues, mappedCallDetail)
    );
  }, [isAddMode, entityFields, callDetailData, entityFieldValues, mappedCallDetail]);

  const mappedOperatorKpiTasks = useMemo(() => {
    const rows = Array.isArray(operatorKpiTasks) ? operatorKpiTasks : [];
    return rows.map((row) => ({
      id: String(row?.operator_kpi_id ?? row?.id ?? `${row?.task_name ?? "task"}-${row?.due_time ?? ""}`),
      text: row?.task_name ? String(row.task_name) : "Untitled task",
      startTime: row?.start_time ? String(row.start_time) : "",
      dueTime: row?.due_time ? String(row.due_time) : "",
      completedTime: row?.completed_time ? String(row.completed_time) : "",
      status: row?.status ? String(row.status) : "",
      statusColor: row?.status_color ? String(row.status_color) : "",
      delayText: row?.delay_text ? String(row.delay_text) : "",
    }));
  }, [operatorKpiTasks]);

  const mappedOperationTaskSections = useMemo(
    () => mapTasksToSections(callTasks),
    [callTasks]
  );

  useEffect(() => {
    if (isAddMode) {
      clearCallTasks();
      return;
    }

    void getTasksByCall({ callId: currentCallId });
  }, [isAddMode, currentCallId, getTasksByCall, clearCallTasks]);

  useEffect(() => {
    if (isAddMode) {
      setOperatorKpiTasks([]);
      setOperatorKpiError("");
      setOperatorKpiLoading(false);
      return;
    }

    const cardIdRaw = card?.id ?? card?.card_id ?? formValues?.card_id;
    const cardId = cardIdRaw === undefined || cardIdRaw === null ? "" : String(cardIdRaw).trim();

    if (!cardId) {
      setOperatorKpiTasks([]);
      setOperatorKpiError("");
      setOperatorKpiLoading(false);
      return;
    }

    let cancelled = false;
    const loadOperatorKpi = async () => {
      setOperatorKpiLoading(true);
      setOperatorKpiError("");
      try {
        const { data } = await kpiTasksService.getOperatorKpi(cardId);
        const rows = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) {
          setOperatorKpiTasks(rows);
        }
      } catch (error) {
        console.error("[General] operator KPI fetch failed", error);
        if (!cancelled) {
          setOperatorKpiTasks([]);
          setOperatorKpiError("Unable to load KPI tasks.");
        }
      } finally {
        if (!cancelled) {
          setOperatorKpiLoading(false);
        }
      }
    };

    void loadOperatorKpi();
    return () => {
      cancelled = true;
    };
  }, [isAddMode, card?.id, card?.card_id, formValues?.card_id]);

  // Keep existing non-add-mode preview only when API file name is unavailable.
  useEffect(() => {
    if (!isAddMode && appointmentDocuments.length === 0) {
      const dummyDocument = {
        name: "appointment_document.pdf",
        size: 1024000, // 1MB
        type: "application/pdf"
      };
      setAppointmentDocuments([dummyDocument]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddMode, appointmentDocuments.length]);

  useEffect(() => {
    let cancelled = false;

    const fetchRow = async (label, request, mapFn) => {
      try {
        const { data } = await request;
        const list = unwrapListResponse(data);
        return { label, options: mapFn(list) };
      } catch (e) {
        console.error(`[General] ${label} master data failed`, e);
        return { label, options: [] };
      }
    };

    const loadMasterData = async () => {
      setMasterDataLoading(true);
      const results = await Promise.all([
        fetchRow("operators", callFileService.getAllOperators(), mapOperatorsToOptions),
        fetchRow("managers", callFileService.getAllManagers(), mapOperatorsToOptions),
        fetchRow("ports", portService.getPorts({ params: { limit: 1000 } }), mapPortsToOptions),
        fetchRow("callTypes", CommonService.getCallTypes(), mapCallTypesToOptions),
        fetchRow(
          "billingEntities",
          billingEntityService.getBillingEntities({ params: { page: 1, limit: 1000 } }),
          mapBillingEntitiesToOptions
        ),
        fetchRow("vesselTypes", vesselTypeService.getVesselTypes({ params: { limit: 1000 } }), mapVesselTypesToOptions),
        fetchRow("bargeTypes", bargeTypeService.getBargeTypes({ params: { limit: 1000 } }), mapBargeTypesToOptions),
      ]);

      if (cancelled) return;

      for (const { label, options } of results) {
        if (label === "operators") setOperatorOptions(options);
        if (label === "managers") setOwnerOptions(options);
        if (label === "ports") setPortSelectOptions(options);
        if (label === "callTypes") setCallTypeOptions(options);
        if (label === "billingEntities") setBillingEntitySelectOptions(options);
        if (label === "vesselTypes") setVesselTypeSelectOptions(options);
        if (label === "bargeTypes") setBargeTypeSelectOptions(options);
      }
      setMasterDataLoading(false);
    };

    loadMasterData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Determine current job status from card data (updated for 5 statuses)
  const currentStatus = useMemo(() => {
    // Map card properties to status keys
    if (card?.sailed) return "sailed";
    if (card?.cleared) return "cleared";
    if (card?.arrived) return "arrived";
    if (card?.expected) return "expected";
    if (card?.received) return "received";
    // Default to Received
    return "expected";
  }, [card]);

  const typeOptions = [
    { value: "Type", label: "IMPORT" },
    { value: "MWP RENEWAL", label: "MWP RENEWAL" },
    // { value: "CREW CHANGE", label: "CREW CHANGE" },
    { value: "FLEET", label: "FLEET" },
    // { value: "MATERIAL DELIVERY", label: "MATERIAL DELIVERY" },
    // { value: "ON STATION", label: "ON STATION" },
  ];

  const hasMeaningfulValue = (value) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim() !== "";
    return true;
  };

  // Helper function to get field value - prioritize formValues, then fetched call detail, then card.
  const getFieldValue = (fieldName) => {
    const apiAliasByField = {
      poNumber: "po_number",
      srtNo: "srt_number",
      srtPoWbs: "srt_number",
      project: "project_name",
      mainBillingEntity: "main_billing_entity_id",
      lastPort: "last_port",
      vesselName: "vessel_id",
    };

    if (hasMeaningfulValue(formValues?.[fieldName])) {
      return formValues[fieldName];
    }
    if (!isAddMode && hasMeaningfulValue(mappedCallDetail?.[fieldName])) {
      return mappedCallDetail[fieldName];
    }
    if (!isAddMode && hasMeaningfulValue(card?.[fieldName])) {
      return card[fieldName];
    }
    const apiAlias = apiAliasByField[fieldName];
    if (
      !isAddMode &&
      apiAlias &&
      callDetailData?.[apiAlias] !== undefined &&
      callDetailData[apiAlias] !== null &&
      String(callDetailData[apiAlias]).trim() !== ""
    ) {
      return String(callDetailData[apiAlias]);
    }
    if (
      !isAddMode &&
      apiAlias &&
      card?.[apiAlias] !== undefined &&
      card[apiAlias] !== null &&
      String(card[apiAlias]).trim() !== ""
    ) {
      return String(card[apiAlias]);
    }
    return "";
  };

  const shouldShowApiField = useCallback(
    (apiKey) => {
      if (isAddMode) return true;
      if (!callDetailData) return true;
      const raw = callDetailData?.[apiKey];
      if (Array.isArray(raw)) return raw.length > 0;
      if (raw === undefined || raw === null) return false;
      if (typeof raw === "string") return raw.trim() !== "";
      return true;
    },
    [isAddMode, callDetailData]
  );

  useEffect(() => {
    if (!isAddMode) return;
    const initialFromDescription = htmlToPlainText(formValues?.cardDescription || "");
    setPreviewMessageText((prev) => (prev.trim() ? prev : initialFromDescription));
  }, [isAddMode, formValues?.cardDescription]);

  useEffect(() => {
    if (isAddMode) return;
    setEmailPreviewData(null);
    setIsPreviewMessageDirty(false);
    resetTouchedPreviewFields();
    setEditablePreviewFields({
      from_email: "",
      to_email: "",
      cc_emails: "",
      subject: "",
    });
  }, [isAddMode, resetTouchedPreviewFields]);

  const populateEditablePreviewFields = useCallback((resolvedPreview) => {
    setTouchedPreviewFields((touched) => {
      setEditablePreviewFields((prev) => ({
        from_email: touched.from_email
          ? prev.from_email
          : firstNonEmptyString(resolvedPreview?.from),
        to_email: touched.to_email ? prev.to_email : firstNonEmptyString(resolvedPreview?.to),
        cc_emails: touched.cc_emails
          ? prev.cc_emails
          : firstNonEmptyString(resolvedPreview?.cc),
        subject: touched.subject
          ? prev.subject
          : firstNonEmptyString(resolvedPreview?.subject),
      }));
      return touched;
    });
  }, []);

  const getTrimmedValue = (value) => {
    if (value === undefined || value === null) return "";
    return String(value).trim();
  };

  const isEmptyValue = (value) => {
    if (value === undefined || value === null) return true;
    return String(value).trim() === "";
  };

  const getValueForGeneralValidation = (fieldName, snapshot = formValues) => {
    const base = snapshot && typeof snapshot === "object" ? snapshot : formValues;
    if (base && Object.prototype.hasOwnProperty.call(base, fieldName)) {
      const v = base[fieldName];
      return v === undefined || v === null ? "" : v;
    }
    return getFieldValue(fieldName);
  };

  const validateGeneralFields = (snapshot = formValues) => {
    const errors = {};
    const v = (name) => getValueForGeneralValidation(name, snapshot);
    if (isEmptyValue(v("mainBillingEntity"))) errors.mainBillingEntity = "Main billing entity is required.";
    return errors;
  };

  const validateRequiredEntityFields = useCallback((fields, values) => {
    const nextErrors = {};
    fields.forEach((field) => {
      const fieldName = String(field?.field_name ?? "").trim().toLowerCase();
      const fieldKey = String(field?.field_key ?? field?.key ?? field?.api_key ?? "").trim().toLowerCase();
      const isAppointmentEmailField =
        fieldName === "appointment email" ||
        fieldKey === "appointment_email" ||
        fieldKey === "appointment email";
      if (isAppointmentEmailField) return;
      if (field.is_required !== 1) return;
      const raw = values?.[field.field_id];
      const trimmed = raw === undefined || raw === null ? "" : String(raw).trim();
      if (trimmed === "") {
        const name = field.field_name || "This field";
        nextErrors[field.field_id] = `${name} is required.`;
      }
    });
    return nextErrors;
  }, []);

  const validateGeneralForm = useCallback(() => {
    const errors = {};
    const dynamicErrors = {};
    const timeErrors = {};
    const v = (name) => getValueForGeneralValidation(name, formValues);
    const requireField = (condition, key, message) => {
      if (condition && isEmptyValue(v(key))) errors[key] = message;
    };
    const selectedAppointmentType = normalizeAppointmentTypeValue(v("appointmentType"));
    const tugSelected = appointmentTypeShowsTugFields(selectedAppointmentType);
    const bargeSelected = appointmentTypeShowsBargeFields(selectedAppointmentType);
    requireField(shouldShowApiField("assigned_operator_id"), "assignedOperator", "Assigned operator is required.");
    requireField(shouldShowApiField("main_billing_entity_id"), "mainBillingEntity", "Main billing entity is required.");
    requireField(shouldShowApiField("vessel_id") && tugSelected, "vesselName", "Vessel name is required.");
    requireField(shouldShowApiField("service_requestor_name"), "serviceRequestorName", "Service requestor name is required.");
    requireField(shouldShowApiField("service_requestor_email"), "serviceRequestorEmail", "Service requestor email is required.");
    requireField(shouldShowApiField("appointment_received_date"), "appointmentReceivedDate", "Appointment received date is required.");
    requireField(shouldShowApiField("appointment_received_date"), "appointmentReceivedTime", "Appointment received time is required.");

    const serviceEmailStr = getTrimmedValue(v("serviceRequestorEmail"));
    if (serviceEmailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(serviceEmailStr)) {
      errors.serviceRequestorEmail = "Invalid email format.";
    }

    if (isAddMode) {
      if (!selectedAppointmentType) {
        errors.appointmentType = "Appointment type is required.";
      }
      requireField(shouldShowApiField("vessel_type_id") && tugSelected, "vesselType", "Vessel type is required.");
      requireField(shouldShowApiField("barge_type_id") && bargeSelected, "bargeType", "Barge type is required.");
      (Array.isArray(stageTimeObjects) ? stageTimeObjects : []).forEach((item) => {
        if (String(item?.is_required ?? "0") !== "1") return;
        const timeObjectId = firstNonEmptyString(item?.time_object_id);
        if (!timeObjectId) return;
        const selected = stageTimeObjectValues?.[timeObjectId];
        const hasDate = firstNonEmptyString(selected?.date);
        const hasTime = firstNonEmptyString(selected?.time);
        if (!hasDate || !hasTime) {
          timeErrors[timeObjectId] = `${firstNonEmptyString(item?.time_object) || "Time object"} is required.`;
        }
      });
    }

    const requiredDynamicErrors = validateRequiredEntityFields(visibleDynamicEntityFields, entityFieldValues);
    Object.assign(dynamicErrors, requiredDynamicErrors);

    setFieldErrors(errors);
    setEntityFieldErrors(dynamicErrors);
    setTimeObjectErrors(timeErrors);
    return Object.keys(errors).length === 0 && Object.keys(dynamicErrors).length === 0 && Object.keys(timeErrors).length === 0;
  }, [
    entityFieldValues,
    formValues,
    isAddMode,
    shouldShowApiField,
    stageTimeObjectValues,
    stageTimeObjects,
    validateRequiredEntityFields,
    visibleDynamicEntityFields,
  ]);

  const handleSubmit = async () => {
    setHasSubmitted(true);
    const isValid = validateGeneralForm();
    if (!isValid) {
      notify("Please fill all required fields before saving.", "error");
      return;
    }

    setFieldErrors({});
    setEntityFieldErrors({});
    setTimeObjectErrors({});

    const entityFieldsPayload = buildEntityFieldsPayload(entityFields, entityFieldValues);
    const swimlaneId =
      formValues?.swimlane_id ??
      formValues?.swimlaneId ??
      card?.swimlane_id ??
      card?.laneId;
    const emailPreviewBody =
      firstNonEmptyString(previewMessageText) ||
      firstNonEmptyString(emailPreviewData?.messageHtml) ||
      "";
    const ownerLabel = getOptionLabel(ownerOptions, getFieldValue("owner"));
    const fallbackFromValue = ownerLabel ? `${ownerLabel} <noreply@sedres.com>` : "operations@shipping.com";
    const resolvedFromEmail = touchedPreviewFields.from_email
      ? (editablePreviewFields.from_email ?? "")
      : firstNonEmptyString(
        editablePreviewFields.from_email,
        emailPreviewData?.from,
        fallbackFromValue,
        "operations@shipping.com"
      );
    const resolvedToEmailRaw = resolveEditablePreviewFieldValue(
      touchedPreviewFields.to_email,
      editablePreviewFields.to_email,
      emailPreviewData?.to,
      normalizePreviewValue(getFieldValue("serviceRequestorEmail")) || "—"
    );
    const resolvedToEmail =
      !resolvedToEmailRaw || resolvedToEmailRaw === "—" ? "" : String(resolvedToEmailRaw).trim();
    const subjectFallback = getPreviewSubject({
      cardTitle: formValues?.cardTitle || "",
      typeOfCall:
        getOptionLabel(callTypeOptions, getFieldValue("typeOfCall")) || getFieldValue("typeOfCall"),
      vesselName:
        getOptionLabel(vesselNameOptions, getFieldValue("vesselName")) || getFieldValue("vesselName"),
      port: getOptionLabel(portSelectOptions, getFieldValue("port")) || getFieldValue("port"),
    });
    const resolvedSubject = touchedPreviewFields.subject
      ? (editablePreviewFields.subject ?? "")
      : firstNonEmptyString(
        editablePreviewFields.subject,
        emailPreviewData?.subject,
        subjectFallback,
        "Appointment Update"
      );
    const dailyValues = getFieldValue("dailyReportEmail");
    const finalCcEmails = resolveAppointmentAcceptanceCcEmails({
      isTouched: touchedPreviewFields.cc_emails,
      editedValue: editablePreviewFields.cc_emails,
      previewFromApiCc: emailPreviewData?.cc,
      dailyReportEmailOptions,
      dailyValues: Array.isArray(dailyValues) ? dailyValues : [],
      forSubmit: true,
    });
    const apiAppointmentBase =
      appointmentAcceptanceFromApi && typeof appointmentAcceptanceFromApi === "object"
        ? appointmentAcceptanceFromApi
        : {};
    const resolvedBody = firstNonEmptyString(
      isPreviewMessageDirty ? emailPreviewBody : "",
      apiAppointmentBase.body,
      emailPreviewBody
    );
    const appointmentAcceptanceForSubmit = {
      ...apiAppointmentBase,
      subject: resolvedSubject,
      body: resolvedBody,
      to_email: resolvedToEmail,
      from_email: resolvedFromEmail,
      cc_emails: finalCcEmails,
    };
    console.log("FINAL appointment_acceptance", appointmentAcceptanceForSubmit);
    const formPayload = {
      ...formValues,
      swimlane_id: swimlaneId,
      card_type_id:
        formValues?.card_type_id ?? card?.card_type_id ?? card?.cardTypeId ?? card?.raw?.card_type_id,
      card_tag_id:
        formValues?.card_tag_id ??
        formValues?.tag_id ??
        card?.card_tag_id ??
        card?.tag_id ??
        card?.raw?.card_tag_id,
      card_blocker_id:
        formValues?.card_blocker_id ??
        formValues?.blocker_id ??
        card?.card_blocker_id ??
        card?.blocker_id ??
        card?.raw?.card_blocker_id,
      card_sticker_id:
        formValues?.card_sticker_id ??
        formValues?.sticker_id ??
        card?.card_sticker_id ??
        card?.sticker_id ??
        card?.raw?.card_sticker_id,
      entity_fields: entityFieldsPayload,
      time_objects: (Array.isArray(stageTimeObjects) ? stageTimeObjects : [])
        .map((item) => {
          const valueLookupId = firstNonEmptyString(item?.time_object_id);
          const timeObjectId = firstNonEmptyString(item?.time_object_id, item?.time_object_stage_id);
          if (!valueLookupId || !timeObjectId) return null;
          const selected = stageTimeObjectValues?.[valueLookupId];
          const selectedDate = firstNonEmptyString(selected?.date);
          const selectedTime = firstNonEmptyString(selected?.time);
          if (!selectedDate || !selectedTime) return null;
          return {
            time_object_id: timeObjectId,
            time_object_value: `${selectedDate} ${selectedTime}:00`,
          };
        })
        .filter(Boolean),
      appointment_acceptance: appointmentAcceptanceForSubmit,
      instruction_type: billingInstructionType,
      billing_instruction_det: getFieldValue("billingInstructions") ?? "",
    };

    setIsSavingGeneral(true);
    try {
      const formData = buildCreateCallFileFormData(formPayload, {
        appointmentFiles: appointmentDocuments,
        dailyReportEmailOptions,
        billingInstructionEmailOptions,
        preserveAppointmentBody:
          !isPreviewMessageDirty && Boolean(firstNonEmptyString(apiAppointmentBase.body)),
      });
      console.log("FINAL FORM DATA");
      for (const pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }
      const response = await callFileService.createCallFile(formData);
      if (onSave) onSave(response);
    } catch (error) {
      console.error("Create failed:", error);
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Could not create call file.";
      notify(typeof msg === "string" ? msg : "Could not create call file.", "error");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleValidatedChange = (fieldName) => (event) => {
    const nextVal = event?.target?.value;
    handleChange(fieldName)(event);
    if (!hasSubmitted) return;
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const merged = { ...formValues, [fieldName]: nextVal };
      const nextValue = merged?.[fieldName];
      const isArrayField =
        fieldName === "dailyReportEmail" ||
        fieldName === "billingInstructionEmails";
      if (fieldName === "serviceRequestorEmail") {
        const email = getTrimmedValue(nextValue);
        const isValidEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (isValidEmail) {
          const next = { ...prev };
          delete next[fieldName];
          return next;
        }
        return prev;
      }
      const hasValue = isArrayField
        ? Array.isArray(nextValue) && nextValue.length > 0
        : !isEmptyValue(nextValue);
      if (hasValue) {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      }
      return prev;
    });
  };

  const handleAppointmentTypeChange = (event) => {
    const nextType = normalizeAppointmentTypeValue(event?.target?.value);
    const syntheticEvent = { target: { value: nextType, name: "appointmentType" } };
    if (isAddMode) {
      handleValidatedChange("appointmentType")(syntheticEvent);
    } else {
      handleChange("appointmentType")(syntheticEvent);
    }
    if (!appointmentTypeShowsBargeFields(nextType)) {
      ["bargeType", "bargeName", "bargeOwner"].forEach((fieldName) => {
        handleChange(fieldName)({ target: { value: "", name: fieldName } });
      });
    }
  };

  const handleServiceRequestorEmailChange = useCallback(
    (event) => {
      const nextVal = event?.target?.value ?? "";
      if (isAddMode) {
        handleValidatedChange("serviceRequestorEmail")(event);
      } else {
        handleChange("serviceRequestorEmail")(event);
      }
      setEditablePreviewFields((prev) =>
        prev.to_email === nextVal ? prev : { ...prev, to_email: nextVal }
      );
    },
    [handleChange, handleValidatedChange, isAddMode]
  );

  const handleEditablePreviewFieldChange = useCallback(
    (fieldName) => (event) => {
      const nextVal = event?.target?.value ?? "";
      setTouchedPreviewFields((prev) => ({
        ...prev,
        [fieldName]: true,
      }));
      setEditablePreviewFields((prev) => ({
        ...prev,
        [fieldName]: nextVal,
      }));
      if (fieldName === "to_email") {
        const currentServiceEmail = String(getFieldValue("serviceRequestorEmail") ?? "");
        if (currentServiceEmail !== nextVal) {
          const syncEvent = {
            target: { name: "serviceRequestorEmail", value: nextVal },
          };
          if (isAddMode) {
            handleValidatedChange("serviceRequestorEmail")(syncEvent);
          } else {
            handleChange("serviceRequestorEmail")(syncEvent);
          }
        }
      }
    },
    [getFieldValue, handleChange, handleValidatedChange, isAddMode]
  );

  const normalizeText = (value = "") =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const parseEmailDateToParts = (value = "") => {
    const clean = String(value).replace(/\s+/g, " ").trim();
    const d = new Date(clean);
    if (Number.isNaN(d.getTime())) return { date: "", time: "" };
    const hasExplicitTime = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/i.test(clean);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = hasExplicitTime ? String(d.getHours()).padStart(2, "0") : "";
    const min = hasExplicitTime ? String(d.getMinutes()).padStart(2, "0") : "";

    return {
      date: `${yyyy}-${mm}-${dd}`,
      time: hh && min ? `${hh}:${min}` : "",
    };
  };

  const parseOutlookHeaderDateTime = (value = "") => {
    const source = String(value || "").replace(/\s+/g, " ").trim();
    if (!source) return { date: "", time: "" };

    const normalized = source
      .replace(/^(?:Sent|Date)\s*:\s*/i, "")
      .replace(/^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?[\s,]+/i, "")
      .replace(/^at\s+/i, "")
      .trim();

    const slash12hMatch = normalized.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+|,\s*)(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    );
    if (slash12hMatch) {
      const dd = Number(slash12hMatch[1]);
      const mm = Number(slash12hMatch[2]);
      const yyyy = Number(slash12hMatch[3]);
      const hour12 = Number(slash12hMatch[4]);
      const minute = Number(slash12hMatch[5]);
      const meridiem = String(slash12hMatch[6] || "").toUpperCase();

      if (!dd || !mm || !yyyy || !hour12 || minute > 59 || !["AM", "PM"].includes(meridiem)) {
        return { date: "", time: "" };
      }

      let hour24 = hour12 % 12;
      if (meridiem === "PM") hour24 += 12;

      return {
        date: `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
        time: `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      };
    }

    const parsed = parseEmailDateToParts(normalized);
    if (parsed?.date) return parsed;
    return { date: "", time: "" };
  };

  const extractFirstEmail = (value = "") => {
    const source = String(value || "");
    const normalized = source.replace(/mailto:/gi, " ");
    const match = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? String(match[0] || "").replace(/[>),;:\s]+$/g, "").trim() : "";
  };

  const resolveMsgReceivedDateTime = (msgData = {}, extractedText = "") => {
    const tryParseDateTime = (value) => {
      const source = String(value || "").trim();
      if (!source) return { date: "", time: "" };
      const parsedHeader = parseOutlookHeaderDateTime(source);
      if (parsedHeader?.date && parsedHeader?.time) return parsedHeader;
      const parsedGeneric = parseEmailDateToParts(source);
      if (parsedGeneric?.date && parsedGeneric?.time) return parsedGeneric;
      return { date: "", time: "" };
    };

    const metadataCandidates = [
      msgData?.sentDate,
      msgData?.messageDeliveryTime,
      msgData?.clientSubmitTime,
      msgData?.deliveryTime,
      msgData?.date,
      msgData?.creationTime,
      msgData?.lastModificationTime,
      msgData?.messageDate,
      msgData?.messageDateTime,
    ];

    for (const candidate of metadataCandidates) {
      const parsed = tryParseDateTime(candidate);
      if (parsed?.date) return parsed;
    }

    const rawHeaderSources = [
      msgData?.headers,
      msgData?.transportMessageHeaders,
      msgData?.messageHeaders,
    ]
      .filter((item) => item !== undefined && item !== null)
      .map((item) => {
        if (typeof item === "string") return item;
        if (Array.isArray(item)) return item.map((part) => String(part || "")).join("\n");
        if (typeof item === "object") {
          const keyValueText = Object.entries(item)
            .map(([key, val]) => `${key}: ${String(val ?? "")}`)
            .join("\n");
          return `${keyValueText}\n${JSON.stringify(item)}`;
        }
        return String(item);
      });

    const rawHeaderText = rawHeaderSources.join("\n");
    if (rawHeaderText) {
      const lineMatches = [...rawHeaderText.matchAll(/(?:^|\n)\s*(Date|Sent)\s*:\s*([^\n]+)/gi)];
      for (const match of lineMatches) {
        const parsed = tryParseDateTime(match?.[2] || "");
        if (parsed?.date) return parsed;
      }

      const inlinePatterns = [
        /\b(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM))\b/i,
        /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[+-]\d{4})?)\b/i,
      ];
      for (const pattern of inlinePatterns) {
        const match = rawHeaderText.match(pattern);
        const parsed = tryParseDateTime(match?.[1] || "");
        if (parsed?.date) return parsed;
      }
    }

    const source = String(extractedText || "");
    const headerPatterns = [
      /(?:^|\n)\s*Sent:\s*([^\n]+)/i,
      /(?:^|\n)\s*Date:\s*([^\n]+)/i,
      /(?:^|\n)\s*(?:From|To|Cc):[^\n]*\b(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM))\b/i,
      /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[+-]\d{4})?)\b/i,
    ];

    for (const pattern of headerPatterns) {
      const match = source.match(pattern);
      const headerValue = String(match?.[1] || "").trim();
      if (!headerValue) continue;
      const parsed = tryParseDateTime(headerValue);
      if (parsed?.date) return parsed;
    }

    return { date: "", time: "" };
  };

  const extractEmailHeaderDetails = (text = "") => {
    const source = String(text || "");
    const extracted = {
      fromName: "",
      fromEmail: "",
      sentDateTime: "",
      portText: "",
      serviceText: "",
      fullText: source,
    };

    const fromMatch = source.match(/From:\s*([^\n<]+?)\s*<([^>]+)>/i);
    if (fromMatch) {
      extracted.fromName = fromMatch[1].trim();
      extracted.fromEmail = fromMatch[2].trim();
    } else {
      const fromLineMatch = source.match(/From:\s*([^\n]+)/i);
      if (fromLineMatch) extracted.fromName = fromLineMatch[1].replace(/\s*<\s*>$/, "").trim();
    }

    if (!extracted.fromName || !extracted.fromEmail) {
      const onWroteMatch = source.match(/On\s+.+?\s+at\s+\d{1,2}:\d{2}\s*[AP]M\s+(.+?)\s*<([^>]+)>\s*wrote:/i);
      if (onWroteMatch) {
        if (!extracted.fromName) extracted.fromName = String(onWroteMatch[1] || "").trim();
        if (!extracted.fromEmail) extracted.fromEmail = String(onWroteMatch[2] || "").trim();
      }
    }

    if (!extracted.fromEmail) {
      const email = extractFirstEmail(source);
      if (email) extracted.fromEmail = email;
    }

    if (!extracted.fromName) {
      const nameEmailMatch = source.match(/([^\n<>]+?)\s*<\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\s*>/i);
      if (nameEmailMatch) {
        extracted.fromName = nameEmailMatch[1].replace(/^From:\s*/i, "").trim();
        extracted.fromEmail = nameEmailMatch[2].trim();
      }
    }

    const sentMatch = source.match(
      /Sent:\s*((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i
    );
    if (sentMatch) {
      extracted.sentDateTime = sentMatch[1].trim();
    } else {
      const onDateMatch = source.match(/On\s+([A-Za-z]{3,9},?\s+[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*[AP]M)/i);
      if (onDateMatch) extracted.sentDateTime = onDateMatch[1].trim();
    }

    const portOfCallMatch = source.match(/Port\s*of\s*call\s*:\s*([^\n]+)/i);
    if (portOfCallMatch) {
      extracted.portText = portOfCallMatch[1].trim();
    }

    const activityMatch = source.match(/Activity\s*:\s*([^\n]+)/i);
    if (activityMatch) {
      extracted.serviceText = activityMatch[1].trim();
    }

    if (!extracted.portText && /rt\s*anchorage|rt\s*port|rastanura|ras\s*tanura/i.test(source)) {
      extracted.portText = "Ras Tanura";
    }

    if (!extracted.serviceText) {
      if (/inward\s*clearance|import/i.test(source)) {
        extracted.serviceText = "Import";
      } else if (/outward\s*clearance|export/i.test(source)) {
        extracted.serviceText = "Export";
      }
    }

    return extracted;
  };

  const findMatchingOption = (options = [], extractedText = "") => {
    let target = normalizeText(extractedText);
    if (!target) return null;

    if (/(^rt$|rt port|rt anchorage|rastanura|ras tanura)/.test(target)) {
      target = "ras tanura";
    } else if (/(import|inward|inward clearance)/.test(target)) {
      target = "import";
    } else if (/(export|outward|export clearance|outward clearance)/.test(target)) {
      target = "export";
    }

    return (
      options.find((option) => {
        let label = normalizeText(option?.label);
        if (/(^rt$|rt port|rt anchorage|rastanura|ras tanura)/.test(label)) {
          label = "ras tanura";
        } else if (/(import|inward|inward clearance)/.test(label)) {
          label = "import";
        } else if (/(export|outward|export clearance|outward clearance)/.test(label)) {
          label = "export";
        }
        return label.includes(target) || target.includes(label);
      }) || null
    );
  };

  const setFieldIfEmpty = (name, value) => {
    if (!firstNonEmptyString(value)) return false;

    const currentValue = getFieldValue(name);
    if (currentValue !== undefined && currentValue !== null && String(currentValue).trim() !== "") {
      return false;
    }

    handleChange(name)({
      target: {
        name,
        value,
      },
    });
    return true;
  };

  const fillIfEmpty = (fieldName, value) => {
    setFieldIfEmpty(fieldName, value);
  };

  const updateFormValue = (fieldName, value) => {
    handleChange(fieldName)({
      target: {
        name: fieldName,
        value,
      },
    });
  };

  const applyAppointmentReceivedDateTime = (receivedParts) => {
    if (!receivedParts?.date || !receivedParts?.time) return false;

    const combinedMinute = `${receivedParts.date} ${receivedParts.time}`;
    const combinedSecond = `${combinedMinute}:00`;

    updateFormValue("appointmentReceivedDate", receivedParts.date);
    updateFormValue("appointmentReceivedTime", receivedParts.time);
    updateFormValue("appointmentReceived", combinedMinute);
    updateFormValue("appointmentReceivedDateTime", combinedMinute);
    updateFormValue("appointment_received_date", combinedSecond);
    console.log("[Appointment Received Applied]", {
      date: receivedParts.date,
      time: receivedParts.time,
      combined: combinedMinute,
    });
    return true;
  };

  const applyAllDetailByVesselResponse = (payload) => {
    const data = unwrapAllDetailResponse(payload);
    if (!data) return;

    ALL_DETAIL_SCALAR_FIELD_MAP.forEach(([apiKey, formKey]) => {
      setFieldIfEmpty(formKey, data[apiKey]);
    });

    const callTypeId = firstNonEmptyString(data.call_type_id, data.call_type);
    if (callTypeId) {
      setFieldIfEmpty("typeOfCall", callTypeId);
      setFieldIfEmpty("call_type_id", callTypeId);
    }

    const srtNumber = firstNonEmptyString(data.srt_number);
    if (srtNumber) {
      setFieldIfEmpty("srtPoWbs", srtNumber);
    }

    const appointmentParts = splitApiDateTimeValue(data.appointment_received_date);
    if (appointmentParts.date && appointmentParts.time) {
      const currentDate = getFieldValue("appointmentReceivedDate");
      const currentTime = getFieldValue("appointmentReceivedTime");
      if (!firstNonEmptyString(currentDate) || !firstNonEmptyString(currentTime)) {
        applyAppointmentReceivedDateTime(appointmentParts);
      }
    }

    const timeRows = Array.isArray(data.time_objects) ? data.time_objects : [];
    if (timeRows.length) {
      setStageTimeObjectValues((prev) => {
        let changed = false;
        const next = { ...prev };
        timeRows.forEach((item) => {
          const timeObjectId = firstNonEmptyString(item?.time_object_id);
          const rawValue = firstNonEmptyString(item?.time_object_value, item?.value, item?.event_datetime);
          if (!timeObjectId || !rawValue) return;
          const existing = prev?.[timeObjectId];
          if (firstNonEmptyString(existing?.date) && firstNonEmptyString(existing?.time)) return;
          const parsed = splitApiDateTimeValue(rawValue);
          if (!parsed.date || !parsed.time) return;
          next[timeObjectId] = parsed;
          changed = true;
        });
        return changed ? next : prev;
      });
    }

    if (data.appointment_acceptance && typeof data.appointment_acceptance === "object") {
      setAppointmentAcceptanceFromApi(data.appointment_acceptance);
    } else {
      setAppointmentAcceptanceFromApi(null);
    }

    const resolvedPreview = resolveEmailPreviewPayload(payload);
    if (resolvedPreview) {
      setEmailPreviewData(resolvedPreview);
      setPreviewMessageText(
        resolvedPreview.messageHtml || resolvedPreview.message || ""
      );
      setIsPreviewMessageDirty(false);
      setPreviewMessageEditorKey((key) => key + 1);
      setTouchedPreviewFields({
        from_email: false,
        to_email: false,
        cc_emails: false,
        subject: false,
      });
      setEditablePreviewFields({
        from_email: firstNonEmptyString(resolvedPreview?.from),
        to_email: firstNonEmptyString(resolvedPreview?.to),
        cc_emails: firstNonEmptyString(resolvedPreview?.cc),
        subject: firstNonEmptyString(resolvedPreview?.subject),
      });
    }
  };

  const resetAppointmentEmailExtractedValues = () => {
    updateFormValue("appointmentReceivedDate", "");
    updateFormValue("appointmentReceivedTime", "");
    updateFormValue("appointmentReceived", "");
    updateFormValue("appointmentReceivedDateTime", "");
    updateFormValue("appointment_received_date", "");
    updateFormValue("port", "");
    updateFormValue("typeOfCall", "");
    updateFormValue("call_type_id", "");
    updateFormValue("vesselName", "");
    updateFormValue("serviceRequestorName", "");
    updateFormValue("serviceRequestorEmail", "");

    setPreviewMessageText("");
    setPreviewMessageEditorKey(0);
    setEmailPreviewData(null);
    setAppointmentAcceptanceFromApi(null);
    setIsPreviewMessageDirty(false);
    resetTouchedPreviewFields();
    setEditablePreviewFields({
      from_email: "",
      to_email: "",
      cc_emails: "",
      subject: "",
    });
    setAiExtractionError("");
  };

  const applyNonAiAppointmentFields = (extracted, receivedParts, msgSenderDetails = null) => {
    let filledCount = 0;
    const fallbackEmail = extractFirstEmail(extracted?.fullText);
    const resolvedRequestorName =
      firstNonEmptyString(msgSenderDetails?.extractedName) ||
      firstNonEmptyString(extracted?.fromName);
    const resolvedRequestorEmail =
      firstNonEmptyString(msgSenderDetails?.extractedEmail) ||
      firstNonEmptyString(extracted?.fromEmail) ||
      fallbackEmail;
    console.log("[Appointment Non-AI Parse] resolved sender", {
      fromName: extracted?.fromName,
      msgSenderName: msgSenderDetails?.extractedName,
      resolvedRequestorName,
      fromEmail: extracted?.fromEmail,
      msgSenderEmail: msgSenderDetails?.extractedEmail,
      fallbackEmail,
      resolvedRequestorEmail,
    });
    if (applyAppointmentReceivedDateTime(receivedParts)) filledCount += 1;
    if (setFieldIfEmpty("serviceRequestorName", resolvedRequestorName)) filledCount += 1;
    if (setFieldIfEmpty("serviceRequestorEmail", resolvedRequestorEmail)) filledCount += 1;

    const matchedPort = findMatchingOption(portSelectOptions, extracted?.portText);
    if (matchedPort && setFieldIfEmpty("port", String(matchedPort.value ?? ""))) {
      filledCount += 1;
    }

    const matchedCallType = findMatchingOption(callTypeOptions, extracted?.serviceText);
    if (matchedCallType && setFieldIfEmpty("typeOfCall", String(matchedCallType.value ?? ""))) {
      setFieldIfEmpty("call_type_id", String(matchedCallType.value ?? ""));
      filledCount += 1;
    }

    return filledCount;
  };

  const applyGeminiAppointmentExtraction = useCallback(
    async (text, msgMetadataDate = "") => {
      const extracted = await extractAppointmentDetailsWithGemini(text);
      const normalizedAppointmentDate =
        normalizeAppointmentDateTime(firstNonEmptyString(extracted?.appointment_received_date)) ||
        normalizeAppointmentDateTime(msgMetadataDate);

      if (normalizedAppointmentDate) {
        const receivedParts = splitApiDateTimeValue(normalizedAppointmentDate);
        if (receivedParts.date && receivedParts.time) {
          applyAppointmentReceivedDateTime(receivedParts);
        }
      }

      const matchedPort = findMatchingOption(portSelectOptions, extracted?.port);
      if (matchedPort) {
        fillIfEmpty("port", String(matchedPort.value ?? ""));
      }

      const matchedCallType = findMatchingOption(callTypeOptions, extracted?.type_of_call);
      if (matchedCallType) {
        const callTypeValue = String(matchedCallType.value ?? "");
        fillIfEmpty("typeOfCall", callTypeValue);
        fillIfEmpty("call_type_id", callTypeValue);
      }

      const matchedVessel = findMatchingOption(vesselNameOptions, extracted?.vessel_name);
      if (matchedVessel) {
        fillIfEmpty("vesselName", String(matchedVessel.value ?? ""));
      }

      fillIfEmpty("serviceRequestorName", extracted?.service_requestor_name);
      fillIfEmpty("serviceRequestorEmail", extracted?.service_requestor_email);
      notify("Appointment details extracted successfully.", "success");
    },
    [callTypeOptions, fillIfEmpty, findMatchingOption, portSelectOptions, vesselNameOptions, applyAppointmentReceivedDateTime]
  );

  const applyBeAppointmentExtraction = useCallback(
    async (file) => {
      const { data: responsePayload } = await mailService.readEmail(file);
      const data = responsePayload?.data ?? responsePayload ?? {};
      let filledCount = 0;

      const receivedRaw = firstNonEmptyString(data.appointment_received_date);
      if (receivedRaw) {
        const normalized =
          normalizeAppointmentDateTime(receivedRaw) || firstNonEmptyString(receivedRaw);
        const receivedParts = splitApiDateTimeValue(normalized);
        if (receivedParts.date && receivedParts.time && applyAppointmentReceivedDateTime(receivedParts)) {
          filledCount += 1;
        }
      }

      if (setFieldIfEmpty("serviceRequestorName", data.service_requestor_name)) filledCount += 1;
      if (setFieldIfEmpty("serviceRequestorEmail", data.service_requestor_email)) filledCount += 1;

      const portValue = firstNonEmptyString(data.port_id, data.port);
      if (portValue) {
        const portById = portSelectOptions.find((option) => String(option?.value ?? "") === String(portValue));
        const matchedPort = portById || findMatchingOption(portSelectOptions, portValue);
        if (matchedPort && setFieldIfEmpty("port", String(matchedPort.value ?? ""))) {
          filledCount += 1;
        }
      }

      const callTypeValue = firstNonEmptyString(data.call_type_id, data.call_type);
      if (callTypeValue) {
        const callTypeById = callTypeOptions.find(
          (option) => String(option?.value ?? "") === String(callTypeValue)
        );
        const matchedCallType = callTypeById || findMatchingOption(callTypeOptions, callTypeValue);
        if (matchedCallType) {
          const callTypeId = String(matchedCallType.value ?? "");
          if (setFieldIfEmpty("typeOfCall", callTypeId)) filledCount += 1;
          setFieldIfEmpty("call_type_id", callTypeId);
        }
      }

      const subject = firstNonEmptyString(data.subject);
      const body = firstNonEmptyString(data.body, data.message, data.message_html, data.email_body);
      if (subject) {
        setTouchedPreviewFields((touched) => {
          if (!touched.subject) {
            setEditablePreviewFields((prev) => ({ ...prev, subject }));
          }
          return touched;
        });
      }
      if (body) {
        setPreviewMessageText(body);
        setPreviewMessageEditorKey((key) => key + 1);
        setIsPreviewMessageDirty(true);
      }

      if (filledCount > 0 || subject || body) {
        notify("Appointment details extracted successfully.", "success");
      } else {
        notify("File uploaded, but no matching appointment details found.", "warning");
      }
    },
    [
      applyAppointmentReceivedDateTime,
      callTypeOptions,
      findMatchingOption,
      portSelectOptions,
      setFieldIfEmpty,
    ]
  );

  const isMsgFile = (file) => file?.name?.toLowerCase()?.endsWith(".msg");

  const extractMsgAppointmentText = async (file) => {
    const buffer = await file.arrayBuffer();
    const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const MsgReaderConstructor =
      MsgReaderModule.default ||
      MsgReaderModule.MsgReader ||
      MsgReaderModule;

    if (typeof MsgReaderConstructor !== "function") {
      console.error("[MSG Reader Module]", MsgReaderModule);
      throw new Error("MSG reader constructor not found");
    }

    const msgReader = new MsgReaderConstructor(uint8Array);
    const msgInfo = msgReader.getFileData();
    console.log("[MSG FULL DATA]", msgInfo);
    console.log("[MSG HEADER RAW]", msgInfo?.headers || msgInfo?.transportMessageHeaders || msgInfo?.messageHeaders);
    console.log("[Appointment Non-AI Parse] MSG raw data", msgInfo);

    const body = msgInfo.body || msgInfo.bodyHTML || "";
    const subject = msgInfo.subject || "";
    const { extractedName, extractedEmail } = parseMsgSenderDetails(msgInfo);
    const senderName = extractedName || msgInfo.senderName || msgInfo.from || "";
    const senderEmail =
      extractedEmail ||
      extractFirstEmailFromText(
        [
          msgInfo.senderEmail,
          msgInfo.senderEmailAddress,
          msgInfo.senderSmtpAddress,
          msgInfo.senderName,
          msgInfo.from,
          msgInfo.fromEmail,
        ]
          .filter(Boolean)
          .join(" ")
      ) ||
      msgInfo.senderEmail ||
      msgInfo.senderEmailAddress ||
      msgInfo.senderSmtpAddress ||
      msgInfo.fromEmail ||
      "";
    const messageDeliveryTime = msgInfo.messageDeliveryTime || "";
    const clientSubmitTime = msgInfo.clientSubmitTime || "";
    const emailDate = resolveMsgEmailDate(msgInfo);

    const extractedText = `
Email Metadata:
Sender Name: ${senderName}
Sender Email: ${senderEmail}
Subject: ${subject}
Date: ${emailDate}
Message Delivery Time: ${messageDeliveryTime}
Client Submit Time: ${clientSubmitTime}

Email Body:
${body}
`.trim();
    return {
      extractedText,
      msgData: msgInfo,
      metadata: {
        emailDate,
        senderName,
        senderEmail,
        serviceRequestorName: extractedName,
        serviceRequestorEmail: extractedEmail,
        subject,
      },
    };
  };

  // Handle document upload
  const handleAppointmentDocumentAdd = async (file) => {
    if (!file) return;
    const hasExistingAppointmentFile = Array.isArray(appointmentDocuments) && appointmentDocuments.length > 0;
    if (hasExistingAppointmentFile) {
      resetAppointmentEmailExtractedValues();
    }
    setAppointmentDocuments([file]);
    setFieldErrors((prev) => {
      if (!prev.appointmentEmailDocuments) return prev;
      const next = { ...prev };
      delete next.appointmentEmailDocuments;
      return next;
    });

    try {
      setIsAiExtractingAppointment(true);
      setAiExtractionError("");

      if (appointmentExtractionMode === "be") {
        setIsServerEmailReading(true);
        try {
          await applyBeAppointmentExtraction(file);
        } finally {
          setIsServerEmailReading(false);
        }
        return;
      }

      let extractedText = "";
      let msgData = null;
      let msgMetadataEmailDate = "";
      if (isMsgFile(file)) {
        const parsedMsg = await extractMsgAppointmentText(file);
        extractedText = firstNonEmptyString(parsedMsg?.extractedText);
        msgData = parsedMsg?.msgData || null;
        msgMetadataEmailDate = firstNonEmptyString(parsedMsg?.metadata?.emailDate);
      } else {
        extractedText = await extractTextFromFile(file);
      }
      console.log("[Appointment Non-AI] msgData keys", Object.keys(msgData || {}));
      console.log("[Appointment Non-AI] msgData raw", msgData);
      console.log("[Appointment Non-AI] extractedText first 500", extractedText?.slice(0, 500));
      console.log("[Appointment Non-AI Parse] upload text", extractedText);
      if (!firstNonEmptyString(extractedText)) {
        notify("File uploaded, but no matching appointment details found.", "warning");
        return;
      }

      if (appointmentExtractionMode === "ai") {
        await applyGeminiAppointmentExtraction(extractedText, msgMetadataEmailDate);
        return;
      }

      const extracted = extractEmailHeaderDetails(extractedText);
      const msgSenderDetails = msgData ? parseMsgSenderDetails(msgData) : null;
      const receivedParts = resolveMsgReceivedDateTime(msgData, extractedText);
      console.log("[Appointment Non-AI] resolved received date", receivedParts);
      console.log("[Appointment Non-AI Parse] extracted", extracted);
      console.log("[Appointment Non-AI Parse] msg sender", msgSenderDetails);
      const filledCount = applyNonAiAppointmentFields(extracted, receivedParts, msgSenderDetails);
      const appointmentReceivedDate = getFieldValue("appointmentReceivedDate");
      const appointmentReceivedTime = getFieldValue("appointmentReceivedTime");
      const appointmentReceived = getFieldValue("appointmentReceived");
      const appointmentReceivedDateTime = getFieldValue("appointmentReceivedDateTime");
      const appointment_received_date = getFieldValue("appointment_received_date");
      console.log("[Appointment Non-AI] current appointment fields after bind", {
        appointmentReceivedDate,
        appointmentReceivedTime,
        appointmentReceived,
        appointmentReceivedDateTime,
        appointment_received_date,
      });
      if (filledCount > 0) {
        notify("Appointment details auto-filled from uploaded email.", "success");
      } else {
        notify("File uploaded, but no matching appointment details found.", "warning");
      }
    } catch (error) {
      const isBeMode = appointmentExtractionMode === "be";
      if (isBeMode) {
        console.error("[Appointment BE Extraction] failed", error);
        const beMessage =
          firstNonEmptyString(error?.response?.data?.message, error?.response?.data?.error, error?.message) ||
          "Backend email extraction failed.";
        notify(beMessage, "error");
        setAiExtractionError(beMessage);
      } else {
        console.error("Appointment non-AI extraction failed", error);
        const isUnsupportedFormat = error?.message === "UNSUPPORTED_FILE_FORMAT";
        const quotaErrorText = firstNonEmptyString(error?.message);
        const isQuotaExceeded = quotaErrorText.toLowerCase().includes("gemini quota exceeded");
        const retrySecondsMatch = quotaErrorText.match(/retry after (\d+) seconds/i);
        const retrySeconds = retrySecondsMatch?.[1] || "20";
        if (isUnsupportedFormat) {
          notify("Unsupported file format for AI extraction.", "warning");
        } else if (isQuotaExceeded) {
          notify(`Gemini quota exceeded. Please try again after ${retrySeconds} seconds or check API quota.`, "error");
        } else {
          notify("File uploaded, but auto-fill failed.", "warning");
        }
        setAiExtractionError(firstNonEmptyString(error?.message) || "AI extraction failed");
      }
    } finally {
      setIsAiExtractingAppointment(false);
    }
  };

  const handleDocumentRemove = (index) => {
    setAppointmentDocuments((prev) => prev.filter((_, i) => i !== index));
    resetAppointmentEmailExtractedValues();
    console.log("[Appointment Email] removed, extracted values reset");
  };

  const normalizeEntityEmailOptions = useCallback((payload) => {
    const root = payload?.data ?? payload ?? {};
    const rows = Array.isArray(root?.emails) ? root.emails : [];
    return rows
      .map((row) => {
        const email = row?.email ? String(row.email).trim() : "";
        if (!email) return null;
        const refRaw = row?.reference ?? row?.email_id ?? row?.id;
        if (refRaw === undefined || refRaw === null || String(refRaw).trim() === "") {
          return { value: email, label: email };
        }
        return { value: String(refRaw).trim(), label: email };
      })
      .filter(Boolean);
  }, []);

  const fetchBillingEntityEmails = useCallback(
    async (entityId) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setDailyReportEmailOptions([]);
        return [];
      }

      setDailyReportEmailLoading(true);
      try {
        const { data } = await billingEntityService.getAllEmailByEntity(normalizedEntityId);
        const opts = normalizeEntityEmailOptions(data);
        setDailyReportEmailOptions(opts);
        return opts;
      } catch (error) {
        console.error("[General] billing entity emails fetch failed", error);
        setDailyReportEmailOptions([]);
        return [];
      } finally {
        setDailyReportEmailLoading(false);
      }
    },
    [normalizeEntityEmailOptions]
  );

  const normalizeBillingInstruction = useCallback((payload) => {
    const root = payload?.data ?? payload ?? {};
    const data = root?.data ?? root ?? {};
    const instructionType = data?.instruction_type ? String(data.instruction_type).trim() : "";
    const description = data?.description ? String(data.description) : "";
    const emails = Array.isArray(data?.emails) ? data.emails : [];
    const emailOptions = emails
      .map((row) => {
        if (typeof row === "string") {
          const normalizedEmail = row.trim();
          return normalizedEmail ? { value: normalizedEmail, label: normalizedEmail } : null;
        }
        const email = row?.email ? String(row.email).trim() : "";
        if (!email) return null;
        const refRaw = row?.reference ?? row?.email_id ?? row?.id;
        if (refRaw === undefined || refRaw === null || String(refRaw).trim() === "") {
          return { value: email, label: email };
        }
        return { value: String(refRaw).trim(), label: email };
      })
      .filter(Boolean);

    return { instructionType, description, emailOptions };
  }, []);

  const fetchBillingInstructionByEntity = useCallback(
    async (entityId) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setBillingInstructionType("");
        setBillingInstructionEmailOptions([]);
        handleChange("billingInstructions")({ target: { value: "", name: "billingInstructions" } });
        handleChange("billingInstructionEmails")({ target: { value: [], name: "billingInstructionEmails" } });
        return;
      }

      setBillingInstructionLoading(true);
      try {
        const { data } = await billingInstructionService.fetchInstructionByEntity(normalizedEntityId);
        const { instructionType, description, emailOptions } = normalizeBillingInstruction(data);
        setBillingInstructionType(instructionType);
        setBillingInstructionEmailOptions(emailOptions);

        const isEmailInstruction = instructionType.toLowerCase() === "email";
        handleChange("billingInstructionEmails")({
          target: { value: isEmailInstruction ? emailOptions.map((opt) => opt.value) : [], name: "billingInstructionEmails" }
        });
        handleChange("billingInstructions")({
          target: { value: isEmailInstruction ? "" : description, name: "billingInstructions" }
        });
      } catch (error) {
        console.error("[General] billing instruction fetch failed", error);
        setBillingInstructionType("");
        setBillingInstructionEmailOptions([]);
        handleChange("billingInstructionEmails")({ target: { value: [], name: "billingInstructionEmails" } });
      } finally {
        setBillingInstructionLoading(false);
      }
    },
    [handleChange, normalizeBillingInstruction]
  );

  useEffect(() => {
    if (isAddMode) return;
    const fileName = callDetailData?.appointment_email ? String(callDetailData.appointment_email).trim() : "";
    if (!fileName) return;
    setAppointmentDocuments([
      {
        name: fileName,
        size: 0,
        type: "application/pdf",
      },
    ]);
  }, [isAddMode, callDetailData?.appointment_email]);

  useEffect(() => {
    if (isAddMode) return;
    const rows = Array.isArray(callDetailData?.daily_report_emails) ? callDetailData.daily_report_emails : [];
    if (!rows.length) return;
    setDailyReportEmailOptions((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      rows.forEach((item) => {
        const idRaw = item?.id ?? item?.email_id ?? item?.reference;
        const id = idRaw === undefined || idRaw === null ? "" : String(idRaw).trim();
        const email = item?.email ? String(item.email).trim() : "";
        if (!id || !email) return;
        if (!next.some((opt) => String(opt.value) === id)) {
          next.push({ value: id, label: email });
        }
      });
      return next;
    });
  }, [isAddMode, callDetailData?.daily_report_emails]);

  useEffect(() => {
    if (isAddMode) return;
    const rows = Array.isArray(callDetailData?.billing_instruction_emails) ? callDetailData.billing_instruction_emails : [];
    if (!rows.length) return;
    setBillingInstructionEmailOptions((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      rows.forEach((item) => {
        const idRaw = item?.id ?? item?.email_id ?? item?.reference;
        const id = idRaw === undefined || idRaw === null ? "" : String(idRaw).trim();
        const email = item?.email ? String(item.email).trim() : "";
        if (!id || !email) return;
        if (!next.some((opt) => String(opt.value) === id)) {
          next.push({ value: id, label: email });
        }
      });
      return next;
    });
    setBillingInstructionType("email");
  }, [isAddMode, callDetailData?.billing_instruction_emails]);

  const normalizeVesselOptions = useCallback((payload) => {
    const rows = unwrapListResponse(payload);
    return rows
      .map((row) => {
        const vesselId = row?.vessel_id === undefined || row?.vessel_id === null ? "" : String(row.vessel_id);
        const vesselName = row?.vessel_name ? String(row.vessel_name).trim() : "";
        if (!vesselId || !vesselName) return null;
        return { value: vesselId, label: vesselName };
      })
      .filter(Boolean);
  }, []);

  const fetchVesselsByEntity = useCallback(
    async (entityId) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setVesselNameOptions([]);
        return;
      }

      setVesselOptionsLoading(true);
      try {
        const { data } = await vesselService.getVesselByEntity(normalizedEntityId);
        setVesselNameOptions(normalizeVesselOptions(data));
      } catch (error) {
        console.error("[General] vessels by entity fetch failed", error);
        setVesselNameOptions([]);
      } finally {
        setVesselOptionsLoading(false);
      }
    },
    [normalizeVesselOptions]
  );

  const normalizeVesselDetails = useCallback((payload) => {
    const raw = payload?.data ?? payload ?? {};
    const detail = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
    return {
      vessel_name: detail?.vessel_name ? String(detail.vessel_name) : "",
      vessel_owner: detail?.vessel_owner ? String(detail.vessel_owner) : "",
      vessel_manager: detail?.vessel_manager ? String(detail.vessel_manager) : "",
      vessel_principal: detail?.vessel_principal ? String(detail.vessel_principal) : "",
    };
  }, []);

  const handleVesselSelectionChange = useCallback(
    async (event) => {
      const selectedVesselId = event?.target?.value ?? "";
      handleChange("vesselName")(event);
      if (hasSubmitted) {
        setFieldErrors((prev) => {
          if (!prev.vesselName) return prev;
          if (!firstNonEmptyString(selectedVesselId)) return prev;
          const next = { ...prev };
          delete next.vesselName;
          return next;
        });
      }

      // Clear details immediately to avoid showing stale data.
      handleChange("vesselOwner")({ target: { value: "", name: "vesselOwner" } });
      handleChange("vesselManager")({ target: { value: "", name: "vesselManager" } });
      handleChange("vesselPrincipal")({ target: { value: "", name: "vesselPrincipal" } });

      const normalizedVesselId = selectedVesselId === undefined || selectedVesselId === null ? "" : String(selectedVesselId).trim();
      if (!normalizedVesselId) return;

      try {
        const { data } = await vesselService.getVesselDetailByVesselId(normalizedVesselId);
        const detail = normalizeVesselDetails(data);
        handleChange("vesselOwner")({ target: { value: detail.vessel_owner, name: "vesselOwner" } });
        handleChange("vesselManager")({ target: { value: detail.vessel_manager, name: "vesselManager" } });
        handleChange("vesselPrincipal")({ target: { value: detail.vessel_principal, name: "vesselPrincipal" } });
      } catch (error) {
        console.error("[General] vessel detail fetch failed", error);
      }
    },
    [handleChange, hasSubmitted, normalizeVesselDetails]
  );

  // Handle new email addition
  const handleAddNewEmail = useCallback(
    async (email) => {
      const normalizedEmail = email ? String(email).trim() : "";
      const currentEntityId = getFieldValue("mainBillingEntity");
      const normalizedEntityId = currentEntityId === undefined || currentEntityId === null ? "" : String(currentEntityId).trim();
      if (!normalizedEmail || !normalizedEntityId) return;

      try {
        await billingEntityService.addBillingEntityEmail({
          entity_id: normalizedEntityId,
          email: normalizedEmail,
        });
        const opts = await fetchBillingEntityEmails(normalizedEntityId);
        const match = opts.find((o) => String(o.label).toLowerCase() === normalizedEmail.toLowerCase());
        if (!match) return;
        const current = getFieldValue("dailyReportEmail");
        const arr = Array.isArray(current) ? [...current] : [];
        const idx = arr.findIndex((v) => String(v).toLowerCase() === normalizedEmail.toLowerCase());
        if (idx >= 0) {
          const next = [...arr];
          next[idx] = match.value;
          handleChange("dailyReportEmail")({ target: { value: next, name: "dailyReportEmail" } });
        }
      } catch (error) {
        console.error("[General] add billing entity email failed", error);
      }
    },
    [getFieldValue, fetchBillingEntityEmails, handleChange]
  );

  const handleAddBillingInstructionEmail = useCallback(
    async (email) => {
      const normalizedEmail = email ? String(email).trim() : "";
      const currentEntityId = getFieldValue("mainBillingEntity");
      const normalizedEntityId = currentEntityId === undefined || currentEntityId === null ? "" : String(currentEntityId).trim();
      if (!normalizedEmail || !normalizedEntityId) return;

      try {
        await billingInstructionService.addBillingInstructionEmail({
          entity_id: normalizedEntityId,
          email: normalizedEmail,
        });
        const { data } = await billingInstructionService.fetchInstructionByEntity(normalizedEntityId);
        const { instructionType, description, emailOptions } = normalizeBillingInstruction(data);
        setBillingInstructionType(instructionType);
        setBillingInstructionEmailOptions(emailOptions);

        const current = getFieldValue("billingInstructionEmails");
        const arr = Array.isArray(current) ? [...current] : [];
        const next = arr.map((v) => {
          const s = v === undefined || v === null ? "" : String(v).trim();
          if (s === "") return v;
          const byRef = emailOptions.find((o) => String(o.value) === s);
          if (byRef) return byRef.value;
          const byLabel = emailOptions.find((o) => String(o.label).toLowerCase() === s.toLowerCase());
          return byLabel ? byLabel.value : v;
        });
        handleChange("billingInstructionEmails")({
          target: { value: next, name: "billingInstructionEmails" },
        });

        const isEmailInstruction = instructionType.toLowerCase() === "email";
        handleChange("billingInstructions")({
          target: { value: isEmailInstruction ? "" : description, name: "billingInstructions" },
        });
      } catch (error) {
        console.error("[General] add billing instruction email failed", error);
      }
    },
    [getFieldValue, handleChange, normalizeBillingInstruction]
  );

  const previewVesselId = firstNonEmptyString(getFieldValue("vesselName"));
  const previewPortId = firstNonEmptyString(getFieldValue("port"));
  const previewCallType = firstNonEmptyString(getFieldValue("typeOfCall"));
  const previewCallTypeId = firstNonEmptyString(getFieldValue("call_type_id"), getFieldValue("typeOfCall"));
  const previewServiceRequestorEmail = firstNonEmptyString(getFieldValue("serviceRequestorEmail"));
  const previewOperatorId = firstNonEmptyString(getFieldValue("assignedOperator"));
  const previewLastPort = firstNonEmptyString(getFieldValue("lastPort"));

  const buildAllDetailPayload = useCallback(
    () => ({
      vessel_id: previewVesselId,
      port_id: previewPortId,
      call_type_id: previewCallTypeId,
      service_requestor_email: previewServiceRequestorEmail,
      operator_id: previewOperatorId,
      last_port: previewLastPort,
      time_objects: buildPreviewTimeObjectsPayload(stageTimeObjects, stageTimeObjectValues),
    }),
    [
      previewVesselId,
      previewPortId,
      previewCallTypeId,
      previewServiceRequestorEmail,
      previewOperatorId,
      previewLastPort,
      stageTimeObjects,
      stageTimeObjectValues,
    ]
  );
  const etaTimeObjectId = useMemo(() => {
    const rows = Array.isArray(stageTimeObjects) ? stageTimeObjects : [];
    const etaField = rows.find(
      (item) => String(item?.time_object ?? "").trim().toLowerCase() === "expected time of arrival"
    );
    return firstNonEmptyString(etaField?.time_object_id);
  }, [stageTimeObjects]);

  useEffect(() => {
    if (!isAddMode) {
      etaDependentRequestIdRef.current += 1;
      etaDependentLastRequestKeyRef.current = "";
      setStageTimeObjects([]);
      setStageTimeObjectValues({});
      setStageTimeObjectsLoading(false);
      setIsEtaDependentTimesLoading(false);
      return;
    }

    etaDependentRequestIdRef.current += 1;
    etaDependentLastRequestKeyRef.current = "";
    setStageTimeObjects([]);
    setStageTimeObjectValues({});
    setIsEtaDependentTimesLoading(false);

    if (!previewPortId || !previewCallType) {
      setStageTimeObjectsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchStageTimeObjects = async () => {
      setStageTimeObjectsLoading(true);
      try {
        const { data } = await stageTimeMappingService.getStageTimeObjects({
          stage_id: 1,
          port_id: previewPortId,
          call_type_id: previewCallType,
        });
        if (cancelled) return;
        const rows = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.time_objects)
            ? data.time_objects
            : Array.isArray(data)
              ? data
              : [];
        const sortedRows = [...rows].sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0));
        setStageTimeObjects(sortedRows);
      } catch (error) {
        console.error("[General] stage time objects fetch failed", error);
        if (!cancelled) {
          setStageTimeObjects([]);
        }
      } finally {
        if (!cancelled) {
          setStageTimeObjectsLoading(false);
        }
      }
    };
    void fetchStageTimeObjects();

    return () => {
      cancelled = true;
    };
  }, [isAddMode, previewPortId, previewCallType]);

  const handleStageTimeObjectChange = useCallback(
    (timeObjectId) => async (nextValues) => {
      const normalizedId = firstNonEmptyString(timeObjectId);
      if (!normalizedId) return;
      const nextDate = firstNonEmptyString(nextValues?.date);
      const nextTime = firstNonEmptyString(nextValues?.time);
      setStageTimeObjectValues((prev) => ({
        ...prev,
        [normalizedId]: { date: nextDate, time: nextTime },
      }));
      if (hasSubmitted) {
        setTimeObjectErrors((prev) => {
          if (!prev?.[normalizedId]) return prev;
          if (!nextDate || !nextTime) return prev;
          const next = { ...prev };
          delete next[normalizedId];
          return next;
        });
      }

      const isEtaField = normalizedId === etaTimeObjectId;
      if (!isEtaField) return;
      if (!isAddMode) return;
      if (!nextDate || !nextTime) return;
      if (!previewPortId || !previewCallType) return;

      const etaDateTime = `${nextDate} ${nextTime}:00`;
      const requestKey = `${etaDateTime}|1|${previewPortId}|${previewCallType}`;
      if (isEtaDependentTimesLoading && etaDependentLastRequestKeyRef.current === requestKey) {
        return;
      }

      etaDependentLastRequestKeyRef.current = requestKey;
      const requestId = etaDependentRequestIdRef.current + 1;
      etaDependentRequestIdRef.current = requestId;
      setIsEtaDependentTimesLoading(true);
      try {
        const { data } = await preArrivalInfoService.getEtaDependentTimes({
          eta_date_time: etaDateTime,
          stage_id: 1,
          port_id: previewPortId,
          call_type_id: previewCallType,
        });
        if (etaDependentRequestIdRef.current !== requestId) return;
        const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const mergedPatch = {};
        rows.forEach((item) => {
          const id = firstNonEmptyString(item?.time_object_id);
          const value = firstNonEmptyString(item?.value, item?.time_object_value, item?.event_datetime);
          if (!id || !value) return;
          const parsed = splitApiDateTimeValue(value);
          if (!parsed.date || !parsed.time) return;
          mergedPatch[id] = parsed;
        });
        if (!Object.keys(mergedPatch).length) return;
        setStageTimeObjectValues((prev) => ({ ...prev, ...mergedPatch }));
        if (hasSubmitted) {
          setTimeObjectErrors((prev) => {
            const next = { ...prev };
            Object.keys(mergedPatch).forEach((tid) => delete next[tid]);
            return next;
          });
        }
      } catch (error) {
        console.error("[General] pre_arrival/get_eta_dependent_times failed", error);
      } finally {
        if (etaDependentRequestIdRef.current === requestId) {
          setIsEtaDependentTimesLoading(false);
        }
      }
    },
    [hasSubmitted, etaTimeObjectId, isAddMode, previewPortId, previewCallType, isEtaDependentTimesLoading]
  );

  useEffect(() => {
    if (!isAddMode) return;
    const hasAllRequiredPreviewFields =
      Boolean(previewVesselId) &&
      Boolean(previewPortId) &&
      Boolean(previewCallType) &&
      Boolean(previewServiceRequestorEmail);

    if (!hasAllRequiredPreviewFields) {
      setEmailPreviewData(null);
      resetTouchedPreviewFields();
      setEditablePreviewFields({
        from_email: "",
        to_email: "",
        cc_emails: "",
        subject: "",
      });
      return;
    }

    let cancelled = false;
    const fetchEmailPreview = async () => {
      try {
        const { data } = await callFileService.getAllDetailByVesselId({
          vessel_id: previewVesselId,
          port_id: previewPortId,
          call_type_id: previewCallType,
          service_requestor_email: previewServiceRequestorEmail,
          operator_id: previewOperatorId,
          last_port: previewLastPort,
          time_objects: buildPreviewTimeObjectsPayload(stageTimeObjects, stageTimeObjectValues),
        });
        if (cancelled) return;
        const resolved = resolveEmailPreviewPayload(data);
        setEmailPreviewData(resolved);
        populateEditablePreviewFields(resolved);
        const apiHtml = firstNonEmptyString(resolved?.messageHtml);
        if (apiHtml && !isPreviewMessageDirty) {
          setPreviewMessageText(apiHtml);
          setPreviewMessageEditorKey((key) => key + 1);
        }
      } catch (error) {
        console.error("[General] email preview fetch failed", error);
        if (!cancelled) {
          setEmailPreviewData(null);
          resetTouchedPreviewFields();
          setEditablePreviewFields({
            from_email: "",
            to_email: "",
            cc_emails: "",
            subject: "",
          });
        }
      }
    };
    void fetchEmailPreview();
    return () => {
      cancelled = true;
    };
  }, [
    isAddMode,
    previewVesselId,
    previewPortId,
    previewCallType,
    previewServiceRequestorEmail,
    previewOperatorId,
    previewLastPort,
    stageTimeObjectValues,
    stageTimeObjects,
    isPreviewMessageDirty,
    populateEditablePreviewFields,
    resetTouchedPreviewFields,
  ]);

  useEffect(() => {
    if (!isAddMode) return;

    const payload = buildAllDetailPayload();
    const hasRequiredIds = Boolean(payload.port_id && payload.call_type_id);
    if (!hasRequiredIds) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      const requestPayload = buildAllDetailPayload();
      if (!requestPayload.port_id || !requestPayload.call_type_id) return;

      const requestId = allDetailByVesselRequestIdRef.current + 1;
      allDetailByVesselRequestIdRef.current = requestId;

      try {
        console.log("[General] all_detail_by_vessel_id payload", requestPayload);
        const response = await callFileService.allDetailByVesselId(requestPayload);
        console.log("[General] all_detail_by_vessel_id response", response?.data);
        if (cancelled || allDetailByVesselRequestIdRef.current !== requestId) return;
        applyAllDetailByVesselResponse(response?.data);
      } catch (error) {
        console.error("[General] all_detail_by_vessel_id failed", error);
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isAddMode,
    buildAllDetailPayload,
    previewVesselId,
    previewPortId,
    previewCallTypeId,
    previewServiceRequestorEmail,
    previewOperatorId,
    previewLastPort,
    stageTimeObjects,
    stageTimeObjectValues,
  ]);

  // Determine if fields should be disabled
  // In simplified mode: always enabled
  // In full mode: disabled when not in add mode (same as before)
  const isDisabled = isSimplifiedMode ? false : !isAddMode;
  const isViewMode = !isAddMode;
  const masterInputsDisabled = isDisabled || masterDataLoading;

  const selectedAppointmentType = normalizeAppointmentTypeValue(
    getFieldValue("appointmentType"),
    isAddMode ? "" : APPOINTMENT_TYPE_TUG
  );
  const isTugSelected = appointmentTypeShowsTugFields(selectedAppointmentType);
  const isTugAndBargeSelected = appointmentTypeShowsBargeFields(selectedAppointmentType);

  // Check if MWP RENEWAL type is selected in simplified mode
  const isMwPRenewal = isSimplifiedMode && getFieldValue("type") === "MWP RENEWAL";

  // Check if CREW CHANGE type is selected in simplified mode (or Type which should show same fields)
  const isCrewChange = isSimplifiedMode && (getFieldValue("type") === "CREW CHANGE" || getFieldValue("type") === "Type");

  // Check if FLEET type is selected in simplified mode
  const isFleet = isSimplifiedMode && getFieldValue("type") === "FLEET";

  // Check if MATERIAL DELIVERY type is selected in simplified mode
  const isMaterialDelivery = isSimplifiedMode && getFieldValue("type") === "MATERIAL DELIVERY";

  // Check if ON STATION type is selected in simplified mode
  const isOnStation = isSimplifiedMode && getFieldValue("type") === "ON STATION";

  const normalizeEntityFields = useCallback((rows) => {
    if (!Array.isArray(rows)) return [];
    const parsed = rows
      .map((row) => {
        const field_id = row?.field_id === undefined || row?.field_id === null ? "" : String(row.field_id);
        const field_name = row?.field_name ? String(row.field_name).trim() : "";
        const field_type = row?.field_type ? String(row.field_type).trim() : "";
        const rawRequired = row?.is_required;
        const is_required =
          rawRequired === 1 || rawRequired === "1" || rawRequired === true ? 1 : 0;
        const seqRaw = row?.sequence_order;
        let sequence_order = 0;
        if (typeof seqRaw === "number" && !Number.isNaN(seqRaw)) {
          sequence_order = seqRaw;
        } else if (seqRaw !== undefined && seqRaw !== null && String(seqRaw).trim() !== "") {
          const n = Number.parseInt(String(seqRaw), 10);
          sequence_order = Number.isNaN(n) ? 0 : n;
        }
        const field_key =
          row?.field_key === undefined || row?.field_key === null ? "" : String(row.field_key).trim();
        return { field_id, field_name, field_type, is_required, sequence_order, field_key };
      })
      .filter((row) => row.field_id && row.field_name);
    return parsed.sort((a, b) => a.sequence_order - b.sequence_order);
  }, []);

  const buildEntityFieldsPayload = useCallback(
    (fields, values) =>
      fields
        .map((field) => {
          const rawValue = values?.[field.field_id];
          const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);
          return {
            field_id: field.field_id,
            field_name: field.field_name,
            value,
          };
        })
        .filter((item) => item.value.trim() !== ""),
    []
  );

  const handleEntityFieldValueChange = useCallback((fieldId) => (event) => {
    const nextValue = event?.target?.value ?? "";
    setEntityFieldValues((prev) => ({
      ...prev,
      [fieldId]: nextValue,
    }));
    setEntityFieldErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const fetchEntityFields = useCallback(
    async (entityId, preservedValues = {}) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setEntityFields([]);
        setEntityFieldValues({});
        setEntityFieldErrors({});
        setEntityFieldsLoading(false);
        setEntityFieldsError("");
        return;
      }

      setEntityFieldsLoading(true);
      setEntityFieldsError("");
      setEntityFieldErrors({});
      try {
        const { data } = await callFileService.getEntityFields(normalizedEntityId);
        const rows = unwrapListResponse(data);
        const normalizedFields = normalizeEntityFields(rows);

        setEntityFields(normalizedFields);
        setEntityFieldValues(() => {
          if (!normalizedFields.length) return {};
          const nextValues = {};
          normalizedFields.forEach((field) => {
            const previousValue = preservedValues?.[field.field_id];
            nextValues[field.field_id] = previousValue === undefined || previousValue === null ? "" : String(previousValue);
          });
          return nextValues;
        });
      } catch (error) {
        console.error("[General] entity fields fetch failed", error);
        setEntityFields([]);
        setEntityFieldValues({});
        setEntityFieldErrors({});
        setEntityFieldsError("Unable to load billing entity fields.");
      } finally {
        setEntityFieldsLoading(false);
      }
    },
    [normalizeEntityFields]
  );

  const handleMainBillingEntityChange = useCallback(
    (event) => {
      const selectedEntityId = event?.target?.value ?? "";
      handleChange("mainBillingEntity")(event);
      handleChange("dailyReportEmail")({
        target: { value: [], name: "dailyReportEmail" }
      });
      handleChange("billingInstructionEmails")({
        target: { value: [], name: "billingInstructionEmails" }
      });
      handleChange("billingInstructions")({
        target: { value: "", name: "billingInstructions" }
      });
      handleChange("vesselName")({ target: { value: "", name: "vesselName" } });
      handleChange("vesselOwner")({ target: { value: "", name: "vesselOwner" } });
      handleChange("vesselManager")({ target: { value: "", name: "vesselManager" } });
      handleChange("vesselPrincipal")({ target: { value: "", name: "vesselPrincipal" } });
      setEntityFields([]);
      setEntityFieldValues({});
      setEntityFieldErrors({});
      setEntityFieldsError("");
      void fetchEntityFields(selectedEntityId);
      void fetchBillingEntityEmails(selectedEntityId);
      void fetchBillingInstructionByEntity(selectedEntityId);
      void fetchVesselsByEntity(selectedEntityId);
    },
    [fetchBillingEntityEmails, fetchBillingInstructionByEntity, fetchEntityFields, fetchVesselsByEntity, handleChange]
  );

  const handleValidatedMainBillingEntityChange = (event) => {
    const nextVal = event?.target?.value ?? "";
    handleMainBillingEntityChange(event);
    if (!hasSubmitted) return;
    setFieldErrors((prev) => {
      if (!prev.mainBillingEntity) return prev;
      const merged = { ...formValues, mainBillingEntity: nextVal };
      const errs = validateGeneralFields(merged);
      if (!errs.mainBillingEntity) {
        const next = { ...prev };
        delete next.mainBillingEntity;
        return next;
      }
      return { ...prev, mainBillingEntity: errs.mainBillingEntity };
    });
  };

  const selectedEntityId = useMemo(
    () => getFieldValue("mainBillingEntity"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAddMode, formValues?.mainBillingEntity, card?.mainBillingEntity, card?.main_billing_entity_id, mappedCallDetail?.mainBillingEntity]
  );

  const optionalOtherBillingEntityOptions = useMemo(() => {
    const current = getFieldValue("otherBillingEntity");
    const base = mergeOptionIfMissing(billingEntitySelectOptions, current);
    return [{ value: "", label: "No Other Billing Entity" }, ...base];
  }, [billingEntitySelectOptions, getFieldValue]);

  useEffect(() => {
    if (!selectedEntityId) return;
    void fetchEntityFields(selectedEntityId);
    void fetchBillingEntityEmails(selectedEntityId);
    if (isAddMode) {
      void fetchBillingInstructionByEntity(selectedEntityId);
    }
    void fetchVesselsByEntity(selectedEntityId);
  }, [
    selectedEntityId,
    isAddMode,
    fetchEntityFields,
    fetchBillingEntityEmails,
    fetchBillingInstructionByEntity,
    fetchVesselsByEntity,
  ]);




  return (
    <div className={`cardform-body card-form-panel general-tab-body ${isViewMode ? "general-tab-body--view-mode" : ""}`}>
      <div className="general-sections-wrapper">
        <div className={`cf-section general-info-section ${isAddMode ? "general-info-section--add-mode" : ""}`}>
          {!isAddMode && (
            <div className="cf-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="cf-section-title">General Information</div>
              {isSimplifiedMode && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ minWidth: "200px" }}>
                    <FormSelect
                      value={getFieldValue("type")}
                      onChange={handleChange("type")}
                      options={typeOptions}
                      placeholder="Select type..."
                      disabled={isDisabled}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="cf-section-body">
            {!isAddMode && callDetailLoading ? (
              <GeneralViewSectionShimmer />
            ) : (
              <div className={isAddMode ? "general-add-mode-wrapper" : "general-view-mode-wrapper"}>
                <div
                  className={`${!isAddMode ? "general-info-three-column general-info-view-with-tasks" : "general-info-two-column general-add-3col-layout general-add-card-layout"} general-tab-form-layout`}
                >
                  <div className={`general-info-left ${isAddMode ? "general-add-form-panel" : ""}`}>
                    <div className={isAddMode ? "general-add-form-scroll" : "general-view-form-scroll"}>
                      <div className="pre-arrival-form">
                        {isFleet ? (
                          <>
                            <OwnerField
                              value={getFieldValue("owner")}
                              onChange={handleChange("owner")}
                              options={mergeOptionIfMissing(ownerOptions, getFieldValue("owner"))}
                              placeholder="Select owner"
                              disabled={masterInputsDisabled}
                            />

                            <FormField label="Billing Entity">
                              <FormSelect
                                value={getFieldValue("billingEntity") || "SS7"}
                                onChange={handleChange("billingEntity")}
                                options={[{ value: "SS7", label: "SS7" }]}
                                placeholder="Select billing entity..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="VESSEL NAME">
                              <FormSelect
                                value={getFieldValue("vesselName") || "MV Ocean Star"}
                                onChange={handleChange("vesselName")}
                                options={[{ value: getFieldValue("vesselName") || "MV Ocean Star", label: getFieldValue("vesselName") || "MV Ocean Star" }]}
                                placeholder="Select vessel name..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="Last moved">
                              <DateTimePickerField
                                dateValue={getFieldValue("lastMovedDate")}
                                timeValue={getFieldValue("lastMovedTime")}
                                onDateChange={handleChange("lastMovedDate")}
                                onTimeChange={handleChange("lastMovedTime")}
                                dateFieldName="lastMovedDate"
                                timeFieldName="lastMovedTime"
                                disabled={isDisabled}
                                placeholder="Select date and time"
                              />
                            </FormField>
                          </>
                        ) : (isCrewChange || isMaterialDelivery) ? (
                          <>
                            <OwnerField
                              value={getFieldValue("owner")}
                              onChange={handleChange("owner")}
                              options={mergeOptionIfMissing(ownerOptions, getFieldValue("owner"))}
                              placeholder="Select owner"
                              disabled={masterInputsDisabled}
                            />

                            <FormField label="Billing Entity">
                              <FormSelect
                                value={getFieldValue("billingEntity") || "SS7"}
                                onChange={handleChange("billingEntity")}
                                options={[{ value: "SS7", label: "SS7" }]}
                                placeholder="Select billing entity..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="SRT|PO|WBS">
                              <FormInput
                                type="text"
                                placeholder="Enter SRT|PO|WBS..."
                                value={getFieldValue("srtPoWbs")}
                                onChange={handleChange("srtPoWbs")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="VESSEL NAME">
                              <FormSelect
                                value={getFieldValue("vesselName") || "MV Ocean Star"}
                                onChange={handleChange("vesselName")}
                                options={[{ value: getFieldValue("vesselName") || "MV Ocean Star", label: getFieldValue("vesselName") || "MV Ocean Star" }]}
                                placeholder="Select vessel name..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="Last moved">
                              <DateTimePickerField
                                dateValue={getFieldValue("lastMovedDate")}
                                timeValue={getFieldValue("lastMovedTime")}
                                onDateChange={handleChange("lastMovedDate")}
                                onTimeChange={handleChange("lastMovedTime")}
                                dateFieldName="lastMovedDate"
                                timeFieldName="lastMovedTime"
                                disabled={isDisabled}
                                placeholder="Select date and time"
                              />
                            </FormField>

                            <FormField label="Inward Clearance Date">
                              <DateTimePickerField
                                dateValue={getFieldValue("inwardClearanceDate")}
                                timeValue={getFieldValue("inwardClearanceTime")}
                                onDateChange={handleChange("inwardClearanceDate")}
                                onTimeChange={handleChange("inwardClearanceTime")}
                                dateFieldName="inwardClearanceDate"
                                timeFieldName="inwardClearanceTime"
                                disabled={isDisabled}
                                placeholder="Select date and time"
                              />
                            </FormField>

                            <FormField label="Outward Clearance Date">
                              <DateTimePickerField
                                dateValue={getFieldValue("outwardClearanceDate")}
                                timeValue={getFieldValue("outwardClearanceTime")}
                                onDateChange={handleChange("outwardClearanceDate")}
                                onTimeChange={handleChange("outwardClearanceTime")}
                                dateFieldName="outwardClearanceDate"
                                timeFieldName="outwardClearanceTime"
                                disabled={isDisabled}
                                placeholder="Select date and time"
                              />
                            </FormField>

                            <FormField label="Operations completion date">
                              <DateTimePickerField
                                dateValue={getFieldValue("operationsCompletionDate")}
                                timeValue={getFieldValue("operationsCompletionTime")}
                                onDateChange={handleChange("operationsCompletionDate")}
                                onTimeChange={handleChange("operationsCompletionTime")}
                                dateFieldName="operationsCompletionDate"
                                timeFieldName="operationsCompletionTime"
                                disabled={isDisabled}
                                placeholder="Select date and time"
                              />
                            </FormField>

                            <FormField label="Total Onsigners">
                              <FormInput
                                type="number"
                                placeholder="Enter total onsigners..."
                                value={getFieldValue("totalOnsigners")}
                                onChange={handleChange("totalOnsigners")}
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="Total Offsigners">
                              <FormInput
                                type="number"
                                placeholder="Enter total offsigners..."
                                value={getFieldValue("totalOffsigners")}
                                onChange={handleChange("totalOffsigners")}
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="3rd Party Items">
                              <FormInput
                                type="text"
                                placeholder="Enter 3rd party items..."
                                value={getFieldValue("thirdPartyItems")}
                                onChange={handleChange("thirdPartyItems")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="Tax Invoice">
                              <FormInput
                                type="text"
                                placeholder="Enter tax invoice..."
                                value={getFieldValue("taxInvoice")}
                                onChange={handleChange("taxInvoice")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="Invoice amount (Including VAT)">
                              <FormInput
                                type="text"
                                placeholder="Enter invoice amount..."
                                value={getFieldValue("invoiceAmount")}
                                onChange={handleChange("invoiceAmount")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="SAP Sales Order No">
                              <FormSelect
                                value={getFieldValue("sapSalesOrderNo") || "SO-12345"}
                                onChange={handleChange("sapSalesOrderNo")}
                                options={[{ value: getFieldValue("sapSalesOrderNo") || "SO-12345", label: getFieldValue("sapSalesOrderNo") || "SO-12345" }]}
                                placeholder="Select SAP Sales Order No..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="Service requester">
                              <FormSelect
                                value={getFieldValue("serviceRequestorName") || "Service Requester Name"}
                                onChange={handleChange("serviceRequestorName")}
                                options={[{ value: getFieldValue("serviceRequestorName") || "Service Requester Name", label: getFieldValue("serviceRequestorName") || "Service Requester Name" }]}
                                placeholder="Select service requester..."
                                disabled={true}
                              />
                            </FormField>
                          </>
                        ) : isOnStation ? (
                          <>
                            <OwnerField
                              value={getFieldValue("owner")}
                              onChange={handleChange("owner")}
                              options={mergeOptionIfMissing(ownerOptions, getFieldValue("owner"))}
                              placeholder="Select owner"
                              disabled={masterInputsDisabled}
                            />

                            <FormField label="Billing Entity">
                              <FormSelect
                                value={getFieldValue("billingEntity") || "SS7"}
                                onChange={handleChange("billingEntity")}
                                options={[{ value: "SS7", label: "SS7" }]}
                                placeholder="Select billing entity..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="SRT|PO|WBS">
                              <FormInput
                                type="text"
                                placeholder="Enter SRT|PO|WBS..."
                                value={getFieldValue("srtPoWbs")}
                                onChange={handleChange("srtPoWbs")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="Operations completion Date">
                              <DateTimePickerField
                                dateValue={getFieldValue("operationsCompletionDate")}
                                timeValue={getFieldValue("operationsCompletionTime")}
                                onDateChange={handleChange("operationsCompletionDate")}
                                onTimeChange={handleChange("operationsCompletionTime")}
                                dateFieldName="operationsCompletionDate"
                                timeFieldName="operationsCompletionTime"
                                disabled={isDisabled}
                                placeholder="Select date and time"
                              />
                            </FormField>

                            <FormField label="VESSEL NAME">
                              <FormSelect
                                value={getFieldValue("vesselName") || "MV Ocean Star"}
                                onChange={handleChange("vesselName")}
                                options={[{ value: getFieldValue("vesselName") || "MV Ocean Star", label: getFieldValue("vesselName") || "MV Ocean Star" }]}
                                placeholder="Select vessel name..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="Last moved">
                              <DateTimePickerField
                                dateValue={getFieldValue("lastMovedDate")}
                                timeValue={getFieldValue("lastMovedTime")}
                                onDateChange={handleChange("lastMovedDate")}
                                onTimeChange={handleChange("lastMovedTime")}
                                dateFieldName="lastMovedDate"
                                timeFieldName="lastMovedTime"
                                disabled={isDisabled}
                                placeholder="Select date and time"
                              />
                            </FormField>

                            <FormField label="Tax Invoice">
                              <FormInput
                                type="text"
                                placeholder="Enter tax invoice..."
                                value={getFieldValue("taxInvoice")}
                                onChange={handleChange("taxInvoice")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="Invoice amount (Including VAT)">
                              <FormInput
                                type="text"
                                placeholder="Enter invoice amount..."
                                value={getFieldValue("invoiceAmount")}
                                onChange={handleChange("invoiceAmount")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="SAP Sales Order No">
                              <FormSelect
                                value={getFieldValue("sapSalesOrderNo") || "SO-12345"}
                                onChange={handleChange("sapSalesOrderNo")}
                                options={[{ value: getFieldValue("sapSalesOrderNo") || "SO-12345", label: getFieldValue("sapSalesOrderNo") || "SO-12345" }]}
                                placeholder="Select SAP Sales Order No..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="Service requester">
                              <FormSelect
                                value={getFieldValue("serviceRequestorName") || "Service Requester Name"}
                                onChange={handleChange("serviceRequestorName")}
                                options={[{ value: getFieldValue("serviceRequestorName") || "Service Requester Name", label: getFieldValue("serviceRequestorName") || "Service Requester Name" }]}
                                placeholder="Select service requester..."
                                disabled={true}
                              />
                            </FormField>
                          </>
                        ) : isMwPRenewal ? (
                          <>
                            <OwnerField
                              value={getFieldValue("owner")}
                              onChange={handleChange("owner")}
                              options={mergeOptionIfMissing(ownerOptions, getFieldValue("owner"))}
                              placeholder="Select owner"
                              disabled={masterInputsDisabled}
                            />

                            <FormField label="VESSEL NAME">
                              <FormSelect
                                value="MV Ocean Star"
                                onChange={handleChange("vesselName")}
                                options={[{ value: "MV Ocean Star", label: "MV Ocean Star" }]}
                                placeholder="Select vessel name..."
                                disabled={true}
                              />
                            </FormField>

                            <FormField label="Last moved">
                              <DateTimePickerField
                                dateValue={getFieldValue("lastMovedDate")}
                                timeValue={getFieldValue("lastMovedTime")}
                                onDateChange={handleChange("lastMovedDate")}
                                onTimeChange={handleChange("lastMovedTime")}
                                dateFieldName="lastMovedDate"
                                timeFieldName="lastMovedTime"
                                disabled={isDisabled}
                                placeholder="Select date and time"
                              />
                            </FormField>

                            <FormField label="Tax Invoice">
                              <FormInput
                                type="text"
                                placeholder="Enter tax invoice..."
                                value={getFieldValue("taxInvoice")}
                                onChange={handleChange("taxInvoice")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="Invoice amount (Including VAT)">
                              <FormInput
                                type="text"
                                placeholder="Enter invoice amount..."
                                value={getFieldValue("invoiceAmount")}
                                onChange={handleChange("invoiceAmount")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="SAP Sales Order No">
                              <FormInput
                                type="number"
                                placeholder="Enter SAP Sales Order No..."
                                value={getFieldValue("sapSalesOrderNo")}
                                onChange={handleChange("sapSalesOrderNo")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="Service requester">
                              <FormInput
                                type="text"
                                placeholder="Enter service requester..."
                                value={getFieldValue("serviceRequestorName")}
                                onChange={handleChange("serviceRequestorName")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="PO Number">
                              <FormInput
                                type="text"
                                placeholder="Enter PO number..."
                                value={getFieldValue("poNumber")}
                                onChange={handleChange("poNumber")}
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="Issue Date">
                              <FormInput
                                type="date"
                                value={getFieldValue("issueDate")}
                                onChange={handleChange("issueDate")}
                                placeholder="Select issue date"
                                disabled={isDisabled}
                              />
                            </FormField>

                            <FormField label="Expiry Date">
                              <FormInput
                                type="date"
                                value={getFieldValue("expiryDate")}
                                onChange={handleChange("expiryDate")}
                                placeholder="Select expiry date"
                                disabled={isDisabled}
                              />
                            </FormField>
                          </>
                        ) : (
                          <>
                            {shouldShowApiField("owner_id") && (
                              <OwnerField
                                value={getFieldValue("owner")}
                                onChange={handleChange("owner")}
                                options={mergeOptionIfMissing(ownerOptions, getFieldValue("owner"))}
                                placeholder="Select owner"
                                disabled={masterInputsDisabled}
                              />
                            )}

                            {!isSimplifiedMode && (
                              <div className="form-group">
                                <h3 className="form-group-title">Appointment Details</h3>
                                {shouldShowApiField("appointment_email") && (
                                  <FormField
                                    label=""
                                    hasError={false}
                                  >
                                    <div className="appointment-email-label-row">
                                      <label className="appointment-email-label">Appointment Email</label>
                                      <div
                                        className="appointment-extraction-mode-group"
                                        role="group"
                                        aria-label="Appointment extraction mode"
                                      >
                                        {[
                                          { id: "without_ai", label: "Manual" },
                                          { id: "ai", label: "AI" },
                                          { id: "be", label: "Server" },
                                        ].map((mode) => (
                                          <button
                                            key={mode.id}
                                            type="button"
                                            className={`appointment-extraction-mode-btn ${appointmentExtractionMode === mode.id ? "active" : ""
                                              }`}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setAppointmentExtractionMode(mode.id);
                                            }}
                                            disabled={isDisabled || isAiExtractingAppointment}
                                          >
                                            {mode.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <DocumentUpload
                                      attachments={appointmentDocuments}
                                      onAdd={handleAppointmentDocumentAdd}
                                      onRemove={handleDocumentRemove}
                                      allowMultiple={false}
                                      onMultipleFiles={() => notify("Only one appointment email can be uploaded.", "warning")}
                                      cardColor={accentColor}
                                      disabled={isDisabled}
                                      hasError={false}
                                      isLoading={isServerEmailReading}
                                      loadingText="Reading email from server..."
                                      fileUrl={appointmentEmailUrl}
                                      showFileActions
                                    />
                                    {/* {isAiExtractingAppointment && (
                                      <div className="cf-field-hint">Extracting appointment details...</div>
                                    )}
                                    {!isAiExtractingAppointment && aiExtractionError && (
                                      <div className="cf-field-hint">{aiExtractionError}</div>
                                    )} */}
                                  </FormField>
                                )}
                                {shouldShowApiField("appointment_received_date") && (
                                  <FormField
                                    label="Appointment Received *"
                                    hasError={isAddMode && Boolean(fieldErrors.appointmentReceivedDate || fieldErrors.appointmentReceivedTime)}
                                  >
                                    <DateTimePickerField
                                      dateValue={getFieldValue("appointmentReceivedDate")}
                                      timeValue={getFieldValue("appointmentReceivedTime")}
                                      onDateChange={isAddMode ? handleValidatedChange("appointmentReceivedDate") : handleChange("appointmentReceivedDate")}
                                      onTimeChange={isAddMode ? handleValidatedChange("appointmentReceivedTime") : handleChange("appointmentReceivedTime")}
                                      dateFieldName="appointmentReceivedDate"
                                      timeFieldName="appointmentReceivedTime"
                                      disabled={isDisabled}
                                      hasError={isAddMode && Boolean(fieldErrors.appointmentReceivedDate || fieldErrors.appointmentReceivedTime)}
                                      placeholder="Select date and time"
                                    />
                                    {isAddMode && (fieldErrors.appointmentReceivedDate || fieldErrors.appointmentReceivedTime) && (
                                      <div className="cf-field-error">{fieldErrors.appointmentReceivedDate || fieldErrors.appointmentReceivedTime}</div>
                                    )}
                                  </FormField>
                                )}
                              </div>
                            )}

                            <div className="form-group">
                              <h3 className="form-group-title">Service Information</h3>
                              {!isAddMode &&
                                viewModeTimeObjects.map((item) => {
                                  const parsed = splitApiDateTimeValue(item.value);
                                  const formatted = formatDateTime(parsed.date, parsed.time);
                                  return (
                                    <FormField key={item.key} label={item.label}>
                                      <FormInput
                                        type="text"
                                        value={formatted}
                                        onChange={() => { }}
                                        placeholder="Not set"
                                        readOnly
                                        disabled
                                      />
                                    </FormField>
                                  );
                                })}
                              {isAddMode &&
                                !stageTimeObjectsLoading &&
                                stageTimeObjects.map((item) => {
                                  const timeObjectId = firstNonEmptyString(item?.time_object_id);
                                  if (!timeObjectId) return null;
                                  const label = firstNonEmptyString(item?.time_object);
                                  const isRequired = String(item?.is_required ?? "0") === "1";
                                  const value = stageTimeObjectValues?.[timeObjectId] || { date: "", time: "" };
                                  return (
                                    <FormField
                                      key={timeObjectId}
                                      label={isRequired ? `${label || "Time object"} *` : label || "Time object"}
                                      hasError={Boolean(timeObjectErrors[timeObjectId])}
                                    >
                                      <DateTimePickerField
                                        dateValue={value.date}
                                        timeValue={value.time}
                                        onDateTimeChange={handleStageTimeObjectChange(timeObjectId)}
                                        disabled={masterInputsDisabled}
                                        hasError={Boolean(timeObjectErrors[timeObjectId])}
                                        placeholder="Select date and time"
                                      />
                                      {timeObjectErrors[timeObjectId] && (
                                        <div className="cf-field-error">{timeObjectErrors[timeObjectId]}</div>
                                      )}
                                    </FormField>
                                  );
                                })}
                              {shouldShowApiField("main_billing_entity_id") && (
                                <FormField label="Last Port">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter last port"
                                    value={getFieldValue("lastPort")}
                                    onChange={handleChange("lastPort")}
                                    disabled={masterInputsDisabled}
                                  />
                                </FormField>
                              )}
                              {shouldShowApiField("main_billing_entity_id") && (
                                <FormField label="Main Billing entity *" hasError={isAddMode && Boolean(fieldErrors.mainBillingEntity)}>
                                  <FormSelect
                                    value={getFieldValue("mainBillingEntity")}
                                    onChange={isAddMode ? handleValidatedMainBillingEntityChange : handleMainBillingEntityChange}
                                    options={mergeOptionIfMissing(billingEntitySelectOptions, getFieldValue("mainBillingEntity"))}
                                    placeholder="Select billing entity"
                                    disabled={masterInputsDisabled}
                                    hasError={isAddMode && Boolean(fieldErrors.mainBillingEntity)}
                                  />
                                  {isAddMode && fieldErrors.mainBillingEntity && (
                                    <div className="cf-field-error">{fieldErrors.mainBillingEntity}</div>
                                  )}
                                </FormField>
                              )}

                              {entityFieldsLoading && (
                                <FormField label="">
                                  <div className="cf-input">
                                    <input type="text" value="Loading fields..." readOnly />
                                  </div>
                                </FormField>
                              )}

                              {!entityFieldsLoading &&
                                visibleDynamicEntityFields.map((field) => (
                                  <FormField
                                    key={field.field_id}
                                    label={field.is_required === 1 ? `${field.field_name} *` : field.field_name}
                                    hasError={Boolean(entityFieldErrors[field.field_id])}
                                  >
                                    <FormInput
                                      type="text"
                                      placeholder={`Enter ${field.field_name}...`}
                                      value={entityFieldValues[field.field_id] || ""}
                                      onChange={handleEntityFieldValueChange(field.field_id)}
                                      disabled={isDisabled}
                                      hasError={Boolean(entityFieldErrors[field.field_id])}
                                    />
                                    {entityFieldErrors[field.field_id] && (
                                      <span className="cf-field-error">
                                        {entityFieldErrors[field.field_id]}
                                      </span>
                                    )}
                                  </FormField>
                                ))}

                              {!entityFieldsLoading && entityFieldsError && (
                                <FormField label="">
                                  <div className="cf-input">
                                    <input type="text" value={entityFieldsError} readOnly />
                                  </div>
                                </FormField>
                              )}

                              {!entityFieldsLoading &&
                                !entityFieldsError &&
                                selectedEntityId &&
                                entityFields.length === 0 && (
                                  <>
                                    <FormField label="PO No">
                                      <FormInput
                                        type="text"
                                        placeholder="Enter PO No..."
                                        value={getFieldValue("poNumber")}
                                        onChange={handleChange("poNumber")}
                                        disabled={isDisabled}
                                      />
                                    </FormField>

                                    <FormField label="Project">
                                      <FormInput
                                        type="text"
                                        placeholder="Enter project..."
                                        value={getFieldValue("project")}
                                        onChange={handleChange("project")}
                                        disabled={isDisabled}
                                      />
                                    </FormField>
                                  </>
                                )}
                            </div>

                            <div className="form-group">
                              <h3 className="form-group-title">Vessel Information</h3>

                              {shouldShowApiField("appointment_type") && (
                                <FormField
                                  label={isAddMode ? "Appointment Type *" : "Appointment Type"}
                                  hasError={isAddMode && Boolean(fieldErrors.appointmentType)}
                                >
                                  <FormSelect
                                    value={selectedAppointmentType}
                                    onChange={handleAppointmentTypeChange}
                                    options={APPOINTMENT_TYPE_OPTIONS}
                                    placeholder="Select appointment type"
                                    disabled={masterInputsDisabled}
                                    hasError={isAddMode && Boolean(fieldErrors.appointmentType)}
                                  />
                                  {isAddMode && fieldErrors.appointmentType && (
                                    <div className="cf-field-error">{fieldErrors.appointmentType}</div>
                                  )}
                                </FormField>
                              )}

                              {isTugSelected && shouldShowApiField("vessel_type_id") && (
                                <FormField
                                  label={isAddMode ? "Vessel type *" : "Vessel type"}
                                  hasError={isAddMode && Boolean(fieldErrors.vesselType)}
                                >
                                  <FormSelect
                                    value={getFieldValue("vesselType")}
                                    onChange={isAddMode ? handleValidatedChange("vesselType") : handleChange("vesselType")}
                                    options={mergeOptionIfMissing(vesselTypeSelectOptions, getFieldValue("vesselType"))}
                                    placeholder="Select vessel type"
                                    disabled={masterInputsDisabled}
                                    hasError={isAddMode && Boolean(fieldErrors.vesselType)}
                                  />
                                  {isAddMode && fieldErrors.vesselType && (
                                    <div className="cf-field-error">{fieldErrors.vesselType}</div>
                                  )}
                                </FormField>
                              )}

                              {isTugSelected && shouldShowApiField("vessel_id") && (
                                <FormField label="Vessel Name *" hasError={isAddMode && Boolean(fieldErrors.vesselName)}>
                                  {(() => {
                                    const vesselNameValue = getFieldValue("vesselName");
                                    const vesselNameLabel = getOptionLabel(vesselNameOptions, vesselNameValue) || vesselNameValue;
                                    return (
                                      <FormSelect
                                        value={vesselNameValue}
                                        onChange={handleVesselSelectionChange}
                                        options={mergeOptionIfMissing(vesselNameOptions, vesselNameValue, vesselNameLabel)}
                                        placeholder="Select vessel name"
                                        disabled={isDisabled || vesselOptionsLoading}
                                        hasError={isAddMode && Boolean(fieldErrors.vesselName)}
                                      />
                                    );
                                  })()}
                                  {isAddMode && fieldErrors.vesselName && <div className="cf-field-error">{fieldErrors.vesselName}</div>}
                                </FormField>
                              )}

                              {isTugSelected && shouldShowApiField("vessel_owner") && (
                                <FormField label="Vessel Owner">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter vessel owner..."
                                    value={getFieldValue("vesselOwner")}
                                    onChange={handleChange("vesselOwner")}
                                    disabled={isDisabled}
                                  />
                                </FormField>
                              )}

                              {isTugSelected && shouldShowApiField("vessel_principal") && (
                                <FormField label="Vessel Charter">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter vessel charter..."
                                    value={getFieldValue("vesselPrincipal")}
                                    onChange={handleChange("vesselPrincipal")}
                                    disabled={isDisabled}
                                  />
                                </FormField>
                              )}

                              {isTugAndBargeSelected && shouldShowApiField("barge_type_id") && (
                                <FormField
                                  label={isAddMode ? "Barge type *" : "Barge type"}
                                  hasError={isAddMode && Boolean(fieldErrors.bargeType)}
                                >
                                  <FormSelect
                                    value={getFieldValue("bargeType")}
                                    onChange={isAddMode ? handleValidatedChange("bargeType") : handleChange("bargeType")}
                                    options={mergeOptionIfMissing(bargeTypeSelectOptions, getFieldValue("bargeType"))}
                                    placeholder="Select barge type"
                                    disabled={masterInputsDisabled}
                                    hasError={isAddMode && Boolean(fieldErrors.bargeType)}
                                  />
                                  {isAddMode && fieldErrors.bargeType && (
                                    <div className="cf-field-error">{fieldErrors.bargeType}</div>
                                  )}
                                </FormField>
                              )}

                              {isTugAndBargeSelected && shouldShowApiField("barge_name") && (
                                <FormField label="Barge Name">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter barge name..."
                                    value={getFieldValue("bargeName")}
                                    onChange={handleChange("bargeName")}
                                    disabled={isDisabled}
                                  />
                                </FormField>
                              )}

                              {isTugAndBargeSelected && shouldShowApiField("barge_owner") && (
                                <FormField label="Barge Owner">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter barge owner..."
                                    value={getFieldValue("bargeOwner")}
                                    onChange={handleChange("bargeOwner")}
                                    disabled={isDisabled}
                                  />
                                </FormField>
                              )}

                              {shouldShowApiField("assigned_operator_id") && (
                                <OwnerField
                                  label="Assigned Operator *"
                                  value={getFieldValue("assignedOperator")}
                                  onChange={isAddMode ? handleValidatedChange("assignedOperator") : handleChange("assignedOperator")}
                                  options={mergeOptionIfMissing(operatorOptions, getFieldValue("assignedOperator"))}
                                  placeholder="Select operator"
                                  disabled={masterInputsDisabled}
                                  error={isAddMode ? fieldErrors.assignedOperator : undefined}
                                  hasError={isAddMode && Boolean(fieldErrors.assignedOperator)}
                                />
                              )}

                              {shouldShowApiField("service_requestor_name") && (
                                <FormField label="Service Requestor Name *" hasError={isAddMode && Boolean(fieldErrors.serviceRequestorName)}>
                                  <FormInput
                                    type="text"
                                    placeholder="Enter service requestor name..."
                                    value={getFieldValue("serviceRequestorName")}
                                    onChange={isAddMode ? handleValidatedChange("serviceRequestorName") : handleChange("serviceRequestorName")}
                                    disabled={isDisabled}
                                    hasError={isAddMode && Boolean(fieldErrors.serviceRequestorName)}
                                  />
                                  {isAddMode && fieldErrors.serviceRequestorName && <div className="cf-field-error">{fieldErrors.serviceRequestorName}</div>}
                                </FormField>
                              )}

                              {shouldShowApiField("service_requestor_email") && (
                                <FormField
                                  label="Service Requestor Email *"
                                  hasError={isAddMode && Boolean(fieldErrors.serviceRequestorEmail)}
                                >
                                  <FormInput
                                    type="email"
                                    placeholder="Enter service requestor email..."
                                    value={getFieldValue("serviceRequestorEmail")}
                                    onChange={handleServiceRequestorEmailChange}
                                    disabled={isDisabled}
                                    hasError={isAddMode && Boolean(fieldErrors.serviceRequestorEmail)}
                                  />
                                  {isAddMode && fieldErrors.serviceRequestorEmail && (
                                    <div className="cf-field-error">{fieldErrors.serviceRequestorEmail}</div>
                                  )}
                                </FormField>
                              )}

                              {shouldShowApiField("daily_report_emails") && (
                                <FormField
                                  label="Daily Report Emails"
                                  className="cf-daily-report-emails-field"
                                  hasError={false}
                                >
                                  <MultiSelectEmail
                                    name="dailyReportEmail"
                                    value={Array.isArray(getFieldValue("dailyReportEmail")) ? getFieldValue("dailyReportEmail") : []}
                                    onChange={handleChange("dailyReportEmail")}
                                    options={dailyReportEmailOptions}
                                    placeholder="Select email addresses..."
                                    onAddNew={handleAddNewEmail}
                                    disabled={isDisabled || dailyReportEmailLoading}
                                  />
                                </FormField>
                              )}

                              {(shouldShowApiField("billing_instruction") || shouldShowApiField("billing_instruction_emails")) && (
                                <>
                                  {billingInstructionType ? (
                                    <FormField
                                      label="Instruction Type"
                                      className="cf-billing-instruction-type-field"
                                      hasError={false}
                                    >
                                      <FormInput
                                        type="text"
                                        value={billingInstructionType}
                                        onChange={() => { }}
                                        readOnly
                                        disabled
                                      />
                                    </FormField>
                                  ) : null}
                                  <FormField
                                    label="Billing instructions"
                                    className="cf-billing-instruction-field"
                                    hasError={false}
                                  >
                                  {billingInstructionType.toLowerCase() === "email" ? (
                                    <MultiSelectEmail
                                      name="billingInstructionEmails"
                                      value={Array.isArray(getFieldValue("billingInstructionEmails")) ? getFieldValue("billingInstructionEmails") : []}
                                      onChange={handleChange("billingInstructionEmails")}
                                      options={billingInstructionEmailOptions}
                                      placeholder="Select billing instruction emails..."
                                      onAddNew={handleAddBillingInstructionEmail}
                                      disabled={isDisabled || billingInstructionLoading}
                                    />
                                  ) : (
                                    <FormInput
                                      type="text"
                                      placeholder="Enter billing instructions..."
                                      value={getFieldValue("billingInstructions")}
                                      onChange={handleChange("billingInstructions")}
                                      disabled={isDisabled || billingInstructionLoading}
                                    />
                                  )}
                                  </FormField>
                                </>
                              )}

                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isAddMode ? (
                    <>
                      <div className="general-info-right">
                        <EmailPreviewPanel
                          ownerOptions={ownerOptions}
                          formValues={formValues}
                          dailyReportEmailOptions={dailyReportEmailOptions}
                          callTypeOptions={callTypeOptions}
                          vesselNameOptions={vesselNameOptions}
                          portSelectOptions={portSelectOptions}
                          getFieldValue={getFieldValue}
                          previewData={emailPreviewData}
                          editableFields={editablePreviewFields}
                          touchedFields={touchedPreviewFields}
                          onEditableFieldChange={handleEditablePreviewFieldChange}
                          messageValue={previewMessageText}
                          messageEditorKey={previewMessageEditorKey}
                          onMessageChange={(next, source) => {
                            if (source !== "user") return;
                            setIsPreviewMessageDirty(true);
                            setPreviewMessageText(next ?? "");
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* {shouldShowApiField("card_description") && (
                        <div className="general-info-middle">
                          <div className="card-description-wrapper">
                            <FormField label="Card Description">
                              <ReactQuillEditor
                                value={getFieldValue("cardDescription")}
                                onChange={handleChange("cardDescription")}
                                placeholder="Enter card description..."
                              />
                            </FormField>
                          </div>
                        </div>
                      )} */}
                      <div className="general-info-middle">
                        <div className="general-info-tasks-card general-info-tasks-card--daily">
                          <div className="daily-task-box-wrapper">
                            <DailyTaskTodo
                              tasks={mappedOperatorKpiTasks}
                              accentColor={accentColor}
                              isLoading={operatorKpiLoading}
                              error={operatorKpiError}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="general-info-right">
                        <div className="general-info-tasks-card general-info-tasks-card--operation">
                          <OperationTasksPanel
                            cardColor={accentColor}
                            isViewOnly={isViewMode}
                            embedded
                            taskSections={mappedOperationTaskSections}
                            isLoading={isLoadingCallTasks}
                            error={callTasksError}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {isAddMode && (
                  <div className="general-add-page-actions">
                    <button
                      type="button"
                      className="form-save-button"
                      onClick={handleSubmit}
                      disabled={isSavingGeneral}
                    >
                      {isSavingGeneral ? "Saving..." : "Add Card"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

General.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  onSave: PropTypes.func,
  isAddMode: PropTypes.bool,
  isSimplifiedMode: PropTypes.bool,
  isSavingGeneral: PropTypes.bool,
  hasSubmitted: PropTypes.bool,
  setHasSubmitted: PropTypes.func,
  setIsSavingGeneral: PropTypes.func,
};

export default General;

