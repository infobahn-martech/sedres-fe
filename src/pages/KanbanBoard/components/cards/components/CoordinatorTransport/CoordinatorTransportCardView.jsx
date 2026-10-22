import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { format, isValid, parseISO } from "date-fns";
import {
  FiAnchor,
  FiBriefcase,
  FiCheck,
  FiEye,
  FiHome,
  FiLayers,
  FiMail,
  FiNavigation,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import { notify } from "../../../../../../components/Toaster";
import useCoordinatorTransportReducer from "../../../../../../store/CoordinatorTransportReducer";
import { buildPickupDateTime } from "../../../../../../store/TransportContent";
import { splitApiDateTimeParts } from "../../../../../../shared/helpers/dateTimeFieldUtils";
import {
  FormGroup,
  FormField,
  FormSelect,
  FieldRow,
  ReactQuillEditor,
  CrewAvatar,
} from "../../../../CardFormTabs/Import/tabs/husbandry/components/Husbandry.components";
import {
  CREW_MANAGEMENT_SUBTABS,
  SERVICE_ACCENT,
  TRANSPORT_ROUTE_LOCATION_OPTIONS,
} from "../../../../CardFormTabs/Import/tabs/husbandry/components/Husbandry.constants";
import CrewSelectionField from "../../../../CardFormTabs/Import/tabs/husbandry/components/CrewSelectionField";
import LocationAutocomplete from "../../../../CardFormTabs/Import/tabs/husbandry/components/LocationAutocomplete";
import DateTimePickerField from "../../../../CardFormTabs/shared/components/DateTimePickerField";
import AttachmentsList from "../../../../CardFormTabs/Import/tabs/appointment/AttachmentsList";
import HusbandryServiceRequestsTable from "../../../../CardFormTabs/Import/tabs/husbandry/components/HusbandryServiceRequestsTable";
import "./CoordinatorTransportCardView.scss";

const TRANSPORT_ACCENT = SERVICE_ACCENT[CREW_MANAGEMENT_SUBTABS.TRANSPORT];
const EMPTY_DISPLAY = "—";
const TABLE_PAGE_SIZE = 10;

const EMPTY_TRANSPORT_FORM = {
  requestEmail: [],
  selectedCrew: [],
  providerType: "inhouse",
  vehicleTypeId: "",
  inhouseDriverId: "",
  transportCompanyId: "",
  pickupDate: "",
  pickupTime: "",
  fromType: "",
  fromLocation: "",
  toType: "",
  toLocation: "",
  invoiceBranch: "",
  documents: [],
  remarks: "",
};

const STATUS_TONE_MAP = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  completed: "completed",
  assigned: "assigned",
  cancelled: "cancelled",
  canceled: "cancelled",
};

const resolveCallId = (cardData) =>
  cardData?.call_id ?? cardData?.callId ?? cardData?.card_call_id ?? cardData?.id ?? null;

const resolveTransportRequestId = (cardData) =>
  cardData?.transport_request_id ??
  cardData?.transportRequestId ??
  cardData?.raw?.transport_request_id ??
  null;

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = typeof value === "string" ? value.trim() : String(value);
    if (text !== "") return text;
  }
  return EMPTY_DISPLAY;
};

// get_call_detail may return these as plain labels or as { name } objects.
const toDisplayLabel = (value) =>
  value && typeof value === "object" ? value.name ?? value.label ?? null : value;

const fileToAttachment = (file) => ({
  name: file.name,
  file,
  size: file.size,
  type: file.type,
});

const flattenTransportRequestRows = (requests) => {
  if (!Array.isArray(requests)) return [];

  return requests.flatMap((request, requestIndex) => {
    const crew = Array.isArray(request?.crew) ? request.crew : [];
    const base = {
      transport_request_id: request?.transport_request_id ?? request?.id,
      wo_id: request?.wo_id ?? request?.wo_number,
      from_location: request?.from_location,
      from_location_det: request?.from_location_det,
      to_location: request?.to_location,
      to_location_det: request?.to_location_det,
      pickup_datetime: request?.pickup_datetime,
      request_email: request?.request_email,
      request_email_url: request?.request_email_url,
      request_type: request?.request_type,
      transport_company: request?.transport_company,
      inhouse_driver_name: request?.inhouse_driver_name,
      third_party_driver_name: request?.third_party_driver_name,
      third_party_driver_contact: request?.third_party_driver_contact,
      remarks: request?.remarks,
      status: request?.status,
    };

    if (crew.length === 0) {
      return [
        {
          ...base,
          id: base.transport_request_id ?? `request-${requestIndex}`,
          crew_name: base.inhouse_driver_name || base.third_party_driver_name || EMPTY_DISPLAY,
          crew_change_id: null,
        },
      ];
    }

    return crew.map((member, crewIndex) => ({
      ...base,
      id: member?.crew_change_id ?? `${base.transport_request_id ?? requestIndex}-${crewIndex}`,
      crew_name: member?.crew_name ?? member?.crewName,
      crew_change_id: member?.crew_change_id,
      status: member?.pickup_status ?? member?.status ?? base.status,
    }));
  });
};

