import { getEventFieldKeyPrefix } from "./operationConstants";
import { ensureHtmlForQuill } from "./operationReportMessageHtml";
import { parseApiDateTimeParts } from "./preArrivalDetailApply";

/** Map the dropdown's stored value to the matching <FormSelect> option. */
const normalizeCustomsStatus = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "pending") return "Pending";
  if (lower === "passed" || lower === "pass") return "Passed";
  if (lower === "failed" || lower === "fail") return "Failed";
  return text;
};

const normalizeImmigrationStatus = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "pending") return "Pending";
  if (lower === "completed" || lower === "complete") return "Completed";
  if (
    lower === "on hold" ||
    lower === "on_hold" ||
    lower === "onhold" ||
    lower === "hold"
  ) {
    return "On Hold";
  }
  if (lower === "failed" || lower === "fail") return "Failed";
  return text;
};

const normalizeWorkflowStatus = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "pending") return "Pending";
  if (lower === "completed" || lower === "complete") return "Completed";
  if (
    lower === "on hold" ||
    lower === "on_hold" ||
    lower === "onhold" ||
    lower === "hold"
  ) {
    return "On Hold";
  }
  if (lower === "failed" || lower === "fail") return "Failed";
  return text;
};

/** Treat the canonical "0000-00-00 00:00:00" placeholder as empty. */
const isUsableDateTime = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return false;
  if (text.startsWith("0000-")) return false;
  return true;
};

const deriveFileName = (rawName, rawUrl) => {
  const name = String(rawName ?? "").trim();
  if (name) return name;
  const url = String(rawUrl ?? "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) {
    try {
      const seg = url.split("/").pop() || url;
      return seg.includes("?") ? seg.split("?")[0] : seg;
    } catch {
      return url;
    }
  }
  return url;
};

const buildAttachmentEntry = (rawName, rawUrl) => {
  const name = deriveFileName(rawName, rawUrl);
  const url = String(rawUrl ?? "").trim();
  if (!name && !url) return null;
  const entry = { name: name || "Document" };
  if (url) entry.url = url;
  return entry;
};

const REPORT_TYPE_ID_TO_TYPE = {
  3: "daily",
  4: "arrival",
};

const REPORT_DEFAULT_SUBJECT = {
  daily: "Report - Daily Arrival",
  arrival: "Report - Arrival",
};

/**
 * Apply `arrival/get_arrival_detail` payload onto the Operation/Arrival form.
 *
 * Time objects are matched against the pre-loaded stage fields by
 * `time_object_id`, falling back to `event_name` / `getEventFieldKeyPrefix`
 * when the stage fields aren't ready yet.
 */
