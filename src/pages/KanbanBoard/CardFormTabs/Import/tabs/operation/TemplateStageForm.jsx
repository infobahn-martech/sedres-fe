import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEye, FiLayers } from "react-icons/fi";
import CardFormEmptyState from "../../../shared/components/CardFormEmptyState";
import GroupSettingsIcon from "@/assets/images/cv.png";
import { notify } from "@/components/Toaster";
import callFileService from "@/services/callFileService";
import appointmentAcceptanceService from "@/services/appointmentAcceptanceService";
import useArrivalReducer from "@/store/ArrivalReducer";
import DateTimePickerField from "../../../shared/components/DateTimePickerField";
import {
  buildTemplateFieldDisplay,
  findTimeObjectRowForField,
  flattenTimeObjects,
  getTemplateFieldType,
  hasExistingTemplateFile,
  isEmptyTemplateValue,
  isTemplateFieldRequired,
  sortTemplateFields,
  toStageDateTimeValue,
  toStageFormValue,
  toStagePayloadValue,
} from "../../../shared/utils/callDetailTemplate";
import {
  AdditionalTimeObjectAddButton,
  AdditionalTimeObjectsFields,
  appendAdditionalTimeObject,
  commitAdditionalTimeObject,
  mapCallTimeObjectsToAdditionalRows,
  FormField,
  FormInput,
  FormSection,
  FormSelect,
  FormTextarea,
  OperationEmailPreviewPanel,
  OperationFileUpload,
  OperationFormCard,
  OperationSaveSection,
} from "./components/OperationCommon";
import { OPERATION_STAGE_IDS } from "./operationConstants";
import { extractReportTemplateFields } from "./operationReportTemplate";
import { resolveReportBodyHtml } from "./operationReportMessageHtml";

// Existing report templates per stage (composer prefill only — saving goes through save_stage).
const REPORT_TEMPLATE_BY_STAGE = {
  pre_arrival: { reportTypeId: 2, load: appointmentAcceptanceService.getTemplateByPortCallType },
  arrival: { reportTypeId: 4, load: appointmentAcceptanceService.getArrivalTemplateByPortCallType },
  departure: { reportTypeId: 5, load: appointmentAcceptanceService.getArrivalTemplateByPortCallType },
};

// Composer fields; each one is sent in save_stage's `report` (from_email, to_email, cc_emails, subject, body).
const REPORT_COMPOSER_FIELDS = ["from", "to", "cc", "subject", "message"];

// Template values win; empty ones keep what the composer already has.
const mergeReportTemplate = (prev, template) => ({
  from: template.from || prev.from,
  to: template.to || prev.to,
  cc: template.cc || prev.cc,
  subject: template.subject || prev.subject,
  message: template.message || prev.message,
});

// Stage ids for the shared time_object endpoints (additional "+" time objects).
const STAGE_ID_BY_KEY = {
  pre_arrival: OPERATION_STAGE_IDS.PRE_ARRIVAL,
  arrival: OPERATION_STAGE_IDS.ARRIVAL,
  departure: OPERATION_STAGE_IDS.DEPARTURE,
};

const SELECT_TYPES =new Set(["dropdown", "select", "multiselect", "multi_select"]);
const TEXT_INPUT_TYPES = { text: "text", email: "email", number: "number", phone: "tel", tel: "tel", url: "url" };

const toOptionList = (field) =>
  (Array.isArray(field?.options) ? field.options : []).map((opt) => ({
    value: String(typeof opt === "object" ? opt?.option_value ?? "" : opt).trim(),
    label: String(typeof opt === "object" ? opt?.option_label ?? opt?.option_value ?? "" : opt).trim(),
  }));

const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const openFile = (url) => {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
};