const parsePickupDateTime = (value) => {
  if (!value) return null;
  const parsed = parseISO(String(value).replace(" ", "T"));
  return isValid(parsed) ? parsed : null;
};

const renderPickupDateTime = (value) => {
  const parsed = parsePickupDateTime(value);
  if (!parsed) return <span className="coordinator-transport-table__empty-cell">{EMPTY_DISPLAY}</span>;
  return (
    <span className="coordinator-transport-datetime">
      <span className="coordinator-transport-datetime__date">{format(parsed, "dd MMM yyyy")}</span>
      <span className="coordinator-transport-datetime__time">{format(parsed, "HH:mm")}</span>
    </span>
  );
};

// Stable palette per name, so the same crew member keeps the same avatar color across pages.
const getAvatarIndex = (name) =>
  [...String(name)].reduce((sum, char) => sum + char.charCodeAt(0), 0);

const renderCrewCell = (name) => {
  if (!name || !String(name).trim()) {
    return <span className="coordinator-transport-table__empty-cell">{EMPTY_DISPLAY}</span>;
  }
  return (
    <span className="husb-crew-cell">
      <CrewAvatar name={name} index={getAvatarIndex(name)} />
      <span className="husb-crew-cell__name" title={name}>{name}</span>
    </span>
  );
};

const renderStatusBadge = (status) => {
  const raw = String(status ?? "").trim();
  if (!raw) return <span className="coordinator-transport-table__empty-cell">{EMPTY_DISPLAY}</span>;
  const tone = STATUS_TONE_MAP[raw.toLowerCase()] || "default";
  return (
    <span className={`coordinator-transport-status-badge coordinator-transport-status-badge--${tone}`}>
      {raw}
    </span>
  );
};

const COORDINATOR_TRANSPORT_REQUEST_COLUMNS = [
  { key: "crew_name", header: "Crew", render: (r) => renderCrewCell(r?.crew_name) },
  {
    key: "route",
    header: "Route",
    type: "route",
    fromAccessor: (r) => r?.from_location_det || r?.from_location,
    toAccessor: (r) => r?.to_location_det || r?.to_location,
  },
  {
    key: "status",
    header: "Status",
    render: (r) => renderStatusBadge(r?.status),
  },
  {
    key: "requested",
    header: "Requested",
    render: (r) => renderPickupDateTime(r?.pickup_datetime),
  },
  {
    key: "document",
    header: "Document",
    render: (r) =>
      r?.request_email_url ? (
        <button
          type="button"
          className="crew-pass-requests-table__doc-btn"
          onClick={() => window.open(r.request_email_url, "_blank", "noopener,noreferrer")}
          aria-label="View document"
        >
          <FiEye size={15} />
        </button>
      ) : (
        <span className="coordinator-transport-table__empty-cell">{EMPTY_DISPLAY}</span>
      ),
  },
];

const CoordinatorTransportSummaryCard = ({ icon, label, value }) => (
  <div className="coordinator-transport-summary-card">
    <span className="coordinator-transport-summary-icon">
      {icon}
    </span>
    <div className="coordinator-transport-summary-text">
      <div className="coordinator-transport-summary-label">{label}</div>
      <div className="coordinator-transport-summary-value" title={value}>
        {value}
      </div>
    </div>
  </div>
);

CoordinatorTransportSummaryCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