export function applyArrivalGetDetailToForm({
  responseBody,
  arrivalEventFields = [],
  postArrivalEventFields = [],
  handleChange,
}) {
  if (typeof handleChange !== "function") return;

  const root = responseBody?.data ?? responseBody ?? {};
  const timeObjects = root.time_objects ?? root.timeObjects ?? [];

  const customsStatus = normalizeCustomsStatus(
    root.customs_status ?? root.custom_status
  );
  if (customsStatus) {
    handleChange("customInspectionStatus")({ target: { value: customsStatus } });
  }

  const immigrationStatus = normalizeImmigrationStatus(root.immigration_status);
  if (immigrationStatus) {
    handleChange("crewImmigrationStatus")({ target: { value: immigrationStatus } });
  }

  const immigrationRemarks = String(root.immigration_remarks ?? "").trim();
  if (immigrationRemarks) {
    handleChange("crewImmigrationHoldRemarks")({ target: { value: immigrationRemarks } });
  }

  const inwardClearanceStatus = normalizeWorkflowStatus(root.inward_clearance_status);
  if (inwardClearanceStatus) {
    handleChange("inwardClearanceStatus")({ target: { value: inwardClearanceStatus } });
  }

  const mwpStatus = normalizeWorkflowStatus(root.mwp_status);
  if (mwpStatus) {
    handleChange("mwpStatus")({ target: { value: mwpStatus } });
  }

  const mwpTicketNo = String(root.mwp_ticket_no ?? "").trim();
  if (mwpTicketNo) {
    handleChange("mwpTicketNo")({ target: { value: mwpTicketNo } });
  }

  const sadadNo = String(root.sadad_no ?? root.sadadNo ?? "").trim();
  if (sadadNo) {
    handleChange("sadadNo")({ target: { value: sadadNo } });
  }

  const mwpExpiryRaw = root.mwp_expiry ?? root.mwpExpiry;
  if (isUsableDateTime(mwpExpiryRaw)) {
    const { date, time } = parseApiDateTimeParts(mwpExpiryRaw);
    if (date) {
      handleChange("marineWorkPermitExpiresDate")({ target: { value: date } });
    }
    if (time) {
      handleChange("marineWorkPermitExpiresTime")({ target: { value: time } });
    }
  }

  const inwardEntry = buildAttachmentEntry(root.inward_clearance_doc, root.inward_clearance_doc_url);
  if (inwardEntry) {
    handleChange("arrivalInwardClearanceDoc")({ target: { value: [inwardEntry] } });
  }

  const mwpEntry = buildAttachmentEntry(root.mwp_doc, root.mwp_doc_url);
  if (mwpEntry) {
    handleChange("arrivalMwpDoc")({ target: { value: [mwpEntry] } });
  }

  const sadadEntry = buildAttachmentEntry(root.sadad_doc, root.sadad_doc_url);
  if (sadadEntry) {
    handleChange("arrivalSadadDoc")({ target: { value: [sadadEntry] } });
  }

  const initialBayanEntry = buildAttachmentEntry(
    root.initial_bayan_doc,
    root.initial_bayan_doc_url ?? root.bayan_doc_url
  );
  if (initialBayanEntry) {
    handleChange("arrivalInitialBayanDoc")({ target: { value: [initialBayanEntry] } });
  }

  const finalBayanEntry = buildAttachmentEntry(
    root.final_bayan_doc,
    root.final_bayan_doc_url ?? root.bayan_doc_url
  );
  if (finalBayanEntry) {
    handleChange("arrivalFinalBayanDoc")({ target: { value: [finalBayanEntry] } });
  }

  const allFields = [
    ...(Array.isArray(arrivalEventFields) ? arrivalEventFields : []),
    ...(Array.isArray(postArrivalEventFields) ? postArrivalEventFields : []),
  ];

  for (const to of Array.isArray(timeObjects) ? timeObjects : []) {
    const rawValue = to?.time_object_value ?? to?.value;
    if (!isUsableDateTime(rawValue)) continue;
    const { date, time } = parseApiDateTimeParts(rawValue);
    if (!date || !time) continue;

    const toId = to?.time_object_id ?? to?.timeObjectId;
    const toName = to?.time_object ?? to?.event_name ?? "";
    const fieldKey = String(to?.field_key ?? "").trim();

    let keyPrefix = "";
    const matched = allFields.find((field) => {
      const fid = field?.time_object_id ?? field?.event_type_id ?? field?.id;
      if (toId != null && fid != null && Number(fid) === Number(toId)) return true;
      if (fieldKey) {
        const candidateKeys = [
          field?.field_key,
          field?.keyPrefix,
          getEventFieldKeyPrefix(field?.event_name ?? field?.time_object ?? ""),
        ]
          .map((value) => String(value ?? "").trim().toLowerCase())
          .filter(Boolean);
        if (candidateKeys.includes(fieldKey.toLowerCase())) return true;
      }
      return (
        String(field?.event_name || "").trim().toLowerCase() ===
        String(toName).trim().toLowerCase()
      );
    });
    if (matched?.keyPrefix) keyPrefix = matched.keyPrefix;
    else if (toName) keyPrefix = getEventFieldKeyPrefix(toName);
    if (!keyPrefix) continue;

    handleChange(`${keyPrefix}Date`)({ target: { value: date } });
    handleChange(`${keyPrefix}Time`)({ target: { value: time } });
  }
}

/**
 * Pull the saved email preview (`arrival_report`) out of the detail payload.
 * Returns `null` when the call has no saved report yet.
 */
export function extractArrivalReportDraftFromDetail(responseBody) {
  const root = responseBody?.data ?? responseBody ?? {};
  const report = root.arrival_report ?? root.arrivalReport;
  if (!report || typeof report !== "object") return null;

  const reportTypeId = Number(report.report_type_id ?? report.reportTypeId);
  const reportType = REPORT_TYPE_ID_TO_TYPE[reportTypeId] || "arrival";

  return {
    reportType,
    from: String(report.from_email ?? "operations@shipping.com").trim(),
    to: String(report.to_email ?? "").trim(),
    cc: String(report.cc_emails ?? report.cc_email ?? "").trim(),
    subject: String(
      report.subject ?? REPORT_DEFAULT_SUBJECT[reportType] ?? ""
    ).trim(),
    message: report.body != null ? ensureHtmlForQuill(String(report.body)) : "",
  };
}
