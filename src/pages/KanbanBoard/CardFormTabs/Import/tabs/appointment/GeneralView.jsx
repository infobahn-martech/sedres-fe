import PropTypes from "prop-types";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import "@/design/scss/general.scss";
import "@/design/css/common/CardForm.css";
import callFileService from "@/services/callFileService";
import kpiTasksService from "@/services/kpiTasksService";
import useCallTaskReducer from "@/store/CallTaskReducer";
import usePermissions from "@/shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "@/shared/constants/permissions";
import OperationTasksPanel from "../operation/TaskTab";
import { mapTasksToSections } from "../operation/operationTasksMapper";
import GeneralViewAppointmentDetails from "./GeneralViewAppointmentDetails";
import DailyTaskTodo from "./DailyTaskTodo";
import {
  appointmentTypeShowsBargeFields,
  appointmentTypeShowsSingleVesselSection,
  appointmentTypeUsesTugTypeSource,
  firstNonEmptyString,
  getOptionLabel,
  hasRenderableEntityFieldValue,
  mapCallDetailToFormFields,
  normalizeAppointmentTypeValue,
} from "./generalHelpers";
import {
  useBillingEntityEmails,
  useChecklistOptions,
  useEntityFields,
  useGeneralMasterData,
} from "./useGeneralData";

const GeneralViewSectionShimmer = () => (
  <div className="general-info-three-column general-info-view-with-tasks general-tab-form-layout general-view-section-shimmer" aria-live="polite">
    <div className="general-info-left">
      <div className="general-view-form-scroll">
        <div className="general-shimmer-section">
          <div className="general-shimmer-line general-shimmer-line--heading" />
          <div className="general-shimmer-line general-shimmer-line--input" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
        </div>
        <div className="general-shimmer-section">
          <div className="general-shimmer-line general-shimmer-line--heading" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
          <div className="general-shimmer-line general-shimmer-line--label" />
          <div className="general-shimmer-line general-shimmer-line--input" />
        </div>
      </div>
    </div>
    <div className="general-info-middle">
      <div className="general-shimmer-panel">
        <div className="general-shimmer-line general-shimmer-line--heading" />
        <div className="general-shimmer-line general-shimmer-line--card" />
        <div className="general-shimmer-line general-shimmer-line--card" />
      </div>
    </div>
    <div className="general-info-right">
      <div className="general-shimmer-panel">
        <div className="general-shimmer-line general-shimmer-line--heading" />
        <div className="general-shimmer-line general-shimmer-line--card" />
        <div className="general-shimmer-line general-shimmer-line--card" />
      </div>
    </div>
  </div>
);

const hasMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

// Maps API detail keys to the form keys used by getFieldValue's last-resort fallback.
const API_ALIAS_BY_FIELD = {
  poNumber: "po_number",
  srtNo: "srt_number",
  srtPoWbs: "srt_number",
  project: "project_name",
  vesselBillingEntity: "main_billing_entity_id",
  tugBillingEntity: "main_billing_entity_id",
  bargeBillingEntity: "barge_billing_entity_id",
  lastPort: "last_port",
  vesselName: "vessel_id",
};

// Merges { id, email } rows from the call detail into an option list without duplicating ids.
const mergeDetailEmailOptions = (prev, rows) => {
  const next = Array.isArray(prev) ? [...prev] : [];
  rows.forEach((item) => {
    const idRaw = item?.id ?? item?.email_id ?? item?.reference;
    const id = idRaw === undefined || idRaw === null ? "" : String(idRaw).trim();
    const email = item?.email ? String(item.email).trim() : "";
    if (!id || !email) return;
    if (!next.some((opt) => String(opt.value) === id)) {
      next.push({ value: id, label: email });
    }
  });
  return next;
};

