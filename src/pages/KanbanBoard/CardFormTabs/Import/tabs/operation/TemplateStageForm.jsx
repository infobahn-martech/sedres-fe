import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEye } from "react-icons/fi";
import GroupSettingsIcon from "@/assets/images/cv.png";
import { notify } from "@/components/Toaster";
import callFileService from "@/services/callFileService";
import appointmentAcceptanceService from "@/services/appointmentAcceptanceService";
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
import { extractReportTemplateFields } from "./operationReportTemplate";
import { resolveReportBodyHtml } from "./operationReportMessageHtml";

// Existing report templates per stage (composer prefill only — saving goes through save_stage).
const REPORT_TEMPLATE_BY_STAGE = {
  pre_arrival: { reportTypeId: 2, load: appointmentAcceptanceService.getTemplateByPortCallType },
  arrival: { reportTypeId: 4, load: appointmentAcceptanceService.getArrivalTemplateByPortCallType },
  departure: { reportTypeId: 5, load: appointmentAcceptanceService.getArrivalTemplateByPortCallType },
};

// save_stage's `report` carries only to_email, subject and body, so the composer shows just those.
const REPORT_COMPOSER_FIELDS = ["to", "subject", "message"];

const SELECT_TYPES = new Set(["dropdown", "select", "multiselect", "multi_select"]);
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
  const [reportDraft, setReportDraft] = useState({
    to: "",
    subject: `Report - ${stage?.label ?? ""}`.trim(),
    message: "",
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

  useEffect(() => {
    if (isViewOnly || !canPreviewEmail || !reportConfig) return undefined;
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
        setReportDraft((prev) => ({
          to: template.to || prev.to,
          subject: template.subject || prev.subject,
          message: template.message || prev.message,
        }));
      })
      .catch(() => {
        // Composer keeps its defaults; the user can still type the report.
      });
    return () => {
      cancelled = true;
    };
  }, [isViewOnly, canPreviewEmail, reportConfig, callId, portId, callTypeId, reportTemplateVersion]);

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
    if (withReport) {
      formData.append(
        "report",
        JSON.stringify({
          to_email: String(reportDraft.to || "").trim(),
          subject: String(reportDraft.subject || "").trim(),
          body: resolveReportBodyHtml(reportDraft.message, "") || "",
        })
      );
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

  // Rows from row_no; inside a row, col_no order. Columns collapse responsively.
  const rows = useMemo(() => {
    const byRow = new Map();
    fields.forEach((field) => {
      const rowKey = Number.isFinite(Number(field.row_no)) ? Number(field.row_no) : Number.MAX_SAFE_INTEGER;
      if (!byRow.has(rowKey)) byRow.set(rowKey, []);
      byRow.get(rowKey).push(field);
    });
    return [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([rowKey, rowFields]) => ({ rowKey, rowFields }));
  }, [fields]);

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
              <OperationFormCard className="operation-form-column">
                {rows.length === 0 ? (
                  <span className="detail-row-empty">No fields are configured for this stage.</span>
                ) : (
                  rows.map(({ rowKey, rowFields }) => (
                    <div
                      key={rowKey}
                      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", columnGap: 16 }}
                    >
                      {rowFields.map((field) => (
                        <FormField
                          key={field.field_id}
                          label={`${field.field_label || field.field_key || "Field"}${isTemplateFieldRequired(field) ? " *" : ""}`}
                        >
                          {renderInput(field)}
                          {errors[field.field_id] && <span className="cf-field-error">{errors[field.field_id]}</span>}
                        </FormField>
                      ))}
                    </div>
                  ))
                )}
              </OperationFormCard>
              {canPreviewEmail && (
                <OperationFormCard className="operation-email-column">
                  <OperationEmailPreviewPanel
                    to={reportDraft.to}
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
  onDirtyChange: PropTypes.func,
  onSaveSuccess: PropTypes.func,
};

export default TemplateStageForm;
