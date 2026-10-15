import { firstNonEmptyString, getOptionLabel, htmlToPlainText, normalizePreviewValue } from "./generalHelpers";

export const mapMultiValuesToLabels = (options = [], values = []) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => {
      const normalized = normalizePreviewValue(value);
      if (!normalized) return "";
      return getOptionLabel(options, normalized) || normalized;
    })
    .filter(Boolean);
};

export const getPreviewRecipients = ({ dailyReportEmailOptions = [], dailyValues = [] }) => {
  const daily = mapMultiValuesToLabels(dailyReportEmailOptions, dailyValues);
  return daily.length ? daily.join(", ") : "—";
};

export const getPreviewSubject = ({ typeOfCall = "", vesselName = "", port = "" }) => {
  const parts = [typeOfCall, vesselName, port].map((item) => normalizePreviewValue(item)).filter(Boolean);
  if (parts.length) return parts.join(" - ");
  return "Appointment Acceptance";
};


/** When the user has edited a preview field, use their value (including ""). Otherwise fall back to API/form defaults. */
export const resolveEditablePreviewFieldValue = (isTouched, editedValue, ...fallbackValues) => {
  if (isTouched) return editedValue ?? "";
  return firstNonEmptyString(editedValue, ...fallbackValues);
};

/** Demo defaults for Email Preview Cc when no API/daily-report recipients exist. */
export const EMAIL_PREVIEW_DEFAULT_CC_EMAILS = "";

/** Shared Cc resolution for preview display and submit payload. */
export const resolveAppointmentAcceptanceCcEmails = ({
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

export const normalizeEmailFieldValue = (value) => {
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

export const normalizeEmailAttachmentList = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const fileUrl = firstNonEmptyString(item.file_url, item.url, item.path, item.fileUrl);
      const fileName = firstNonEmptyString(
        item.file_name,
        item.name,
        item.fileName,
        fileUrl ? fileUrl.split("/").pop() : ""
      );
      if (!fileName && !fileUrl) return null;
      return { file_name: fileName, file_url: fileUrl };
    })
    .filter(Boolean);

export const dedupeAttachmentsByUrl = (attachments) =>
  Array.from(
    new Map(
      (Array.isArray(attachments) ? attachments : []).map((file) => [
        file.file_url || file.file_name,
        file,
      ])
    ).values()
  );

export const resolveEmailPreviewPayload = (payload) => {
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
  const rawAttachments = Array.isArray(source.attachments)
    ? source.attachments
    : Array.isArray(data.attachments)
      ? data.attachments
      : [];
  const attachments = rawAttachments
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const fileUrl = firstNonEmptyString(item.file_url, item.url, item.path);
      const fileName = firstNonEmptyString(
        item.file_name,
        item.name,
        fileUrl ? fileUrl.split("/").pop() : ""
      );
      if (!fileName && !fileUrl) return null;
      return { file_name: fileName, file_url: fileUrl };
    })
    .filter(Boolean);
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
    attachments,
  };
};

export const buildPreviewTimeObjectsPayload = (timeObjects, timeObjectValues) =>
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

export const unwrapAllDetailResponse = (payload) => {
  const root = payload?.data?.data ?? payload?.data ?? payload ?? {};
  const data = Array.isArray(root) ? (root[0] ?? {}) : root;
  return data && typeof data === "object" ? data : null;
};

export const ALL_DETAIL_SCALAR_FIELD_MAP = [
  ["vessel_id", "vesselName"],
  ["port_id", "port"],
  ["assigned_operator_id", "assignedOperator"],
  ["other_billing_entity_id", "otherBillingEntity"],
  ["vessel_type_id", "vesselType"],
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

export const formatPreviewDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