// Read-only Appointment Details tab for an existing call: appointment summary, daily KPI tasks and operation tasks.
function GeneralView({ card, formValues, handleChange }) {
  const { hasPermission } = usePermissions();
  const canViewGeneralInformation = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.APPOINTMENT_DETAILS,
    actionKey: PERMISSION_ACTIONS.GENERAL_INFORMATION,
  });
  const canViewDailyTasks = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.APPOINTMENT_DETAILS,
    actionKey: PERMISSION_ACTIONS.DAILY_TASKS,
  });
  const canViewOperationTasks = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.APPOINTMENT_DETAILS,
    actionKey: PERMISSION_ACTIONS.OPERATION_TASKS,
  });
  const accentColor = card?.color || "#2A00FF";

  const {
    ownerOptions,
    operatorOptions,
    portSelectOptions,
    callTypeOptions,
    billingEntitySelectOptions,
    vesselTypeSelectOptions,
    bargeTypeSelectOptions,
    tugTypeSelectOptions,
    allVesselOptions,
  } = useGeneralMasterData();
  const { entityFields, entityFieldValues, setEntityFieldValues, fetchEntityFields } = useEntityFields();
  const { dailyReportEmailOptions, setDailyReportEmailOptions, fetchBillingEntityEmails } = useBillingEntityEmails();
  const [billingInstructionType, setBillingInstructionType] = useState("");
  const [billingInstructionEmailOptions, setBillingInstructionEmailOptions] = useState([]);
  const [callDetailLoading, setCallDetailLoading] = useState(false);
  const [callDetailData, setCallDetailData] = useState(null);
  const lastHydratedEntityFieldCallIdRef = useRef(null);
  const [operatorKpiTasks, setOperatorKpiTasks] = useState([]);
  const [operatorKpiLoading, setOperatorKpiLoading] = useState(false);
  const [operatorKpiError, setOperatorKpiError] = useState("");
  const callTasks = useCallTaskReducer((state) => state.callTasks);
  const isLoadingCallTasks = useCallTaskReducer((state) => state.isLoadingTasks);
  const callTasksError = useCallTaskReducer((state) => state.tasksErrorMessage);
  const getTasksByCall = useCallTaskReducer((state) => state.getTasksByCall);

  const currentCallId = useMemo(
    () => card?.call_id ?? formValues?.call_id ?? card?.callId ?? "",
    [card?.call_id, card?.callId, formValues?.call_id]
  );

  useEffect(() => {
    if (!currentCallId) {
      setCallDetailData(null);
      setCallDetailLoading(false);
      return;
    }

    let cancelled = false;

    const loadCallDetail = async () => {
      setCallDetailLoading(true);
      try {
        const { data } = await callFileService.getCallDetail(currentCallId);
        const detail = data?.data ?? null;
        if (!cancelled) {
          setCallDetailData(detail);
        }
      } catch {
      } finally {
        if (!cancelled) {
          setCallDetailLoading(false);
        }
      }
    };

    loadCallDetail();
    return () => {
      cancelled = true;
    };
  }, [currentCallId]);

  const mappedCallDetail = useMemo(() => {
    if (!callDetailData) return {};
    return mapCallDetailToFormFields(callDetailData);
  }, [callDetailData]);

  const appointmentEmailUrl = useMemo(() => {
    const url = callDetailData?.appointment_email_url ?? mappedCallDetail?.appointmentEmailUrl;
    return url ? String(url).trim() : "";
  }, [callDetailData?.appointment_email_url, mappedCallDetail?.appointmentEmailUrl]);

  const appointmentEmailName = callDetailData?.appointment_email ? String(callDetailData.appointment_email).trim() : "";

  const viewModeTimeObjects = useMemo(() => {
    const source = callDetailData?.time_objects;
    if (!Array.isArray(source)) return [];

    const flattened = source.flatMap((item) => (Array.isArray(item) ? item : [item]));
    const seen = new Set();

    return flattened
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const label = firstNonEmptyString(item?.time_object);
        const rawValue = firstNonEmptyString(item?.value, item?.time_object_value, item?.event_datetime);
        if (!label || !rawValue) return null;
        const dedupeKey = `${firstNonEmptyString(item?.time_object_id)}|${label}|${rawValue}`;
        if (seen.has(dedupeKey)) return null;
        seen.add(dedupeKey);
        return {
          key: dedupeKey,
          label,
          value: rawValue,
        };
      })
      .filter(Boolean);
  }, [callDetailData]);

  useEffect(() => {
    if (!callDetailData) return;
    const detailCallIdRaw = callDetailData?.call_id ?? currentCallId;
    if (detailCallIdRaw === undefined || detailCallIdRaw === null || String(detailCallIdRaw).trim() === "") {
      return;
    }
    const detailCallId = String(detailCallIdRaw);
    if (!Array.isArray(entityFields) || entityFields.length === 0) return;

    const fallbackMap = {
      po_number: callDetailData?.po_number ?? mappedCallDetail?.poNumber ?? "",
      project_name: callDetailData?.project_name ?? mappedCallDetail?.project ?? "",
      project_code: callDetailData?.project_code ?? "",
    };

    setEntityFieldValues((prev) => {
      const hasExistingUserInput = Object.values(prev || {}).some(
        (value) => value !== undefined && value !== null && String(value).trim() !== ""
      );
      const sameCallAsLastHydration = lastHydratedEntityFieldCallIdRef.current === detailCallId;
      if (hasExistingUserInput && sameCallAsLastHydration) return prev;

      const nextValues = {};
      entityFields.forEach((field) => {
        const fieldId = field?.field_id;
        if (!fieldId) return;
        const key = field?.field_key ? String(field.field_key).trim() : "";
        if (!key) {
          nextValues[fieldId] = "";
          return;
        }
        const direct = callDetailData?.[key];
        const resolved = direct !== undefined && direct !== null && String(direct).trim() !== ""
          ? String(direct)
          : fallbackMap[key] !== undefined && fallbackMap[key] !== null
            ? String(fallbackMap[key])
            : "";
        nextValues[fieldId] = resolved;
      });

      lastHydratedEntityFieldCallIdRef.current = detailCallId;
      return nextValues;
    });
  }, [callDetailData, entityFields, mappedCallDetail, currentCallId, setEntityFieldValues]);

  const visibleDynamicEntityFields = useMemo(
    () =>
      entityFields.filter((field) =>
        hasRenderableEntityFieldValue(field, callDetailData, entityFieldValues, mappedCallDetail)
      ),
    [entityFields, callDetailData, entityFieldValues, mappedCallDetail]
  );

  const mappedOperatorKpiTasks = useMemo(() => {
    const rows = Array.isArray(operatorKpiTasks) ? operatorKpiTasks : [];
    return rows.map((row) => ({
      id: String(row?.operator_kpi_id ?? row?.id ?? `${row?.task_name ?? "task"}-${row?.due_time ?? ""}`),
      text: row?.task_name ? String(row.task_name) : "Untitled task",
      startTime: row?.start_time ? String(row.start_time) : "",
      dueTime: row?.due_time ? String(row.due_time) : "",
      completedTime: row?.completed_time ? String(row.completed_time) : "",
      status: row?.status ? String(row.status) : "",
      statusColor: row?.status_color ? String(row.status_color) : "",
      delayText: row?.delay_text ? String(row.delay_text) : "",
    }));
  }, [operatorKpiTasks]);

  const mappedOperationTaskSections = useMemo(
    () => mapTasksToSections(callTasks),
    [callTasks]
  );

  useEffect(() => {
    void getTasksByCall({ callId: currentCallId });
  }, [currentCallId, getTasksByCall]);

  useEffect(() => {
    const cardIdRaw = card?.id ?? card?.card_id ?? formValues?.card_id;
    const cardId = cardIdRaw === undefined || cardIdRaw === null ? "" : String(cardIdRaw).trim();

    if (!cardId) {
      setOperatorKpiTasks([]);
      setOperatorKpiError("");
      setOperatorKpiLoading(false);
      return;
    }

    let cancelled = false;
    const loadOperatorKpi = async () => {
      setOperatorKpiLoading(true);
      setOperatorKpiError("");
      try {
        const { data } = await kpiTasksService.getOperatorKpi(cardId);
        const rows = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) {
          setOperatorKpiTasks(rows);
        }
      } catch {
        if (!cancelled) {
          setOperatorKpiTasks([]);
          setOperatorKpiError("Unable to load KPI tasks.");
        }
      } finally {
        if (!cancelled) {
          setOperatorKpiLoading(false);
        }
      }
    };

    void loadOperatorKpi();
    return () => {
      cancelled = true;
    };
  }, [card?.id, card?.card_id, formValues?.card_id]);

  // Prioritize formValues, then fetched call detail, then card, then raw API keys on the detail / card.
  const getFieldValue = (fieldName) => {
    if (hasMeaningfulValue(formValues?.[fieldName])) {
      return formValues[fieldName];
    }
    if (hasMeaningfulValue(mappedCallDetail?.[fieldName])) {
      return mappedCallDetail[fieldName];
    }
    if (hasMeaningfulValue(card?.[fieldName])) {
      return card[fieldName];
    }
    const apiAlias = API_ALIAS_BY_FIELD[fieldName];
    if (
      apiAlias &&
      callDetailData?.[apiAlias] !== undefined &&
      callDetailData[apiAlias] !== null &&
      String(callDetailData[apiAlias]).trim() !== ""
    ) {
      return String(callDetailData[apiAlias]);
    }
    if (
      apiAlias &&
      card?.[apiAlias] !== undefined &&
      card[apiAlias] !== null &&
      String(card[apiAlias]).trim() !== ""
    ) {
      return String(card[apiAlias]);
    }
    return "";
  };

  const shouldShowApiField = useCallback(
    (apiKey) => {
      if (!callDetailData) return true;
      const raw = callDetailData?.[apiKey];
      if (Array.isArray(raw)) return raw.length > 0;
      if (raw === undefined || raw === null) return false;
      if (typeof raw === "string") return raw.trim() !== "";
      return true;
    },
    [callDetailData]
  );

  useEffect(() => {
    const rows = Array.isArray(callDetailData?.daily_report_emails) ? callDetailData.daily_report_emails : [];
    if (!rows.length) return;
    setDailyReportEmailOptions((prev) => mergeDetailEmailOptions(prev, rows));
  }, [callDetailData?.daily_report_emails, setDailyReportEmailOptions]);

  useEffect(() => {
    const rows = Array.isArray(callDetailData?.billing_instruction_emails) ? callDetailData.billing_instruction_emails : [];
    if (!rows.length) return;
    setBillingInstructionEmailOptions((prev) => mergeDetailEmailOptions(prev, rows));
    setBillingInstructionType("email");
  }, [callDetailData?.billing_instruction_emails]);

  const { checklistOptions } = useChecklistOptions({
    callTypeId: firstNonEmptyString(getFieldValue("call_type_id"), getFieldValue("typeOfCall")),
    portId: firstNonEmptyString(getFieldValue("port")),
    onSelectionsReset: () => {
      handleChange("selectedChecklists")({ target: { value: [], name: "selectedChecklists" } });
      handleChange("bargeSelectedChecklists")({ target: { value: [], name: "bargeSelectedChecklists" } });
    },
  });

  const selectedAppointmentType = normalizeAppointmentTypeValue(getFieldValue("appointmentType"));
  const isTugAndBargeSelected = appointmentTypeShowsBargeFields(selectedAppointmentType);
  const isSingleVesselSection = appointmentTypeShowsSingleVesselSection(selectedAppointmentType);
  // "Vessel type" catalogue depends on appointment type: Taxi Tug -> tug types, Vessel -> vessel types.
  const singleVesselTypeOptions = appointmentTypeUsesTugTypeSource(selectedAppointmentType)
    ? tugTypeSelectOptions
    : vesselTypeSelectOptions;

  // Entity-dependent lookups (dynamic entity fields, daily report emails) follow the vessel billing entity
  // for single Vessel/Taxi Tug appointments, or the tug billing entity for Tug and Barge appointments.
  const selectedEntityId = isTugAndBargeSelected
    ? getFieldValue("tugBillingEntity")
    : getFieldValue("vesselBillingEntity");

  useEffect(() => {
    if (!selectedEntityId) return;
    void fetchEntityFields(selectedEntityId);
    void fetchBillingEntityEmails(selectedEntityId);
  }, [selectedEntityId, fetchEntityFields, fetchBillingEntityEmails]);

  return (
    <div className="cardform-body card-form-panel general-tab-body general-tab-body--view-mode">
      <div className="general-sections-wrapper">
        <div className="cf-section general-info-section">
          <div className="cf-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="cf-section-title">General Information</div>
          </div>
          <div className="cf-section-body">
            {callDetailLoading ? (
              <GeneralViewSectionShimmer />
            ) : (
              <div className="general-view-mode-wrapper">
                <div className="general-info-three-column general-info-view-with-tasks general-tab-form-layout">
                  {canViewGeneralInformation && (
                    <div className="general-info-left">
                      <div className="general-view-form-scroll">
                        <div className="pre-arrival-form">
                          <GeneralViewAppointmentDetails
                            getFieldValue={getFieldValue}
                            shouldShowApiField={shouldShowApiField}
                            ownerOptions={ownerOptions}
                            operatorOptions={operatorOptions}
                            portSelectOptions={portSelectOptions}
                            callTypeOptions={callTypeOptions}
                            billingEntitySelectOptions={billingEntitySelectOptions}
                            singleVesselTypeOptions={singleVesselTypeOptions}
                            tugTypeSelectOptions={tugTypeSelectOptions}
                            bargeTypeSelectOptions={bargeTypeSelectOptions}
                            vesselNameOptions={allVesselOptions}
                            tugVesselNameOptions={allVesselOptions}
                            bargeVesselNameOptions={allVesselOptions}
                            checklistOptions={checklistOptions}
                            viewModeTimeObjects={viewModeTimeObjects}
                            visibleDynamicEntityFields={visibleDynamicEntityFields}
                            entityFieldValues={entityFieldValues}
                            appointmentEmailName={appointmentEmailName}
                            appointmentEmailUrl={appointmentEmailUrl}
                            isSingleVesselSection={isSingleVesselSection}
                            isTugAndBargeSelected={isTugAndBargeSelected}
                            dailyReportEmailOptions={dailyReportEmailOptions}
                            billingInstructionType={billingInstructionType}
                            billingInstructionEmailOptions={billingInstructionEmailOptions}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {canViewDailyTasks && (
                    <div className="general-info-middle">
                      <div className="general-info-tasks-card general-info-tasks-card--daily">
                        <div className="daily-task-box-wrapper">
                          <DailyTaskTodo
                            tasks={mappedOperatorKpiTasks}
                            accentColor={accentColor}
                            isLoading={operatorKpiLoading}
                            error={operatorKpiError}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {canViewOperationTasks && (
                    <div className="general-info-right">
                      <div className="general-info-tasks-card general-info-tasks-card--operation">
                        <OperationTasksPanel
                          cardColor={accentColor}
                          callType={
                            getOptionLabel(callTypeOptions, getFieldValue("typeOfCall")) ||
                            getFieldValue("typeOfCall")
                          }
                          isViewOnly
                          embedded
                          taskSections={mappedOperationTaskSections}
                          isLoading={isLoadingCallTasks}
                          error={callTasksError}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

GeneralView.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
};

export default GeneralView;