// Pre Arrival / Arrival / Departure rendered from the call's template subtab (`stage`) and
// saved through POST call_file/save_stage. Mounted with key `${callId}:${stage.tabId}`, so a
// different call or stage always starts from fresh state.
function TemplateStageForm({
  stageKey,
  stage,
  detail,
  callId,
  portId,
  callTypeId,
  refetchCallDetail,
  cardColor,
  isViewOnly = false,
  canPreviewEmail = true,
  canSendReport = true,
  canAddTimeObject = true,
  canDeleteTimeObject = true,
  onDirtyChange,
  onSaveSuccess,
}) {
  const fields = useMemo(() => sortTemplateFields(stage?.fields), [stage]);
  const timeObjects = useMemo(() => flattenTimeObjects(detail), [detail]);

  // Saved values from the (shared) call detail; recomputed after a save refreshes it.
  const baselineValues = useMemo(() => {
    const values = {};
    fields.forEach((field) => {
      values[field.field_id] = toStageFormValue(field, { detail, timeObjects });
    });
    return values;
  }, [fields, detail, timeObjects]);

  // Only fields the user changed live here, so a background refresh never overwrites them.
  const [edits, setEdits] = useState({});
  const [newFiles, setNewFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(null); // "save" | "report" | null
  const submittingRef = useRef(false);
  // The call detail's subtab `email_template` is the composer's source; the report template
  // endpoints are only a fallback for templates that don't carry one.
  const detailEmailTemplate = stage?.emailTemplate ?? null;
  const showEmailPreview = canPreviewEmail && stage?.emailPreview !== false;
  const [reportDraft, setReportDraft] = useState(() => {
    const defaults = { from: "", to: "", cc: "", subject: `Report - ${stage?.label ?? ""}`.trim(), message: "" };
    if (!detailEmailTemplate) return defaults;
    return mergeReportTemplate(defaults, extractReportTemplateFields(detailEmailTemplate));
  });
  const reportTouchedRef = useRef(false);
  const [reportTemplateVersion, setReportTemplateVersion] = useState(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const getValue = useCallback(
    (fieldId) => (Object.prototype.hasOwnProperty.call(edits, fieldId) ? edits[fieldId] : baselineValues[fieldId]),
    [edits, baselineValues]
  );

  const isDirty = Object.keys(edits).length > 0 || Object.keys(newFiles).length > 0;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const clearError = (fieldId) =>
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });

  const setFieldValue = (fieldId, value) => {
    setEdits((prev) => ({ ...prev, [fieldId]: value }));
    clearError(fieldId);
  };

  const setFieldFile = (fieldId, file) => {
    setNewFiles((prev) => {
      const next = { ...prev };
      if (file) next[fieldId] = file;
      else delete next[fieldId];
      return next;
    });
    clearError(fieldId);
  };

  // ---- Report composer prefill (existing report template endpoints) ----
  const reportConfig = REPORT_TEMPLATE_BY_STAGE[stageKey];
  const templateTimeObjectsRef = useRef([]);
  templateTimeObjectsRef.current = fields
    .filter((field) => ["datetime", "timeobject"].includes(getTemplateFieldType(field)))
    .map((field) => {
      const value = toStageDateTimeValue(getValue(field.field_id));
      if (!value) return null;
      const row = findTimeObjectRowForField(field, timeObjects);
      return {
        time_object_id: row?.id || null,
        field_key: field.field_key,
        time_object_value: value,
      };
    })
    .filter(Boolean);

  // Rebind from the call detail whenever it refreshes (e.g. after a save), unless the user
  // has already edited the composer.
  useEffect(() => {
    if (!detailEmailTemplate || reportTouchedRef.current) return;
    const template = extractReportTemplateFields(detailEmailTemplate);
    setReportDraft((prev) => mergeReportTemplate(prev, template));
  }, [detailEmailTemplate]);

  useEffect(() => {
    if (detailEmailTemplate || isViewOnly || !showEmailPreview || !reportConfig) return undefined;
    const resolvedCallId = String(callId ?? "").trim();
    const resolvedPortId = String(portId ?? "").trim();
    const resolvedCallTypeId = String(callTypeId ?? "").trim();
    if (!resolvedCallId || !resolvedPortId || !resolvedCallTypeId) return undefined;

    let cancelled = false;
    reportConfig
      .load({
        call_id: resolvedCallId,
        port_id: resolvedPortId,
        call_type_id: resolvedCallTypeId,
        report_type_id: reportConfig.reportTypeId,
        time_objects: templateTimeObjectsRef.current,
      })
      .then((response) => {
        if (cancelled || !aliveRef.current || reportTouchedRef.current) return;
        const template = extractReportTemplateFields(response);
        setReportDraft((prev) => mergeReportTemplate(prev, template));
      })
      .catch(() => {
        // Composer keeps its defaults; the user can still type the report.
      });
    return () => {
      cancelled = true;
    };
  }, [detailEmailTemplate, isViewOnly, showEmailPreview, reportConfig, callId, portId, callTypeId, reportTemplateVersion]);

  // ---- Additional time objects ("+" button): saved/deleted per row via time_object endpoints ----
  const stageId = STAGE_ID_BY_KEY[stageKey];
  const saveCallTimeObjectAction = useArrivalReducer((s) => s.saveCallTimeObject);
  const deleteCallTimeObjectAction = useArrivalReducer((s) => s.deleteCallTimeObject);
  const [additionalRows, setAdditionalRows] = useState([]);
  const additionalRowsRef = useRef(additionalRows);
  additionalRowsRef.current = additionalRows;

  // Saved additional rows come from the call detail (call_file/get_call_detail) `time_objects`.
  const savedAdditionalRows = useMemo(() => {
    const source = Array.isArray(detail?.time_objects) ? detail.time_objects.flat(Infinity) : [];
    return mapCallTimeObjectsToAdditionalRows(source, { stageId });
  }, [detail, stageId]);

  // Whenever the call detail refreshes, show its saved rows plus any unsaved local drafts.
  useEffect(() => {
    setAdditionalRows((prev) => [
      ...savedAdditionalRows,
      ...prev.filter((row) => row?.id == null || String(row.id).trim() === ""),
    ]);
  }, [savedAdditionalRows]);

  const handleCommitAdditionalTimeObject = async (row, index) => {
    const resolvedCallId = String(callId ?? "").trim();
    if (!resolvedCallId) return;
    try {
      const newId = await commitAdditionalTimeObject({
        row,
        callId: resolvedCallId,
        stageId,
        saveCallTimeObject: saveCallTimeObjectAction,
      });
      if (!aliveRef.current) return;
      // The saved row now comes back from the call detail, so drop the local draft copy.
      setAdditionalRows((prev) => prev.filter((_, i) => i !== index));
      await refetchCallDetail?.();
      // Time objects feed the report template body.
      if (aliveRef.current) setReportTemplateVersion((version) => version + 1);
      return newId;
    } catch (error) {
      notify(getApiErrorMessage(error, "Failed to save time object."), "error");
    }
  };

  const handleRemoveAdditionalTimeObject = async (row, index) => {
    const resolvedCallId = String(callId ?? "").trim();
    if (row?.id != null && String(row.id).trim() !== "" && resolvedCallId) {
      try {
        await deleteCallTimeObjectAction({ timeObjectId: row.id, callId: resolvedCallId, stageId });
        if (!aliveRef.current) return;
        setAdditionalRows((prev) => prev.filter((_, i) => i !== index));
        await refetchCallDetail?.();
        if (aliveRef.current) setReportTemplateVersion((version) => version + 1);
      } catch (error) {
        notify(getApiErrorMessage(error, "Failed to delete time object."), "error");
      }
      return;
    }
    setAdditionalRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReportDraftChange = (name, value) => {
    reportTouchedRef.current = true;
    setReportDraft((prev) => ({ ...prev, [name]: value }));
  };

  // ---- Validation & submit ----
  const validate = () => {
    const nextErrors = {};
    fields.forEach((field) => {
      if (!isTemplateFieldRequired(field)) return;
      const type = getTemplateFieldType(field);
      const id = field.field_id;
      let missing;
      if (type === "file") missing = !newFiles[id] && !hasExistingTemplateFile(field);
      else if (type === "checkbox" && typeof getValue(id) === "boolean") missing = getValue(id) !== true;
      else missing = isEmptyTemplateValue(getValue(id));
      if (missing) nextErrors[id] = `${field.field_label || "This field"} is required.`;
    });
    return nextErrors;
  };

  const submit = async ({ withReport }) => {
    if (submittingRef.current || isViewOnly) return;
    const resolvedCallId = String(callId ?? "").trim();
    if (!resolvedCallId) {
      notify("Call ID is required to save this stage.", "error");
      return;
    }
    if (stage?.tabId === undefined || stage?.tabId === null || String(stage.tabId).trim() === "") {
      notify("This stage has no template tab id, so it can't be saved.", "error");
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    const missingLabels = fields.filter((field) => nextErrors[field.field_id]).map((field) => field.field_label);
    if (missingLabels.length) {
      notify(`Please fill the required fields: ${missingLabels.join(", ")}.`, "error");
      return;
    }
    if (withReport && !String(reportDraft.to || "").trim()) {
      notify("Add a recipient in the email preview before sending the report.", "error");
      return;
    }

    const fieldsPayload = {};
    fields.forEach((field) => {
      if (getTemplateFieldType(field) === "file") return;
      fieldsPayload[field.field_id] = toStagePayloadValue(field, getValue(field.field_id));
    });

    const formData = new FormData();
    formData.append("call_id", resolvedCallId);
    formData.append("tab_id", String(stage.tabId));
    formData.append("fields", JSON.stringify(fieldsPayload));
    // Only newly selected files are uploaded; existing attachments are left untouched.
    Object.entries(newFiles).forEach(([fieldId, file]) => {
      if (file instanceof File) formData.append(`field_${fieldId}`, file);
    });
    // The composer's report goes with every save_stage call (Save and Send) once it has a recipient,
    // e.g. report = {"from_email":"info@x.com","to_email":"agent@x.com","cc_emails":"ops@x.com",
    //               "subject":"Departure - MV ALNEHEM","body":"<p>...</p>"}.
    const report = {
      from_email: String(reportDraft.from || "").trim(),
      to_email: String(reportDraft.to || "").trim(),
      cc_emails: String(reportDraft.cc || "").trim(),
      subject: String(reportDraft.subject || "").trim(),
      body: resolveReportBodyHtml(reportDraft.message, "") || "",
    };
    if (showEmailPreview && report.to_email) {
      formData.append("report", JSON.stringify(report));
    }

    submittingRef.current = true;
    setSubmitting(withReport ? "report" : "save");
    try {
      const response = await callFileService.saveStage(formData);
      const body = response?.data;
      if (body?.status === "error" || body?.status === false) {
        throw new Error(body?.message || "Unable to save this stage.");
      }
      if (!aliveRef.current) return;
      // Rebind saved values / attachment URLs from a fresh call detail before clearing edits.
      await refetchCallDetail?.();
      if (!aliveRef.current) return;
      setEdits({});
      setNewFiles({});
      setErrors({});
      setReportTemplateVersion((version) => version + 1);
      notify(withReport ? "Saved and report sent." : "Saved successfully.", "success");
      onSaveSuccess?.();
    } catch (error) {
      // Entered values and selected files stay in place so the user can retry.
      if (aliveRef.current) {
        notify(getApiErrorMessage(error, withReport ? "Failed to save and send the report." : "Failed to save."), "error");
      }
    } finally {
      submittingRef.current = false;
      if (aliveRef.current) setSubmitting(null);
    }
  };

  // ---- Field rendering ----
  const renderInput = (field) => {
    const id = field.field_id;
    const type = getTemplateFieldType(field);
    const value = getValue(id);
    const hasError = Boolean(errors[id]);
    const disabled = isViewOnly || Boolean(submitting);

    if (type === "datetime" || type === "timeobject") {
      const [datePart = "", timePart = ""] = String(value || "").split(" ");
      return (
        <DateTimePickerField
          dateValue={datePart}
          timeValue={timePart}
          onDateTimeChange={({ date, time }) => setFieldValue(id, date ? `${date} ${time || "00:00"}` : "")}
          dateFieldName={`stage-field-${id}-date`}
          timeFieldName={`stage-field-${id}-time`}
          disabled={disabled}
          hasError={hasError}
        />
      );
    }
    if (type === "date" || type === "time") {
      return <FormInput type={type} value={String(value ?? "")} onChange={(e) => setFieldValue(id, e.target.value)} disabled={disabled} />;
    }
    if (type === "textarea") {
      return <FormTextarea value={String(value ?? "")} onChange={(e) => setFieldValue(id, e.target.value)} disabled={disabled} />;
    }
    if (type === "radio") {
      return (
        <div className="operation-inline-radio-row">
          {toOptionList(field).map((opt) => (
            <label key={opt.value} className="operation-inline-radio">
              <input
                type="radio"
                name={`stage-field-${id}`}
                value={opt.value}
                checked={String(value ?? "") === opt.value}
                onChange={() => setFieldValue(id, opt.value)}
                disabled={disabled}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    }
    if (type === "checkbox") {
      const options = toOptionList(field);
      if (!options.length) {
        return (
          <label className="operation-inline-radio">
            <input type="checkbox" checked={value === true} onChange={(e) => setFieldValue(id, e.target.checked)} disabled={disabled} />
            <span>{field.field_label}</span>
          </label>
        );
      }
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className="operation-inline-radio-row">
          {options.map((opt) => (
            <label key={opt.value} className="operation-inline-radio">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={(e) =>
                  setFieldValue(
                    id,
                    e.target.checked ? [...selected, opt.value] : selected.filter((item) => item !== opt.value)
                  )
                }
                disabled={disabled}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    }
    if (SELECT_TYPES.has(type)) {
      const options = toOptionList(field);
      const current = String(value ?? "");
      // Keep an unmatched saved value visible instead of rendering a blank select.
      const withCurrent =
        current && !options.some((opt) => opt.value === current) ? [...options, { value: current, label: current }] : options;
      return (
        <FormSelect
          value={current}
          onChange={(e) => setFieldValue(id, e?.target?.value ?? e ?? "")}
          options={withCurrent}
          placeholder={options.length ? "Select..." : "No options configured"}
          disabled={disabled}
          hasError={hasError}
        />
      );
    }
    if (type === "file") {
      const existingName = !isEmptyTemplateValue(field.value) ? String(field.value) : "";
      const existingUrl = String(field.file_url ?? "").trim();
      const pending = newFiles[id];
      return (
        <>
          {(existingName || existingUrl) && (
            <div className="detail-attachment-row">
              <span className="detail-attachment-name">{existingName || existingUrl.split("/").pop()}</span>
              <button
                type="button"
                className="detail-attachment-view-btn"
                onClick={() => openFile(existingUrl)}
                disabled={!existingUrl}
                title={existingUrl ? "View attachment" : "File URL not available"}
              >
                <FiEye size={14} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
          )}
          <OperationFileUpload
            files={pending ? [{ name: pending.name }] : []}
            onAddFiles={(attachments) => setFieldFile(id, attachments[0]?.file ?? null)}
            isViewOnly={disabled}
            ariaLabel={`Upload ${field.field_label || "file"}`}
          />
          {pending && !disabled && (
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setFieldFile(id, null)}>
              Remove selected file
            </button>
          )}
        </>
      );
    }
    if (TEXT_INPUT_TYPES[type]) {
      return (
        <FormInput
          type={TEXT_INPUT_TYPES[type]}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => setFieldValue(id, e.target.value)}
          disabled={disabled}
        />
      );
    }
    // Unsupported type: show the saved value read-only; it is still sent back unchanged.
    const display = buildTemplateFieldDisplay(field, { detail, timeObjects });
    return (
      <span className="detail-row-empty">
        {display.kind === "text" ? display.text : `Can't edit this field type (${type}).`}
      </span>
    );
  };

  const formClassName = `${String(stageKey).replace(/_/g, "-")}-form`;

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <div className="operation-content-header">
        <h3 className="operation-content-title">{stage?.label} Information</h3>
      </div>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="operation-tab-layout">
          <div className={formClassName}>
            <div className="operation-two-column-grid operation-two-column-grid--split-scroll">
              <OperationFormCard
                className="operation-form-column"
                topRightAction={
                  !isViewOnly && canAddTimeObject ? (
                    <AdditionalTimeObjectAddButton
                      onClick={() => setAdditionalRows((prev) => appendAdditionalTimeObject(prev))}
                    />
                  ) : null
                }
              >
                {/* Operation stages are a single column: fields stack in row_no, then col_no order. */}
                {fields.length === 0 ? (
                  <CardFormEmptyState
                    icon={FiLayers}
                    title="No fields for this stage"
                    message={
                      !isViewOnly && canAddTimeObject
                        ? "Use the + button above to add a time object for this stage."
                        : "This stage has no fields configured in the call's template."
                    }
                  />
                ) : (
                  fields.map((field) => (
                    <FormField
                      key={field.field_id}
                      label={`${field.field_label || field.field_key || "Field"}${isTemplateFieldRequired(field) ? " *" : ""}`}
                    >
                      {renderInput(field)}
                      {errors[field.field_id] && <span className="cf-field-error">{errors[field.field_id]}</span>}
                    </FormField>
                  ))
                )}
                <AdditionalTimeObjectsFields
                  value={additionalRows}
                  onChange={setAdditionalRows}
                  onRemoveRow={handleRemoveAdditionalTimeObject}
                  onCommitRow={handleCommitAdditionalTimeObject}
                  isViewOnly={isViewOnly}
                  hideAddButton
                  canAdd={canAddTimeObject}
                  canDelete={canDeleteTimeObject}
                />
              </OperationFormCard>
              {showEmailPreview && (
                <OperationFormCard className="operation-email-column">
                  <OperationEmailPreviewPanel
                    from={reportDraft.from}
                    to={reportDraft.to}
                    cc={reportDraft.cc}
                    subject={reportDraft.subject}
                    message={reportDraft.message}
                    onChange={handleReportDraftChange}
                    onSend={() => submit({ withReport: true })}
                    isSending={submitting === "report"}
                    isViewOnly={isViewOnly}
                    canSend={canSendReport}
                    visibleFields={REPORT_COMPOSER_FIELDS}
                  />
                </OperationFormCard>
              )}
            </div>
          </div>
          <OperationSaveSection
            isViewOnly={isViewOnly}
            onSave={() => submit({ withReport: false })}
            isSaving={Boolean(submitting)}
          />
        </div>
      </FormSection>
    </div>
  );
}

TemplateStageForm.propTypes = {
  stageKey: PropTypes.oneOf(["pre_arrival", "arrival", "departure"]).isRequired,
  stage: PropTypes.shape({
    tabId: PropTypes.string,
    label: PropTypes.string,
    fields: PropTypes.array,
  }).isRequired,
  detail: PropTypes.object,
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  refetchCallDetail: PropTypes.func,
  cardColor: PropTypes.string,
  isViewOnly: PropTypes.bool,
  canPreviewEmail: PropTypes.bool,
  canSendReport: PropTypes.bool,
  canAddTimeObject: PropTypes.bool,
  canDeleteTimeObject: PropTypes.bool,
  onDirtyChange: PropTypes.func,
  onSaveSuccess: PropTypes.func,
};

export default TemplateStageForm;
