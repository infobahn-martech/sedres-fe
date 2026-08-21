import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { notify } from "../../../../../../components/Toaster";
import Gateway from "../../../../../../gateway/gateway";
import callFileService from "../../../../../../services/callFileService";
import stageTimeMappingService from "../../../../../../services/stageTimeMappingService";
import preArrivalInfoService from "../../../../../../services/preArrivalInfoService";
import "../../../../../../design/scss/operations.scss";
import OperationTabs from "./components/OperationTabs";
import CrewImmigrationDashboard from "./CrewImmigrationDashboard";
import PreArrival from "./PreArrival";
import Arrival from "./Arrival";
import Departure from "./Departure";
import CheckListTab from "./CheckListTab";
import { buildSendReportRequestBody } from "./components/OperationCommon";
import usePermissions from "../../../../../../shared/hooks/usePermissions";
import {
  PERMISSION_MODULES,
  PERMISSION_SUBMODULES,
  PERMISSION_ACTIONS,
} from "../../../../../../shared/constants/permissions";
import {
  OPERATION_TABS,
  OPERATION_STAGE_IDS,
  SABER_APPLIED_BY_SEDRES,
  mapEventFields,
  getEventFieldKeyPrefix,
} from "./operationConstants";

// Dummy values for view-only mode
const getDummyValues = () => ({
  expectedArrivalDate: "2024-01-15",
  expectedArrivalTime: "10:30",
  customsInspectionDate: "2024-01-15",
  customsInspectionTime: "11:00",
  immigrationClearanceDate: "2024-01-15",
  immigrationClearanceTime: "12:00",
  inwardClearanceDate: "2024-01-15",
  inwardClearanceTime: "14:00",
  saberUtStatus: SABER_APPLIED_BY_SEDRES,
  saberUtDocumentsAttachments: [
    { name: "SABER_Certificate_001.pdf", size: 245678, type: "application/pdf" },
    { name: "SABER_UT_Document_002.pdf", size: 189234, type: "application/pdf" },
    { name: "Pre_Arrival_Documentation.pdf", size: 312456, type: "application/pdf" },
  ],
  preArrivalDocumentHandling: {
    selectedProcesses: { gro: true, customClearance: true },
    documents: {
      gro: [
        {
          id: "pre-gro-1",
          name: "GRO appointment confirmation",
          is_required: true,
          files: [{ name: "GRO_Appointment.pdf", size: 120400, type: "application/pdf" }],
        },
        { id: "pre-gro-2", name: "Berthing allocation (GRO)", is_required: false, files: [] },
      ],
      customClearance: [
        {
          id: "pre-cc-1",
          name: "Customs import declaration",
          is_required: true,
          files: [{ name: "Customs_Declaration.pdf", size: 98000, type: "application/pdf" }],
        },
        {
          id: "pre-cc-2",
          name: "Bill of lading / cargo manifest",
          is_required: true,
          files: [{ name: "BOL_Manifest.pdf", size: 210000, type: "application/pdf" }],
        },
        { id: "pre-cc-3", name: "Delivery order", is_required: false, files: [] },
      ],
    },
  },
  preArrivalDescription: "<p><strong>Pre-Arrival Summary:</strong></p><p>Vessel is expected to arrive on schedule. All pre-arrival documentation has been submitted and verified. The vessel SS Central Bay is proceeding according to the planned timeline.</p><p><strong>Documentation Status:</strong></p><ul><li>SABER certificate has been approved and uploaded</li><li>Customs inspection documents are ready</li><li>Immigration clearance paperwork is complete</li><li>All required permits have been obtained</li></ul><p><strong>Additional Notes:</strong></p><p>The vessel is currently en route and maintaining good communication. Weather conditions are favorable for arrival. All port services have been notified and are on standby. The crew is prepared for the arrival procedures.</p>",
  weatherForecast: "Normal weather",
  coordinates: "24.7136° N, 46.6753° E",
  actualArrivalDate: "2024-01-15",
  actualArrivalTime: "10:35",
  customInspectionCommencedDate: "2024-01-15",
  customInspectionCommencedTime: "11:05",
  customInspectionCompletedDate: "2024-01-15",
  customInspectionCompletedTime: "13:30",
  customInspectionStatus: "Passed",
  crewImmigrationCommencedDate: "2024-01-15",
  crewImmigrationCommencedTime: "12:05",
  crewImmigrationStatus: "Completed",
  crewImmigrationCompletedDate: "2024-01-15",
  crewImmigrationCompletedTime: "13:00",
  vesselInwardFormalitiesCompletedDate: "2024-01-15",
  vesselInwardFormalitiesCompletedTime: "14:15",
  marineWorkPermitAppliedDate: "2024-01-15",
  marineWorkPermitAppliedTime: "14:30",
  marineWorkPermitIssuedDate: "2024-01-15",
  marineWorkPermitIssuedTime: "15:00",
  marineWorkPermitExpiresDate: "2024-02-15",
  marineWorkPermitExpiresTime: "15:00",
  arrivalDocumentsAttachments: [
    { name: "Vessel_Inward_Clearance_001.pdf", size: 456789, type: "application/pdf" },
    { name: "Marine_Work_Permit_002.pdf", size: 321456, type: "application/pdf" },
    { name: "Custom_Inspection_Report.pdf", size: 234567, type: "application/pdf" },
    { name: "Immigration_Clearance_Document.pdf", size: 198765, type: "application/pdf" },
  ],
  arrivalDescription: "<p><strong>Arrival Summary:</strong></p><p>Vessel arrived on time. All clearance procedures completed successfully. The vessel SS Central Bay docked at the designated berth without any issues.</p><p><strong>Clearance Status:</strong></p><ul><li>Custom inspection: Passed without any discrepancies</li><li>Crew immigration: Completed for all crew members</li><li>Vessel inward formalities: Successfully completed</li><li>Marine work permit: Issued and valid until expiration date</li></ul><p><strong>Operational Notes:</strong></p><p>All required documentation has been submitted and verified. The vessel is now cleared for operations. Port services have been notified and are ready to commence. Weather conditions were favorable during arrival. All safety protocols were followed during the docking procedure.</p>",
  outwardClearanceRequestReceivedDate: "2024-01-20",
  outwardClearanceRequestReceivedTime: "09:00",
  outwardClearanceIssuedDate: "2024-01-20",
  outwardClearanceIssuedTime: "10:00",
  outwardClearanceDeliveredDate: "2024-01-20",
  outwardClearanceDeliveredTime: "10:30",
  vesselSailedDate: "2024-01-20",
  vesselSailedTime: "11:00",
  nextPort: "Jeddah Port",
  departureAttachments: [
    { name: "Outward_Clearance_Request_001.pdf", size: 345678, type: "application/pdf" },
  ],
  departureReportAttachments: [
    { name: "Outward_Clearance_Issued_002.pdf", size: 298765, type: "application/pdf" },
    { name: "Outward_Clearance_Delivered_003.pdf", size: 267890, type: "application/pdf" },
    { name: "Vessel_Sailing_Certificate.pdf", size: 189234, type: "application/pdf" },
  ],
  departureDescription: "<p><strong>Departure Summary:</strong></p><p>Vessel departed successfully. All outward clearance documents have been delivered and verified. The vessel SS Central Bay has completed all port formalities and is now en route to the next destination.</p><p><strong>Clearance Status:</strong></p><ul><li>Outward clearance request: Received and processed</li><li>Outward clearance issued: Completed on schedule</li><li>Outward clearance delivered: All documents delivered to vessel</li><li>Vessel sailing: Departed on time without any issues</li></ul><p><strong>Next Port Information:</strong></p><p>The vessel is proceeding to Jeddah Port as scheduled. All required documentation for the next port has been prepared and is ready. The crew has been briefed on the next port procedures. Weather conditions are favorable for the journey.</p>",
});

