import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../../components/Toaster";
import { FormSection, FormField, FormSelect, FormGroup, PremiumCardHeader, ReactQuillEditor } from "./Husbandry.components";
import AttachmentsList from "../../appointment/AttachmentsList";
import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
import CrewSelectionField from "./CrewSelectionField";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import useLaunchHireServiceReducer from "../../../../../../../store/LaunchHireServiceReducer";
import { buildPickupDateTime } from "../../../../../../../store/TransportContent";
import { SERVICE_ACCENT, LAUNCH_HIRE_LOCATION_OPTIONS } from "./Husbandry.constants";

const LAUNCH_HIRE_ACCENT = SERVICE_ACCENT.LAUNCH_HIRE;
const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;
const REQUEST_EMAIL_TYPE_WARNING = "Only .msg, .eml, .pdf, .doc, .docx files are allowed for request email.";

const DRAFT_FIELDS = {
  launchHireLocation: "",
  launchHireBookingDate: "",
  launchHireBookingTime: "",
  launchHireRequestEmailFile: [],
  launchHireDocuments: [],
  launchHireDescription: "",
};

const LAUNCH_HIRE_REQUEST_COLUMNS = [
  { key: "location", header: "Location", accessor: (r) => r?.location },
  { key: "type_of_service", header: "Type of Service", accessor: (r) => r?.type_of_service ?? r?.service_type },
  { key: "status", header: "Status", accessor: (r) => r?.status, type: "status" },
  { key: "requested_date", header: "Requested", accessor: (r) => r?.created_date, type: "date" },
  { key: "document", header: "Document", accessor: (r) => r?.document_url, type: "document" },
];

const fileToAttachment = (file) => ({ name: file.name, file, size: file.size, type: file.type });

const stopEvent = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

