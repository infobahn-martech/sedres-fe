import { buildGroArrivalTimeObjectsPayload } from "./groCardUtils";

export const GRO_CREW_IMMIGRATION_STATUS = {
  ON_HOLD: "Pending",
  COMPLETED: "Completed",
};

export const GRO_CUSTOM_INSPECTION_STATUS = {
  PASSED: "Passed",
  FAILED: "Failed",
};

export const createEmptyExtraStageFields = () => ({
  crew_immigration_status: "",
  on_hold_reason: "",
  immigration_doc: null,
  inward_clearance_copy: null,
  custom_inspection_status: "",
  failed_reason: "",
  initial_bayan_doc: null,
  final_bayan_doc: null,
  mwp_application_no: "",
  sadad_no: "",
  sadad_doc: null,
  mwp_subscription_sadad_no: "",
  mwp_subscription_sadad_doc: null,
  mwp_copy: null,
  mwp_subscription_tax_invoice: null,
  outward_clearance_copy: null,
  mwp_cancellation_doc: null,
});

const trimText = (value) => String(value ?? "").trim();

const hasFile = (file) => file != null && file !== "";

export const validateGroExtraStageFields = (stageId, fields = {}) => {
  const errors = {};
  const data = fields ?? {};

  if (stageId === 7) {
    if (!trimText(data.crew_immigration_status)) {
      errors.crew_immigration_status = "Crew Immigration Status is required.";
    }
    if (data.crew_immigration_status === GRO_CREW_IMMIGRATION_STATUS.ON_HOLD && !trimText(data.on_hold_reason)) {
      errors.on_hold_reason = "Remarks is required.";
    }
  }

  if (stageId === 8) {
    if (!hasFile(data.inward_clearance_copy)) {
      errors.inward_clearance_copy = "Inward Clearance Copy is required.";
    }
    if (!trimText(data.custom_inspection_status)) {
      errors.custom_inspection_status = "Customs Status is required.";
    }
    if (data.custom_inspection_status === GRO_CUSTOM_INSPECTION_STATUS.FAILED && !trimText(data.failed_reason)) {
      errors.failed_reason = "Failed Reason is required.";
    }
  }

  if (stageId === 9) {
    if (!hasFile(data.initial_bayan_doc)) {
      errors.initial_bayan_doc = "Initial Bayan Doc is required.";
    }
  }

  if (stageId === 12) {
    if (!hasFile(data.outward_clearance_copy)) {
      errors.outward_clearance_copy = "Outward Clearance Copy is required.";
    }
  }

  if (stageId === 13) {
    if (!hasFile(data.mwp_cancellation_doc)) {
      errors.mwp_cancellation_doc = "MWP Cancellation Doc is required.";
    }
  }

  return errors;
};

const appendTextField = (formData, key, value) => {
  const normalized = trimText(value);
  if (normalized) formData.append(key, normalized);
};

const appendFileField = (formData, key, file) => {
  if (hasFile(file)) formData.append(key, file);
};

/** arrival/save_arrival_document — stage-specific scalar + file fields */
export const appendGroArrivalStageFieldsToFormData = (formData, stageId, fields = {}) => {
  const data = fields ?? {};

  if (stageId === 7) {
    appendTextField(formData, "immigration_status", data.crew_immigration_status);
    if (data.crew_immigration_status === GRO_CREW_IMMIGRATION_STATUS.ON_HOLD) {
      appendTextField(formData, "immigration_remarks", data.on_hold_reason);
    }
    appendFileField(formData, "immigration_doc", data.immigration_doc);
  }

  if (stageId === 8) {
    appendFileField(formData, "inward_clearance_doc", data.inward_clearance_copy);
    appendTextField(formData, "customs_status", data.custom_inspection_status);
    if (data.custom_inspection_status === GRO_CUSTOM_INSPECTION_STATUS.FAILED) {
      appendTextField(formData, "customs_remarks", data.failed_reason);
    }
  }

  if (stageId === 9) {
    appendFileField(formData, "initial_bayan_doc", data.initial_bayan_doc);
    appendFileField(formData, "final_bayan_doc", data.final_bayan_doc);
  }

  if (stageId === 10) {
    appendTextField(formData, "mwp_ticket_no", data.mwp_application_no);
    appendTextField(formData, "sadad_no", data.sadad_no);
    appendFileField(formData, "sadad_doc", data.sadad_doc);
    appendTextField(formData, "mwp_subscription_sadad_no", data.mwp_subscription_sadad_no);
    appendFileField(formData, "mwp_subscription_sadad", data.mwp_subscription_sadad_doc);
    appendFileField(formData, "mwp_doc", data.mwp_copy);
  }

  if (stageId === 11) {
    appendFileField(formData, "mwp_subscription_tax_invoice", data.mwp_subscription_tax_invoice);
  }

  if (stageId === 12) {
    appendFileField(formData, "outward_clearance_doc", data.outward_clearance_copy);
  }

  if (stageId === 13) {
    appendFileField(formData, "mwp_cancellation_doc", data.mwp_cancellation_doc);
  }
};

