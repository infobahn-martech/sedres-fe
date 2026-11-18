import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiExternalLink, FiEye, FiFileText, FiLayers, FiX } from "react-icons/fi";
import CardFormEmptyState from "../../../shared/components/CardFormEmptyState";
import GroupSettingsIcon from "@/assets/images/cv.png";
import { notify } from "@/components/Toaster";
import callFileService from "@/services/callFileService";
import arrivalService from "@/services/arrivalService";
import appointmentAcceptanceService from "@/services/appointmentAcceptanceService";
import useArrivalReducer from "@/store/ArrivalReducer";
import DateTimePickerField from "../../../shared/components/DateTimePickerField";
import DefaultLineItemsModal from "../appointment/DefaultLineItemsModal";
import {
  buildTemplateFieldDisplay,
  findTimeObjectRowForField,
  flattenTimeObjects,
  normalizeTemplateKey,
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
  buildSendReportRequestBody,
  commitAdditionalTimeObject,
  extractUploadedAttachments,
  mapAttachmentsForSave,
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

// Arrival offers an Arrival / Daily report switch in the composer (as in the legacy Arrival form).
// Daily reports use report_type_id 3.
const ARRIVAL_REPORT_TYPE_OPTIONS = [
  { value: "arrival", label: "Arrival Report" },
  { value: "daily", label: "Daily Report" },
];
const DAILY_REPORT_TYPE_ID = 3;

const escapeHtml = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Composer fields; each one is sent in save_stage's `report`
// (from_email, to_email, cc_emails, subject, body, attachments).
const REPORT_COMPOSER_FIELDS = ["from", "to", "cc", "subject", "attachments", "message"];

// Template values win; empty ones keep what the composer already has. Template attachments
// ({ file_name, file_url }) get local ids so the preview chips can be removed individually.
const mergeReportTemplate = (prev, template) => {
  const templateAttachments = extractUploadedAttachments(template.attachments);
  return {
    from: template.from || prev.from,
    to: template.to || prev.to,
    cc: template.cc || prev.cc,
    subject: template.subject || prev.subject,
    message: template.message || prev.message,
    attachments: templateAttachments.length ? templateAttachments : prev.attachments || [],
  };
};

// Stage ids for the shared time_object endpoints (additional "+" time objects).
const STAGE_ID_BY_KEY = {
  pre_arrival: OPERATION_STAGE_IDS.PRE_ARRIVAL,
  arrival: OPERATION_STAGE_IDS.ARRIVAL,
  departure: OPERATION_STAGE_IDS.DEPARTURE,
};

// Changing one of these fields re-requests call_file/get_call_detail/{callId} with the current
// values as query params, and the stage's returned email_template is rebound into the composer.
const EMAIL_TEMPLATE_TRIGGER_KEYS = ["saber", "weather_forecast"];

// Live wind map shown under Weather Forecast when "Bad Weather" is selected (as in the legacy
// Pre Arrival form).
const WINDY_EMBED_URL =
  "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=default&metricTemp=default&metricWind=default&zoom=8&overlay=wind&product=ecmwf&level=surface&lat=27.284&lon=49.109&detailLat=29.0525682775337&detailLon=48.087158203125&marker=true";
const WINDY_OPEN_URL = "https://www.windy.com/27.284/49.109?wind,27.284,49.109,8";

const isBadWeatherValue = (value) => normalizeTemplateKey(value) === "bad_weather";

const WindyWeatherMap = ({ iframe }) => (
  <div className="stage-windy-card">
    <div className="stage-windy-card__header">
      <span className="stage-windy-card__icon" aria-hidden>
        <FiAlertTriangle size={14} strokeWidth={2.4} />
      </span>
      <div className="stage-windy-card__text">
        <span className="stage-windy-card__title">Bad weather forecast</span>
        <span className="stage-windy-card__hint">Re-check ETA and clearance time objects.</span>
      </div>
      <a
        className="stage-windy-card__link"
        href={WINDY_OPEN_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in Windy"
      >
        <FiExternalLink size={13} strokeWidth={2.2} aria-hidden />
        <span>Windy</span>
      </a>
    </div>
    <div className="stage-windy-card__map">
      <iframe
        title={iframe?.title || "Windy weather map"}
        src={iframe?.src || WINDY_EMBED_URL}
        loading="lazy"
        allowFullScreen
      />
    </div>
  </div>
);

WindyWeatherMap.propTypes = {
  iframe: PropTypes.shape({ title: PropTypes.string, src: PropTypes.string }),
};

const HIDDEN_FIELD_TYPES = new Set(["iframe"]);

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

// The SABER certificate upload is a template "file" field labelled / keyed with "SABER".
const isSaberField = (field) =>
  getTemplateFieldType(field) === "file" &&
  [field?.field_label, field?.field_key, field?.system_binding_key].some((value) =>
    /saber/i.test(String(value ?? ""))
  );

// Moves the SABER attachment field directly under the SABER select it depends on
// (`show_when_field_id`), regardless of its row_no / col_no.
const placeSaberFieldUnderSelect = (fields) => {
  const saberIndex = fields.findIndex(isSaberField);
  if (saberIndex < 0) return fields;
  const saberField = fields[saberIndex];
  const controllerId = String(saberField.show_when_field_id ?? "").trim();
  if (!controllerId) return fields;
  const rest = fields.filter((_, index) => index !== saberIndex);
  const controllerIndex = rest.findIndex((field) => String(field?.field_id) === controllerId);
  if (controllerIndex < 0) return fields;
  rest.splice(controllerIndex + 1, 0, saberField);
  return rest;
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
  // A SABER / Weather Forecast change re-requests get_call_detail with those values; its response
  // ({ detail, stage }) then drives this stage's fields, values and email template until the shared
  // call detail refreshes again (e.g. after a save).
  const [freshData, setFreshData] = useState(null);
  // A SABER change requests call_file/get_saber_attachment instead; its `saber_attachment`
  // field replaces the matching template field (saved file name / url) until the detail refreshes.
  const [saberAttachmentField, setSaberAttachmentField] = useState(null);
  // A Weather Forecast change requests call_file/get_weather_map; its `weather_map` field
  // (iframe title / src) is shown under the Weather Forecast select.
  const [weatherMapField, setWeatherMapField] = useState(null);
  useEffect(() => {
    setFreshData(null);
  }, [detail]);
  const activeDetail = freshData?.detail ?? detail;
  const activeStage = freshData?.stage ?? stage;

  const fields = useMemo(() => {
    const base = Array.isArray(activeStage?.fields) ? activeStage.fields : [];
    if (!saberAttachmentField) return placeSaberFieldUnderSelect(sortTemplateFields(base));
    const overrideId = String(saberAttachmentField.field_id ?? "").trim();
    const matchIndex = base.findIndex(
      (field) => (overrideId && String(field?.field_id) === overrideId) || isSaberField(field)
    );
    const responseField = {
      ...saberAttachmentField,
      value: saberAttachmentField.value ?? null,
      file_url: saberAttachmentField.file_url ?? null,
    };
    let next = base;
    if (matchIndex >= 0) {
      // Template already has the SABER file field — keep its id, take the response's data.
      next = base.slice();
      next[matchIndex] = { ...base[matchIndex], ...responseField, field_id: base[matchIndex].field_id };
    } else if (overrideId) {
      // Template has no SABER file field — render the one from get_saber_attachment.
      next = [...base, responseField];
    }
    return placeSaberFieldUnderSelect(sortTemplateFields(next));
  }, [activeStage, saberAttachmentField]);
  const timeObjects = useMemo(() => flattenTimeObjects(activeDetail), [activeDetail]);

  // Saved values from the (shared) call detail; recomputed after a save refreshes it.
  const baselineValues = useMemo(() => {
    const values = {};
    fields.forEach((field) => {
      values[field.field_id] = toStageFormValue(field, { detail: activeDetail, timeObjects });
    });
    return values;
  }, [fields, activeDetail, timeObjects]);

  // Only fields the user changed live here, so a background refresh never overwrites them.
  const [edits, setEdits] = useState({});
  const [newFiles, setNewFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(null); // "save" | "report" | null
  const submittingRef = useRef(false);
  // Changing the SABER select opens the sales order line items modal
  // (sales_order/get_so_items_by_call/{call_id}?so_type=Marine).
  const [lineItemsCallId, setLineItemsCallId] = useState(null);
  const handleLineItemsDone = () => setLineItemsCallId(null);
  const openLineItemsForSaber = () => {
    const resolvedCallId = String(callId ?? "").trim();
    if (resolvedCallId) setLineItemsCallId(resolvedCallId);
  };
  // The call detail's subtab `email_template` is the composer's source; the report template
  // endpoints are only a fallback for templates that don't carry one.
  const detailEmailTemplate = activeStage?.emailTemplate ?? null;
  const showEmailPreview = canPreviewEmail && stage?.emailPreview !== false;
  const [reportDraft, setReportDraft] = useState(() => {
    const defaults = {
      from: "",
      to: "",
      cc: "",
      subject: `Report - ${stage?.label ?? ""}`.trim(),
      message: "",
      attachments: [],
    };
    if (!detailEmailTemplate) return defaults;
    return mergeReportTemplate(defaults, extractReportTemplateFields(detailEmailTemplate));
  });
  const reportTouchedRef = useRef(false);
  const [reportTemplateVersion, setReportTemplateVersion] = useState(0);
  // Arrival only: "arrival" | "daily". The arrival draft is kept aside while Daily is shown.
  const hasReportTypeSwitch = stageKey === "arrival";
  const [reportType, setReportType] = useState("arrival");
  const reportTypeRef = useRef(reportType);
  reportTypeRef.current = reportType;
  const arrivalDraftRef = useRef(null);
  const arrivalTouchedRef = useRef(false);
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

  // field_key → field for the email-template trigger fields present on this stage.
  const triggerFields = useMemo(() => {
    const map = {};
    fields.forEach((field) => {
      const key = normalizeTemplateKey(field?.field_key);
      if (EMAIL_TEMPLATE_TRIGGER_KEYS.includes(key)) map[key] = field;
    });
    return map;
  }, [fields]);

  // Current saber / weather_forecast values as query params; the JSON key drives the effect below.
  const triggerParams = {};
  EMAIL_TEMPLATE_TRIGGER_KEYS.forEach((key) => {
    const field = triggerFields[key];
    if (!field) return;
    const value = getValue(field.field_id);
    triggerParams[key] = value === null || value === undefined ? "" : String(value);
  });
  const triggerParamsKey = JSON.stringify(triggerParams);
  const hasTriggerEdit = Object.values(triggerFields).some((field) =>
    Object.prototype.hasOwnProperty.call(edits, field.field_id)
  );
  const lastTriggerParamsKeyRef = useRef(triggerParamsKey);

  // SABER change → GET call_file/get_saber_attachment/{callId}?saber=<value> (not get_call_detail).
  const saberRequestSeqRef = useRef(0);
  const refreshSaberAttachment = async (saber) => {
    const resolvedCallId = String(callId ?? "").trim();
    if (!resolvedCallId) return;
    const seq = ++saberRequestSeqRef.current;
    try {
      const { data } = await callFileService.getSaberAttachment(resolvedCallId, { saber });
      if (!aliveRef.current || seq !== saberRequestSeqRef.current) return;
      const attachment = data?.data?.saber_attachment;
      setSaberAttachmentField(attachment && typeof attachment === "object" ? attachment : { value: null, file_url: null });
    } catch (error) {
      if (aliveRef.current && seq === saberRequestSeqRef.current) {
        notify(getApiErrorMessage(error, "Failed to load the SABER attachment."), "error");
      }
    }
  };

  // On open (and after the call detail refreshes, e.g. a save), bind the SABER attachment
  // field for the saved SABER value.
  const initialSaber = triggerFields.saber ? JSON.parse(triggerParamsKey).saber ?? "" : "";
  useEffect(() => {
    if (isViewOnly || !initialSaber) return;
    refreshSaberAttachment(initialSaber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, detail, isViewOnly, Boolean(triggerFields.saber)]);

  // Weather Forecast change → GET call_file/get_weather_map/{callId}?weather_forecast=<value>.
  const weatherRequestSeqRef = useRef(0);
  const refreshWeatherMap = async (weatherForecast) => {
    const resolvedCallId = String(callId ?? "").trim();
    if (!resolvedCallId) return;
    const seq = ++weatherRequestSeqRef.current;
    try {
      const { data } = await callFileService.getWeatherMap(resolvedCallId, {
        weather_forecast: weatherForecast,
      });
      if (!aliveRef.current || seq !== weatherRequestSeqRef.current) return;
      const payload = data?.data ?? {};
      const mapField = payload.weather_map;
      setWeatherMapField(
        Number(payload.is_bad_weather) === 1 && mapField && typeof mapField === "object" ? mapField : null
      );
    } catch (error) {
      if (aliveRef.current && seq === weatherRequestSeqRef.current) {
        notify(getApiErrorMessage(error, "Failed to load the weather map."), "error");
      }
    }
  };

  // On open (and after the call detail refreshes), bind the weather map for the saved value.
  const initialWeatherForecast = triggerFields.weather_forecast
    ? JSON.parse(triggerParamsKey).weather_forecast ?? ""
    : "";
  useEffect(() => {
    if (isViewOnly || !initialWeatherForecast) return;
    refreshWeatherMap(initialWeatherForecast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, detail, isViewOnly, Boolean(triggerFields.weather_forecast)]);

  // SABER change → get_saber_attachment; Weather Forecast change → get_weather_map.
  useEffect(() => {
    if (triggerParamsKey === lastTriggerParamsKeyRef.current) return;
    const prevParams = JSON.parse(lastTriggerParamsKeyRef.current || "{}");
    lastTriggerParamsKeyRef.current = triggerParamsKey;
    if (!hasTriggerEdit || isViewOnly) return;
    const nextParams = JSON.parse(triggerParamsKey);
    if (nextParams.saber !== prevParams.saber) {
      refreshSaberAttachment(nextParams.saber ?? "");
      if (nextParams.saber) openLineItemsForSaber();
    }
    if (nextParams.weather_forecast !== prevParams.weather_forecast) {
      refreshWeatherMap(nextParams.weather_forecast ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerParamsKey]);

  // Conditional fields (`show_when_field_id` / `show_when_value`, e.g. the SABER attachment shown
  // only for "by_sedres") render, validate and save only while their condition holds.
  const isFieldVisible = (field) => {
    const dependsOn = field?.show_when_field_id;
    if (dependsOn === null || dependsOn === undefined || String(dependsOn).trim() === "") return true;
    const current = getValue(dependsOn);
    const expected = String(field.show_when_value ?? "").trim();
    if (Array.isArray(current)) return current.map(String).includes(expected);
    return String(current ?? "").trim() === expected;
  };
  // `iframe` fields (e.g. "Weather Map") are display-only from the template; the Windy card under
  // Weather Forecast already shows the map, so they are neither rendered nor saved.
  const visibleFields = fields.filter(
    (field) => !HIDDEN_FIELD_TYPES.has(getTemplateFieldType(field)) && isFieldVisible(field)
  );

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
    if (!detailEmailTemplate || reportTouchedRef.current || reportTypeRef.current !== "arrival") return;
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
        if (cancelled || !aliveRef.current || reportTouchedRef.current || reportTypeRef.current !== "arrival") return;
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

  // Saved additional (user-added "+") time objects from the call detail, by id and by name.
  const additionalTimeObjectIndex = useMemo(() => {
    const byId = new Map();
    const byLabel = new Map();
    const source = Array.isArray(activeDetail?.time_objects) ? activeDetail.time_objects.flat(Infinity) : [];
    source.forEach((to) => {
      if (!to || typeof to !== "object" || !(to.is_additional ?? to.isAdditional)) return;
      const id = String(to.time_object_id ?? to.timeObjectId ?? to.id ?? "").trim();
      if (!id) return;
      byId.set(id, id);
      const label = normalizeTemplateKey(to.time_object_name ?? to.time_object ?? to.event_name ?? "");
      if (label) byLabel.set(label, id);
    });
    return { byId, byLabel };
  }, [activeDetail]);

  // A template field that renders a saved additional time object → that time object's id
  // (so it gets the same remove button as a freshly added row). Core fields return null.
  const getAdditionalTimeObjectId = (field) => {
    // The call detail injects saved additional time objects as fields "call_time_object_<id>";
    // they are not part of the call's template, so save_stage rejects them.
    const injected = /^call_time_object_(.+)$/.exec(String(field?.field_id ?? "").trim());
    if (injected) return injected[1];
    if (!["datetime", "timeobject"].includes(getTemplateFieldType(field))) return null;
    const explicitId = String(field?.time_object_id ?? field?.timeobject_id ?? "").trim();
    if (explicitId && additionalTimeObjectIndex.byId.has(explicitId)) return explicitId;
    if (explicitId && (field?.is_additional ?? field?.isAdditional)) return explicitId;
    if (explicitId) return null;
    const candidates = [normalizeTemplateKey(field?.field_key), normalizeTemplateKey(field?.field_label)].filter(Boolean);
    const match = candidates.find((key) => additionalTimeObjectIndex.byLabel.has(key));
    return match ? additionalTimeObjectIndex.byLabel.get(match) : null;
  };

  // Saved additional rows come from the call detail (call_file/get_call_detail) `time_objects`.
  // Rows the template already renders as a field are skipped so they don't show twice.
  const savedAdditionalRows = useMemo(() => {
    const source = Array.isArray(activeDetail?.time_objects) ? activeDetail.time_objects.flat(Infinity) : [];
    const renderedIds = new Set(fields.map(getAdditionalTimeObjectId).filter(Boolean));
    return mapCallTimeObjectsToAdditionalRows(source, { stageId }).filter(
      (row) => row?.id == null || !renderedIds.has(String(row.id).trim())
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetail, stageId, fields, additionalTimeObjectIndex]);

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

  // Remove a saved additional time object that the template renders as a regular field.
  const [removingTimeObjectId, setRemovingTimeObjectId] = useState(null);
  const handleRemoveTemplateTimeObject = async (timeObjectId) => {
    const resolvedCallId = String(callId ?? "").trim();
    if (!timeObjectId || !resolvedCallId || removingTimeObjectId) return;
    setRemovingTimeObjectId(timeObjectId);
    try {
      await deleteCallTimeObjectAction({ timeObjectId, callId: resolvedCallId, stageId });
      if (!aliveRef.current) return;
      await refetchCallDetail?.();
      if (aliveRef.current) setReportTemplateVersion((version) => version + 1);
    } catch (error) {
      notify(getApiErrorMessage(error, "Failed to delete time object."), "error");
    } finally {
      if (aliveRef.current) setRemovingTimeObjectId(null);
    }
  };

  const handleReportDraftChange = (name, value) => {
    reportTouchedRef.current = true;
    setReportDraft((prev) => ({ ...prev, [name]: value }));
  };

  // Daily report body: every filled, visible stage field as "Label: value".
  const buildDailyReportBody = () => {
    const rows = visibleFields
      .filter((field) => getTemplateFieldType(field) !== "file")
      .map((field) => {
        const raw = getValue(field.field_id);
        if (isEmptyTemplateValue(raw)) return null;
        const options = toOptionList(field);
        const values = (Array.isArray(raw) ? raw : [raw]).map((item) => {
          const match = options.find((opt) => opt.value === String(item));
          return match ? match.label : String(item);
        });
        return `<p><strong>${escapeHtml(field.field_label || field.field_key)}:</strong> ${escapeHtml(values.join(", "))}</p>`;
      })
      .filter(Boolean);
    return `<p><strong>Daily Report - ${escapeHtml(stage?.label || "Arrival")}</strong></p><p><br></p>${rows.join("")}`;
  };

  const handleReportTypeChange = (nextType) => {
    if (nextType === reportType) return;
    if (nextType === "daily") {
      // Keep the arrival draft (with any edits) to restore when switching back.
      arrivalDraftRef.current = reportDraft;
      arrivalTouchedRef.current = reportTouchedRef.current;
      setReportType("daily");
      // "Arrival Report - AESEN GALAXY" → "Daily Report - AESEN GALAXY".
      const arrivalSubject = String(reportDraft.subject || "").trim();
      const dailySubject = /^Arrival Report/i.test(arrivalSubject)
        ? arrivalSubject.replace(/^Arrival Report/i, "Daily Report")
        : "Daily Report";
      setReportDraft((prev) => ({
        ...prev,
        subject: dailySubject,
        message: buildDailyReportBody(),
        attachments: [],
      }));
      // A configured Daily (report_type_id 3) template, if any, replaces the generated body.
      const resolvedCallId = String(callId ?? "").trim();
      const resolvedPortId = String(portId ?? "").trim();
      const resolvedCallTypeId = String(callTypeId ?? "").trim();
      if (resolvedCallId && resolvedPortId && resolvedCallTypeId) {
        appointmentAcceptanceService
          .getArrivalTemplateByPortCallType({
            call_id: resolvedCallId,
            port_id: resolvedPortId,
            call_type_id: resolvedCallTypeId,
            report_type_id: DAILY_REPORT_TYPE_ID,
            time_objects: templateTimeObjectsRef.current,
          })
          .then((response) => {
            if (!aliveRef.current || reportTypeRef.current !== "daily") return;
            const template = extractReportTemplateFields(response);
            if (template.subject || template.message) {
              setReportDraft((prev) => mergeReportTemplate(prev, template));
            }
          })
          .catch(() => {
            // Generated daily body stays in place.
          });
      }
      return;
    }
    setReportType("arrival");
    reportTouchedRef.current = arrivalTouchedRef.current;
    if (arrivalDraftRef.current) setReportDraft(arrivalDraftRef.current);
    else if (detailEmailTemplate) {
      setReportDraft((prev) => mergeReportTemplate(prev, extractReportTemplateFields(detailEmailTemplate)));
    }
  };

  // ---- Validation & submit ----
  const validate = () => {
    const nextErrors = {};
    visibleFields.forEach((field) => {
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
    const missingLabels = visibleFields.filter((field) => nextErrors[field.field_id]).map((field) => field.field_label);
    if (missingLabels.length) {
      notify(`Please fill the required fields: ${missingLabels.join(", ")}.`, "error");
      return;
    }
    if (withReport && !String(reportDraft.to || "").trim()) {
      notify("Add a recipient in the email preview before sending the report.", "error");
      return;
    }

    const fieldsPayload = {};
    // Additional time objects aren't template fields: edited ones are saved through
    // save_call_time_object instead of save_stage.
    const editedTimeObjectRows = [];
    visibleFields.forEach((field) => {
      if (getTemplateFieldType(field) === "file") return;
      const timeObjectId = getAdditionalTimeObjectId(field);
      if (timeObjectId) {
        if (Object.prototype.hasOwnProperty.call(edits, field.field_id)) {
          const value = toStagePayloadValue(field, getValue(field.field_id));
          if (value) {
            editedTimeObjectRows.push({
              id: timeObjectId,
              label: String(field.field_label || field.field_key || "").trim(),
              time_object_value: value,
            });
          }
        }
        return;
      }
      fieldsPayload[field.field_id] = toStagePayloadValue(field, getValue(field.field_id));
    });

    const formData = new FormData();
    formData.append("call_id", resolvedCallId);
    formData.append("tab_id", String(stage.tabId));
    formData.append("fields", JSON.stringify(fieldsPayload));
    // Only newly selected files are uploaded; existing attachments are left untouched.
    const visibleFieldsById = new Map(visibleFields.map((field) => [String(field.field_id), field]));
    Object.entries(newFiles).forEach(([fieldId, file]) => {
      const field = visibleFieldsById.get(String(fieldId));
      if (!(file instanceof File) || !field) return;
      // Fields from get_saber_attachment carry their own upload key (e.g. "saber_attachments[]").
      const uploadKey = String(field.upload_key ?? "").trim() || `field_${fieldId}`;
      formData.append(uploadKey, file);
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
      attachments: mapAttachmentsForSave(reportDraft.attachments),
    };
    // The stage's saved report is the Arrival one; a Daily draft is only ever sent, not saved.
    if (showEmailPreview && report.to_email && reportType === "arrival") {
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
      for (const row of editedTimeObjectRows) {
        await commitAdditionalTimeObject({
          row,
          callId: resolvedCallId,
          stageId,
          saveCallTimeObject: saveCallTimeObjectAction,
        });
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

  // Email preview "Send": posts the composer to arrival/send_report (no stage save).
  const sendReport = async () => {
    if (submittingRef.current || isViewOnly) return;
    const resolvedCallId = String(callId ?? "").trim();
    if (!resolvedCallId) {
      notify("Call ID is required to send the report.", "error");
      return;
    }
    const toEmail = String(reportDraft.to || "").trim();
    if (!toEmail) {
      notify("Add a recipient in the email preview before sending the report.", "error");
      return;
    }

    const reportTypeId =
      hasReportTypeSwitch && reportType === "daily"
        ? DAILY_REPORT_TYPE_ID
        : activeStage?.emailTemplate?.report_type_id ?? reportConfig?.reportTypeId;
    const body = resolveReportBodyHtml(reportDraft.message, "") || "";
    const requestBody = buildSendReportRequestBody(
      {
        call_id: resolvedCallId,
        report_type_id: reportTypeId,
        from_email: String(reportDraft.from || "").trim(),
        to_email: toEmail,
        cc_emails: String(reportDraft.cc || "").trim(),
        subject: String(reportDraft.subject || "").trim(),
        body,
        message: body,
      },
      reportDraft.attachments
    );

    submittingRef.current = true;
    setSubmitting("report");
    try {
      const response = await arrivalService.sendReport(requestBody);
      const resBody = response?.data;
      if (resBody?.status === "error" || resBody?.status === false) {
        throw new Error(resBody?.message || "Unable to send the report.");
      }
      if (aliveRef.current) notify(resBody?.message || "Report sent successfully.", "success");
    } catch (error) {
      if (aliveRef.current) notify(getApiErrorMessage(error, "Failed to send the report."), "error");
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
    const disabled = isViewOnly;

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
      const savedName = existingName || existingUrl.split("/").pop();
      const hasSaved = Boolean(existingName || existingUrl);
      return (
        <div className="operation-file-field">
          {hasSaved && (
            <div className={`operation-file-card${pending ? " operation-file-card--replaced" : ""}`}>
              <span className="operation-file-card__icon" aria-hidden>
                <FiFileText size={16} />
              </span>
              <span className="operation-file-card__body">
                <span className="operation-file-card__name" title={savedName}>
                  {savedName}
                </span>
                <span className="operation-file-card__meta">
                  {pending ? "Will be replaced on save" : "Uploaded"}
                </span>
              </span>
              <button
                type="button"
                className="operation-file-card__action"
                onClick={() => openFile(existingUrl)}
                disabled={!existingUrl}
                title={existingUrl ? "View attachment" : "File URL not available"}
                aria-label={`View ${savedName}`}
              >
                <FiEye size={15} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
          )}
          {pending && (
            <div className="operation-file-card operation-file-card--pending">
              <span className="operation-file-card__icon" aria-hidden>
                <FiFileText size={16} />
              </span>
              <span className="operation-file-card__body">
                <span className="operation-file-card__name" title={pending.name}>
                  {pending.name}
                </span>
                <span className="operation-file-card__meta">New file · uploads on save</span>
              </span>
              {!disabled && (
                <button
                  type="button"
                  className="operation-file-card__action operation-file-card__action--danger"
                  onClick={() => setFieldFile(id, null)}
                  title="Remove selected file"
                  aria-label={`Remove ${pending.name}`}
                >
                  <FiX size={15} strokeWidth={2.2} aria-hidden />
                </button>
              )}
            </div>
          )}
          {!disabled && (
            <OperationFileUpload
              files={[]}
              onAddFiles={(attachments) => {
                const file = attachments[0]?.file ?? null;
                setFieldFile(id, file);
              }}
              isViewOnly={disabled}
              ariaLabel={`Upload ${field.field_label || "file"}`}
              prompt={hasSaved || pending ? "Drop a file to replace, or" : undefined}
            />
          )}
        </div>
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
    const display = buildTemplateFieldDisplay(field, { detail: activeDetail, timeObjects });
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
                {visibleFields.length === 0 ? (
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
                  visibleFields.map((field) => {
                    const fieldLabel = `${field.field_label || field.field_key || "Field"}${isTemplateFieldRequired(field) ? " *" : ""}`;
                    const additionalTimeObjectId = getAdditionalTimeObjectId(field);
                    const showRemove = Boolean(additionalTimeObjectId) && !isViewOnly && canDeleteTimeObject;
                    return (
                    <FormField key={field.field_id} label={showRemove ? undefined : fieldLabel}>
                      {showRemove && (
                        <div className="operation-additional-time-object-label-row">
                          <label>{fieldLabel}</label>
                          <button
                            type="button"
                            className="operation-additional-time-object-remove-btn"
                            onClick={() => handleRemoveTemplateTimeObject(additionalTimeObjectId)}
                            disabled={removingTimeObjectId === additionalTimeObjectId}
                            aria-label={`Remove ${field.field_label || field.field_key || "time object"}`}
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      {renderInput(field)}
                      {errors[field.field_id] && <span className="cf-field-error">{errors[field.field_id]}</span>}
                      {normalizeTemplateKey(field.field_key) === "weather_forecast" &&
                        isBadWeatherValue(getValue(field.field_id)) &&
                        weatherMapField?.iframe?.src && <WindyWeatherMap iframe={weatherMapField.iframe} />}
                    </FormField>
                    );
                  })
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
                    reportType={hasReportTypeSwitch ? reportType : undefined}
                    reportTypeOptions={hasReportTypeSwitch ? ARRIVAL_REPORT_TYPE_OPTIONS : undefined}
                    onReportTypeChange={hasReportTypeSwitch ? handleReportTypeChange : undefined}
                    from={reportDraft.from}
                    to={reportDraft.to}
                    cc={reportDraft.cc}
                    subject={reportDraft.subject}
                    message={reportDraft.message}
                    attachments={reportDraft.attachments}
                    onAttachmentsChange={(list) => handleReportDraftChange("attachments", list)}
                    billingEntityId={activeDetail?.template?.billing_entity_id}
                    onChange={handleReportDraftChange}
                    onSend={sendReport}
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
            isSaving={submitting === "save"}
          />
        </div>
      </FormSection>
      {lineItemsCallId && <DefaultLineItemsModal callId={lineItemsCallId} soType="Marine" onDone={handleLineItemsDone} readOnly />}
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