const LaunchHireContent = ({
  formValues,
  handleChange,
  cardColor,
  card,
  onLaunchHireSaved,
  onRequestCountChange,
  onGoToCrew,
  crewUploadMode = false,
}) => {
  const callId = formValues.call_id || formValues.callId || formValues.card_call_id || card?.call_id || card?.id;
  const { launchHireRequests, isLoadingRequests, getLaunchHireRequests, createCrewChangeBooking } = useLaunchHireServiceReducer();
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const fileInputRef = useRef(null);
  const requestEmailInputRef = useRef(null);

  const setField = (field, value) => handleChange(field)({ target: { value } });

  const resetDraft = () => {
    Object.entries(DRAFT_FIELDS).forEach(([field, value]) => setField(field, value));
  };

  useEffect(() => {
    void getLaunchHireRequests(callId);
  }, [callId, getLaunchHireRequests]);

  useEffect(() => {
    onRequestCountChange?.(launchHireRequests.length);
  }, [launchHireRequests, onRequestCountChange]);

  // Discard any draft entered on a previous visit — this tab always opens blank.
  // Crew is kept so a selection assigned from the Crew Management dashboard carries over.
  useEffect(() => {
    resetDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const launchHireRequestRows = launchHireRequests.map((row) => ({
    ...row,
    document_url: row?.request_email_url || row?.documents?.[0]?.file_url || "",
  }));

  const setRequestEmailFromFiles = (files) => {
    const raw = Array.from(files || []);
    const allowed = raw.filter((f) => REQUEST_EMAIL_EXT_RE.test(f.name));
    if (allowed.length === 0) {
      if (raw.length > 0) notify(REQUEST_EMAIL_TYPE_WARNING, "warning", "top-center");
      return;
    }
    setField("launchHireRequestEmailFile", [fileToAttachment(allowed[0])]);
  };

  const addDocuments = (files) => {
    const added = Array.from(files || []).map(fileToAttachment);
    if (added.length === 0) return;
    setField("launchHireDocuments", [...(formValues.launchHireDocuments || []), ...added]);
  };

  const handleRequestEmailDrop = (e) => {
    stopEvent(e);
    setIsDraggingEmail(false);
    setRequestEmailFromFiles(e.dataTransfer.files);
  };

  const handleRequestEmailFileInputChange = (e) => {
    setRequestEmailFromFiles(e.target.files);
    if (requestEmailInputRef.current) requestEmailInputRef.current.value = "";
  };

  const handleDocumentsDrop = (e) => {
    stopEvent(e);
    setIsDragging(false);
    addDocuments(e.dataTransfer.files);
  };

  const handleDocumentsFileInputChange = (e) => {
    addDocuments(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDocumentsRemoveAttachment = (index) => {
    setField("launchHireDocuments", (formValues.launchHireDocuments || []).filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!callId) {
      notify("Call ID is required before saving.", "error", "top-center");
      return;
    }
    const requestEmailFile = (formValues.launchHireRequestEmailFile || [])
      .map((a) => a?.file ?? a)
      .find((f) => f instanceof File);
    if (!requestEmailFile) {
      notify("Request email file is required.", "error", "top-center");
      return;
    }
    if (!formValues.launchHireLocation) {
      notify("Please select a location.", "error", "top-center");
      return;
    }
    const bookingDatetime = buildPickupDateTime(formValues.launchHireBookingDate, formValues.launchHireBookingTime);
    if (!bookingDatetime) {
      notify("Please select a booking date and time.", "error", "top-center");
      return;
    }

    const crewIds = Array.isArray(formValues.launchHireSelectedCrew) ? formValues.launchHireSelectedCrew : [];
    const formData = new FormData();
    formData.append("call_id", callId);
    formData.append("booking_datetime", bookingDatetime);
    formData.append("location", formValues.launchHireLocation);
    formData.append("crew_change_ids", JSON.stringify(crewIds.map(Number)));
    formData.append("request_email", requestEmailFile);
    formData.append("remarks", formValues.launchHireDescription || "");
    (formValues.launchHireDocuments || [])
      .map((a) => a?.file ?? a)
      .filter((f) => f instanceof File)
      .forEach((file, index) => formData.append(`documents[${index}]`, file));

    setSaving(true);
    try {
      await createCrewChangeBooking(formData);
      notify("Launch hire request saved successfully.", "success", "top-center");
      resetDraft();
      onLaunchHireSaved?.();
      await getLaunchHireRequests(callId);
    } catch (err) {
      notify(err?.response?.data?.message ?? "Failed to save launch hire request.", "error", "top-center");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cardform-left-full launchhire-booking" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form launchhire-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
            <div className="general-info-left crew-pass-premium-left">
              <div className={`crew-pass-request-details-card husb-accent-${LAUNCH_HIRE_ACCENT}`}>
                <PremiumCardHeader
                  icon="LAUNCH_HIRE"
                  title="New launch hire request"
                  subtitle="Book a launch for crew transfer to the vessel"
                  headerClassName="crew-pass-request-details-card__header"
                  titleClassName="crew-pass-request-details-card__title"
                />
                <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                  <FormGroup icon="mail" label="Request Email *" accent={LAUNCH_HIRE_ACCENT}>
                    <FormField>
                      <div className="transport-upload-box">
                        <AttachmentsList
                          attachments={formValues.launchHireRequestEmailFile || []}
                          onAdd={() => {}}
                          onRemove={() => setField("launchHireRequestEmailFile", [])}
                          cardColor={cardColor}
                          isDragging={isDraggingEmail}
                          onDragEnter={(e) => {
                            stopEvent(e);
                            setIsDraggingEmail(true);
                          }}
                          onDragLeave={(e) => {
                            stopEvent(e);
                            setIsDraggingEmail(false);
                          }}
                          onDragOver={stopEvent}
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

                  <FormGroup icon="LAUNCH_HIRE" label="Location *" accent={LAUNCH_HIRE_ACCENT}>
                    <FormField>
                      <FormSelect
                        value={formValues.launchHireLocation || ""}
                        onChange={handleChange("launchHireLocation")}
                        options={LAUNCH_HIRE_LOCATION_OPTIONS}
                        placeholder="Select location..."
                      />
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="calendar" label="Booking Date & Time *" accent={LAUNCH_HIRE_ACCENT}>
                    <FormField>
                      <DateTimePickerField
                        dateValue={formValues.launchHireBookingDate || ""}
                        timeValue={formValues.launchHireBookingTime || ""}
                        onDateChange={handleChange("launchHireBookingDate")}
                        onTimeChange={handleChange("launchHireBookingTime")}
                        dateFieldName="launchHireBookingDate"
                        timeFieldName="launchHireBookingTime"
                        placeholder="Select date and time"
                        minDate={new Date()}
                      />
                    </FormField>
                  </FormGroup>

                  <CrewSelectionField
                    callId={callId ? String(callId) : ""}
                    selected={formValues.launchHireSelectedCrew || []}
                    onChange={(ids) => setField("launchHireSelectedCrew", ids)}
                    accent={LAUNCH_HIRE_ACCENT}
                    onGoToCrew={onGoToCrew}
                    uploadMode={crewUploadMode}
                  />

                  <FormGroup icon="folder" label="Documents" accent={LAUNCH_HIRE_ACCENT}>
                    <FormField className="cf-field-full">
                      <div className="transport-upload-box">
                        <AttachmentsList
                          attachments={formValues.launchHireDocuments || []}
                          onAdd={() => {}}
                          onRemove={handleDocumentsRemoveAttachment}
                          cardColor={cardColor}
                          isDragging={isDragging}
                          onDragEnter={(e) => {
                            stopEvent(e);
                            setIsDragging(true);
                          }}
                          onDragLeave={(e) => {
                            stopEvent(e);
                            setIsDragging(false);
                          }}
                          onDragOver={stopEvent}
                          onDrop={handleDocumentsDrop}
                          fileInputRef={fileInputRef}
                          onFileInputChange={handleDocumentsFileInputChange}
                        />
                      </div>
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="notebook" label="Remarks" accent={LAUNCH_HIRE_ACCENT}>
                    <div className="zawilpass-remarks">
                      <FormField>
                        <ReactQuillEditor
                          value={formValues.launchHireDescription || ""}
                          onChange={handleChange("launchHireDescription")}
                          placeholder="Enter remarks..."
                          name="launchHireDescription"
                        />
                      </FormField>
                    </div>
                  </FormGroup>
                </div>
                <div className="form-save-button-wrapper zawilpass-save-footer">
                  <button
                    type="button"
                    className="form-save-button"
                    onClick={() => {
                      void handleSave();
                    }}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>

            <div className="general-info-right crew-pass-requests-sidebar">
              <HusbandryServiceRequestsTable
                title="Launch Hire requests"
                subtitle="All launch hire bookings for this job"
                icon="list"
                requests={launchHireRequestRows}
                loading={isLoadingRequests}
                columns={LAUNCH_HIRE_REQUEST_COLUMNS}
                serviceType="LAUNCH_HIRE"
                emptyMessage="No launch hire requests found"
                accent={LAUNCH_HIRE_ACCENT}
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

LaunchHireContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  card: PropTypes.object,
  onLaunchHireSaved: PropTypes.func,
  onRequestCountChange: PropTypes.func,
  onGoToCrew: PropTypes.func,
  crewUploadMode: PropTypes.bool,
};

export default LaunchHireContent;