const CoordinatorTransportCardView = ({ cardData, cardColor }) => {
  const documentsInputRef = useRef(null);

  const callId = useMemo(() => resolveCallId(cardData), [cardData]);
  const transportRequestId = useMemo(() => resolveTransportRequestId(cardData), [cardData]);

  const {
    callDetails,
    transportRequests,
    loadingTransportRequests,
    transportCompanies,
    loadingCompanies,
    vehicleTypes,
    loadingVehicleTypes,
    inhouseDrivers,
    loadingInhouseDrivers,
    invoiceBranches,
    loadingInvoiceBranches,
    isSavingTransport,
    fetchCallDetails,
    fetchTransportRequests,
    fetchTransportCompanies,
    fetchVehicleTypes,
    fetchInhouseDrivers,
    fetchInvoiceBranches,
    createTransportRequest,
    updateTransportRequestDetail,
  } = useCoordinatorTransportReducer();

  const [transportForm, setTransportForm] = useState(EMPTY_TRANSPORT_FORM);
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  // Set once a save is blocked by a missing pickup date/time, so the field is
  // only highlighted after the user has tried to submit.
  const [pickupSubmitAttempted, setPickupSubmitAttempted] = useState(false);

  const updateTransportField = useCallback((field, value) => {
    setTransportForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }, []);

  useEffect(() => {
    fetchCallDetails(callId);
  }, [callId, fetchCallDetails]);

  const refreshTransportRequests = useCallback(
    () => fetchTransportRequests(callId),
    [callId, fetchTransportRequests]
  );

  useEffect(() => {
    void refreshTransportRequests();
  }, [refreshTransportRequests]);

  useEffect(() => {
    if (!transportRequestId) return;
    const detail = transportRequests.find(
      (r) => String(r?.transport_request_id ?? "") === String(transportRequestId)
    );
    if (!detail) return;

    const hasPickupDateTime =
      detail.pickup_datetime && !String(detail.pickup_datetime).startsWith("0000-00-00");
    const { date: pickupDate, time: pickupTime } = splitApiDateTimeParts(
      hasPickupDateTime ? detail.pickup_datetime : ""
    );
    const crewIds = Array.isArray(detail.crew)
      ? detail.crew.map((c) => String(c?.crew_change_id ?? c?.id ?? "")).filter(Boolean)
      : [];
    const attachmentRows = Array.isArray(detail.attachments) ? detail.attachments : [];

    setTransportForm((previous) => ({
      ...previous,
      providerType: detail.request_type === "Third Party" ? "thirdparty" : "inhouse",
      pickupDate: pickupDate || previous.pickupDate,
      pickupTime: pickupTime || previous.pickupTime,
      fromType: detail.from_location || previous.fromType,
      fromLocation: detail.from_location_det || previous.fromLocation,
      toType: detail.to_location || previous.toType,
      toLocation: detail.to_location_det || previous.toLocation,
      remarks: detail.remarks || previous.remarks,
      selectedCrew: crewIds.length > 0 ? crewIds : previous.selectedCrew,
      vehicleTypeId: detail.vehicle_id != null ? String(detail.vehicle_id) : previous.vehicleTypeId,
      inhouseDriverId: detail.driver_id != null ? String(detail.driver_id) : previous.inhouseDriverId,
      invoiceBranch: detail.invoice_branch || previous.invoiceBranch,
      transportCompanyId:
        detail.transport_company_id != null
          ? String(detail.transport_company_id)
          : previous.transportCompanyId,
      requestEmail: detail.request_email_url
        ? [{ name: detail.request_email || "Request email", url: detail.request_email_url }]
        : previous.requestEmail,
      documents: attachmentRows.map((a) => ({
        name: a?.file_name ?? a?.name ?? "Attachment",
        url: a?.file_url ?? a?.url ?? "",
      })),
    }));
  }, [transportRequestId, transportRequests]);

  useEffect(() => {
    fetchTransportCompanies();
  }, [fetchTransportCompanies]);

  useEffect(() => {
    fetchVehicleTypes();
  }, [fetchVehicleTypes]);

  useEffect(() => {
    fetchInvoiceBranches();
  }, [fetchInvoiceBranches]);

  useEffect(() => {
    fetchInhouseDrivers(transportForm.vehicleTypeId);
  }, [transportForm.vehicleTypeId, fetchInhouseDrivers]);

  const callTypeSummary = firstNonEmpty(callDetails?.call_type, callDetails?.call_type_name, cardData?.typeOfCall);
  const billingEntitySummary = firstNonEmpty(toDisplayLabel(callDetails?.main_billing_entity));
  const portFromDetail =
    typeof callDetails?.port === "string"
      ? callDetails.port
      : callDetails?.port?.label || callDetails?.port?.name || "";
  const portSummary = firstNonEmpty(callDetails?.port_name, portFromDetail);
  const vesselNameSummary = firstNonEmpty(callDetails?.vessel_name, cardData?.vesselName);
  const requestedOperatorSummary = firstNonEmpty(callDetails?.assigned_operator_name);

  const handleProviderChange = useCallback((next) => {
    setTransportForm((previous) => ({
      ...previous,
      providerType: next,
      vehicleTypeId: next === "inhouse" ? previous.vehicleTypeId : "",
      inhouseDriverId: next === "inhouse" ? previous.inhouseDriverId : "",
      invoiceBranch: next === "inhouse" ? previous.invoiceBranch : "",
      transportCompanyId: next === "thirdparty" ? previous.transportCompanyId : "",
    }));
  }, []);

  const handleVehicleTypeChange = useCallback((vehicleTypeId) => {
    setTransportForm((previous) => ({
      ...previous,
      vehicleTypeId,
      inhouseDriverId: "",
    }));
  }, []);

  const handleDocumentsDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(true);
  };
  const handleDocumentsDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(false);
  };
  const handleDocumentsDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDocumentsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(false);
    const raw = Array.from(e.dataTransfer.files || []);
    if (raw.length === 0) return;
    updateTransportField("documents", [...transportForm.documents, ...raw.map(fileToAttachment)]);
  };
  const handleDocumentsFileInputChange = (e) => {
    const raw = Array.from(e.target.files || []);
    if (raw.length > 0) {
      updateTransportField("documents", [...transportForm.documents, ...raw.map(fileToAttachment)]);
    }
    if (documentsInputRef.current) documentsInputRef.current.value = "";
  };
  const handleDocumentsRemoveAttachment = (index) =>
    updateTransportField("documents", transportForm.documents.filter((_, i) => i !== index));

  const resetForm = useCallback(() => {
    setTransportForm(EMPTY_TRANSPORT_FORM);
  }, []);

  const handleSave = useCallback(async () => {
    if (!callId) {
      notify("Call is required to save a transport request.", "error", "top-center");
      return;
    }
    if (!callDetails?.call_type_id) {
      notify("Call type id is missing. Please reload call details.", "warning", "top-center");
      return;
    }
    if (!transportForm.pickupDate || !transportForm.pickupTime) {
      setPickupSubmitAttempted(true);
      notify("Pickup date and time are required.", "error", "top-center");
      return;
    }
    setPickupSubmitAttempted(false);
    if (transportForm.providerType === "inhouse") {
      if (!transportForm.vehicleTypeId) {
        notify("Vehicle type is required.", "error", "top-center");
        return;
      }
      if (!transportForm.inhouseDriverId) {
        notify("Inhouse driver is required.", "error", "top-center");
        return;
      }
      if (!transportForm.invoiceBranch) {
        notify("Invoice branch is required.", "error", "top-center");
        return;
      }
    } else {
      if (!transportForm.transportCompanyId) {
        notify("Transport company is required.", "error", "top-center");
        return;
      }
    }

    // Existing card already has a linked transport request: confirm/update
    // its driver/company, pickup time, invoice branch, remarks & attachments.
    if (transportRequestId) {
      const updatePayload = {
        transport_request_id: Number(transportRequestId),
        request_type: transportForm.providerType === "thirdparty" ? "Third Party" : "Inhouse",
        pickup_datetime: buildPickupDateTime(transportForm.pickupDate, transportForm.pickupTime),
        remarks: transportForm.remarks || "",
      };

      if (transportForm.providerType === "inhouse") {
        updatePayload.driver_id = Number(transportForm.inhouseDriverId || "");
        updatePayload.invoice_branch = transportForm.invoiceBranch || "";
      } else {
        updatePayload.transport_company_id = Number(transportForm.transportCompanyId || "");
      }

      const updateFormData = new FormData();
      updateFormData.append("data", JSON.stringify(updatePayload));

      transportForm.documents.forEach((attachment) => {
        const file = attachment?.file ?? attachment;
        if (file instanceof File) {
          updateFormData.append("attachments[]", file);
        }
      });

      try {
        const response = await updateTransportRequestDetail(updateFormData);
        notify(response?.data?.message || "Transport request updated successfully", "success", "top-center");
        await refreshTransportRequests();
      } catch (error) {
        notify(error?.response?.data?.message || "Failed to update transport request", "error", "top-center");
      }
      return;
    }

    if (transportForm.selectedCrew.length === 0) {
      notify("Please select at least one crew member.", "error", "top-center");
      return;
    }
    if (!transportForm.fromType) {
      notify("From type is required.", "error", "top-center");
      return;
    }
    if (!transportForm.fromLocation) {
      notify("From location is required.", "error", "top-center");
      return;
    }
    if (!transportForm.toType) {
      notify("To type is required.", "error", "top-center");
      return;
    }
    if (!transportForm.toLocation) {
      notify("To location is required.", "error", "top-center");
      return;
    }

    const payload = {
      call_id: Number(callId),
      request_type: transportForm.providerType === "thirdparty" ? "Third Party" : "Inhouse",
      pickup_datetime: buildPickupDateTime(transportForm.pickupDate, transportForm.pickupTime),
      from_location: transportForm.fromType || "",
      from_location_det: transportForm.fromLocation || "",
      to_location: transportForm.toType || "",
      to_location_det: transportForm.toLocation || "",
      remarks: transportForm.remarks || "",
      crew: transportForm.selectedCrew.map((id) => ({ crew_change_id: Number(id) })),
    };

    if (transportForm.providerType === "inhouse") {
      payload.vehicle_id = Number(transportForm.vehicleTypeId || "");
      payload.driver_id = Number(transportForm.inhouseDriverId || "");
      payload.invoice_branch = transportForm.invoiceBranch || "";
    } else {
      payload.transport_company_id = Number(transportForm.transportCompanyId || "");
    }

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    transportForm.documents.forEach((attachment, index) => {
      const file = attachment?.file ?? attachment;
      if (file instanceof File) {
        formData.append(`documents[${index}]`, file);
      }
    });

    try {
      const response = await createTransportRequest(formData);
      notify(response?.data?.message || "Transport request created successfully", "success", "top-center");
      resetForm();
      await refreshTransportRequests();
    } catch (error) {
      notify(error?.response?.data?.message || "Failed to create transport request", "error", "top-center");
    }
  }, [
    callId,
    callDetails,
    transportForm,
    transportRequestId,
    createTransportRequest,
    updateTransportRequestDetail,
    refreshTransportRequests,
    resetForm,
  ]);

  const companyOptions = useMemo(
    () =>
      transportCompanies.map((c) => ({
        value: String(c?.transport_company_id ?? ""),
        label: c?.transport_company ?? "",
      })),
    [transportCompanies]
  );

  const vehicleTypeOptions = useMemo(
    () =>
      vehicleTypes.map((v) => ({
        value: String(v?.vehicle_type_id ?? ""),
        label: v?.vehicle_name ?? "",
      })),
    [vehicleTypes]
  );

  const invoiceBranchOptions = useMemo(
    () =>
      invoiceBranches.map((b) => ({
        value: b?.branch_name ?? "",
        label: b?.branch_name ?? "",
      })),
    [invoiceBranches]
  );

  const inhouseDriverOptions = useMemo(
    () =>
      inhouseDrivers.map((d) => ({
        value: String(d?.driver_id ?? ""),
        label: d?.driver_name ?? "",
      })),
    [inhouseDrivers]
  );

  const transportRequestRows = useMemo(
    () => flattenTransportRequestRows(transportRequests),
    [transportRequests]
  );

  return (
    <div className="coordinator-transport-card-view" style={{ "--card-color": cardColor }}>
      <div className="coordinator-transport-content">
        <div className="coordinator-transport-summary">
          <CoordinatorTransportSummaryCard icon={<FiLayers size={16} />} label="Call Type" value={callTypeSummary} />
          <CoordinatorTransportSummaryCard icon={<FiBriefcase size={16} />} label="Billing Entity" value={billingEntitySummary} />
          <CoordinatorTransportSummaryCard icon={<FiAnchor size={16} />} label="Port" value={portSummary} />
          <CoordinatorTransportSummaryCard icon={<FiNavigation size={16} />} label="Vessel Name" value={vesselNameSummary} />
          <CoordinatorTransportSummaryCard icon={<FiUser size={16} />} label="Requested Operator" value={requestedOperatorSummary} />
        </div>

        <div className={`coordinator-transport-workspace husb-accent-${TRANSPORT_ACCENT}`}>
          <section className={`coordinator-transport-form-card husb-accent-${TRANSPORT_ACCENT}`}>
            <div className="coordinator-transport-form-header">
              <span className="coordinator-transport-form-header-icon">
                <FiTruck size={18} />
              </span>
              <div>
                <h3 className="coordinator-transport-form-title">New transport request</h3>
                <p className="coordinator-transport-form-subtitle">Book a vehicle for crew movement</p>
              </div>
            </div>

            <div className="coordinator-transport-form-body crew-pass-thin-scrollbar">
              <div className="coordinator-transport-form-section">
                <FormGroup icon="mail" label="Request Email" accent={TRANSPORT_ACCENT}>
                  <FormField>
                    <div className="coordinator-transport-request-email-view">
                      {transportForm.requestEmail?.[0] ? (
                        <div className="coordinator-transport-request-email-view__file">
                          <span className="coordinator-transport-request-email-view__icon">
                            <FiMail size={15} />
                          </span>
                          <span className="coordinator-transport-request-email-view__name">
                            {transportForm.requestEmail[0].name}
                          </span>
                          {transportForm.requestEmail[0].url ? (
                            <button
                              type="button"
                              className="crew-pass-requests-table__doc-btn"
                              onClick={() =>
                                window.open(transportForm.requestEmail[0].url, "_blank", "noopener,noreferrer")
                              }
                              aria-label="View request email"
                            >
                              <FiEye size={15} />
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="coordinator-transport-request-email-view__empty">
                          <FiMail size={16} />
                          <span>No request email attached</span>
                        </div>
                      )}
                    </div>
                  </FormField>
                </FormGroup>
              </div>

              <div className="coordinator-transport-form-section">
                <CrewSelectionField
                  callId={callId}
                  selected={transportForm.selectedCrew}
                  onChange={(ids) => updateTransportField("selectedCrew", ids)}
                  accent={TRANSPORT_ACCENT}
                />
              </div>

              <div className="coordinator-transport-form-section">
                <FormGroup icon="transport" label="Provider" accent={TRANSPORT_ACCENT}>
                  <FormField>
                    <div className="coordinator-transport-provider-toggle">
                      <button
                        type="button"
                        className={`coordinator-transport-provider-option${
                          transportForm.providerType === "inhouse" ? " is-active" : ""
                        }`}
                        onClick={() => handleProviderChange("inhouse")}
                      >
                        <FiHome size={14} />
                        In house
                      </button>
                      <button
                        type="button"
                        className={`coordinator-transport-provider-option${
                          transportForm.providerType === "thirdparty" ? " is-active" : ""
                        }`}
                        onClick={() => handleProviderChange("thirdparty")}
                      >
                        <FiTruck size={14} />
                        Third party
                      </button>
                    </div>
                  </FormField>
                </FormGroup>

                {transportForm.providerType === "inhouse" ? (
                  <FieldRow>
                    <FormField label="Vehicle Type">
                      <FormSelect
                        value={transportForm.vehicleTypeId}
                        onChange={(e) => handleVehicleTypeChange(e.target.value)}
                        options={vehicleTypeOptions}
                        placeholder={loadingVehicleTypes ? "Loading..." : "Select vehicle type..."}
                        disabled={loadingVehicleTypes}
                      />
                    </FormField>
                    <FormField label="Inhouse Driver">
                      <FormSelect
                        value={transportForm.inhouseDriverId}
                        onChange={(e) => updateTransportField("inhouseDriverId", e.target.value)}
                        options={inhouseDriverOptions}
                        placeholder={
                          !transportForm.vehicleTypeId
                            ? "Select vehicle type first"
                            : loadingInhouseDrivers
                              ? "Loading drivers..."
                              : "Select driver..."
                        }
                        disabled={!transportForm.vehicleTypeId || loadingInhouseDrivers}
                      />
                    </FormField>
                    <FormField label="Invoice Branch" className="cf-field-full">
                      <FormSelect
                        value={transportForm.invoiceBranch}
                        onChange={(e) => updateTransportField("invoiceBranch", e.target.value)}
                        options={invoiceBranchOptions}
                        placeholder={loadingInvoiceBranches ? "Loading..." : "Select branch..."}
                        disabled={loadingInvoiceBranches}
                      />
                    </FormField>
                  </FieldRow>
                ) : (
                  <FieldRow>
                    <FormField label="Transport Company" className="cf-field-full">
                      <FormSelect
                        value={transportForm.transportCompanyId}
                        onChange={(e) => updateTransportField("transportCompanyId", e.target.value)}
                        options={companyOptions}
                        placeholder={loadingCompanies ? "Loading..." : "Select company..."}
                        disabled={loadingCompanies}
                      />
                    </FormField>
                  </FieldRow>
                )}
              </div>

              <div className="coordinator-transport-form-section coordinator-transport-form-section--route">
                <FormGroup icon="calendar" label="Pickup Date Time*" accent={TRANSPORT_ACCENT}>
                  <FormField>
                    <DateTimePickerField
                      dateValue={transportForm.pickupDate}
                      timeValue={transportForm.pickupTime}
                      hasError={
                        pickupSubmitAttempted && (!transportForm.pickupDate || !transportForm.pickupTime)
                      }
                      onDateChange={(e) => updateTransportField("pickupDate", e.target.value)}
                      onTimeChange={(e) => updateTransportField("pickupTime", e.target.value)}
                    />
                  </FormField>
                </FormGroup>

                <FieldRow>
                  <FormField label="From">
                    <FormSelect
                      value={transportForm.fromType}
                      onChange={(e) => updateTransportField("fromType", e.target.value)}
                      options={TRANSPORT_ROUTE_LOCATION_OPTIONS}
                      placeholder="Select location type"
                    />
                    <LocationAutocomplete
                      value={transportForm.fromLocation}
                      onChange={(e) => updateTransportField("fromLocation", e.target.value)}
                      placeholder="Enter pickup location"
                    />
                  </FormField>
                  <FormField label="To">
                    <FormSelect
                      value={transportForm.toType}
                      onChange={(e) => updateTransportField("toType", e.target.value)}
                      options={TRANSPORT_ROUTE_LOCATION_OPTIONS}
                      placeholder="Select location type"
                    />
                    <LocationAutocomplete
                      value={transportForm.toLocation}
                      onChange={(e) => updateTransportField("toLocation", e.target.value)}
                      placeholder="Enter drop-off location"
                    />
                  </FormField>
                </FieldRow>
              </div>

              <div className="coordinator-transport-form-section">
                <FormGroup icon="folder" label="Documents" accent={TRANSPORT_ACCENT}>
                  <FormField className="cf-field-full">
                    <div className="coordinator-transport-documents-upload">
                      <AttachmentsList
                        attachments={transportForm.documents}
                        onAdd={() => {}}
                        onRemove={handleDocumentsRemoveAttachment}
                        cardColor={cardColor}
                        isDragging={isDraggingDocuments}
                        onDragEnter={handleDocumentsDragEnter}
                        onDragLeave={handleDocumentsDragLeave}
                        onDragOver={handleDocumentsDragOver}
                        onDrop={handleDocumentsDrop}
                        fileInputRef={documentsInputRef}
                        onFileInputChange={handleDocumentsFileInputChange}
                        helperText="Drag files or click to browse"
                        multiple
                      />
                    </div>
                  </FormField>
                </FormGroup>
              </div>

              <div className="coordinator-transport-form-section">
                <FormGroup icon="notebook" label="Remarks" accent={TRANSPORT_ACCENT}>
                  <FormField>
                    <ReactQuillEditor
                      value={transportForm.remarks}
                      onChange={(e) => updateTransportField("remarks", e.target.value)}
                      placeholder="Enter remarks..."
                      name="remarks"
                    />
                  </FormField>
                </FormGroup>
              </div>
            </div>

            <div className="coordinator-transport-form-footer">
              <button
                type="button"
                className="form-save-button coordinator-transport-save-button"
                onClick={handleSave}
                disabled={isSavingTransport}
              >
                {!isSavingTransport && <FiCheck size={15} />}
                {isSavingTransport ? "Saving..." : "Save request"}
              </button>
            </div>
          </section>

          <section className="coordinator-transport-table-card">
            <HusbandryServiceRequestsTable
              title="Transport requests"
              subtitle="All bookings for this job"
              icon="list"
              requests={transportRequestRows}
              loading={loadingTransportRequests}
              columns={COORDINATOR_TRANSPORT_REQUEST_COLUMNS}
              emptyMessage="No transport requests found"
              serviceType="transport"
              pageSize={TABLE_PAGE_SIZE}
              accent={TRANSPORT_ACCENT}
            />
          </section>
        </div>
      </div>
    </div>
  );
};

CoordinatorTransportCardView.propTypes = {
  cardData: PropTypes.object,
  cardColor: PropTypes.string,
};

export default CoordinatorTransportCardView;
