import { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../../components/Toaster";
import { FormSection, FormField, FormSelect, ReactQuillEditor, FormGroup, FieldRow, PremiumCardHeader } from "./Husbandry.components";
import AttachmentsList from "../../appointment/AttachmentsList";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import hotelService, {
  extractHotelRequestsFromEnvelope,
  flattenHotelRequestRows,
} from "../../../../../../../services/hotelService";
import callFileService from "../../../../../../../services/callFileService";
import { buildPickupDateTime } from "../../../../../../../store/TransportContent";
import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
import CrewSelectionField from "./CrewSelectionField";
import { CREW_MANAGEMENT_SUBTABS, SERVICE_ACCENT, LAUNCH_HIRE_LOCATION_OPTIONS } from "./Husbandry.constants";

const HOTEL_REQUEST_COLUMNS = [
  {
    key: "wo_number",
    header: "Work Order",
    accessor: (r) => r?.wo_number || r?.work_order_no || r?.hotel_request_id,
    type: "workorder",
  },
  { key: "crew_name", header: "Crew", accessor: (r) => r?.crew_name ?? r?.crewName, type: "crew", perCrew: true },
  { key: "hotel_name", header: "Hotel", accessor: (r) => r?.hotel_name ?? r?.hotelName },
  {
    key: "check_in",
    header: "Check-in",
    accessor: (r) => r?.check_in ?? r?.check_in_date ?? r?.checkin_datetime,
    type: "date",
  },
  {
    key: "check_out",
    header: "Check-out",
    accessor: (r) => r?.check_out ?? r?.check_out_date ?? r?.checkout_datetime,
    type: "date",
  },
  {
    key: "status",
    header: "Status",
    accessor: (r) => r?.status ?? r?.stay_status,
    type: "status",
  },
  { key: "document", header: "Document", type: "document" },
];

const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;

const HOTEL_ACCENT = SERVICE_ACCENT[CREW_MANAGEMENT_SUBTABS.HOTEL];

const unwrapApiList = (axiosData) => {
  const payload = axiosData?.data ?? axiosData;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const HotelContent = ({ formValues, handleChange, cardColor, onRequestCountChange, onGoToCrew, crewUploadMode = false }) => {
  const requestEmailInputRef = useRef(null);
  const documentsInputRef = useRef(null);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [isSavingHotel, setIsSavingHotel] = useState(false);
  const [hotelRequests, setHotelRequests] = useState([]);
  const [loadingHotelRequests, setLoadingHotelRequests] = useState(false);

  const callId = formValues.call_id || formValues.callId || formValues.card_call_id;

  const [callDetails, setCallDetails] = useState(null);
  const launchHireEnabled = Number(callDetails?.launch_hire) === 1;
  const isLaunchHire = launchHireEnabled && formValues.hotelLaunchHire !== false;

  const fetchHotelRequests = useCallback(async () => {
    if (!callId) {
      setHotelRequests([]);
      setLoadingHotelRequests(false);
      return;
    }

    setLoadingHotelRequests(true);
    try {
      const response = await hotelService.getHotelRequests(callId);
      const list = extractHotelRequestsFromEnvelope(response);
      setHotelRequests(flattenHotelRequestRows(list));
      onRequestCountChange?.(list.length);
    } catch {
      setHotelRequests([]);
      onRequestCountChange?.(0);
    } finally {
      setLoadingHotelRequests(false);
    }
  }, [callId, onRequestCountChange]);

  useEffect(() => {
    void fetchHotelRequests();
  }, [fetchHotelRequests]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingHotels(true);
        const { data } = await hotelService.getHotels();
        const list = unwrapApiList(data);
        if (!cancelled) setHotels(list);
      } catch {
        if (!cancelled) setHotels([]);
      } finally {
        if (!cancelled) setLoadingHotels(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hotelOptions = hotels.map((h) => ({
    value: String(h.hotel_id ?? h._id ?? ""),
    label: h.hotel_name ?? "",
  }));

  const handleHotelChange = (e) => {
    handleChange("hotelId")(e);
    const id = e.target.value;
    const row = hotels.find((h) => String(h.hotel_id ?? h._id) === id);
    handleChange("hotelName")({ target: { value: row?.hotel_name ?? "" } });
  };

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
    handleChange("hotelRequestEmail")({
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
      handleChange("hotelRequestEmail")({
        target: { value: [fileToAttachment(allowed[0])] },
      });
    }
    if (requestEmailInputRef.current) {
      requestEmailInputRef.current.value = "";
    }
  };

  const handleRequestEmailRemoveAttachment = () => {
    handleChange("hotelRequestEmail")({ target: { value: [] } });
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
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const current = formValues.hotelDocuments || [];
      const added = files.map(fileToAttachment);
      handleChange("hotelDocuments")({ target: { value: [...current, ...added] } });
    }
  };

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const current = formValues.hotelDocuments || [];
      const added = files.map(fileToAttachment);
      handleChange("hotelDocuments")({ target: { value: [...current, ...added] } });
    }
    if (documentsInputRef.current) {
      documentsInputRef.current.value = "";
    }
  };

  const handleDocumentsRemoveAttachment = (index) => {
    const current = formValues.hotelDocuments || [];
    handleChange("hotelDocuments")({ target: { value: current.filter((_, i) => i !== index) } });
  };

  const handleSave = useCallback(async () => {
    if (!callId) {
      notify("Call is required to save a hotel request.", "error", "top-center");
      return;
    }

    if (!formValues.hotelId) {
      notify("Hotel is required.", "error", "top-center");
      return;
    }

    const checkinDatetime = buildPickupDateTime(
      formValues.hotelCheckInDate,
      formValues.hotelCheckInTime
    );
    const checkoutDatetime = buildPickupDateTime(
      formValues.hotelCheckOutDate,
      formValues.hotelCheckOutTime
    );

    if (!checkinDatetime) {
      notify("Check-in date and time are required.", "error", "top-center");
      return;
    }

    if (!checkoutDatetime) {
      notify("Check-out date and time are required.", "error", "top-center");
      return;
    }

    let launchHireBookingDatetime = "";
    if (isLaunchHire) {
      if (!formValues.hotelLaunchHireLocation) {
        notify("Launch hire location is required.", "error", "top-center");
        return;
      }
      launchHireBookingDatetime = buildPickupDateTime(
        formValues.hotelLaunchHireBookingDate,
        formValues.hotelLaunchHireBookingTime
      );
      if (!launchHireBookingDatetime) {
        notify("Launch hire booking date and time are required.", "error", "top-center");
        return;
      }
    }

    const payload = {
      call_id: Number(callId),
      hotel_id: Number(formValues.hotelId),
      checkin_datetime: checkinDatetime,
      checkout_datetime: checkoutDatetime,
      remarks: formValues.hotelDescription || "",
      crew: (formValues.hotelSelectedCrew || []).map((id) => ({ crew_change_id: Number(id) })),
      launch_hire: isLaunchHire ? 1 : 0,
      location: isLaunchHire ? formValues.hotelLaunchHireLocation || "" : "",
      booking_datetime: isLaunchHire ? launchHireBookingDatetime : "",
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    const requestEmailFile = formValues.hotelRequestEmail?.[0]?.file;
    if (requestEmailFile) {
      formData.append("request_email", requestEmailFile);
    }

    const documents = formValues.hotelDocuments || [];
    let docIndex = 0;
    documents.forEach((attachment) => {
      const file = attachment?.file ?? attachment;
      if (file instanceof File) {
        formData.append(`documents[${docIndex}]`, file);
        docIndex += 1;
      }
    });

    setIsSavingHotel(true);
    try {
      const response = await hotelService.createHotelRequest(formData);
      notify(
        response?.data?.message || "Hotel request created successfully",
        "success",
        "top-center"
      );
      handleChange("hotelId")({ target: { value: "" } });
      handleChange("hotelName")({ target: { value: "" } });
      handleChange("hotelCheckInDate")({ target: { value: "" } });
      handleChange("hotelCheckInTime")({ target: { value: "" } });
      handleChange("hotelCheckOutDate")({ target: { value: "" } });
      handleChange("hotelCheckOutTime")({ target: { value: "" } });
      handleChange("hotelDescription")({ target: { value: "" } });
      handleChange("hotelRequestEmail")({ target: { value: [] } });
      handleChange("hotelDocuments")({ target: { value: [] } });
      handleChange("hotelSelectedCrew")({ target: { value: [] } });
      handleChange("hotelLaunchHire")({ target: { value: true } });
      handleChange("hotelLaunchHireLocation")({ target: { value: "" } });
      handleChange("hotelLaunchHireBookingDate")({ target: { value: "" } });
      handleChange("hotelLaunchHireBookingTime")({ target: { value: "" } });
      await fetchHotelRequests();
    } catch (error) {
      notify(
        error?.response?.data?.message || "Failed to create hotel request",
        "error",
        "top-center"
      );
    } finally {
      setIsSavingHotel(false);
    }
  }, [callId, formValues, fetchHotelRequests, isLaunchHire, handleChange]);

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form hotel-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
            <div className="general-info-left crew-pass-premium-left">
              <div className={`crew-pass-request-details-card husb-accent-${HOTEL_ACCENT}`}>
                <PremiumCardHeader
                  icon="hotel"
                  title="New hotel request"
                  subtitle="Book a stay for crew accommodation"
                  headerClassName="crew-pass-request-details-card__header"
                  titleClassName="crew-pass-request-details-card__title"
                />
                <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                <FormGroup icon="mail" label="Request Email *" accent={HOTEL_ACCENT}>
                  <FormField>
                    <div className="transport-upload-box">
                      <AttachmentsList
                        attachments={formValues.hotelRequestEmail || []}
                        onAdd={() => {}}
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
                  selected={formValues.hotelSelectedCrew || []}
                  onChange={(ids) => handleChange("hotelSelectedCrew")({ target: { value: ids } })}
                  accent={HOTEL_ACCENT}
                  onGoToCrew={onGoToCrew}
                  uploadMode={crewUploadMode}
                />

                <FormGroup icon="calendar" label="Stay Details" accent={HOTEL_ACCENT}>
                  <FormField label="Hotel Name">
                    <FormSelect
                      value={formValues.hotelId || ""}
                      onChange={handleHotelChange}
                      options={hotelOptions}
                      placeholder={loadingHotels ? "Loading hotels..." : "Select hotel name..."}
                      disabled={loadingHotels}
                    />
                  </FormField>

                  <FieldRow>
                    <FormField label="Check-in Date">
                      <div className="transport-date-time-field">
                        <DateTimePickerField
                          dateValue={formValues.hotelCheckInDate || ""}
                          timeValue={formValues.hotelCheckInTime || ""}
                          onDateChange={handleChange("hotelCheckInDate")}
                          onTimeChange={handleChange("hotelCheckInTime")}
                          dateFieldName="hotelCheckInDate"
                          timeFieldName="hotelCheckInTime"
                          placeholder="Select date and time"
                        />
                      </div>
                    </FormField>

                    <FormField label="Check-out Date">
                      <div className="transport-date-time-field">
                        <DateTimePickerField
                          dateValue={formValues.hotelCheckOutDate || ""}
                          timeValue={formValues.hotelCheckOutTime || ""}
                          onDateChange={handleChange("hotelCheckOutDate")}
                          onTimeChange={handleChange("hotelCheckOutTime")}
                          dateFieldName="hotelCheckOutDate"
                          timeFieldName="hotelCheckOutTime"
                          placeholder="Select date and time"
                        />
                      </div>
                    </FormField>
                  </FieldRow>
                </FormGroup>

                {launchHireEnabled && (
                  <FormGroup icon="LAUNCH_HIRE" label="Launch Hire" accent={HOTEL_ACCENT}>
                    <FormField>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isLaunchHire}
                          onChange={(e) => handleChange("hotelLaunchHire")({ target: { value: e.target.checked } })}
                          style={{ width: 16, height: 16, accentColor: "var(--card-color)" }}
                        />
                        Launch hire required
                      </label>
                    </FormField>
                    {isLaunchHire && (
                      <FieldRow>
                        <FormField label="Location">
                          <FormSelect
                            value={formValues.hotelLaunchHireLocation || ""}
                            onChange={handleChange("hotelLaunchHireLocation")}
                            options={LAUNCH_HIRE_LOCATION_OPTIONS}
                            placeholder="Select location..."
                          />
                        </FormField>
                        <FormField label="Booking Date Time">
                          <div className="transport-date-time-field">
                            <DateTimePickerField
                              dateValue={formValues.hotelLaunchHireBookingDate || ""}
                              timeValue={formValues.hotelLaunchHireBookingTime || ""}
                              onDateChange={handleChange("hotelLaunchHireBookingDate")}
                              onTimeChange={handleChange("hotelLaunchHireBookingTime")}
                              dateFieldName="hotelLaunchHireBookingDate"
                              timeFieldName="hotelLaunchHireBookingTime"
                              placeholder="Select date and time"
                            />
                          </div>
                        </FormField>
                      </FieldRow>
                    )}
                  </FormGroup>
                )}

                <FormGroup icon="folder" label="Documents *" accent={HOTEL_ACCENT}>
                  <FormField className="cf-field-full">
                    <div className="transport-upload-box">
                      <AttachmentsList
                        attachments={formValues.hotelDocuments || []}
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
                      />
                    </div>
                  </FormField>
                </FormGroup>

                <FormGroup icon="notebook" label="Remarks" accent={HOTEL_ACCENT}>
                  <div className="cgpass-remarks">
                    <FormField>
                      <ReactQuillEditor
                        value={formValues?.hotelDescription || ""}
                        onChange={handleChange("hotelDescription")}
                        placeholder="Enter remarks..."
                        name="hotelDescription"
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
                    disabled={isSavingHotel}
                  >
                    {isSavingHotel ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>

            <div className="general-info-right crew-pass-requests-sidebar">
              <HusbandryServiceRequestsTable
                title="Hotel requests"
                subtitle="All hotel bookings for this job"
                icon="list"
                requests={hotelRequests}
                loading={loadingHotelRequests}
                columns={HOTEL_REQUEST_COLUMNS}
                emptyMessage="No hotel requests found"
                serviceType="hotel"
                accent={HOTEL_ACCENT}
                groupKey="hotel_request_id"
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

HotelContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  onRequestCountChange: PropTypes.func,
  onGoToCrew: PropTypes.func,
  crewUploadMode: PropTypes.bool,
};

export default HotelContent;