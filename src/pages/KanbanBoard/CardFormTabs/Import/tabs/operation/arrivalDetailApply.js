import { getEventFieldKeyPrefix } from "./operationConstants";
import { ensureHtmlForQuill } from "./operationReportMessageHtml";
import { parseApiDateTimeParts } from "./preArrivalDetailApply";

/** Map the dropdown's stored value to the matching <FormSelect> option. */
const normalizeCustomsStatus = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "passed" || lower === "pass") return "Passed";
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

const normalizeInwardClearanceStatus = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "received") return "Received";
  if (lower === "not received" || lower === "not_received" || lower === "notreceived") {
    return "Not Received";
  }
  if (lower === "completed" || lower === "complete") return "Received";
  if (lower === "pending") return "Not Received";
  return text;
};

/** Treat the canonical "0000-00-00 00:00:00" placeholder as empty. */
const isUsableDateTime = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return false;
  if (text.startsWith("0000-")) return false;
  return true;
};

const applyDateTimeFieldToForm = (raw, dateKey, timeKey, handleChange) => {
  if (!isUsableDateTime(raw)) return;
  const { date, time } = parseApiDateTimeParts(raw);
  if (date) handleChange(dateKey)({ target: { value: date } });
  if (time) handleChange(timeKey)({ target: { value: time } });
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

  const customsRemarks = String(root.customs_remarks ?? "").trim();
  if (customsRemarks) {
    handleChange("customsRemarks")({ target: { value: customsRemarks } });
  }

  const immigrationStatus = normalizeImmigrationStatus(root.immigration_status);
  if (immigrationStatus) {
    handleChange("crewImmigrationStatus")({ target: { value: immigrationStatus } });
  }

  const immigrationRemarks = String(root.immigration_remarks ?? "").trim();
  if (immigrationRemarks) {
    handleChange("crewImmigrationHoldRemarks")({ target: { value: immigrationRemarks } });
  }

  const inwardClearanceStatus = normalizeInwardClearanceStatus(root.inward_clearance_status);
  if (inwardClearanceStatus) {
    handleChange("inwardClearanceStatus")({ target: { value: inwardClearanceStatus } });
  }

  applyDateTimeFieldToForm(
    root.inward_clearance_received_timestamp,
    "inwardClearanceReceivedDate",
    "inwardClearanceReceivedTime",
    handleChange
  );
  applyDateTimeFieldToForm(root.mwp_applied, "mwpAppliedDate", "mwpAppliedTime", handleChange);
  applyDateTimeFieldToForm(root.mwp_received, "mwpReceivedDate", "mwpReceivedTime", handleChange);

  const allFields = [
    ...(Array.isArray(arrivalEventFields) ? arrivalEventFields : []),
    ...(Array.isArray(postArrivalEventFields) ? postArrivalEventFields : []),
  ];
  const additionalTimeObjects = [];

  for (const to of Array.isArray(timeObjects) ? timeObjects : []) {
    const rawValue = to?.time_object_value ?? to?.value;
    if (!isUsableDateTime(rawValue)) continue;
    const { date, time } = parseApiDateTimeParts(rawValue);
    if (!date || !time) continue;

    const toId = to?.time_object_id ?? to?.timeObjectId;
    const toName = to?.time_object_name ?? to?.time_object ?? to?.event_name ?? "";
    const fieldKey = String(to?.field_key ?? "").trim();
    const isAdditional = Boolean(to?.is_additional ?? to?.isAdditional) || toId == null;

    if (isAdditional) {
      const label = String(toName).trim();
      if (label) {
        additionalTimeObjects.push({ label, date, time });
      }
      continue;
    }

    if (toId == null && !fieldKey && !toName) continue;

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

  if (additionalTimeObjects.length) {
    handleChange("arrivalAdditionalTimeObjects")({
      target: { value: additionalTimeObjects },
    });
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