/** Normalizes an arrival/get_task_details file value (URL string, or {file_name|name, file_url|url}) for display. */
const resolveGroSavedFileInfo = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const url = value.trim();
    if (!url) return null;
    return { file_name: url.split("/").pop() || "Uploaded file", file_url: url };
  }
  if (typeof value === "object") {
    const url = String(value.file_url ?? value.url ?? value.document_url ?? "").trim();
    const name = String(value.file_name ?? value.name ?? "").trim();
    if (!url && !name) return null;
    return {
      file_name: name || url.split("/").pop() || "Uploaded file",
      file_url: url || null,
    };
  }
  return null;
};

/** Falls back to `taskDetails.documents[]` (matched by document_name) when a stage has no flat *_doc field. */
export const resolveGroDocumentByName = (taskDetails, documentName) => {
  const docs = Array.isArray(taskDetails?.documents) ? taskDetails.documents : [];
  const target = String(documentName).trim().toLowerCase();
  const match = docs.find((doc) => String(doc?.document_name ?? "").trim().toLowerCase() === target);
  return match ? resolveGroSavedFileInfo(match) : null;
};

/**
 * arrival/get_task_details — reverse of appendGroArrivalStageFieldsToFormData: maps the saved response
 * back onto { scalarValues } (text/select fields) and { fileInfo } (previously-uploaded file display info).
 */
export const extractGroSavedExtraStageFields = (stageId, taskDetails = {}) => {
  const t = taskDetails ?? {};
  const scalarValues = {};
  const fileInfo = {};

  if (stageId === 7) {
    if (t.immigration_status) scalarValues.crew_immigration_status = t.immigration_status;
    if (t.immigration_remarks) scalarValues.on_hold_reason = t.immigration_remarks;
    fileInfo.immigration_doc =
      resolveGroSavedFileInfo(t.immigration_doc) ??
      resolveGroDocumentByName(t, "Crew Immigration");
  }

  if (stageId === 8) {
    if (t.customs_status) scalarValues.custom_inspection_status = t.customs_status;
    if (t.customs_remarks) scalarValues.failed_reason = t.customs_remarks;
    fileInfo.inward_clearance_copy = resolveGroSavedFileInfo(t.inward_clearance_doc);
  }

  if (stageId === 9) {
    fileInfo.initial_bayan_doc =
      resolveGroSavedFileInfo(t.initial_bayan_doc) ?? resolveGroDocumentByName(t, "Initial Bayan");
    fileInfo.final_bayan_doc =
      resolveGroSavedFileInfo(t.final_bayan_doc) ?? resolveGroDocumentByName(t, "Final Bayan");
  }

  if (stageId === 10) {
    if (t.mwp_ticket_no) scalarValues.mwp_application_no = t.mwp_ticket_no;
    if (t.sadad_no) scalarValues.sadad_no = t.sadad_no;
    if (t.mwp_subscription_sadad_no) scalarValues.mwp_subscription_sadad_no = t.mwp_subscription_sadad_no;
    fileInfo.sadad_doc = resolveGroSavedFileInfo(t.sadad_doc) ?? resolveGroDocumentByName(t, "SADAD");
    fileInfo.mwp_subscription_sadad_doc =
      resolveGroSavedFileInfo(t.mwp_subscription_sadad) ??
      resolveGroDocumentByName(t, "MWP Subscription SADAD");
    fileInfo.mwp_copy = resolveGroSavedFileInfo(t.mwp_doc) ?? resolveGroDocumentByName(t, "Marine Work Permit");
    // Stage 10's popover renders stage 11's fields alongside it (see GROCardView), so its saved
    // file must be bound here too — stage 11 is never extracted on its own in that flow.
    fileInfo.mwp_subscription_tax_invoice =
      resolveGroSavedFileInfo(t.mwp_subscription_tax_invoice) ??
      resolveGroDocumentByName(t, "MWP Subscription Tax Invoice");
  }

  if (stageId === 11) {
    fileInfo.mwp_subscription_tax_invoice =
      resolveGroSavedFileInfo(t.mwp_subscription_tax_invoice) ??
      resolveGroDocumentByName(t, "MWP Subscription Tax Invoice");
  }

  if (stageId === 12) {
    fileInfo.outward_clearance_copy =
      resolveGroSavedFileInfo(t.outward_clearance_doc) ??
      resolveGroDocumentByName(t, "Outward Clearance");
  }

  if (stageId === 13) {
    fileInfo.mwp_cancellation_doc =
      resolveGroSavedFileInfo(t.mwp_cancellation_doc) ??
      resolveGroDocumentByName(t, "MWP Cancellation");
  }

  return { scalarValues, fileInfo };
};

export const groStageHasExtraFields = (stageId) => [7, 8, 9, 10, 11, 12, 13].includes(Number(stageId));

export const buildGroArrivalSaveFormData = ({
  callId,
  taskId,
  timeObjects,
  timeObjectValues,
  stageId,
  extraStageFields,
}) => {
  const formData = new FormData();
  formData.append("call_id", String(callId));
  formData.append("task_id", String(taskId));
  formData.append(
    "time_objects",
    JSON.stringify(buildGroArrivalTimeObjectsPayload(timeObjects, timeObjectValues))
  );
  if (groStageHasExtraFields(stageId)) {
    appendGroArrivalStageFieldsToFormData(formData, stageId, extraStageFields);
  }
  return formData;
};
