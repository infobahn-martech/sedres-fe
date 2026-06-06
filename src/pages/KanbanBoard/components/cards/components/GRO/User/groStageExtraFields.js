import { buildGroArrivalTimeObjectsPayload } from "./groCardUtils";

export const GRO_CREW_IMMIGRATION_STATUS = {
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
};

export const GRO_CUSTOM_INSPECTION_STATUS = {
  PASSED: "Passed",
  FAILED: "Failed",
};

export const GRO_EXTRA_STAGE_FIELD_KEYS = {
  CREW_IMMIGRATION_STATUS: "crew_immigration_status",
  ON_HOLD_REASON: "on_hold_reason",
  INWARD_CLEARANCE_COPY: "inward_clearance_copy",
  CUSTOM_INSPECTION_STATUS: "custom_inspection_status",
  FAILED_REASON: "failed_reason",
  INITIAL_BAYAN_DOC: "initial_bayan_doc",
  FINAL_BAYAN_DOC: "final_bayan_doc",
  MWP_APPLICATION_NO: "mwp_application_no",
  SADAD_NO: "sadad_no",
  SADAD_DOC: "sadad_doc",
  MWP_COPY: "mwp_copy",
};

export const createEmptyExtraStageFields = () => ({
  crew_immigration_status: "",
  on_hold_reason: "",
  inward_clearance_copy: null,
  custom_inspection_status: "",
  failed_reason: "",
  initial_bayan_doc: null,
  final_bayan_doc: null,
  mwp_application_no: "",
  sadad_no: "",
  sadad_doc: null,
  mwp_copy: null,
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
      errors.on_hold_reason = "On Hold Reason is required.";
    }
  }

  if (stageId === 8) {
    if (!hasFile(data.inward_clearance_copy)) {
      errors.inward_clearance_copy = "Inward Clearance Copy is required.";
    }
  }

  if (stageId === 9) {
    if (!trimText(data.custom_inspection_status)) {
      errors.custom_inspection_status = "Custom Inspection Status is required.";
    }
    if (data.custom_inspection_status === GRO_CUSTOM_INSPECTION_STATUS.FAILED && !trimText(data.failed_reason)) {
      errors.failed_reason = "Customs remarks are required.";
    }
    if (!hasFile(data.initial_bayan_doc)) {
      errors.initial_bayan_doc = "Initial Bayan Doc is required.";
    }
    if (!hasFile(data.final_bayan_doc)) {
      errors.final_bayan_doc = "Final Bayan Doc is required.";
    }
  }

  if (stageId === 10) {
    if (!hasFile(data.inward_clearance_copy)) {
      errors.inward_clearance_copy = "Inward Clearance Copy is required.";
    }
    if (!trimText(data.mwp_application_no)) {
      errors.mwp_application_no = "MWP Application No is required.";
    }
    if (!trimText(data.sadad_no)) {
      errors.sadad_no = "SADAD No is required.";
    }
    if (!hasFile(data.sadad_doc)) {
      errors.sadad_doc = "SADAD Doc is required.";
    }
    if (!hasFile(data.mwp_copy)) {
      errors.mwp_copy = "MWP Copy is required.";
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
  }

  if (stageId === 8) {
    appendFileField(formData, "inward_clearance_doc", data.inward_clearance_copy);
  }

  if (stageId === 9) {
    appendTextField(formData, "customs_status", data.custom_inspection_status);
    if (data.custom_inspection_status === GRO_CUSTOM_INSPECTION_STATUS.FAILED) {
      appendTextField(formData, "immigration_remarks", data.failed_reason);
    }
    appendFileField(formData, "initial_bayan_doc", data.initial_bayan_doc);
    appendFileField(formData, "final_bayan_doc", data.final_bayan_doc);
  }

  if (stageId === 10) {
    appendFileField(formData, "inward_clearance_doc", data.inward_clearance_copy);
    appendTextField(formData, "mwp_ticket_no", data.mwp_application_no);
    appendTextField(formData, "sadad_no", data.sadad_no);
    appendFileField(formData, "sadad_doc", data.sadad_doc);
    appendFileField(formData, "mwp_doc", data.mwp_copy);
  }
};

/** @deprecated Use appendGroArrivalStageFieldsToFormData */
export const appendGroExtraStageFieldsToFormData = appendGroArrivalStageFieldsToFormData;

export const groStageHasExtraFields = (stageId) => [7, 8, 9, 10].includes(Number(stageId));

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
