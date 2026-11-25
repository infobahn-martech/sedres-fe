  import { useState, useEffect, useCallback, useMemo, useRef } from "react";
  import PropTypes from "prop-types";
  import GroupSettingsIcon from "@/assets/images/cv.png";
  import { notify } from "@/components/Toaster";
  import { FormSection, FormField, FormSelect, ReactQuillEditor, FormGroup, FieldRow, PremiumCardHeader } from "./Husbandry.components";
import { getApiMessage } from "./apiMessage";
  import { CREW_MANAGEMENT_SUBTABS, SERVICE_ACCENT, TRANSPORT_ROUTE_LOCATION_OPTIONS, LAUNCH_HIRE_LOCATION_OPTIONS } from "./Husbandry.constants";
  import AttachmentsList from "../../appointment/AttachmentsList";
  import { useCallDetail } from "@/pages/KanbanBoard/CardFormTabs/shared/callDetailContext";
  import transportContentService from "@/services/transportContentService";
  import { buildPickupDateTime } from "@/store/TransportContent";
  import CrewPassRequestsTable from "./CrewPassRequestsTable";
  import CrewSelectionField from "./CrewSelectionField";
  import { manualCrewIdsField, manualCrewIdsFromChange, buildCrewPayloadList } from "./crewPayloadIds";
  import { useRequestEmailCrewValidation } from "./useRequestEmailCrewValidation";
  import { useServiceLineItemsModal } from "./useServiceLineItemsModal";
  import LocationAutocomplete from "./LocationAutocomplete";
  import DateTimePickerField from "@/pages/KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";

  // Helper functions to extract and flatten transport requests from API response
  const extractTransportRequestsFromEnvelope = (response) => {
    const payload = response?.data ?? response;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const isBlankValue = (value) => value === undefined || value === null || String(value).trim() === "";

  const formatPickup = (value) => {
    if (isBlankValue(value)) return "";
    const parsed = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // One card per transport request (same card list as CG / Zawil pass), crew listed inside.
  const buildTransportRequestGroups = (requests) =>
    (Array.isArray(requests) ? requests : []).map((request, index) => ({
      woId: request.transport_request_id ?? request.wo_id ?? `transport-${index}`,
      woNumber: "",
      woStatus: request.status,
      from: request.from_location || request.from_location_det || "",
      to: request.to_location || request.to_location_det || "",
      pickupDatetime: request.pickup_datetime,
      driver: request.inhouse_driver_name || request.third_party_driver_name || "",
      transportCompany: request.transport_company || "",
      requestEmailUrl: request.request_email || "",
      crew: (Array.isArray(request.crew) ? request.crew : []).map((member, crewIndex) => ({
        ...member,
        id: member.crew_change_id ?? `${request.transport_request_id ?? index}-${crewIndex}`,
        status: member.pickup_status,
      })),
    }));

  const renderTransportRoute = (group) => (
    <span className="cpr-route" title={`${group.from || "—"} → ${group.to || "—"}`}>
      <span>{group.from || "Not set"}</span>
      <span className="cpr-route__arrow" aria-hidden="true">→</span>
      <span>{group.to || "Not set"}</span>
    </span>
  );

  const getTransportFacts = (group) => {
    const facts = [group.pickupDatetime ? `Pickup ${formatPickup(group.pickupDatetime)}` : "Pickup time not set"];
    if (group.driver) facts.push(`Driver: ${group.driver}`);
    if (group.transportCompany) facts.push(`Company: ${group.transportCompany}`);
    return facts;
  };

  // Rank moves into the details columns, so no second line under the name.
  const getTransportCrewMeta = () => null;

  const getTransportCrewDetails = (row) => [
    { label: "Rank", value: row?.rank },
    { label: "Nationality", value: row?.nationality },
    { label: "Passport", value: row?.passport_no ?? row?.passport },
    { label: "Pickup", value: formatPickup(row?.pickup_datetime) },
    { label: "Drop-off", value: formatPickup(row?.drop_offdatetime ?? row?.dropoff_datetime) },
  ];

  const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
  const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;

  const TRANSPORT_ACCENT = SERVICE_ACCENT[CREW_MANAGEMENT_SUBTABS.TRANSPORT];

  const TransportContent = ({ formValues, handleChange, cardColor, onRequestCountChange, onGoToCrew, crewUploadMode = false }) => {
    const requestEmailInputRef = useRef(null);
    const documentsInputRef = useRef(null);
    const [isDraggingEmail, setIsDraggingEmail] = useState(false);

    const callId = formValues.call_id || formValues.callId || formValues.card_call_id;
    const { errors: fieldErrors, validate, resetValidation } = useRequestEmailCrewValidation(formValues, {
      requestEmailField: "transportRequestEmail",
      crewField: "selectedCrew",
    });
    const { showSavedLineItems, lineItemsModal } = useServiceLineItemsModal(callId);

    // Shared with the rest of the drawer (CardForm fetches it once per card).
    const { detail: callDetails } = useCallDetail(callId);
    const launchHireEnabled = Number(callDetails?.launch_hire) === 1;
    const isLaunchHire = launchHireEnabled && formValues.transportLaunchHire !== false;


    const [isSavingTransport, setIsSavingTransport] = useState(false);
    const [transportRequests, setTransportRequests] = useState([]);
    const transportRequestGroups = useMemo(() => buildTransportRequestGroups(transportRequests), [transportRequests]);
    const [loadingTransportRequests, setLoadingTransportRequests] = useState(false);
    const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);

    const fetchTransportRequests = useCallback(async () => {
      if (!callId) {
        setTransportRequests([]);
        setLoadingTransportRequests(false);
        return;
      }

      setLoadingTransportRequests(true);
      try {
        const response = await transportContentService.getTransportRequest(callId);
        const list = extractTransportRequestsFromEnvelope(response);
        setTransportRequests(list);
        onRequestCountChange?.(list.length);
      } catch {
        setTransportRequests([]);
        onRequestCountChange?.(0);
      } finally {
        setLoadingTransportRequests(false);
      }
    }, [callId, onRequestCountChange]);

    useEffect(() => {
      void fetchTransportRequests();
    }, [fetchTransportRequests]);

    const fileToAttachment = (file) => ({
      name: file.name,
      file,
      size: file.size,
      type: file.type,
    });

    const filterRequestEmailFiles = (files) =>
      Array.from(files || []).filter((f) => REQUEST_EMAIL_EXT_RE.test(f.name));

    const handleRequestEmailDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingEmail(true);
    };

    const handleRequestEmailDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingEmail(false);
    };

    const handleRequestEmailDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleRequestEmailDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingEmail(false);
      const raw = Array.from(e.dataTransfer.files || []);
      const allowed = filterRequestEmailFiles(raw);
      if (allowed.length === 0) {
        if (raw.length > 0) {
          notify(
            "Only .msg, .eml, .pdf, .doc, .docx files are allowed for request email.",
            "warning",
            "top-center"
          );
        }
        return;
      }
      handleChange("transportRequestEmail")({
        target: { value: [fileToAttachment(allowed[0])] },
      });
    };

    const handleRequestEmailFileInputChange = (e) => {
      const raw = Array.from(e.target.files || []);
      const allowed = filterRequestEmailFiles(raw);
      if (allowed.length === 0) {
        if (raw.length > 0) {
          notify(
            "Only .msg, .eml, .pdf, .doc, .docx files are allowed for request email.",
            "warning",
            "top-center"
          );
        }
      } else {
        handleChange("transportRequestEmail")({
          target: { value: [fileToAttachment(allowed[0])] },
        });
      }
      if (requestEmailInputRef.current) {
        requestEmailInputRef.current.value = "";
      }
    };

    const handleRequestEmailRemoveAttachment = () => {
      handleChange("transportRequestEmail")({ target: { value: [] } });
    };

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
      const current = formValues.transportDocuments || [];
      const added = raw.map(fileToAttachment);
      handleChange("transportDocuments")({ target: { value: [...current, ...added] } });
    };

    const handleDocumentsFileInputChange = (e) => {
      const raw = Array.from(e.target.files || []);
      if (raw.length === 0) {
        if (requestEmailInputRef.current) {
          requestEmailInputRef.current.value = "";
        }
        return;
      }

      const current = formValues.transportDocuments || [];
      const added = raw.map(fileToAttachment);
      handleChange("transportDocuments")({ target: { value: [...current, ...added] } });
      if (requestEmailInputRef.current) {
        requestEmailInputRef.current.value = "";
      }
    };

    const handleDocumentsRemoveAttachment = (index) => {
      const current = formValues.transportDocuments || [];
      handleChange("transportDocuments")({ target: { value: current.filter((_, i) => i !== index) } });
    };

    const handleSave = useCallback(async () => {
      if (!callId) {
        notify("Call is required to save a transport request.", "error", "top-center");
        return;
      }

      if (!validate()) return;

      if (!formValues.transportPickupDate || !formValues.transportPickupTime) {
        notify("Pickup date and time are required.", "error", "top-center");
        return;
      }

      let launchHireBookingDatetime = "";
      if (isLaunchHire) {
        if (!formValues.transportLaunchHireLocation) {
          notify("Launch hire location is required.", "error", "top-center");
          return;
        }
        launchHireBookingDatetime = buildPickupDateTime(
          formValues.transportLaunchHireBookingDate,
          formValues.transportLaunchHireBookingTime
        );
        if (!launchHireBookingDatetime) {
          notify("Launch hire booking date and time are required.", "error", "top-center");
          return;
        }
      }

      const payload = {
        call_id: Number(callDetails?.call_id || callId),
        pickup_datetime: buildPickupDateTime(formValues.transportPickupDate, formValues.transportPickupTime),
        from_location: formValues.transportFromType || "",
        from_location_det: formValues.transportFromLocation || "",
        to_location: formValues.transportToType || "",
        to_location_det: formValues.transportToLocation || "",
        remarks: formValues.transportDescription || "",
        crew: buildCrewPayloadList(formValues.selectedCrew, formValues[manualCrewIdsField("selectedCrew")]),
        launch_hire: isLaunchHire ? 1 : 0,
        location: isLaunchHire ? formValues.transportLaunchHireLocation || "" : "",
        booking_datetime: isLaunchHire ? launchHireBookingDatetime : "",
      };

      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));

      const requestEmailFile = formValues.transportRequestEmail?.[0]?.file;
      if (requestEmailFile) {
        formData.append("request_email", requestEmailFile);
      }

      const transportDocuments = Array.isArray(formValues.transportDocuments)
        ? formValues.transportDocuments
        : [];
      transportDocuments.forEach((attachment) => {
        const file = attachment?.file ?? attachment;
        if (file instanceof File) {
          formData.append("attachments[]", file);
        }
      });

      setIsSavingTransport(true);
      try {
        const response = await transportContentService.createTransportRequest(formData);
        notify(
          getApiMessage(response, "Transport request created successfully"),
          "success",
          "top-center"
        );
        resetValidation();
        showSavedLineItems(response);
        handleChange("transportRequestEmail")({ target: { value: [] } });
        handleChange("selectedCrew")({ target: { value: [] } });
        handleChange(manualCrewIdsField("selectedCrew"))({ target: { value: null } });
        handleChange("transportPickupDate")({ target: { value: "" } });
        handleChange("transportPickupTime")({ target: { value: "" } });
        handleChange("transportFromType")({ target: { value: "" } });
        handleChange("transportFromLocation")({ target: { value: "" } });
        handleChange("transportToType")({ target: { value: "" } });
        handleChange("transportToLocation")({ target: { value: "" } });
        handleChange("transportDescription")({ target: { value: "" } });
        handleChange("transportDocuments")({ target: { value: [] } });
        handleChange("transportLaunchHire")({ target: { value: true } });
        handleChange("transportLaunchHireLocation")({ target: { value: "" } });
        handleChange("transportLaunchHireBookingDate")({ target: { value: "" } });
        handleChange("transportLaunchHireBookingTime")({ target: { value: "" } });
        await fetchTransportRequests();
      } catch (error) {
        notify(
          error?.response?.data?.message || "Failed to create transport request",
          "error",
          "top-center"
        );
      } finally {
        setIsSavingTransport(false);
      }
    }, [callId, callDetails, formValues, fetchTransportRequests, isLaunchHire, handleChange, validate, resetValidation, showSavedLineItems]);

    return (
      <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
        {lineItemsModal}
        <FormSection icon={GroupSettingsIcon} title="">
          <div className="pre-arrival-form transport-form">
            <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
              <div className="general-info-left crew-pass-premium-left">
                <div className={`crew-pass-request-details-card husb-accent-${TRANSPORT_ACCENT}`}>
                  <PremiumCardHeader
                    icon="transport"
                    title="New transport request"
                    subtitle="Book a vehicle for crew movement"
                    headerClassName="crew-pass-request-details-card__header"
                    titleClassName="crew-pass-request-details-card__title"
                  />
                  <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                  <FormGroup icon="mail" label="Request Email *" accent={TRANSPORT_ACCENT} error={fieldErrors.requestEmail}>
                    <FormField>
                      <div className="transport-upload-box">
                        <AttachmentsList
                          attachments={formValues.transportRequestEmail || []}
                          onAdd={() => { }}
                          onRemove={handleRequestEmailRemoveAttachment}
                          cardColor={cardColor}
                          isDragging={isDraggingEmail}
                          onDragEnter={handleRequestEmailDragEnter}
                          onDragLeave={handleRequestEmailDragLeave}
                          onDragOver={handleRequestEmailDragOver}
                          onDrop={handleRequestEmailDrop}
                          fileInputRef={requestEmailInputRef}
                          onFileInputChange={handleRequestEmailFileInputChange}
                          accept={REQUEST_EMAIL_ACCEPT_ATTR}
                          multiple={false}
                          helperText=".msg, .eml, .pdf, .doc or .docx"
                        />
                      </div>
                    </FormField>
                  </FormGroup>

                  <CrewSelectionField
                    callId={callId}
                    selected={formValues.selectedCrew || []}
                    onChange={(ids, meta) => {
                    handleChange("selectedCrew")({ target: { value: ids } });
                    handleChange(manualCrewIdsField("selectedCrew"))({ target: { value: manualCrewIdsFromChange(meta) } });
                  }}
                    accent={TRANSPORT_ACCENT}
                    onGoToCrew={onGoToCrew}
                    uploadMode={crewUploadMode}
                    error={fieldErrors.crew}
                  />

                  <FormGroup icon="calendar" label="Pickup Date Time" accent={TRANSPORT_ACCENT}>
                    <FormField>
                      <DateTimePickerField
                        dateValue={formValues.transportPickupDate || ""}
                        timeValue={formValues.transportPickupTime || ""}
                        onDateChange={handleChange("transportPickupDate")}
                        onTimeChange={handleChange("transportPickupTime")}
                      />
                    </FormField>
                  </FormGroup>

                  <FieldRow>
                    <FormField label="From">
                      <FormSelect
                        value={formValues.transportFromType || ""}
                        onChange={handleChange("transportFromType")}
                        options={TRANSPORT_ROUTE_LOCATION_OPTIONS}
                        placeholder="Select location type"
                      />
                      <LocationAutocomplete
                        value={formValues.transportFromLocation || ""}
                        onChange={handleChange("transportFromLocation")}
                        placeholder="Enter pickup location"
                      />
                    </FormField>
                    <FormField label="To">
                      <FormSelect
                        value={formValues.transportToType || ""}
                        onChange={handleChange("transportToType")}
                        options={TRANSPORT_ROUTE_LOCATION_OPTIONS}
                        placeholder="Select location type"
                      />
                      <LocationAutocomplete
                        value={formValues.transportToLocation || ""}
                        onChange={handleChange("transportToLocation")}
                        placeholder="Enter drop-off location"
                      />
                    </FormField>
                  </FieldRow>

                  {launchHireEnabled && (
                    <FormGroup icon="LAUNCH_HIRE" label="Launch Hire" accent={TRANSPORT_ACCENT}>
                      <FormField>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={isLaunchHire}
                            onChange={(e) => handleChange("transportLaunchHire")({ target: { value: e.target.checked } })}
                            style={{ width: 16, height: 16, accentColor: "var(--card-color)" }}
                          />
                          Launch hire required
                        </label>
                      </FormField>
                      {isLaunchHire && (
                        <FieldRow>
                          <FormField label="Location">
                            <FormSelect
                              value={formValues.transportLaunchHireLocation || ""}
                              onChange={handleChange("transportLaunchHireLocation")}
                              options={LAUNCH_HIRE_LOCATION_OPTIONS}
                              placeholder="Select location..."
                            />
                          </FormField>
                          <FormField label="Booking Date Time">
                            <DateTimePickerField
                              dateValue={formValues.transportLaunchHireBookingDate || ""}
                              timeValue={formValues.transportLaunchHireBookingTime || ""}
                              onDateChange={handleChange("transportLaunchHireBookingDate")}
                              onTimeChange={handleChange("transportLaunchHireBookingTime")}
                              dateFieldName="transportLaunchHireBookingDate"
                              timeFieldName="transportLaunchHireBookingTime"
                              placeholder="Select date and time"
                            />
                          </FormField>
                        </FieldRow>
                      )}
                    </FormGroup>
                  )}

                  <FormGroup icon="folder" label="Documents" accent={TRANSPORT_ACCENT}>
                    <FormField className="cf-field-full">
                      <div className="transport-upload-box">
                        <AttachmentsList
                          attachments={formValues.transportDocuments || []}
                          onAdd={() => { }}
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
                          multiple={true}
                        />
                      </div>
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="notebook" label="Remarks" accent={TRANSPORT_ACCENT}>
                    <div className="cgpass-remarks">
                      <FormField>
                        <ReactQuillEditor
                          value={formValues?.transportDescription || ""}
                          onChange={handleChange("transportDescription")}
                          placeholder="Enter remarks..."
                          name="transportDescription"
                        />
                      </FormField>
                    </div>
                  </FormGroup>

                  </div>
                  <div className="form-save-button-wrapper cgpass-save-footer">
                    <button
                      type="button"
                      className="form-save-button"
                      onClick={handleSave}
                      disabled={isSavingTransport}
                    >
                      {isSavingTransport ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="general-info-right crew-pass-requests-sidebar">
                <CrewPassRequestsTable
                  title="Transport requests"
                  subtitle="All bookings for this job"
                  icon="list"
                  groups={transportRequestGroups}
                  loading={loadingTransportRequests}
                  emptyMessage="No transport requests found"
                  passType="transport"
                  accent={TRANSPORT_ACCENT}
                  renderGroupTitle={renderTransportRoute}
                  getGroupFacts={getTransportFacts}
                  getGroupDocumentUrl={(group) => group.requestEmailUrl}
                  getGroupSearchText={(group) => `${group.from} ${group.to} ${group.driver}`}
                  getCrewMeta={getTransportCrewMeta}
                  getCrewDetails={getTransportCrewDetails}
                  searchPlaceholder="Search crew, location or driver"
                />
              </div>
            </div>
          </div>
        </FormSection>
      </div>
    );
  };

  TransportContent.propTypes = {
    formValues: PropTypes.object.isRequired,
    handleChange: PropTypes.func.isRequired,
    cardColor: PropTypes.string,
    onRequestCountChange: PropTypes.func,
    onGoToCrew: PropTypes.func,
    crewUploadMode: PropTypes.bool,
  };

  export default TransportContent;

