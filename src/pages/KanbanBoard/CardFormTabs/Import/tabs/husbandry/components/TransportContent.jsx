  import { useState, useEffect, useCallback, useRef } from "react";
  import PropTypes from "prop-types";
  import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
  import { notify } from "../../../../../../../components/Toaster";
  import { FormSection, FormField, FormSelect, ReactQuillEditor, FormGroup, FieldRow, PremiumCardHeader } from "./Husbandry.components";
  import { CREW_MANAGEMENT_SUBTABS, SERVICE_ACCENT, TRANSPORT_ROUTE_LOCATION_OPTIONS, LAUNCH_HIRE_LOCATION_OPTIONS } from "./Husbandry.constants";
  import AttachmentsList from "../../appointment/AttachmentsList";
  import callFileService from "../../../../../../../services/callFileService";
  import transportContentService from "../../../../../../../services/transportContentService";
  import { buildPickupDateTime } from "../../../../../../../store/TransportContent";
  import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
  import CrewSelectionField from "./CrewSelectionField";
  import LeafletLocationField from "./LeafletLocationField";
  import DateTimePickerField from "../../../../shared/components/DateTimePickerField";

  // Helper functions to extract and flatten transport requests from API response
  const extractTransportRequestsFromEnvelope = (response) => {
    const payload = response?.data ?? response;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const flattenTransportRequestRows = (requests) => {
    if (!Array.isArray(requests)) return [];
    
    return requests.flatMap((request) => {
      const crew = Array.isArray(request.crew) ? request.crew : [];
      
      // If no crew, create one row for the request itself
      if (crew.length === 0) {
        return [
          {
            transport_request_id: request.transport_request_id,
            wo_id: request.wo_id,
            crew_name: request.inhouse_driver_name || request.third_party_driver_name || "N/A",
            crew_change_id: null,
            pickup_status: request.status,
            from_location: request.from_location,
            to_location: request.to_location,
            pickup_datetime: request.pickup_datetime,
            request_type: request.request_type,
            transport_company: request.transport_company,
            third_party_driver_name: request.third_party_driver_name,
            third_party_driver_contact: request.third_party_driver_contact,
            inhouse_driver_name: request.inhouse_driver_name,
            request_email: request.request_email,
            remarks: request.remarks,
            status: request.status,
          },
        ];
      }
      
      // Create a row for each crew member
      return crew.map((crewMember) => ({
        transport_request_id: request.transport_request_id,
        wo_id: request.wo_id,
        crew_name: crewMember.crew_name,
        crew_change_id: crewMember.crew_change_id,
        pickup_status: crewMember.pickup_status,
        rank: crewMember.rank,
        from_location: request.from_location,
        to_location: request.to_location,
        pickup_datetime: request.pickup_datetime,
        request_type: request.request_type,
        transport_company: request.transport_company,
        third_party_driver_name: request.third_party_driver_name,
        third_party_driver_contact: request.third_party_driver_contact,
        inhouse_driver_name: request.inhouse_driver_name,
        request_email: request.request_email,
        remarks: request.remarks,
        status: request.status,
      }));
    });
  };

  const TRANSPORT_REQUEST_COLUMNS = [
    {
      key: "transport_request_id",
      header: "Request No",
      accessor: (r) => r?.wo_id ?? r?.transport_request_id,
      type: "workorder",
    },
    { key: "crew_name", header: "Crew", accessor: (r) => r?.crew_name ?? r?.crewName, type: "crew", perCrew: true },
    {
      key: "route",
      header: "Route",
      type: "route",
      fromAccessor: (r) => r?.from ?? r?.from_location ?? r?.pickup_location,
      toAccessor: (r) => r?.to ?? r?.to_location ?? r?.drop_location,
    },
    {
      key: "status",
      header: "Status",
      accessor: (r) => r?.status ?? r?.pickup_status,
      type: "status",
    },
    {
      key: "requested_date",
      header: "Requested",
      accessor: (r) => r?.requested_date ?? r?.pickup_datetime,
      type: "date",
    },
    { 
      key: "document", 
      header: "Document", 
      accessor: (r) => r?.request_email,
      type: "document" 
    },
  ];

  const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
  const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;

  const TRANSPORT_ACCENT = SERVICE_ACCENT[CREW_MANAGEMENT_SUBTABS.TRANSPORT];

  const TransportContent = ({ formValues, handleChange, cardColor, onRequestCountChange }) => {
    const requestEmailInputRef = useRef(null);
    const documentsInputRef = useRef(null);
    const [isDraggingEmail, setIsDraggingEmail] = useState(false);

    const callId = formValues.call_id || formValues.callId || formValues.card_call_id;

    const [callDetails, setCallDetails] = useState(null);
    const launchHireEnabled = Number(callDetails?.launch_hire) === 1;
    const isLaunchHire = launchHireEnabled && formValues.transportLaunchHire !== false;

    useEffect(() => {
      if (!callId) {
        setCallDetails(null);
        return;
      }

      let cancelled = false;

      callFileService
        .getCallDetail(callId)
        .then(({ data }) => {
          const details = data?.data || null;
          if (!cancelled) setCallDetails(details);
        })
        .catch(() => {
          if (!cancelled) setCallDetails(null);
        });

      return () => {
        cancelled = true;
      };
    }, [callId]);

    const [isSavingTransport, setIsSavingTransport] = useState(false);
    const [transportRequests, setTransportRequests] = useState([]);
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
        setTransportRequests(flattenTransportRequestRows(list));
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

      if (!callDetails?.call_type_id) {
        notify("Call type id is missing. Please reload call details.", "warning", "top-center");
        return;
      }

      if (!formValues.transportRequestEmail?.[0]?.file) {
        notify("Request email is required.", "error", "top-center");
        return;
      }

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
        call_id: Number(callDetails?.call_id || ""),
        pickup_datetime: buildPickupDateTime(formValues.transportPickupDate, formValues.transportPickupTime),
        from_location: formValues.transportFromType || "",
        from_location_det: formValues.transportFromLocation || "",
        to_location: formValues.transportToType || "",
        to_location_det: formValues.transportToLocation || "",
        remarks: formValues.transportDescription || "",
        crew: (formValues.selectedCrew || []).map((id) => ({ crew_change_id: Number(id) })),
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
          response?.data?.message || "Transport request created successfully",
          "success",
          "top-center"
        );
        handleChange("transportRequestEmail")({ target: { value: [] } });
        handleChange("selectedCrew")({ target: { value: [] } });
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
    }, [callId, callDetails, formValues, fetchTransportRequests, isLaunchHire, handleChange]);

    return (
      <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
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
                  <FormGroup icon="mail" label="Request Email *" accent={TRANSPORT_ACCENT}>
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
                    onChange={(ids) => handleChange("selectedCrew")({ target: { value: ids } })}
                    accent={TRANSPORT_ACCENT}
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
                      <LeafletLocationField
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
                      <LeafletLocationField
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

                  <FormGroup icon="folder" label="Documents *" accent={TRANSPORT_ACCENT}>
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
                <HusbandryServiceRequestsTable
                  title="Transport requests"
                  subtitle="All bookings for this job"
                  icon="list"
                  requests={transportRequests}
                  loading={loadingTransportRequests}
                  columns={TRANSPORT_REQUEST_COLUMNS}
                  emptyMessage="No transport requests found"
                  serviceType="transport"
                  accent={TRANSPORT_ACCENT}
                  groupKey="transport_request_id"
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
  };

  export default TransportContent;