async function sendOperationReportRequest(payload) {
  const reportTypeMap = {
    "Pre Arrival": 2,
    Arrival: 4,
    "Daily Report": 4,
    Departure: 5,
  };
  const reportTypeId = payload?.report_type_id ?? reportTypeMap[payload?.tabName];
  const requestBody = buildSendReportRequestBody(
    {
      call_id: payload?.call_id,
      report_type_id: reportTypeId,
      from_email: payload?.from ?? "",
      to_email: payload?.to ?? "",
      cc_emails: payload?.cc ?? "",
      subject: payload?.subject ?? "",
      body: payload?.body ?? "",
      message: payload?.body ?? "",
    },
    payload?.attachments
  );
  return Gateway.post("arrival/send_report", requestBody);
}

function Operation({ card, formValues, handleChange, ownerInitial, isDAModule = false, isAddMode = false }) {
  const { hasPermission } = usePermissions();
  const hasCardPermission = useCallback(
    (submoduleKey, actionKey) =>
      hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_CARD, submoduleKey, actionKey }),
    [hasPermission]
  );
  const canViewPreArrivalTab = hasCardPermission(PERMISSION_SUBMODULES.PRE_ARRIVAL, PERMISSION_ACTIONS.VIEW);
  const canViewCrewImmigrationTab = hasCardPermission(PERMISSION_SUBMODULES.CREW_IMMIGRATION, PERMISSION_ACTIONS.VIEW);
  const canViewArrivalTab = hasCardPermission(PERMISSION_SUBMODULES.ARRIVAL, PERMISSION_ACTIONS.VIEW);
  const canViewDepartureTab = hasCardPermission(PERMISSION_SUBMODULES.DEPARTURE, PERMISSION_ACTIONS.VIEW);
  const canViewChecklistTab = hasCardPermission(PERMISSION_SUBMODULES.CHECKLIST, PERMISSION_ACTIONS.VIEW);
  const canEditPreArrival = hasCardPermission(PERMISSION_SUBMODULES.PRE_ARRIVAL, PERMISSION_ACTIONS.EDIT);
  const canEditArrival = hasCardPermission(PERMISSION_SUBMODULES.ARRIVAL, PERMISSION_ACTIONS.EDIT);
  const canEditDeparture = hasCardPermission(PERMISSION_SUBMODULES.DEPARTURE, PERMISSION_ACTIONS.EDIT);
  const canDeletePreArrivalTimeObject = hasCardPermission(PERMISSION_SUBMODULES.PRE_ARRIVAL, PERMISSION_ACTIONS.DELETE_NEW_TIME_OBJECT);
  const canDeleteArrivalTimeObject = hasCardPermission(PERMISSION_SUBMODULES.ARRIVAL, PERMISSION_ACTIONS.DELETE_NEW_TIME_OBJECT);
  const canDeleteDepartureTimeObject = hasCardPermission(PERMISSION_SUBMODULES.DEPARTURE, PERMISSION_ACTIONS.DELETE_NEW_TIME_OBJECT);
  const canAddPreArrivalTimeObject = hasCardPermission(PERMISSION_SUBMODULES.PRE_ARRIVAL, PERMISSION_ACTIONS.ADD_NEW_TIME_OBJECT);
  const canAddArrivalTimeObject = hasCardPermission(PERMISSION_SUBMODULES.ARRIVAL, PERMISSION_ACTIONS.ADD_NEW_TIME_OBJECT);
  const canAddDepartureTimeObject = hasCardPermission(PERMISSION_SUBMODULES.DEPARTURE, PERMISSION_ACTIONS.ADD_NEW_TIME_OBJECT);
  const canPreviewPreArrivalEmail = hasCardPermission(PERMISSION_SUBMODULES.PRE_ARRIVAL, PERMISSION_ACTIONS.PREVIEW_EMAIL);
  const canPreviewArrivalEmail = hasCardPermission(PERMISSION_SUBMODULES.ARRIVAL, PERMISSION_ACTIONS.PREVIEW_EMAIL);
  const canPreviewDepartureEmail = hasCardPermission(PERMISSION_SUBMODULES.DEPARTURE, PERMISSION_ACTIONS.PREVIEW_EMAIL);
  const canSendPreArrivalReport = hasCardPermission(PERMISSION_SUBMODULES.PRE_ARRIVAL, PERMISSION_ACTIONS.SEND_REPORT);
  const canSendArrivalReport = hasCardPermission(PERMISSION_SUBMODULES.ARRIVAL, PERMISSION_ACTIONS.SEND_REPORT);
  const canSendDepartureReport = hasCardPermission(PERMISSION_SUBMODULES.DEPARTURE, PERMISSION_ACTIONS.SEND_REPORT);

  const allowedOperationTabIds = useMemo(
    () =>
      [
        canViewPreArrivalTab && OPERATION_TABS.PRE_ARRIVAL,
        canViewCrewImmigrationTab && OPERATION_TABS.CREW_IMMIGRATION,
        canViewArrivalTab && OPERATION_TABS.ARRIVAL,
        canViewDepartureTab && OPERATION_TABS.DEPARTURE,
        canViewChecklistTab && OPERATION_TABS.CHECK_LIST,
      ].filter(Boolean),
    [canViewPreArrivalTab, canViewCrewImmigrationTab, canViewArrivalTab, canViewDepartureTab, canViewChecklistTab]
  );

  const [activeOperationTab, setActiveOperationTab] = useState(OPERATION_TABS.PRE_ARRIVAL);

  // KANBAN_CARD sub-tab permissions removed the active sub-tab — fall back to
  // the first sub-tab the user still has permission for.
  useEffect(() => {
    if (allowedOperationTabIds.length > 0 && !allowedOperationTabIds.includes(activeOperationTab)) {
      setActiveOperationTab(allowedOperationTabIds[0]);
    }
  }, [allowedOperationTabIds, activeOperationTab]);
  const [callDetailData, setCallDetailData] = useState(null);
  const [callDetailLoading, setCallDetailLoading] = useState(false);
  const [eventTypeFieldsByStage, setEventTypeFieldsByStage] = useState({
    2: [],
    3: [],
    4: [],
    5: [],
  });
  const lastEtaDependentRequestRef = useRef("");
  const cardColor = card?.color || "#2A00FF";

  const currentCallId = useMemo(
    () => card?.call_id ?? formValues?.call_id ?? card?.callId ?? "",
    [card?.call_id, card?.callId, formValues?.call_id]
  );
  const preArrivalPortId = useMemo(
    () =>
      callDetailData?.port_id ??
      callDetailData?.portId ??
      callDetailData?.port?.port_id ??
      formValues?.port_id ??
      formValues?.portId ??
      card?.port_id ??
      card?.portId ??
      "",
    [callDetailData, formValues?.port_id, formValues?.portId, card?.port_id, card?.portId]
  );
  const preArrivalCallTypeId = useMemo(
    () =>
      callDetailData?.call_type_id ??
      callDetailData?.callTypeId ??
      callDetailData?.call_type?.call_type_id ??
      formValues?.call_type_id ??
      formValues?.typeOfCall ??
      card?.call_type_id ??
      card?.typeOfCall ??
      "",
    [
      callDetailData,
      formValues?.call_type_id,
      formValues?.typeOfCall,
      card?.call_type_id,
      card?.typeOfCall,
    ]
  );
  const preArrivalVesselTypeId = useMemo(
    () =>
      callDetailData?.vessel_type_id ??
      callDetailData?.vesselTypeId ??
      callDetailData?.vessel?.vessel_type_id ??
      formValues?.vesselType ??
      formValues?.vessel_type_id ??
      card?.vessel_type_id ??
      "",
    [
      callDetailData,
      formValues?.vesselType,
      formValues?.vessel_type_id,
      card?.vessel_type_id,
    ]
  );

  const billingEntityId = useMemo(
    () =>
      callDetailData?.main_billing_entity_id ??
      callDetailData?.mainBillingEntity ??
      formValues?.mainBillingEntity ??
      formValues?.main_billing_entity_id ??
      card?.main_billing_entity_id ??
      card?.mainBillingEntity ??
      "",
    [
      callDetailData,
      formValues?.mainBillingEntity,
      formValues?.main_billing_entity_id,
      card?.main_billing_entity_id,
      card?.mainBillingEntity,
    ]
  );

  useEffect(() => {
    if (isAddMode || !currentCallId) {
      setCallDetailData(null);
      setCallDetailLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setCallDetailLoading(true);
      try {
        const { data } = await callFileService.getCallDetail(currentCallId);
        const detail = data?.data ?? data ?? null;
        if (!cancelled) {
          setCallDetailData(detail);
        }
      } catch (e) {
        if (!cancelled) setCallDetailData(null);
      } finally {
        if (!cancelled) setCallDetailLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAddMode, currentCallId]);

  useEffect(() => {
    let cancelled = false;

    if (!preArrivalPortId || !preArrivalCallTypeId) {
      setEventTypeFieldsByStage({ 2: [], 3: [], 4: [], 5: [] });
      return () => {
        cancelled = true;
      };
    }

    const loadEventTypeFields = async () => {
      try {
        const [stage2, stage3, stage4, stage5] = await Promise.all([
          stageTimeMappingService.getStageTimeObjects({
            stage_id: 2,
            port_id: preArrivalPortId,
            call_type_id: preArrivalCallTypeId,
            call_id: currentCallId,
          }),
          stageTimeMappingService.getStageTimeObjects({
            stage_id: 3,
            port_id: preArrivalPortId,
            call_type_id: preArrivalCallTypeId,
            call_id: currentCallId,
          }),
          stageTimeMappingService.getStageTimeObjects({
            stage_id: 4,
            port_id: preArrivalPortId,
            call_type_id: preArrivalCallTypeId,
            call_id: currentCallId,
          }),
          stageTimeMappingService.getStageTimeObjects({
            stage_id: 5,
            port_id: preArrivalPortId,
            call_type_id: preArrivalCallTypeId,
            call_id: currentCallId,
          }),
        ]);

        if (cancelled) return;

        setEventTypeFieldsByStage({
          2: mapEventFields(stage2?.data),
          3: mapEventFields(stage3?.data),
          4: mapEventFields(stage4?.data),
          5: mapEventFields(stage5?.data),
        });
      } catch (error) {
        if (!cancelled) {
          setEventTypeFieldsByStage({ 2: [], 3: [], 4: [], 5: [] });
        }
      }
    };

    loadEventTypeFields();

    return () => {
      cancelled = true;
    };
  }, [preArrivalPortId, preArrivalCallTypeId, currentCallId]);

  const preArrivalEventFields = eventTypeFieldsByStage[2] || [];
  const firstPreArrivalField = preArrivalEventFields[0];
  const etaDateKey = firstPreArrivalField ? `${firstPreArrivalField.keyPrefix}Date` : "";
  const etaTimeKey = firstPreArrivalField ? `${firstPreArrivalField.keyPrefix}Time` : "";
  const etaDateValue = etaDateKey ? formValues?.[etaDateKey] || "" : "";
  const etaTimeValue = etaTimeKey ? formValues?.[etaTimeKey] || "" : "";
  const { arrivalStageFields, postArrivalStageFields } = useMemo(() => {
    const arrivalStageFields = [...(eventTypeFieldsByStage[3] || [])].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );

    const postArrivalStageFields = [...(eventTypeFieldsByStage[4] || [])].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );

    return { arrivalStageFields, postArrivalStageFields };
  }, [eventTypeFieldsByStage]);
  const departureEventFields = eventTypeFieldsByStage[5] || [];
  const viewOnlyFormValues = isDAModule ? { ...formValues, ...getDummyValues() } : formValues;
  const isViewOnly = isDAModule;

  useEffect(() => {
    if (isViewOnly || !etaDateValue || !etaTimeValue) return;

    if (formValues.preArrivalEtaAutofillDisabled) return;

    if (!preArrivalPortId || !preArrivalCallTypeId) return;

    const eta_date_time = `${etaDateValue} ${etaTimeValue}:00`;
    const requestKey = `${eta_date_time}|2|${preArrivalPortId}|${preArrivalCallTypeId}`;
    if (lastEtaDependentRequestRef.current === requestKey) return;
    lastEtaDependentRequestRef.current = requestKey;

    let cancelled = false;
    const loadEtaDependentTimes = async () => {
      try {
        const response = await preArrivalInfoService.getEtaDependentTimes({
          eta_date_time,
          stage_id: 2,
          port_id: preArrivalPortId,
          call_type_id: preArrivalCallTypeId,
        });
        if (cancelled) return;

        const dependentEvents = response?.data?.data || [];
        dependentEvents.forEach((eventItem) => {
          const rawDateTime = String(
            eventItem?.value || eventItem?.event_datetime || eventItem?.event_date_time || ""
          ).trim();
          if (!rawDateTime) return;

          const normalizedDateTime = rawDateTime.replace("T", " ");
          const [datePart = "", timePart = ""] = normalizedDateTime.split(" ");
          const normalizedTime = timePart.slice(0, 5);
          if (!datePart || !normalizedTime) return;

          const matchedField = preArrivalEventFields.find((field) => {
            if (eventItem?.time_object_id != null && field?.event_type_id != null) {
              return Number(field.event_type_id) === Number(eventItem.time_object_id);
            }
            if (eventItem?.event_type_id != null && field?.event_type_id != null) {
              return Number(field.event_type_id) === Number(eventItem.event_type_id);
            }
            return (
              String(field?.event_name || "").trim().toLowerCase() ===
              String(eventItem?.event_name || "").trim().toLowerCase()
            );
          });

          const keyPrefix = matchedField?.keyPrefix || getEventFieldKeyPrefix(eventItem?.event_name || "");
          if (!keyPrefix) return;

          handleChange(`${keyPrefix}Date`)({ target: { value: datePart } });
          handleChange(`${keyPrefix}Time`)({ target: { value: normalizedTime } });
        });
      } catch (error) {
        if (cancelled) return;
      }
    };

    loadEtaDependentTimes();

    return () => {
      cancelled = true;
    };
  }, [
    isViewOnly,
    etaDateValue,
    etaTimeValue,
    formValues.preArrivalEtaAutofillDisabled,
    preArrivalEventFields,
    preArrivalPortId,
    preArrivalCallTypeId,
    handleChange,
  ]);

  const handleTabChange = useCallback((tab) => {
    setActiveOperationTab(tab);
  }, []);

  const handleSendReportRequest = useCallback(async (payload) => {
    try {
      await sendOperationReportRequest(payload);
      notify("Report sent successfully.", "success");
    } catch (err) {
      notify(err?.message || "Failed to send report.", "error");
    }
  }, []);

  const handleAddLink = useCallback(() => {
    // TODO: Implement link add logic
  }, []);

  const handleRemoveLink = useCallback((index) => {
    // TODO: Implement link remove logic
  }, []);

  return (
    <div className="operation-wrapper" style={{ "--card-color": cardColor }}>
      <div className="operation-content-container">
        <OperationTabs
          activeTab={activeOperationTab}
          onTabChange={handleTabChange}
          allowedTabIds={allowedOperationTabIds}
        />
        <div className="operation-right">
          {activeOperationTab === OPERATION_TABS.CREW_IMMIGRATION && (
            <CrewImmigrationDashboard
              card={card}
              formValues={viewOnlyFormValues}
              cardColor="#00368c"
            />
          )}
          {activeOperationTab === OPERATION_TABS.PRE_ARRIVAL && (
            <PreArrival
              card={card}
              formValues={viewOnlyFormValues}
              handleChange={handleChange}
              ownerInitial={ownerInitial}
              cardUser={card?.user}
              cardColor={cardColor}
              onAddLink={handleAddLink}
              onRemoveLink={handleRemoveLink}
              eventFields={preArrivalEventFields}
              portId={preArrivalPortId}
              callTypeId={preArrivalCallTypeId}
              vesselTypeId={preArrivalVesselTypeId}
              billingEntityId={billingEntityId}
              stageId={OPERATION_STAGE_IDS.PRE_ARRIVAL}
              isViewOnly={isViewOnly || !canEditPreArrival}
              canAddTimeObject={canAddPreArrivalTimeObject}
              canDeleteTimeObject={canDeletePreArrivalTimeObject}
              canPreviewEmail={canPreviewPreArrivalEmail}
              canSendReport={canSendPreArrivalReport}
            />
          )}
          {activeOperationTab === OPERATION_TABS.ARRIVAL && (
            <Arrival
              formValues={viewOnlyFormValues}
              handleChange={handleChange}
              cardColor={cardColor}
              onAddLink={handleAddLink}
              onRemoveLink={handleRemoveLink}
              onSendReport={handleSendReportRequest}
              isViewOnly={isViewOnly || !canEditArrival}
              arrivalStageFields={arrivalStageFields}
              postArrivalStageFields={postArrivalStageFields}
              callId={currentCallId}
              portId={preArrivalPortId}
              callTypeId={preArrivalCallTypeId}
              billingEntityId={billingEntityId}
              stageId={OPERATION_STAGE_IDS.ARRIVAL}
              exportApprovalStatus={callDetailData?.export_approval_status}
              canAddTimeObject={canAddArrivalTimeObject}
              canDeleteTimeObject={canDeleteArrivalTimeObject}
              canPreviewEmail={canPreviewArrivalEmail}
              canSendReport={canSendArrivalReport}
            />
          )}
          {activeOperationTab === OPERATION_TABS.DEPARTURE && (
            <Departure
              formValues={viewOnlyFormValues}
              handleChange={handleChange}
              cardColor={cardColor}
              onAddLink={handleAddLink}
              onRemoveLink={handleRemoveLink}
              onSendReport={handleSendReportRequest}
              isViewOnly={isViewOnly || !canEditDeparture}
              eventFields={departureEventFields}
              callId={currentCallId}
              portId={preArrivalPortId}
              callTypeId={preArrivalCallTypeId}
              billingEntityId={billingEntityId}
              stageId={OPERATION_STAGE_IDS.DEPARTURE}
              canAddTimeObject={canAddDepartureTimeObject}
              canDeleteTimeObject={canDeleteDepartureTimeObject}
              canPreviewEmail={canPreviewDepartureEmail}
              canSendReport={canSendDepartureReport}
            />
          )}
          {activeOperationTab === OPERATION_TABS.CHECK_LIST && (
            <CheckListTab
              card={card}
              formValues={viewOnlyFormValues}
              handleChange={handleChange}
              cardColor={cardColor}
              isViewOnly={isViewOnly}
              isDAModule={isDAModule}
              cardDetail={callDetailData}
              callDetailLoading={callDetailLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}

Operation.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  ownerInitial: PropTypes.string.isRequired,
  isDAModule: PropTypes.bool,
  isAddMode: PropTypes.bool,
};

export default Operation;
