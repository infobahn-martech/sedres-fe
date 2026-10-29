import PropTypes from "prop-types";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import "@/design/scss/general.scss";
import "@/design/css/common/CardForm.css";
import "@/design/scss/pages/callTypeBuilder.scss";
import callFileService from "@/services/callFileService";
import mailService from "@/services/mailService";
import billingEntityService from "@/services/billingEntityService";
import billingInstructionService from "@/services/billingInstructionService";
import vesselService from "@/services/vesselService";
import stageTimeMappingService from "@/services/stageTimeMappingService";
import preArrivalInfoService from "@/services/preArrivalInfoService";
import useCallTaskReducer from "@/store/CallTaskReducer";
import useFormTemplateReducer from "@/store/FormTemplateReducer";
import TemplateFieldPreview from "@/pages/CustomTemplate/TemplateFieldPreview";
import usePermissions from "@/shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "@/shared/constants/permissions";
import { mergeOptionIfMissing } from "@/shared/helpers/callFileFormOptions";
import {
  buildCreateCallFileFormData,
  buildCreateTemplateCallFileFormData,
} from "@/shared/helpers/createCallFilePayload";
import { getItem } from "@/shared/helpers/localStorage";
import { extractTextFromFile, normalizeAppointmentDateTime } from "@/shared/helpers/appointmentAiExtractor";
import { notify } from "@/components/Toaster";
import CardTabListLoading from "@/components/CardTabListLoading";
import DateTimePickerField from "../../../shared/components/DateTimePickerField";
import {
  FormField,
  FormInput,
  FormSelect,
  OwnerField,
  DocumentUpload,
  MultiSelectEmail,
  MultiSelectField,
} from "./GeneralFormFields";
import EmailPreviewPanel from "./EmailPreviewPanel";
import {
  APPOINTMENT_TYPE_OPTIONS,
  appointmentTypeShowsBargeFields,
  appointmentTypeShowsSingleVesselSection,
  appointmentTypeUsesTugTypeSource,
  firstNonEmptyString,
  getOptionLabel,
  htmlToPlainText,
  normalizeAppointmentTypeValue,
  normalizeBillingInstruction,
  normalizePreviewValue,
  normalizeVesselDetails,
  splitApiDateTimeValue,
} from "./generalHelpers";
import {
  ALL_DETAIL_SCALAR_FIELD_MAP,
  buildPreviewTimeObjectsPayload,
  dedupeAttachmentsByUrl,
  getPreviewSubject,
  normalizeEmailAttachmentList,
  resolveAppointmentAcceptanceCcEmails,
  resolveEditablePreviewFieldValue,
  resolveEmailPreviewPayload,
  unwrapAllDetailResponse,
} from "./emailPreviewHelpers";
import {
  extractEmailHeaderDetails,
  extractFirstEmailFromText,
  extractMsgAppointmentText,
  findMatchingOption,
  isMsgFile,
  parseMsgSenderDetails,
  resolveMsgReceivedDateTime,
} from "./appointmentEmailParser";
import {
  useBillingEntityEmails,
  useChecklistOptions,
  useEntityFields,
  useGeneralMasterData,
} from "./useGeneralData";

const EMPTY_PREVIEW_FIELDS = {
  from_email: "",
  to_email: "",
  cc_emails: "",
  subject: "",
};

const UNTOUCHED_PREVIEW_FIELDS = {
  from_email: false,
  to_email: false,
  cc_emails: false,
  subject: false,
};

// Maps a form_template/first_tab field to the shape TemplateFieldPreview renders,
// ordered by grid row, then column, then display order.
const mapTemplateTabFields = (fields) =>
  (Array.isArray(fields) ? fields : [])
    .slice()
    .sort(
      (a, b) =>
        Number(a?.row_no ?? 0) - Number(b?.row_no ?? 0) ||
        Number(a?.col_no ?? 0) - Number(b?.col_no ?? 0) ||
        Number(a?.display_order ?? 0) - Number(b?.display_order ?? 0)
    )
    .map((field) => {
      const options = Array.isArray(field?.options) ? field.options : [];
      return {
        id: field?.field_id,
        label: field?.field_label ?? "",
        type: String(field?.type_key ?? "text").toLowerCase(),
        required: String(field?.is_required ?? "0") === "1",
        options: options.map((opt) => (typeof opt === "string" ? opt : opt?.option_label ?? "")),
        // option_value is what create_call_file_new expects for radio/dropdown/checkbox selections.
        optionValues: options.map((opt) =>
          typeof opt === "string" ? opt : String(opt?.option_value ?? opt?.option_label ?? "")
        ),
        // User-list masters (e.g. Owner) send an `avatar` key per option, even when it is null.
        hasAvatars: options.some((opt) => opt && typeof opt === "object" && "avatar" in opt),
        optionAvatars: options.map((opt) => opt?.avatar ?? null),
        optionsSource: field?.option_source === "master" ? "master" : "manual",
        masterModule: field?.master_key ?? "",
        refetchParam: resolveTemplateRefetchParam(field),
      };
    });

// Changing a field bound to one of these params re-fetches first_tab so the backend can resolve
// the remaining field values for that email / vessel / billing entity. Keyed by the normalized
// system_binding_key / master_key / label (e.g. "billing_entity_id", "Billing Entity", "Vessel Name").
const TEMPLATE_REFETCH_PARAMS = {
  appointment_email: "appointment_email_file",
  vessel: "vessel_id",
  billing_entity: "billing_entity_id",
};

const normalizeBindingKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_(id|file|name)$/, "");

const resolveTemplateRefetchParam = (field) =>
  [field?.system_binding_key, field?.master_key, field?.field_label]
    .map((candidate) => TEMPLATE_REFETCH_PARAMS[normalizeBindingKey(candidate)])
    .find(Boolean) ?? "";

const isFileValue = (value) =>
  value instanceof File || (typeof Blob !== "undefined" && value instanceof Blob);

// Values returned by first_tab, keyed by field_id. File fields are skipped: the uploaded File stays local.
const extractTemplateFieldValues = (fields) =>
  (Array.isArray(fields) ? fields : []).reduce((acc, field) => {
    const value = field?.value ?? field?.field_value;
    if (field?.field_id == null || String(field?.type_key ?? "").toLowerCase() === "file") return acc;
    if (!hasMeaningfulValue(value)) return acc;
    acc[field.field_id] = Array.isArray(value) ? value.map((item) => String(item)) : String(value);
    return acc;
  }, {});

// A checkbox with no options is a legacy single checkbox, submitted as "1" / "0".
const isSingleCheckboxField = (field) => field.type === "checkbox" && !field.options.length;

const hasMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

