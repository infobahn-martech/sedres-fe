import PropTypes from "prop-types";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import GeneralViewAppointmentDetails from "./GeneralViewAppointmentDetails";
import GeneralViewSectionShimmer from "./GeneralViewShimmer";
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
import { useChecklistOptions, useEntityFields, useGeneralViewLookups } from "./useGeneralData";

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

// Appointment Details view for calls WITHOUT a custom template (`data.template` missing):
// labels come from master lookups because the response carries no field options. Calls with
// a template use TemplateFieldsView instead and never mount this (or its lookup requests).
function GeneralViewLegacyDetails({
  card,
  formValues,
  handleChange,
  callDetailData,
  canViewGeneralInformation,
  canViewOperationTasks,
  renderTaskColumns,
}) {
  const { entityFields, entityFieldValues, setEntityFieldValues, fetchEntityFields } = useEntityFields();
  const [dailyReportEmailOptions, setDailyReportEmailOptions] = useState([]);
  const [billingInstructionType, setBillingInstructionType] = useState("");
  const [billingInstructionEmailOptions, setBillingInstructionEmailOptions] = useState([]);
  const lastHydratedEntityFieldCallIdRef = useRef(null);

  const mappedCallDetail = useMemo(
    () => (callDetailData ? mapCallDetailToFormFields(callDetailData) : {}),
    [callDetailData]
  );

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
        return { key: dedupeKey, label, value: rawValue };
      })
      .filter(Boolean);
  }, [callDetailData]);

  useEffect(() => {
    if (!callDetailData) return;
    const detailCallIdRaw = callDetailData?.call_id;
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
  }, [callDetailData, entityFields, mappedCallDetail, setEntityFieldValues]);

  const visibleDynamicEntityFields = useMemo(
    () =>
      entityFields.filter((field) =>
        hasRenderableEntityFieldValue(field, callDetailData, entityFieldValues, mappedCallDetail)
      ),
    [entityFields, callDetailData, entityFieldValues, mappedCallDetail]
  );

  // Prioritize formValues, then fetched call detail, then card, then raw API keys on the detail / card.
  const getFieldValue = (fieldName) => {
    if (hasMeaningfulValue(formValues?.[fieldName])) return formValues[fieldName];
    if (hasMeaningfulValue(mappedCallDetail?.[fieldName])) return mappedCallDetail[fieldName];
    if (hasMeaningfulValue(card?.[fieldName])) return card[fieldName];
    const apiAlias = API_ALIAS_BY_FIELD[fieldName];
    if (apiAlias && hasMeaningfulValue(callDetailData?.[apiAlias]) && String(callDetailData[apiAlias]).trim() !== "") {
      return String(callDetailData[apiAlias]);
    }
    if (apiAlias && hasMeaningfulValue(card?.[apiAlias]) && String(card[apiAlias]).trim() !== "") {
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
  }, [callDetailData?.daily_report_emails]);

  useEffect(() => {
    const rows = Array.isArray(callDetailData?.billing_instruction_emails) ? callDetailData.billing_instruction_emails : [];
    if (!rows.length) return;
    setBillingInstructionEmailOptions((prev) => mergeDetailEmailOptions(prev, rows));
    setBillingInstructionType("email");
  }, [callDetailData?.billing_instruction_emails]);

  const hasSelectedChecklists = ["selectedChecklists", "bargeSelectedChecklists"].some((key) =>
    hasMeaningfulValue(getFieldValue(key))
  );
  const { checklistOptions } = useChecklistOptions({
    enabled: canViewGeneralInformation && Boolean(callDetailData) && hasSelectedChecklists,
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
  const singleVesselUsesTugTypes = appointmentTypeUsesTugTypeSource(selectedAppointmentType);

  // Only fetch the catalogues needed to label fields that actually have a value on this call.
  const viewCatalogues = [];
  const needs = (fieldName, catalogue) => {
    if (hasMeaningfulValue(getFieldValue(fieldName))) viewCatalogues.push(catalogue);
  };
  if (canViewGeneralInformation) {
    needs("owner", "managers");
    needs("assignedOperator", "operators");
    needs("port", "ports");
    if (isSingleVesselSection) {
      needs("vesselType", singleVesselUsesTugTypes ? "tugTypes" : "vesselTypes");
      needs("vesselName", "vessels");
    } else if (isTugAndBargeSelected) {
      needs("tugType", "tugTypes");
      needs("bargeType", "bargeTypes");
      needs("tugVesselName", "vessels");
      needs("bargeVesselName", "vessels");
    }
  }
  if (canViewGeneralInformation || canViewOperationTasks) {
    if (firstNonEmptyString(getFieldValue("call_type_id"), getFieldValue("typeOfCall"))) {
      viewCatalogues.push("callTypes");
    }
  }
  const viewBillingEntityIds = !canViewGeneralInformation
    ? []
    : isSingleVesselSection
      ? [getFieldValue("vesselBillingEntity")]
      : isTugAndBargeSelected
        ? [getFieldValue("tugBillingEntity"), getFieldValue("bargeBillingEntity")]
        : [];

  const {
    lookupsLoading,
    ownerOptions,
    operatorOptions,
    portSelectOptions,
    callTypeOptions,
    billingEntitySelectOptions,
    vesselTypeSelectOptions,
    bargeTypeSelectOptions,
    tugTypeSelectOptions,
    allVesselOptions,
  } = useGeneralViewLookups({
    enabled: Boolean(callDetailData),
    catalogues: viewCatalogues,
    billingEntityIds: viewBillingEntityIds,
  });

  // "Vessel type" catalogue depends on appointment type: Taxi Tug -> tug types, Vessel -> vessel types.
  const singleVesselTypeOptions = singleVesselUsesTugTypes ? tugTypeSelectOptions : vesselTypeSelectOptions;

  // Dynamic entity fields follow the vessel billing entity for single Vessel/Taxi Tug appointments,
  // or the tug billing entity for Tug and Barge appointments.
  const selectedEntityId = isTugAndBargeSelected
    ? getFieldValue("tugBillingEntity")
    : getFieldValue("vesselBillingEntity");

  useEffect(() => {
    if (!selectedEntityId || !canViewGeneralInformation) return;
    void fetchEntityFields(selectedEntityId);
  }, [selectedEntityId, canViewGeneralInformation, fetchEntityFields]);

  if (lookupsLoading) return <GeneralViewSectionShimmer />;

  const callTypeLabel =
    getOptionLabel(callTypeOptions, getFieldValue("typeOfCall")) || getFieldValue("typeOfCall");

  return (
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
        {renderTaskColumns(callTypeLabel)}
      </div>
    </div>
  );
}

GeneralViewLegacyDetails.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  callDetailData: PropTypes.object,
  canViewGeneralInformation: PropTypes.bool,
  canViewOperationTasks: PropTypes.bool,
  renderTaskColumns: PropTypes.func.isRequired,
};

export default GeneralViewLegacyDetails;
