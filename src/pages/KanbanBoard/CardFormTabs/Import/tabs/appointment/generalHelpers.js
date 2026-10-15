export const splitDateTime = (value) => {
  if (!value) return { date: "", time: "" };
  const normalized = String(value).trim().replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5),
  };
};

export const splitApiDateTimeValue = (value) => {
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

export const APPOINTMENT_TYPE_TUG = "tug";
export const APPOINTMENT_TYPE_TUG_AND_BARGE = "tug_and_barge";
export const APPOINTMENT_TYPE_TAXI_TUG_AND_BARGE = "taxi_tug_and_barge";
export const APPOINTMENT_TYPE_VESSEL = "vessel";
export const APPOINTMENT_TYPE_OPTIONS = [
  { value: APPOINTMENT_TYPE_TUG, label: "Taxi Tug" },
  { value: APPOINTMENT_TYPE_TUG_AND_BARGE, label: "Tug and barge" },
  { value: APPOINTMENT_TYPE_TAXI_TUG_AND_BARGE, label: "Taxi tug and barge" },
  { value: APPOINTMENT_TYPE_VESSEL, label: "Vessel" },
];

// Accepts a scalar, arrays, JSON array strings, or comma-separated strings; returns one option value.
export const normalizeAppointmentTypeValue = (raw, fallback = "") => {
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
  if (unique.includes(APPOINTMENT_TYPE_TAXI_TUG_AND_BARGE)) return APPOINTMENT_TYPE_TAXI_TUG_AND_BARGE;
  if (unique.includes(APPOINTMENT_TYPE_TUG_AND_BARGE)) return APPOINTMENT_TYPE_TUG_AND_BARGE;
  if (unique.includes(APPOINTMENT_TYPE_VESSEL)) return APPOINTMENT_TYPE_VESSEL;
  if (unique.includes(APPOINTMENT_TYPE_TUG)) return APPOINTMENT_TYPE_TUG;
  return fallback;
};

export const appointmentTypeShowsBargeFields = (value) =>
  value === APPOINTMENT_TYPE_TUG_AND_BARGE || value === APPOINTMENT_TYPE_TAXI_TUG_AND_BARGE;

// Single (non tug-and-barge) vessel block is shown for Taxi Tug and Vessel appointment types.
export const appointmentTypeShowsSingleVesselSection = (value) =>
  value === APPOINTMENT_TYPE_TUG || value === APPOINTMENT_TYPE_VESSEL;

// Tug and Vessel use the tug-type catalogue for their "Vessel type" dropdown; only Vessel uses the vessel-type catalogue.
export const appointmentTypeUsesTugTypeSource = (value) =>
  value === APPOINTMENT_TYPE_TUG || value === APPOINTMENT_TYPE_TUG_AND_BARGE;

export const getDetailAppointmentTypeFallback = (detail) =>
  detail?.barge_type_id ||
    detail?.barge_vessel_id ||
    detail?.barge_vessel_owner ||
    detail?.barge_name ||
    detail?.barge_owner
    ? APPOINTMENT_TYPE_TUG_AND_BARGE
    : APPOINTMENT_TYPE_TUG;

export const toDetailString = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : "";

// Builds the vessel / tug / barge form fields from a call detail, keyed by the detail's appointment type.
export const mapDetailVesselFields = (detail, appointmentType) => {
  if (appointmentTypeShowsBargeFields(appointmentType)) {
    return {
      // Tug section reuses the standard vessel_* API keys, including the primary billing entity.
      tugType: toDetailString(detail?.tug_type_id),
      tugVesselName: toDetailString(detail?.vessel_id),
      tugOwner: toDetailString(detail?.vessel_owner),
      tugPrincipal: toDetailString(detail?.vessel_principal),
      tugManager: toDetailString(detail?.vessel_manager),
      tugBillingEntity: toDetailString(detail?.billing_entity_id ?? detail?.main_billing_entity_id),
      // Barge section uses the barge_vessel_* API keys and its own billing entity.
      bargeType: toDetailString(detail?.barge_type_id),
      bargeVesselName: toDetailString(detail?.barge_vessel_id),
      bargeOwner: toDetailString(detail?.barge_vessel_owner ?? detail?.barge_owner),
      bargePrincipal: toDetailString(detail?.barge_vessel_principal),
      bargeManager: toDetailString(detail?.barge_vessel_manager),
      bargeBillingEntity: toDetailString(detail?.barge_billing_entity_id),
    };
  }

  // Taxi Tug stores its type in tug_type_id; Vessel uses vessel_type_id.
  return {
    vesselType:
      appointmentType === APPOINTMENT_TYPE_TUG
        ? toDetailString(detail?.tug_type_id) || toDetailString(detail?.vessel_type_id)
        : toDetailString(detail?.vessel_type_id) || toDetailString(detail?.tug_type_id),
    vesselName: toDetailString(detail?.vessel_id),
    vesselOwner: toDetailString(detail?.vessel_owner),
    vesselPrincipal: toDetailString(detail?.vessel_principal),
    vesselManager: toDetailString(detail?.vessel_manager),
    vesselBillingEntity: toDetailString(detail?.billing_entity_id ?? detail?.main_billing_entity_id),
  };
};

export const mapCallDetailToFormFields = (detail) => {
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
  const selectedChecklists = Array.isArray(detail?.checklist_type_ids)
    ? detail.checklist_type_ids.map((item) => String(item?.checklist_type_id ?? item ?? "").trim()).filter(Boolean)
    : Array.isArray(detail?.checklists)
      ? detail.checklists.map((item) => String(item?.checklist_type_id ?? item ?? "").trim()).filter(Boolean)
      : [];
  const bargeSelectedChecklists = Array.isArray(detail?.barge_checklist_type_ids)
    ? detail.barge_checklist_type_ids.map((item) => String(item?.checklist_type_id ?? item ?? "").trim()).filter(Boolean)
    : Array.isArray(detail?.barge_checklists)
      ? detail.barge_checklists.map((item) => String(item?.checklist_type_id ?? item ?? "").trim()).filter(Boolean)
      : [];

  const detailAppointmentType = normalizeAppointmentTypeValue(
    detail?.appointment_type,
    getDetailAppointmentTypeFallback(detail)
  );

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
    lastPort: detail?.last_port != null ? String(detail.last_port) : "",
    otherBillingEntity: detail?.other_billing_entity_id ? String(detail.other_billing_entity_id) : "",
    selectedChecklists,
    bargeSelectedChecklists,
    appointmentType: detailAppointmentType,
    ...mapDetailVesselFields(detail, detailAppointmentType),
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

export const hasMeaningfulDynamicValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export const getDynamicFieldFallbackMap = (callDetailData, mappedCallDetail) => ({
  po_number: callDetailData?.po_number ?? mappedCallDetail?.poNumber,
  project_name: callDetailData?.project_name ?? mappedCallDetail?.project,
  project_code: callDetailData?.project_code,
  srt_number: callDetailData?.srt_number ?? mappedCallDetail?.srtNo ?? mappedCallDetail?.srtPoWbs,
});

export const hasRenderableEntityFieldValue = (field, callDetailData, entityFieldValues, mappedCallDetail) => {
  const fieldId = field?.field_id;
  const fieldKey = field?.field_key ? String(field.field_key).trim() : "";

  if (hasMeaningfulDynamicValue(entityFieldValues?.[fieldId])) return true;

  if (!fieldKey) return false;

  if (hasMeaningfulDynamicValue(callDetailData?.[fieldKey])) return true;

  const fallbackMap = getDynamicFieldFallbackMap(callDetailData, mappedCallDetail);
  if (hasMeaningfulDynamicValue(fallbackMap[fieldKey])) return true;

  return false;
};

// Helper function to format date and time
export const formatDateTime = (date, time) => {
  if (!date && !time) return "Not set";
  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const timeStr = time || '';
  return dateStr && timeStr ? `${dateStr} at ${timeStr}` : dateStr || timeStr || "Not set";
};

export const normalizePreviewValue = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

export const getOptionLabel = (options = [], value = "") => {
  const normalizedValue = normalizePreviewValue(value);
  if (!normalizedValue || !Array.isArray(options)) return "";
  const match = options.find((item) => normalizePreviewValue(item?.value) === normalizedValue);
  return match?.label ? String(match.label).trim() : "";
};

export const htmlToPlainText = (html = "") =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
};

export const normalizeEntityFields = (rows) => {
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
};

export const normalizeEntityEmailOptions = (payload) => {
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
};

export const normalizeBillingInstruction = (payload) => {
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
};

export const normalizeVesselDetails = (payload) => {
  const raw = payload?.data ?? payload ?? {};
  const detail = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  return {
    vessel_name: detail?.vessel_name ? String(detail.vessel_name) : "",
    vessel_owner: detail?.vessel_owner ? String(detail.vessel_owner) : "",
    vessel_manager: detail?.vessel_manager ? String(detail.vessel_manager) : "",
    vessel_principal: detail?.vessel_principal ? String(detail.vessel_principal) : "",
  };
};