// Add Card flow of the Appointment Details tab: appointment email extraction, call/vessel form,
// live email preview and call file creation.
function GeneralAdd({
  card,
  boardId,
  formValues,
  handleChange,
  onSave,
  isSavingGeneral = false,
  hasSubmitted = false,
  setHasSubmitted = () => { },
  setIsSavingGeneral = () => { },
}) {
  const { hasPermission, hasAnyPermission } = usePermissions();
  // ADD_CARD no longer has a VIEW action — it's gated by its granular
  // Basic fields / Email actions instead.
  const canAddCard = hasAnyPermission(
    [PERMISSION_ACTIONS.BASIC_FIELDS, PERMISSION_ACTIONS.EMAIL].map((actionKey) => ({
      moduleKey: PERMISSION_MODULES.KANBAN_CARD,
      submoduleKey: PERMISSION_SUBMODULES.ADD_CARD,
      actionKey,
    }))
  );
  const canViewBasicFields = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.ADD_CARD,
    actionKey: PERMISSION_ACTIONS.BASIC_FIELDS,
  });
  const canViewEmail = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.ADD_CARD,
    actionKey: PERMISSION_ACTIONS.EMAIL,
  });

  const {
    masterDataLoading,
    operatorOptions,
    ownerOptions,
    portSelectOptions,
    callTypeOptions,
    billingEntitySelectOptions,
    vesselTypeSelectOptions,
    bargeTypeSelectOptions,
    tugTypeSelectOptions,
    allVesselOptions,
    allVesselsLoading,
  } = useGeneralMasterData();
  const {
    entityFields,
    setEntityFields,
    entityFieldValues,
    setEntityFieldValues,
    entityFieldErrors,
    setEntityFieldErrors,
    entityFieldsLoading,
    entityFieldsError,
    setEntityFieldsError,
    fetchEntityFields,
  } = useEntityFields();
  const {
    dailyReportEmailOptions,
    dailyReportEmailLoading,
    fetchBillingEntityEmails,
  } = useBillingEntityEmails();
  // Vessel/Tug/Barge Name all pull from the same full vessel catalogue.
  const vesselNameOptions = allVesselOptions;
  const [appointmentDocuments, setAppointmentDocuments] = useState([]);
  const [defaultEmailAttachments, setDefaultEmailAttachments] = useState([]);
  const [uploadedEmailAttachments, setUploadedEmailAttachments] = useState([]);
  const [isUploadingEmailAttachments, setIsUploadingEmailAttachments] = useState(false);
  const [isServerEmailReading, setIsServerEmailReading] = useState(false);
  const [, setAiExtractionError] = useState("");
  const [previewMessageText, setPreviewMessageText] = useState("");
  const [previewMessageEditorKey, setPreviewMessageEditorKey] = useState(0);
  const [emailPreviewData, setEmailPreviewData] = useState(null);
  const [isPreviewMessageDirty, setIsPreviewMessageDirty] = useState(false);
  const [editablePreviewFields, setEditablePreviewFields] = useState(EMPTY_PREVIEW_FIELDS);
  /** Unmodified appointment_acceptance from all_detail_by_vessel_id (preserves base64 logo in body). */
  const [appointmentAcceptanceFromApi, setAppointmentAcceptanceFromApi] = useState(null);
  const [touchedPreviewFields, setTouchedPreviewFields] = useState(UNTOUCHED_PREVIEW_FIELDS);
  const resetTouchedPreviewFields = useCallback(() => {
    setTouchedPreviewFields(UNTOUCHED_PREVIEW_FIELDS);
  }, []);
  const [billingInstructionType, setBillingInstructionType] = useState("");
  const [billingInstructionEmailOptions, setBillingInstructionEmailOptions] = useState([]);
  const [billingInstructionLoading, setBillingInstructionLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [timeObjectErrors, setTimeObjectErrors] = useState({});
  const [stageTimeObjects, setStageTimeObjects] = useState([]);
  const [stageTimeObjectValues, setStageTimeObjectValues] = useState({});
  const [stageTimeObjectsLoading, setStageTimeObjectsLoading] = useState(false);
  const [isEtaDependentTimesLoading, setIsEtaDependentTimesLoading] = useState(false);
  const etaDependentRequestIdRef = useRef(0);
  const etaDependentLastRequestKeyRef = useRef("");
  const allDetailByVesselRequestIdRef = useRef(0);
  // Per-field (vesselName / tugVesselName / bargeVesselName) request counters guarding against
  // a stale vessel-detail response overwriting a newer selection.
  const vesselDetailRequestIdRef = useRef({});
  const clearCallTasks = useCallTaskReducer((state) => state.clearCallTasks);
  const currentCallId = card?.call_id ?? formValues?.call_id ?? card?.callId ?? "";

  // A new card has no call yet — drop any operation tasks left over from a previously opened card.
  useEffect(() => {
    clearCallTasks();
  }, [clearCallTasks]);

  // Selecting a template swaps the form fields for that template's first-tab fields.
  const getTemplateFirstTab = useFormTemplateReducer((state) => state.getTemplateFirstTab);
  const [templateFields, setTemplateFields] = useState(null);
  const [templateFieldValues, setTemplateFieldValues] = useState({});
  const [templateFieldErrors, setTemplateFieldErrors] = useState({});
  const templateRefetchRequestIdRef = useRef(0);
  const [isTemplateRefetching, setIsTemplateRefetching] = useState(false);
  // Id whose fetch has finished (success or failure); derived loading avoids flashing the default form.
  const [settledTemplateId, setSettledTemplateId] = useState("");
  const selectedTemplateId = firstNonEmptyString(formValues?.template_id);
  const isTemplateFieldsLoading = Boolean(selectedTemplateId) && settledTemplateId !== selectedTemplateId;

  useEffect(() => {
    setTemplateFields(null);
    setTemplateFieldValues({});
    setTemplateFieldErrors({});
    // Drop any in-flight re-fetch for the previous template.
    templateRefetchRequestIdRef.current += 1;
    setIsTemplateRefetching(false);
    if (!selectedTemplateId) return;
    let cancelled = false;
    getTemplateFirstTab({
      templateId: selectedTemplateId,
      cb: (data) => {
        if (cancelled) return;
        setTemplateFields(mapTemplateTabFields(data?.tab?.fields));
        setTemplateFieldValues(extractTemplateFieldValues(data?.tab?.fields));
      },
    }).finally(() => {
      if (!cancelled) setSettledTemplateId(selectedTemplateId);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTemplateId, getTemplateFirstTab]);

  const getFieldValue = (fieldName) =>
    hasMeaningfulValue(formValues?.[fieldName]) ? formValues[fieldName] : "";

  // Entity-dependent lookups (dynamic entity fields, daily report emails, billing instructions) follow
  // the vessel billing entity for single Vessel/Taxi Tug appointments, or the tug billing entity for
  // Tug and Barge / Taxi tug and barge appointments — the barge billing entity stays independent.
  const getPrimaryBillingEntityId = () => {
    const type = normalizeAppointmentTypeValue(getFieldValue("appointmentType"));
    return appointmentTypeShowsBargeFields(type)
      ? getFieldValue("tugBillingEntity")
      : getFieldValue("vesselBillingEntity");
  };

  useEffect(() => {
    const initialFromDescription = htmlToPlainText(formValues?.cardDescription || "");
    setPreviewMessageText((prev) => (prev.trim() ? prev : initialFromDescription));
  }, [formValues?.cardDescription]);

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
    const requireField = (key, message, condition = true) => {
      if (condition && isEmptyValue(v(key))) errors[key] = message;
    };
    const selectedAppointmentType = normalizeAppointmentTypeValue(v("appointmentType"));
    const singleSelected = appointmentTypeShowsSingleVesselSection(selectedAppointmentType);
    const bargeSelected = appointmentTypeShowsBargeFields(selectedAppointmentType);
    requireField("typeOfCall", "Call type is required.");
    requireField("port", "Port is required.");
    requireField("assignedOperator", "Assigned operator is required.");
    requireField("vesselBillingEntity", "Billing entity is required.", singleSelected);
    requireField("tugBillingEntity", "Billing entity is required.", bargeSelected);
    requireField("bargeBillingEntity", "Billing entity is required.", bargeSelected);
    requireField("vesselName", "Vessel name is required.", singleSelected);
    requireField("serviceRequestorName", "Service requestor name is required.");
    requireField("serviceRequestorEmail", "Service requestor email is required.");
    requireField("appointmentReceivedDate", "Appointment received date is required.");
    requireField("appointmentReceivedTime", "Appointment received time is required.");

    const serviceEmailStr = getTrimmedValue(v("serviceRequestorEmail"));
    if (serviceEmailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(serviceEmailStr)) {
      errors.serviceRequestorEmail = "Invalid email format.";
    }

    if (String(billingInstructionType || "").trim().toLowerCase() === "email") {
      const dailyEmails = v("dailyReportEmail");
      const hasDailyEmail = Array.isArray(dailyEmails) ? dailyEmails.length > 0 : Boolean(dailyEmails);
      if (!hasDailyEmail) {
        errors.dailyReportEmail = "At least one daily report email is required.";
      }
    }

    if (!selectedAppointmentType) {
      errors.appointmentType = "Appointment type is required.";
    }
    requireField("tugVesselName", "Vessel name is required.", bargeSelected);
    requireField("bargeVesselName", "Vessel name is required.", bargeSelected);
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

    const requiredDynamicErrors = validateRequiredEntityFields(entityFields, entityFieldValues);
    Object.assign(dynamicErrors, requiredDynamicErrors);

    setFieldErrors(errors);
    setEntityFieldErrors(dynamicErrors);
    setTimeObjectErrors(timeErrors);
    return Object.keys(errors).length === 0 && Object.keys(dynamicErrors).length === 0 && Object.keys(timeErrors).length === 0;
  }, [
    billingInstructionType,
    entityFieldValues,
    formValues,
    setEntityFieldErrors,
    stageTimeObjectValues,
    stageTimeObjects,
    validateRequiredEntityFields,
    entityFields,
  ]);

  // Board / card-meta ids are picked by the topbar into formValues, falling back to the source card.
  const resolveCardMetaIds = () => ({
    boardId:
      boardId ??
      formValues?.board_id ??
      formValues?.boardId ??
      card?.board_id ??
      card?.boardId ??
      card?.raw?.board_id ??
      card?.raw?.boardId,
    cardTypeId:
      formValues?.card_type_id ?? card?.card_type_id ?? card?.cardTypeId ?? card?.raw?.card_type_id,
    cardTagId:
      formValues?.card_tag_id ??
      formValues?.tag_id ??
      card?.card_tag_id ??
      card?.tag_id ??
      card?.raw?.card_tag_id,
    cardBlockerId:
      formValues?.card_blocker_id ??
      formValues?.blocker_id ??
      card?.card_blocker_id ??
      card?.blocker_id ??
      card?.raw?.card_blocker_id,
    cardStickerId:
      formValues?.card_sticker_id ??
      formValues?.sticker_id ??
      card?.card_sticker_id ??
      card?.sticker_id ??
      card?.raw?.card_sticker_id,
  });

  const templateFieldValuesRef = useRef(templateFieldValues);
  templateFieldValuesRef.current = templateFieldValues;
  // Re-fetches first_tab with the current email / vessel / billing entity selection and binds the
  // returned values; the trigger fields keep what the user picked.
  const refetchTemplateFirstTab = useCallback(
    (values) => {
      if (!selectedTemplateId || !templateFields) return;
      const payload = new FormData();
      const triggerValues = {};
      templateFields.forEach((field) => {
        if (!field.refetchParam) return;
        const value = values[field.id];
        triggerValues[field.id] = value;
        if (isFileValue(value) || hasMeaningfulValue(value)) payload.append(field.refetchParam, value);
      });

      const requestId = ++templateRefetchRequestIdRef.current;
      setIsTemplateRefetching(true);
      getTemplateFirstTab({
        templateId: selectedTemplateId,
        payload,
        cb: (data) => {
          if (requestId !== templateRefetchRequestIdRef.current) return;
          const fields = data?.tab?.fields;
          if (Array.isArray(fields) && fields.length) setTemplateFields(mapTemplateTabFields(fields));
          const boundValues = extractTemplateFieldValues(fields);
          setTemplateFieldValues((prev) => ({ ...prev, ...boundValues, ...triggerValues }));
          setTemplateFieldErrors((prev) => {
            const next = { ...prev };
            Object.keys(boundValues).forEach((id) => delete next[id]);
            return next;
          });
        },
      }).finally(() => {
        if (requestId === templateRefetchRequestIdRef.current) setIsTemplateRefetching(false);
      });
    },
    [selectedTemplateId, templateFields, getTemplateFirstTab]
  );

  const handleTemplateFieldChange = useCallback(
    (field) => (nextValue) => {
      const fieldId = field.id;
      const nextValues = { ...templateFieldValuesRef.current, [fieldId]: nextValue };
      templateFieldValuesRef.current = nextValues;
      setTemplateFieldValues(nextValues);
      setTemplateFieldErrors((prev) => {
        if (!prev[fieldId] || !hasMeaningfulValue(nextValue) || nextValue === "0") return prev;
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      if (field.refetchParam) refetchTemplateFirstTab(nextValues);
    },
    [refetchTemplateFirstTab]
  );

  // Template fields submitted as-is; single checkboxes always carry an explicit "1" / "0".
  const getTemplateSubmitValues = () =>
    (templateFields || []).reduce((acc, field) => {
      const value = templateFieldValues[field.id];
      acc[field.id] = isSingleCheckboxField(field) ? (value === "1" ? "1" : "0") : value;
      return acc;
    }, {});

  const validateTemplateFields = (values) =>
    (templateFields || []).reduce((errors, field) => {
      if (!field.required) return errors;
      const value = values[field.id];
      const isMissing = isSingleCheckboxField(field) ? value !== "1" : !hasMeaningfulValue(value);
      if (isMissing) errors[field.id] = `${field.label || "This field"} is required.`;
      return errors;
    }, {});

  // A touched preview field keeps the user's edit (even if cleared); otherwise fall back to the API preview.
  const resolvePreviewField = (fieldName, apiValue) =>
    touchedPreviewFields[fieldName]
      ? editablePreviewFields[fieldName] ?? ""
      : firstNonEmptyString(editablePreviewFields[fieldName], apiValue);

  const handleTemplateSubmit = async () => {
    const fieldValues = getTemplateSubmitValues();
    const errors = validateTemplateFields(fieldValues);
    setTemplateFieldErrors(errors);
    if (Object.keys(errors).length) {
      notify("Please fill all required fields before saving.", "error");
      requestAnimationFrame(() => {
        document.querySelector(".cf-field-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    const meta = resolveCardMetaIds();
    setIsSavingGeneral(true);
    try {
      const formData = buildCreateTemplateCallFileFormData({
        boardId: meta.boardId,
        templateId: selectedTemplateId,
        cardTitle: formValues?.cardTitle,
        cardTypeId: meta.cardTypeId,
        cardBlockerId: meta.cardBlockerId,
        cardStickerId: meta.cardStickerId,
        cardTagId: meta.cardTagId,
        fieldValues,
        appointmentAcceptance: {
          to_email: resolvePreviewField("to_email", emailPreviewData?.to),
          cc_emails: resolvePreviewField("cc_emails", emailPreviewData?.cc),
          subject: resolvePreviewField("subject", emailPreviewData?.subject),
          body: firstNonEmptyString(previewMessageText, emailPreviewData?.messageHtml),
        },
        emailAttachments: [...defaultEmailAttachments, ...uploadedEmailAttachments],
      });
      const response = await callFileService.createCallFileNew(formData);
      if (onSave) onSave(response);
    } catch (error) {
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

  const handleSubmit = async () => {
    if (!canAddCard || isTemplateFieldsLoading || isTemplateRefetching) return;
    setHasSubmitted(true);
    if (templateFields) {
      await handleTemplateSubmit();
      return;
    }
    const isValid = validateGeneralForm();
    if (!isValid) {
      notify("Please fill all required fields before saving.", "error");
      requestAnimationFrame(() => {
        document.querySelector(".cf-field-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setFieldErrors({});
    setEntityFieldErrors({});
    setTimeObjectErrors({});

    const entityFieldsPayload = buildEntityFieldsPayload(entityFields, entityFieldValues);
    const cardMeta = resolveCardMetaIds();
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
    const mergedSaveAttachments = [
      ...(Array.isArray(defaultEmailAttachments) ? defaultEmailAttachments : []),
      ...(Array.isArray(uploadedEmailAttachments) ? uploadedEmailAttachments : []),
    ].map((file) => ({
      file_name: file?.file_name ?? "",
      file_url: file?.file_url ?? "",
    }));
    const normalizedEmailAttachments = dedupeAttachmentsByUrl(
      mergedSaveAttachments.filter((item) => item.file_name || item.file_url)
    );
    const appointmentAcceptanceForSubmit = {
      ...apiAppointmentBase,
      subject: resolvedSubject,
      body: resolvedBody,
      to_email: resolvedToEmail,
      from_email: resolvedFromEmail,
      cc_emails: finalCcEmails,
    };
    const formPayload = {
      ...formValues,
      board_id: cardMeta.boardId,
      card_type_id: cardMeta.cardTypeId,
      card_tag_id: cardMeta.cardTagId,
      card_blocker_id: cardMeta.cardBlockerId,
      card_sticker_id: cardMeta.cardStickerId,
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
        emailAttachments: normalizedEmailAttachments,
        dailyReportEmailOptions,
        billingInstructionEmailOptions,
        preserveAppointmentBody:
          !isPreviewMessageDirty && Boolean(firstNonEmptyString(apiAppointmentBase.body)),
      });
      if (import.meta.env.DEV) {
        console.group("Create Call File Payload");
        for (const [key, value] of formData.entries()) {
          console.log(key, value);
        }
        console.groupEnd();
      }
      const response = await callFileService.createCallFile(formData);
      if (onSave) onSave(response);
    } catch (error) {
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
    const prevType = normalizeAppointmentTypeValue(getFieldValue("appointmentType"));
    const nextType = normalizeAppointmentTypeValue(event?.target?.value);
    const syntheticEvent = { target: { value: nextType, name: "appointmentType" } };
    handleValidatedChange("appointmentType")(syntheticEvent);

    const clearFields = (fieldNames) => {
      fieldNames.forEach((fieldName) => {
        handleChange(fieldName)({ target: { value: "", name: fieldName } });
      });
    };

    const singleVesselKeys = [
      "vesselType",
      "vesselName",
      "vesselOwner",
      "vesselPrincipal",
      "vesselManager",
      "vesselBillingEntity",
    ];
    const tugAndBargeKeys = [
      "tugType",
      "tugVesselName",
      "tugOwner",
      "tugPrincipal",
      "tugManager",
      "tugBillingEntity",
      "bargeType",
      "bargeVesselName",
      "bargeOwner",
      "bargePrincipal",
      "bargeManager",
      "bargeBillingEntity",
    ];

    if (appointmentTypeShowsBargeFields(nextType)) {
      // Switching into Tug and barge: drop the single-section values.
      clearFields(singleVesselKeys);
    } else {
      // Switching into Taxi Tug / Vessel: drop the tug & barge sub-section values, including the
      // Barge Information checklist selection — the Barge section no longer renders.
      clearFields(tugAndBargeKeys);
      clearFields(["bargeSelectedChecklists"]);
      // The single-section "Vessel type" catalogue differs between the tug source (Taxi Tug)
      // and the vessel source (Vessel), so a previously selected id is invalid across that boundary.
      if (appointmentTypeUsesTugTypeSource(prevType) !== appointmentTypeUsesTugTypeSource(nextType)) {
        clearFields(["vesselType"]);
      }
    }
  };

  // Changing a vessel-type selection invalidates the matching vessel-name dropdown, so we clear the
  // dependent name/owner/charter/manager fields and let the fetch effects reload the filtered options.
  // Vessel Type / Tug Type / Barge Type are purely descriptive and independent from the selected
  // vessel — changing one must never clear the already-selected Vessel/Tug/Barge Name or its details.
  const makeIndependentVesselTypeChange = (typeKey) => (event) => {
    handleValidatedChange(typeKey)(event);
  };

  const handleSingleVesselTypeChange = makeIndependentVesselTypeChange("vesselType");
  const handleTugTypeChange = makeIndependentVesselTypeChange("tugType");
  const handleBargeTypeChange = makeIndependentVesselTypeChange("bargeType");

  // Call type / port are now chosen directly on this tab (previously selected upfront in the
  // Select Workflow modal). call_type_id is kept in sync alongside typeOfCall since other reads
  // (e.g. the parent CardForm's Husbandry-call check) key off call_type_id specifically.
  const handleCallTypeChange = (event) => {
    const nextValue = event?.target?.value ?? "";
    const syntheticEvent = { target: { value: nextValue, name: "typeOfCall" } };
    handleValidatedChange("typeOfCall")(syntheticEvent);
    handleChange("call_type_id")({ target: { value: nextValue, name: "call_type_id" } });
  };

  const handlePortChange = (event) => {
    handleValidatedChange("port")(event);
  };

  const handleServiceRequestorEmailChange = useCallback(
    (event) => {
      const nextVal = event?.target?.value ?? "";
      handleValidatedChange("serviceRequestorEmail")(event);
      setEditablePreviewFields((prev) =>
        prev.to_email === nextVal ? prev : { ...prev, to_email: nextVal }
      );
    },
    [handleChange, handleValidatedChange]
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
          handleValidatedChange("serviceRequestorEmail")(syncEvent);
        }
      }
    },
    [getFieldValue, handleChange, handleValidatedChange]
  );

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
      setDefaultEmailAttachments(
        normalizeEmailAttachmentList(data.appointment_acceptance.attachments)
      );
    } else {
      setAppointmentAcceptanceFromApi(null);
      setDefaultEmailAttachments([]);
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
    setDefaultEmailAttachments([]);
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
    const fallbackEmail = extractFirstEmailFromText(extracted?.fullText);
    const resolvedRequestorName =
      firstNonEmptyString(msgSenderDetails?.extractedName) ||
      firstNonEmptyString(extracted?.fromName);
    const resolvedRequestorEmail =
      firstNonEmptyString(msgSenderDetails?.extractedEmail) ||
      firstNonEmptyString(extracted?.fromEmail) ||
      fallbackEmail;
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

      const isBargeAppointment = appointmentTypeShowsBargeFields(
        normalizeAppointmentTypeValue(getFieldValue("appointmentType"))
      );

      const vesselValue = firstNonEmptyString(data.vessel_id, data.vessel_name);
      if (vesselValue) {
        const vesselById = allVesselOptions.find(
          (option) => String(option?.value ?? "") === String(data.vessel_id ?? "")
        );
        const matchedVessel =
          vesselById || findMatchingOption(allVesselOptions, firstNonEmptyString(data.vessel_name, data.vessel_id));
        const vesselFieldKey = isBargeAppointment ? "tugVesselName" : "vesselName";
        if (matchedVessel && setFieldIfEmpty(vesselFieldKey, String(matchedVessel.value ?? ""))) {
          filledCount += 1;
        }
      }

      const billingEntityValue = firstNonEmptyString(data.billing_entity_id, data.billing_entity);
      if (billingEntityValue) {
        const billingEntityById = billingEntitySelectOptions.find(
          (option) => String(option?.value ?? "") === String(data.billing_entity_id ?? "")
        );
        const matchedBillingEntity =
          billingEntityById ||
          findMatchingOption(billingEntitySelectOptions, firstNonEmptyString(data.billing_entity, data.billing_entity_id));
        const billingEntityFieldKey = isBargeAppointment ? "tugBillingEntity" : "vesselBillingEntity";
        if (matchedBillingEntity && setFieldIfEmpty(billingEntityFieldKey, String(matchedBillingEntity.value ?? ""))) {
          filledCount += 1;
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

      const hasExtractedDetails = filledCount > 0 || Boolean(subject) || Boolean(body);
      if (hasExtractedDetails) {
        notify("Appointment details extracted successfully.", "success");
      }
      return hasExtractedDetails;
    },
    [
      applyAppointmentReceivedDateTime,
      allVesselOptions,
      billingEntitySelectOptions,
      callTypeOptions,
      getFieldValue,
      portSelectOptions,
      setFieldIfEmpty,
    ]
  );

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

    setAiExtractionError("");

    // AI extraction runs first; any failure or empty result falls back to local (manual) parsing.
    setIsServerEmailReading(true);
    try {
      const aiExtracted = await applyBeAppointmentExtraction(file);
      if (aiExtracted) return;
    } catch (error) {
      setAiExtractionError(
        firstNonEmptyString(error?.response?.data?.message, error?.response?.data?.error, error?.message) ||
        "AI appointment extraction failed."
      );
    } finally {
      setIsServerEmailReading(false);
    }

    try {
      let extractedText = "";
      let msgData = null;
      if (isMsgFile(file)) {
        const parsedMsg = await extractMsgAppointmentText(file);
        extractedText = firstNonEmptyString(parsedMsg?.extractedText);
        msgData = parsedMsg?.msgData || null;
      } else {
        extractedText = await extractTextFromFile(file);
      }
      if (!firstNonEmptyString(extractedText)) {
        notify("File uploaded, but no matching appointment details found.", "warning");
        return;
      }

      const extracted = extractEmailHeaderDetails(extractedText);
      const msgSenderDetails = msgData ? parseMsgSenderDetails(msgData) : null;
      const receivedParts = resolveMsgReceivedDateTime(msgData, extractedText);
      const filledCount = applyNonAiAppointmentFields(extracted, receivedParts, msgSenderDetails);
      if (filledCount > 0) {
        notify("Appointment details auto-filled from uploaded email.", "success");
      } else {
        notify("File uploaded, but no matching appointment details found.", "warning");
      }
    } catch (error) {
      const isUnsupportedFormat = error?.message === "UNSUPPORTED_FILE_FORMAT";
      if (isUnsupportedFormat) {
        notify("Unsupported file format.", "warning");
      } else {
        notify("File uploaded, but auto-fill failed.", "warning");
      }
      setAiExtractionError(firstNonEmptyString(error?.message) || "Extraction failed");
    }
  };

  const handleDocumentRemove = (index) => {
    setAppointmentDocuments((prev) => prev.filter((_, i) => i !== index));
    resetAppointmentEmailExtractedValues();
  };

  const handleEmailAttachmentUpload = useCallback(
    async (files) => {
      const incoming = Array.isArray(files) ? files : [files];
      const validFiles = incoming.filter(
        (file) =>
          (file instanceof File || (typeof Blob !== "undefined" && file instanceof Blob)) &&
          Number(file?.size) > 0
      );
      if (!validFiles.length) return;

      const billingEntityId = getPrimaryBillingEntityId();
      if (isEmptyValue(billingEntityId)) {
        notify("Please select a Billing entity before uploading attachments.", "error");
        return;
      }

      const formData = new FormData();
      validFiles.forEach((file) => {
        formData.append("files[]", file);
      });
      formData.append("billing_entity_id", billingEntityId ?? "");

      setIsUploadingEmailAttachments(true);
      try {
        const response = await callFileService.uploadEmailAttachments(formData);
        const payload = response?.data?.data ?? response?.data ?? response;
        const rawList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.attachments)
            ? payload.attachments
            : Array.isArray(payload?.files)
              ? payload.files
              : [];
        const normalized = rawList
          .map((item) => ({
            file_name: item?.file_name ?? item?.name ?? item?.fileName ?? "",
            file_url: item?.file_url ?? item?.url ?? item?.fileUrl ?? "",
          }))
          .filter((item) => item.file_name || item.file_url);

        if (!normalized.length) {
          notify("No attachments were returned by the server.", "error");
          return;
        }

        setUploadedEmailAttachments((prev) => [...prev, ...normalized]);
      } catch (error) {
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Could not upload attachments.";
        notify(typeof msg === "string" ? msg : "Could not upload attachments.", "error");
      } finally {
        setIsUploadingEmailAttachments(false);
      }
    },
    [getFieldValue]
  );

  const handleRemoveEmailAttachment = useCallback((item) => {
    if (!item) return;
    if (item._source === "default") {
      setDefaultEmailAttachments((prev) => prev.filter((_, i) => i !== item._index));
    } else {
      setUploadedEmailAttachments((prev) => prev.filter((_, i) => i !== item._index));
    }
  }, []);

  const mergedEmailAttachments = useMemo(
    () => [
      ...(Array.isArray(defaultEmailAttachments) ? defaultEmailAttachments : []).map(
        (file, index) => ({ ...file, _source: "default", _index: index })
      ),
      ...(Array.isArray(uploadedEmailAttachments) ? uploadedEmailAttachments : []).map(
        (file, index) => ({ ...file, _source: "uploaded", _index: index })
      ),
    ],
    [defaultEmailAttachments, uploadedEmailAttachments]
  );

  const fetchBillingInstructionByEntity = useCallback(
    async (entityId) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setBillingInstructionType("");
        setBillingInstructionEmailOptions([]);
        handleChange("billingInstructions")({ target: { value: "", name: "billingInstructions" } });
        handleChange("billingInstructionEmails")({ target: { value: [], name: "billingInstructionEmails" } });
        handleChange("dailyReportEmail")({ target: { value: [], name: "dailyReportEmail" } });
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
        // daily_report_emails only applies to Email instruction type — clear stale selections otherwise.
        if (!isEmailInstruction) {
          handleChange("dailyReportEmail")({ target: { value: [], name: "dailyReportEmail" } });
        }
      } catch {
        setBillingInstructionType("");
        setBillingInstructionEmailOptions([]);
        handleChange("billingInstructionEmails")({ target: { value: [], name: "billingInstructionEmails" } });
      } finally {
        setBillingInstructionLoading(false);
      }
    },
    [handleChange]
  );

  // Builds a vessel-name change handler for a given set of form keys (used by the Vessel,
  // Taxi Tug single section and the Tug / Barge sub-sections of Tug and barge).
  const makeVesselSelectionChange = useCallback(
    ({ nameKey, ownerKey, managerKey, principalKey }) =>
      async (event) => {
        const selectedVesselId = event?.target?.value ?? "";
        handleChange(nameKey)(event);
        if (hasSubmitted) {
          setFieldErrors((prev) => {
            if (!prev[nameKey]) return prev;
            if (!firstNonEmptyString(selectedVesselId)) return prev;
            const next = { ...prev };
            delete next[nameKey];
            return next;
          });
        }

        // Clear details immediately to avoid showing stale data.
        handleChange(ownerKey)({ target: { value: "", name: ownerKey } });
        handleChange(managerKey)({ target: { value: "", name: managerKey } });
        handleChange(principalKey)({ target: { value: "", name: principalKey } });

        // Track the latest request per field so a slower, older detail response can never
        // overwrite a newer vessel selection (vesselName / tugVesselName / bargeVesselName are independent).
        const requestId = (vesselDetailRequestIdRef.current[nameKey] || 0) + 1;
        vesselDetailRequestIdRef.current[nameKey] = requestId;

        const normalizedVesselId = selectedVesselId === undefined || selectedVesselId === null ? "" : String(selectedVesselId).trim();
        if (!normalizedVesselId) return;

        try {
          const { data } = await vesselService.getVesselDetailByVesselId(normalizedVesselId);
          if (vesselDetailRequestIdRef.current[nameKey] !== requestId) return;
          const detail = normalizeVesselDetails(data);
          handleChange(ownerKey)({ target: { value: detail.vessel_owner, name: ownerKey } });
          handleChange(managerKey)({ target: { value: detail.vessel_manager, name: managerKey } });
          handleChange(principalKey)({ target: { value: detail.vessel_principal, name: principalKey } });
        } catch {
        }
      },
    [handleChange, hasSubmitted]
  );

  const handleVesselSelectionChange = useMemo(
    () =>
      makeVesselSelectionChange({
        nameKey: "vesselName",
        ownerKey: "vesselOwner",
        managerKey: "vesselManager",
        principalKey: "vesselPrincipal",
      }),
    [makeVesselSelectionChange]
  );

  const handleTugVesselSelectionChange = useMemo(
    () =>
      makeVesselSelectionChange({
        nameKey: "tugVesselName",
        ownerKey: "tugOwner",
        managerKey: "tugManager",
        principalKey: "tugPrincipal",
      }),
    [makeVesselSelectionChange]
  );

  const handleBargeVesselSelectionChange = useMemo(
    () =>
      makeVesselSelectionChange({
        nameKey: "bargeVesselName",
        ownerKey: "bargeOwner",
        managerKey: "bargeManager",
        principalKey: "bargePrincipal",
      }),
    [makeVesselSelectionChange]
  );

  // Handle new email addition
  const handleAddNewEmail = useCallback(
    async (email) => {
      const normalizedEmail = email ? String(email).trim() : "";
      const currentEntityId = getPrimaryBillingEntityId();
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
      } catch {
      }
    },
    [getFieldValue, fetchBillingEntityEmails, handleChange]
  );

  const handleAddBillingInstructionEmail = useCallback(
    async (email) => {
      const normalizedEmail = email ? String(email).trim() : "";
      const currentEntityId = getPrimaryBillingEntityId();
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
      } catch {
      }
    },
    [getFieldValue, handleChange]
  );

  // For Tug and barge the primary vessel is the tug (tugVesselName); otherwise the single vessel field.
  const previewVesselId = firstNonEmptyString(getFieldValue("vesselName"), getFieldValue("tugVesselName"));
  const previewPortId = firstNonEmptyString(getFieldValue("port"));
  const previewCallType = firstNonEmptyString(getFieldValue("typeOfCall"));
  const previewCallTypeId = firstNonEmptyString(getFieldValue("call_type_id"), getFieldValue("typeOfCall"));
  const previewVesselTypeId = firstNonEmptyString(getFieldValue("vesselType"));
  const previewBargeTypeId = firstNonEmptyString(getFieldValue("bargeType"));
  const previewTugTypeId = firstNonEmptyString(getFieldValue("tugType"));
  const previewServiceRequestorEmail = firstNonEmptyString(getFieldValue("serviceRequestorEmail"));
  const previewOperatorId = firstNonEmptyString(getFieldValue("assignedOperator"));
  const previewLastPort = firstNonEmptyString(getFieldValue("lastPort"));
  const previewSelectedChecklists = getFieldValue("selectedChecklists");
  const previewChecklistTypeIds = Array.isArray(previewSelectedChecklists)
    ? previewSelectedChecklists.filter(Boolean)
    : [];
  const previewChecklistTypeIdsKey = previewChecklistTypeIds.join(",");
  const previewBargeSelectedChecklists = getFieldValue("bargeSelectedChecklists");
  const previewBargeChecklistTypeIds = Array.isArray(previewBargeSelectedChecklists)
    ? previewBargeSelectedChecklists.filter(Boolean)
    : [];
  const previewBargeChecklistTypeIdsKey = previewBargeChecklistTypeIds.join(",");

  const { checklistOptions, checklistLoading } = useChecklistOptions({
    callTypeId: previewCallTypeId,
    portId: previewPortId,
    onSelectionsReset: () => {
      handleChange("selectedChecklists")({ target: { value: [], name: "selectedChecklists" } });
      handleChange("bargeSelectedChecklists")({ target: { value: [], name: "bargeSelectedChecklists" } });
    },
  });

  const buildAllDetailPayload = useCallback(
    () => ({
      vessel_id: previewVesselId,
      port_id: previewPortId,
      call_type_id: previewCallTypeId,
      vessel_type_id: previewVesselTypeId,
      barge_type_id: previewBargeTypeId,
      tug_type_id: previewTugTypeId,
      service_requestor_email: previewServiceRequestorEmail,
      operator_id: previewOperatorId,
      last_port: previewLastPort,
      time_objects: buildPreviewTimeObjectsPayload(stageTimeObjects, stageTimeObjectValues),
      checklist_type_ids: previewChecklistTypeIds,
      barge_checklist_type_ids: previewBargeChecklistTypeIds,
    }),
    [
      previewVesselId,
      previewPortId,
      previewCallTypeId,
      previewVesselTypeId,
      previewBargeTypeId,
      previewTugTypeId,
      previewServiceRequestorEmail,
      previewOperatorId,
      previewLastPort,
      stageTimeObjects,
      stageTimeObjectValues,
      previewChecklistTypeIdsKey,
      previewBargeChecklistTypeIdsKey,
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
          call_id: currentCallId,
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
      } catch {
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
  }, [previewPortId, previewCallType, currentCallId]);

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
      } catch {
      } finally {
        if (etaDependentRequestIdRef.current === requestId) {
          setIsEtaDependentTimesLoading(false);
        }
      }
    },
    [hasSubmitted, etaTimeObjectId, previewPortId, previewCallType, isEtaDependentTimesLoading]
  );

  useEffect(() => {
    const hasAllRequiredPreviewFields =
      Boolean(previewVesselId) &&
      Boolean(previewPortId) &&
      Boolean(previewCallType) &&
      Boolean(previewServiceRequestorEmail);

    if (!hasAllRequiredPreviewFields) {
      setEmailPreviewData(null);
      setDefaultEmailAttachments([]);
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
          vessel_type_id: previewVesselTypeId,
          barge_type_id: previewBargeTypeId,
          tug_type_id: previewTugTypeId,
          service_requestor_email: previewServiceRequestorEmail,
          operator_id: previewOperatorId,
          last_port: previewLastPort,
          time_objects: buildPreviewTimeObjectsPayload(stageTimeObjects, stageTimeObjectValues),
          checklist_type_ids: previewChecklistTypeIds,
          barge_checklist_type_ids: previewBargeChecklistTypeIds,
        });
        if (cancelled) return;
        const resolved = resolveEmailPreviewPayload(data);
        setEmailPreviewData(resolved);
        setDefaultEmailAttachments(normalizeEmailAttachmentList(resolved?.attachments));
        populateEditablePreviewFields(resolved);
        const apiHtml = firstNonEmptyString(resolved?.messageHtml);
        if (apiHtml && !isPreviewMessageDirty) {
          setPreviewMessageText(apiHtml);
          setPreviewMessageEditorKey((key) => key + 1);
        }
      } catch {
        if (!cancelled) {
          setEmailPreviewData(null);
          setDefaultEmailAttachments([]);
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
    previewVesselId,
    previewPortId,
    previewCallType,
    previewVesselTypeId,
    previewBargeTypeId,
    previewTugTypeId,
    previewServiceRequestorEmail,
    previewOperatorId,
    previewLastPort,
    stageTimeObjectValues,
    stageTimeObjects,
    previewChecklistTypeIdsKey,
    previewBargeChecklistTypeIdsKey,
    isPreviewMessageDirty,
    populateEditablePreviewFields,
    resetTouchedPreviewFields,
  ]);

  useEffect(() => {

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
        const response = await callFileService.allDetailByVesselId(requestPayload);
        if (cancelled || allDetailByVesselRequestIdRef.current !== requestId) return;
        applyAllDetailByVesselResponse(response?.data);
      } catch {
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    buildAllDetailPayload,
    previewVesselId,
    previewPortId,
    previewCallTypeId,
    previewVesselTypeId,
    previewBargeTypeId,
    previewTugTypeId,
    previewServiceRequestorEmail,
    previewOperatorId,
    previewLastPort,
    stageTimeObjects,
    stageTimeObjectValues,
  ]);

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
  }, [setEntityFieldErrors, setEntityFieldValues]);

  // Vessel/Tug billing entity drives the shared entity-dependent lookups (dynamic fields, daily report
  // emails, billing instructions). Barge billing entity is independent and has no such side effects —
  // selecting one must never overwrite or refetch data tied to the other.
  const applyPrimaryBillingEntitySideEffects = (nextEntityId) => {
    handleChange("dailyReportEmail")({ target: { value: [], name: "dailyReportEmail" } });
    handleChange("billingInstructionEmails")({ target: { value: [], name: "billingInstructionEmails" } });
    handleChange("billingInstructions")({ target: { value: "", name: "billingInstructions" } });
    setEntityFields([]);
    setEntityFieldValues({});
    setEntityFieldErrors({});
    setEntityFieldsError("");
    void fetchEntityFields(nextEntityId);
    void fetchBillingEntityEmails(nextEntityId);
    void fetchBillingInstructionByEntity(nextEntityId);
  };

  const handleVesselBillingEntityChange = (event) => {
    const nextEntityId = event?.target?.value ?? "";
    handleValidatedChange("vesselBillingEntity")(event);
    applyPrimaryBillingEntitySideEffects(nextEntityId);
  };

  const handleTugBillingEntityChange = (event) => {
    const nextEntityId = event?.target?.value ?? "";
    handleValidatedChange("tugBillingEntity")(event);
    applyPrimaryBillingEntitySideEffects(nextEntityId);
  };

  const handleBargeBillingEntityChange = (event) => {
    handleValidatedChange("bargeBillingEntity")(event);
  };

  const selectedEntityId = getPrimaryBillingEntityId();

  useEffect(() => {
    if (!selectedEntityId) return;
    void fetchEntityFields(selectedEntityId);
    void fetchBillingEntityEmails(selectedEntityId);
    void fetchBillingInstructionByEntity(selectedEntityId);
  }, [
    selectedEntityId,
    fetchEntityFields,
    fetchBillingEntityEmails,
    fetchBillingInstructionByEntity,
  ]);

  const masterInputsDisabled = masterDataLoading;
  const selectedAppointmentType = normalizeAppointmentTypeValue(getFieldValue("appointmentType"));
  const isTugAndBargeSelected = appointmentTypeShowsBargeFields(selectedAppointmentType);
  const isSingleVesselSection = appointmentTypeShowsSingleVesselSection(selectedAppointmentType);
  // "Vessel type" catalogue depends on appointment type: Taxi Tug -> tug types, Vessel -> vessel types.
  const singleVesselTypeOptions = appointmentTypeUsesTugTypeSource(selectedAppointmentType)
    ? tugTypeSelectOptions
    : vesselTypeSelectOptions;

  if (isTemplateFieldsLoading) {
    return (
      <div className="cardform-body card-form-panel general-tab-body general-tab-body--loading">
        <CardTabListLoading message="Loading template..." cardColor={formValues?.cardColor} />
      </div>
    );
  }

  return (
    <div className="cardform-body card-form-panel general-tab-body">
      <div className="general-sections-wrapper">
        <div className="cf-section general-info-section general-info-section--add-mode">
          <div className="cf-section-body">
            <div className="general-add-mode-wrapper">
              <div className="general-info-two-column general-add-3col-layout general-add-card-layout general-tab-form-layout">
                {canViewBasicFields && (
                  <div className="general-info-left general-add-form-panel">
                    <div className="general-add-form-scroll">
                      {templateFields ? (
                        <div className="pre-arrival-form">
                          {templateFields.map((field) => (
                            <TemplateFieldPreview
                              key={field.id}
                              field={field}
                              value={templateFieldValues[field.id]}
                              onChange={handleTemplateFieldChange(field)}
                              error={templateFieldErrors[field.id]}
                            />
                          ))}
                        </div>
                      ) : (
                      <div className="pre-arrival-form">
                        <OwnerField
                          value={getFieldValue("owner")}
                          onChange={handleChange("owner")}
                          options={mergeOptionIfMissing(ownerOptions, getFieldValue("owner"), getItem("userName"))}
                          placeholder="Select owner"
                          disabled={masterInputsDisabled}
                        />

                        <div className="form-group">
                          <h3 className="form-group-title">Appointment Details</h3>
                          <FormField
                            label=""
                            hasError={false}
                          >
                            <div className="appointment-email-label-row">
                              <label className="appointment-email-label">Appointment Email</label>
                            </div>
                            <DocumentUpload
                              attachments={appointmentDocuments}
                              onAdd={handleAppointmentDocumentAdd}
                              onRemove={handleDocumentRemove}
                              allowMultiple={false}
                              onMultipleFiles={() => notify("Only one appointment email can be uploaded.", "warning")}
                              hasError={false}
                              isLoading={isServerEmailReading}
                              loadingText="Extracting appointment details with AI..."
                              showFileActions
                            />
                            {/* {isAiExtractingAppointment && (
                              <div className="cf-field-hint">Extracting appointment details...</div>
                            )}
                            {!isAiExtractingAppointment && aiExtractionError && (
                              <div className="cf-field-hint">{aiExtractionError}</div>
                            )} */}
                          </FormField>
                          <FormField
                            label="Appointment Type *"
                            hasError={Boolean(fieldErrors.appointmentType)}
                          >
                            <FormSelect
                              value={selectedAppointmentType}
                              onChange={handleAppointmentTypeChange}
                              options={APPOINTMENT_TYPE_OPTIONS}
                              placeholder="Select appointment type"
                              disabled={masterInputsDisabled}
                              hasError={Boolean(fieldErrors.appointmentType)}
                            />
                            {fieldErrors.appointmentType && (
                              <div className="cf-field-error">{fieldErrors.appointmentType}</div>
                            )}
                          </FormField>
                          <FormField
                            label="Appointment Received *"
                            hasError={Boolean(fieldErrors.appointmentReceivedDate || fieldErrors.appointmentReceivedTime)}
                          >
                            <DateTimePickerField
                              dateValue={getFieldValue("appointmentReceivedDate")}
                              timeValue={getFieldValue("appointmentReceivedTime")}
                              onDateChange={handleValidatedChange("appointmentReceivedDate")}
                              onTimeChange={handleValidatedChange("appointmentReceivedTime")}
                              dateFieldName="appointmentReceivedDate"
                              timeFieldName="appointmentReceivedTime"
                              hasError={Boolean(fieldErrors.appointmentReceivedDate || fieldErrors.appointmentReceivedTime)}
                              placeholder="Select date and time"
                            />
                            {(fieldErrors.appointmentReceivedDate || fieldErrors.appointmentReceivedTime) && (
                              <div className="cf-field-error">{fieldErrors.appointmentReceivedDate || fieldErrors.appointmentReceivedTime}</div>
                            )}
                          </FormField>
                        </div>

                        <div className="form-group">
                          <h3 className="form-group-title">Service Information</h3>
                          <FormField label="Call Type *" hasError={Boolean(fieldErrors.typeOfCall)}>
                            <FormSelect
                              value={firstNonEmptyString(getFieldValue("call_type_id"), getFieldValue("typeOfCall"))}
                              onChange={handleCallTypeChange}
                              options={mergeOptionIfMissing(
                                callTypeOptions,
                                firstNonEmptyString(getFieldValue("call_type_id"), getFieldValue("typeOfCall"))
                              )}
                              placeholder="Select call type"
                              disabled={masterInputsDisabled}
                              hasError={Boolean(fieldErrors.typeOfCall)}
                            />
                            {fieldErrors.typeOfCall && <div className="cf-field-error">{fieldErrors.typeOfCall}</div>}
                          </FormField>
                          <FormField label="Port *" hasError={Boolean(fieldErrors.port)}>
                            <FormSelect
                              value={getFieldValue("port")}
                              onChange={handlePortChange}
                              options={mergeOptionIfMissing(portSelectOptions, getFieldValue("port"))}
                              placeholder="Select port"
                              disabled={masterInputsDisabled}
                              hasError={Boolean(fieldErrors.port)}
                            />
                            {fieldErrors.port && <div className="cf-field-error">{fieldErrors.port}</div>}
                          </FormField>
                          {!stageTimeObjectsLoading &&
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
                          <FormField label="Last Port">
                            <FormInput
                              type="text"
                              placeholder="Enter last port"
                              value={getFieldValue("lastPort")}
                              onChange={handleChange("lastPort")}
                              disabled={masterInputsDisabled}
                            />
                          </FormField>

                          {entityFieldsLoading && (
                            <FormField label="">
                              <div className="cf-input">
                                <input type="text" value="Loading fields..." readOnly />
                              </div>
                            </FormField>
                          )}

                          {!entityFieldsLoading &&
                            entityFields.map((field) => (
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
                                  />
                                </FormField>

                                <FormField label="Project">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter project..."
                                    value={getFieldValue("project")}
                                    onChange={handleChange("project")}
                                  />
                                </FormField>
                              </>
                            )}
                        </div>

                        <div className="form-group">
                          <h3 className="form-group-title">Vessel Information</h3>

                          {isSingleVesselSection && (
                            <FormField label="Vessel type">
                              <FormSelect
                                value={getFieldValue("vesselType")}
                                onChange={handleSingleVesselTypeChange}
                                options={mergeOptionIfMissing(singleVesselTypeOptions, getFieldValue("vesselType"))}
                                placeholder="Select vessel type"
                                disabled={masterInputsDisabled}
                              />
                            </FormField>
                          )}

                          {isSingleVesselSection && (
                            <FormField label="Vessel Name *" hasError={Boolean(fieldErrors.vesselName)}>
                              {(() => {
                                const vesselNameValue = getFieldValue("vesselName");
                                const vesselNameLabel = getOptionLabel(vesselNameOptions, vesselNameValue) || vesselNameValue;
                                return (
                                  <FormSelect
                                    value={vesselNameValue}
                                    onChange={handleVesselSelectionChange}
                                    options={mergeOptionIfMissing(vesselNameOptions, vesselNameValue, vesselNameLabel)}
                                    placeholder={allVesselsLoading ? "Loading vessels..." : "Select vessel name"}
                                    disabled={allVesselsLoading}
                                    hasError={Boolean(fieldErrors.vesselName)}
                                  />
                                );
                              })()}
                              {fieldErrors.vesselName && <div className="cf-field-error">{fieldErrors.vesselName}</div>}
                            </FormField>
                          )}

                          {isSingleVesselSection && (
                            <FormField label="Billing Entity" hasError={Boolean(fieldErrors.vesselBillingEntity)}>
                              <FormSelect
                                value={getFieldValue("vesselBillingEntity")}
                                onChange={handleVesselBillingEntityChange}
                                options={mergeOptionIfMissing(billingEntitySelectOptions, getFieldValue("vesselBillingEntity"))}
                                placeholder="Select billing entity"
                                disabled={masterInputsDisabled}
                                hasError={Boolean(fieldErrors.vesselBillingEntity)}
                                menuClassName="billing-entity-select"
                                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                                menuPosition="fixed"
                              />
                              {fieldErrors.vesselBillingEntity && (
                                <div className="cf-field-error">{fieldErrors.vesselBillingEntity}</div>
                              )}
                            </FormField>
                          )}

                          {isSingleVesselSection && (
                            <FormField label="Vessel Owner">
                              <FormInput
                                type="text"
                                placeholder="Enter vessel owner..."
                                value={getFieldValue("vesselOwner")}
                                onChange={handleChange("vesselOwner")}
                              />
                            </FormField>
                          )}

                          {isSingleVesselSection && (
                            <FormField label="Vessel Charterer">
                              <FormInput
                                type="text"
                                placeholder="Enter vessel charter..."
                                value={getFieldValue("vesselPrincipal")}
                                onChange={handleChange("vesselPrincipal")}
                              />
                            </FormField>
                          )}

                          {isSingleVesselSection && (
                            <FormField label="Select Checklist" className="cf-select-checklist-field">
                              <MultiSelectField
                                name="selectedChecklists"
                                value={Array.isArray(getFieldValue("selectedChecklists")) ? getFieldValue("selectedChecklists") : []}
                                onChange={handleChange("selectedChecklists")}
                                options={checklistOptions}
                                placeholder={checklistLoading ? "Loading checklists..." : "Select checklists"}
                                disabled={checklistLoading}
                                className="checklist-multi-select"
                                menuMaxHeight={260}
                                isLoading={checklistLoading}
                                emptyMessage="No checklists found"
                              />
                            </FormField>
                          )}

                          {isTugAndBargeSelected && (
                            <>
                              <div className="cf-vessel-subsection">
                                <h4 className="cf-vessel-subsection-title">Tug Information</h4>

                                <FormField label="Vessel type">
                                  <FormSelect
                                    value={getFieldValue("tugType")}
                                    onChange={handleTugTypeChange}
                                    options={mergeOptionIfMissing(tugTypeSelectOptions, getFieldValue("tugType"))}
                                    placeholder="Select vessel type"
                                    disabled={masterInputsDisabled}
                                  />
                                </FormField>

                                <FormField label="Vessel Name *" hasError={Boolean(fieldErrors.tugVesselName)}>
                                  {(() => {
                                    const tugVesselNameValue = getFieldValue("tugVesselName");
                                    const tugVesselNameLabel = getOptionLabel(vesselNameOptions, tugVesselNameValue) || tugVesselNameValue;
                                    return (
                                      <FormSelect
                                        value={tugVesselNameValue}
                                        onChange={handleTugVesselSelectionChange}
                                        options={mergeOptionIfMissing(vesselNameOptions, tugVesselNameValue, tugVesselNameLabel)}
                                        placeholder={allVesselsLoading ? "Loading vessels..." : "Select vessel name"}
                                        disabled={allVesselsLoading}
                                        hasError={Boolean(fieldErrors.tugVesselName)}
                                      />
                                    );
                                  })()}
                                  {fieldErrors.tugVesselName && <div className="cf-field-error">{fieldErrors.tugVesselName}</div>}
                                </FormField>

                                <FormField label="Billing Entity" hasError={Boolean(fieldErrors.tugBillingEntity)}>
                                  <FormSelect
                                    value={getFieldValue("tugBillingEntity")}
                                    onChange={handleTugBillingEntityChange}
                                    options={mergeOptionIfMissing(billingEntitySelectOptions, getFieldValue("tugBillingEntity"))}
                                    placeholder="Select billing entity"
                                    disabled={masterInputsDisabled}
                                    hasError={Boolean(fieldErrors.tugBillingEntity)}
                                    menuClassName="billing-entity-select"
                                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                                    menuPosition="fixed"
                                  />
                                  {fieldErrors.tugBillingEntity && (
                                    <div className="cf-field-error">{fieldErrors.tugBillingEntity}</div>
                                  )}
                                </FormField>

                                <FormField label="Vessel Owner">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter vessel owner..."
                                    value={getFieldValue("tugOwner")}
                                    onChange={handleChange("tugOwner")}
                                  />
                                </FormField>

                                <FormField label="Vessel Charterer">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter vessel charter..."
                                    value={getFieldValue("tugPrincipal")}
                                    onChange={handleChange("tugPrincipal")}
                                  />
                                </FormField>

                                <FormField label="Vessel Manager">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter vessel manager..."
                                    value={getFieldValue("tugManager")}
                                    onChange={handleChange("tugManager")}
                                  />
                                </FormField>

                                <FormField label="Select Checklist" className="cf-select-checklist-field">
                                  <MultiSelectField
                                    name="selectedChecklists"
                                    value={Array.isArray(getFieldValue("selectedChecklists")) ? getFieldValue("selectedChecklists") : []}
                                    onChange={handleChange("selectedChecklists")}
                                    options={checklistOptions}
                                    placeholder={checklistLoading ? "Loading checklists..." : "Select checklists"}
                                    disabled={checklistLoading}
                                    className="checklist-multi-select"
                                    menuMaxHeight={260}
                                    isLoading={checklistLoading}
                                    emptyMessage="No checklists found"
                                  />
                                </FormField>
                              </div>

                              <div className="cf-vessel-subsection">
                                <h4 className="cf-vessel-subsection-title">Barge Information</h4>

                                <FormField label="Vessel type">
                                  <FormSelect
                                    value={getFieldValue("bargeType")}
                                    onChange={handleBargeTypeChange}
                                    options={mergeOptionIfMissing(bargeTypeSelectOptions, getFieldValue("bargeType"))}
                                    placeholder="Select vessel type"
                                    disabled={masterInputsDisabled}
                                  />
                                </FormField>

                                <FormField label="Vessel Name *" hasError={Boolean(fieldErrors.bargeVesselName)}>
                                  {(() => {
                                    const bargeVesselNameValue = getFieldValue("bargeVesselName");
                                    const bargeVesselNameLabel = getOptionLabel(vesselNameOptions, bargeVesselNameValue) || bargeVesselNameValue;
                                    return (
                                      <FormSelect
                                        value={bargeVesselNameValue}
                                        onChange={handleBargeVesselSelectionChange}
                                        options={mergeOptionIfMissing(vesselNameOptions, bargeVesselNameValue, bargeVesselNameLabel)}
                                        placeholder={allVesselsLoading ? "Loading vessels..." : "Select vessel name"}
                                        disabled={allVesselsLoading}
                                        hasError={Boolean(fieldErrors.bargeVesselName)}
                                      />
                                    );
                                  })()}
                                  {fieldErrors.bargeVesselName && <div className="cf-field-error">{fieldErrors.bargeVesselName}</div>}
                                </FormField>

                                <FormField label="Billing Entity" hasError={Boolean(fieldErrors.bargeBillingEntity)}>
                                  <FormSelect
                                    value={getFieldValue("bargeBillingEntity")}
                                    onChange={handleBargeBillingEntityChange}
                                    options={mergeOptionIfMissing(billingEntitySelectOptions, getFieldValue("bargeBillingEntity"))}
                                    placeholder="Select billing entity"
                                    disabled={masterInputsDisabled}
                                    hasError={Boolean(fieldErrors.bargeBillingEntity)}
                                    menuClassName="billing-entity-select"
                                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                                    menuPosition="fixed"
                                  />
                                  {fieldErrors.bargeBillingEntity && (
                                    <div className="cf-field-error">{fieldErrors.bargeBillingEntity}</div>
                                  )}
                                </FormField>

                                <FormField label="Vessel Owner">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter vessel owner..."
                                    value={getFieldValue("bargeOwner")}
                                    onChange={handleChange("bargeOwner")}
                                  />
                                </FormField>

                                <FormField label="Vessel Charterer">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter vessel charter..."
                                    value={getFieldValue("bargePrincipal")}
                                    onChange={handleChange("bargePrincipal")}
                                  />
                                </FormField>

                                <FormField label="Vessel Manager">
                                  <FormInput
                                    type="text"
                                    placeholder="Enter vessel manager..."
                                    value={getFieldValue("bargeManager")}
                                    onChange={handleChange("bargeManager")}
                                  />
                                </FormField>

                                <FormField label="Select Checklist" className="cf-select-checklist-field">
                                  <MultiSelectField
                                    name="bargeSelectedChecklists"
                                    value={Array.isArray(getFieldValue("bargeSelectedChecklists")) ? getFieldValue("bargeSelectedChecklists") : []}
                                    onChange={handleChange("bargeSelectedChecklists")}
                                    options={checklistOptions}
                                    placeholder={checklistLoading ? "Loading checklists..." : "Select checklists"}
                                    disabled={checklistLoading}
                                    className="checklist-multi-select"
                                    menuMaxHeight={260}
                                    isLoading={checklistLoading}
                                    emptyMessage="No checklists found"
                                  />
                                </FormField>
                              </div>
                            </>
                          )}

                          <OwnerField
                            label="Assigned Operator *"
                            value={getFieldValue("assignedOperator")}
                            onChange={handleValidatedChange("assignedOperator")}
                            options={mergeOptionIfMissing(operatorOptions, getFieldValue("assignedOperator"))}
                            placeholder="Select operator"
                            disabled={masterInputsDisabled}
                            error={fieldErrors.assignedOperator}
                            hasError={Boolean(fieldErrors.assignedOperator)}
                          />

                          <FormField label="Service Requestor Name *" hasError={Boolean(fieldErrors.serviceRequestorName)}>
                            <FormInput
                              type="text"
                              placeholder="Enter service requestor name..."
                              value={getFieldValue("serviceRequestorName")}
                              onChange={handleValidatedChange("serviceRequestorName")}
                              hasError={Boolean(fieldErrors.serviceRequestorName)}
                            />
                            {fieldErrors.serviceRequestorName && <div className="cf-field-error">{fieldErrors.serviceRequestorName}</div>}
                          </FormField>

                          <FormField
                            label="Service Requestor Email *"
                            hasError={Boolean(fieldErrors.serviceRequestorEmail)}
                          >
                            <FormInput
                              type="email"
                              placeholder="Enter service requestor email..."
                              value={getFieldValue("serviceRequestorEmail")}
                              onChange={handleServiceRequestorEmailChange}
                              hasError={Boolean(fieldErrors.serviceRequestorEmail)}
                            />
                            {fieldErrors.serviceRequestorEmail && (
                              <div className="cf-field-error">{fieldErrors.serviceRequestorEmail}</div>
                            )}
                          </FormField>

                          <FormField
                            label="Daily Report Emails"
                            className="cf-daily-report-emails-field"
                            hasError={Boolean(fieldErrors.dailyReportEmail)}
                          >
                            <MultiSelectEmail
                              name="dailyReportEmail"
                              value={Array.isArray(getFieldValue("dailyReportEmail")) ? getFieldValue("dailyReportEmail") : []}
                              onChange={handleChange("dailyReportEmail")}
                              options={dailyReportEmailOptions}
                              placeholder="Select email addresses..."
                              onAddNew={handleAddNewEmail}
                              disabled={dailyReportEmailLoading}
                              hasError={Boolean(fieldErrors.dailyReportEmail)}
                            />
                            {fieldErrors.dailyReportEmail && (
                              <div className="cf-field-error">{fieldErrors.dailyReportEmail}</div>
                            )}
                          </FormField>

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
                                  disabled={billingInstructionLoading}
                                />
                              ) : (
                                <FormInput
                                  type="text"
                                  placeholder="Enter billing instructions..."
                                  value={getFieldValue("billingInstructions")}
                                  onChange={handleChange("billingInstructions")}
                                  disabled={billingInstructionLoading}
                                />
                              )}
                            </FormField>
                          </>

                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                )}

                {canViewEmail && (
                  <div className="general-info-right">
                    <EmailPreviewPanel
                      ownerOptions={ownerOptions}
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
                      emailAttachments={mergedEmailAttachments}
                      onUploadEmailAttachments={handleEmailAttachmentUpload}
                      onRemoveEmailAttachment={handleRemoveEmailAttachment}
                      isUploadingEmailAttachments={isUploadingEmailAttachments}
                      isBillingEntitySelected={!isEmptyValue(getPrimaryBillingEntityId())}
                    />
                  </div>
                )}
              </div>
              {canAddCard && (
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
          </div>
        </div>
      </div>
    </div>
  );
}

GeneralAdd.propTypes = {
  card: PropTypes.object,
  boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  onSave: PropTypes.func,
  isSavingGeneral: PropTypes.bool,
  hasSubmitted: PropTypes.bool,
  setHasSubmitted: PropTypes.func,
  setIsSavingGeneral: PropTypes.func,
};

export default GeneralAdd;
