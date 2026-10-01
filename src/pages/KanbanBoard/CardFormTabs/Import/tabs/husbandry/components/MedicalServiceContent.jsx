import { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../../components/Toaster";
import { FormSection, FormField, FormSelect, ReactQuillEditor, FormGroup, FieldRow, PremiumCardHeader } from "./Husbandry.components";
import AttachmentsList from "../../appointment/AttachmentsList";
import hospitalService, {
  extractMedicalRequestsFromEnvelope,
  flattenMedicalRequestRows,
} from "../../../../../../../services/hospitalService";
import callFileService from "../../../../../../../services/callFileService";
import { buildPickupDateTime } from "../../../../../../../store/TransportContent";
import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
import CrewSelectionField from "./CrewSelectionField";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import { CREW_MANAGEMENT_SUBTABS, SERVICE_ACCENT, LAUNCH_HIRE_LOCATION_OPTIONS } from "./Husbandry.constants";

const MEDICAL_ACCENT = SERVICE_ACCENT[CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE];

const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;

const MEDICAL_REQUEST_COLUMNS = [
  {
    key: "wo_number",
    header: "Work Order",
    accessor: (r) => r?.wo_number || r?.wo_id || r?.medical_request_id,
    type: "workorder",
  },
  { key: "crew_name", header: "Crew", accessor: (r) => r?.crew_name ?? r?.crewName, type: "crew", perCrew: true },
  { key: "hospital_name", header: "Hospital", accessor: (r) => r?.hospital_name ?? r?.hospitalName },
  { key: "service_name", header: "Service", accessor: (r) => r?.service_name ?? r?.medical_service_name },
  { key: "status", header: "Status", accessor: (r) => r?.status, type: "status" },
  { key: "requested_date", header: "Requested Date", accessor: (r) => r?.requested_date ?? r?.created_date, type: "date" },
  { key: "document", header: "Document", type: "document" },
];

const MedicalServiceContent = ({ formValues, handleChange, cardColor, onRequestCountChange, onGoToCrew, crewUploadMode = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const fileInputRef = useRef(null);
  const requestEmailInputRef = useRef(null);
  const callId = formValues.call_id || formValues.callId || formValues.card_call_id;

  const [callDetails, setCallDetails] = useState(null);
  const launchHireEnabled = Number(callDetails?.launch_hire) === 1;
  const isLaunchHire = launchHireEnabled && formValues.medicalServiceLaunchHire !== false;

  const [hospitals, setHospitals] = useState([]);
  const [hospitalServices, setHospitalServices] = useState([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [medicalRequests, setMedicalRequests] = useState([]);
  const [loadingMedicalRequests, setLoadingMedicalRequests] = useState(false);

  const fetchMedicalRequests = useCallback(async () => {
    if (!callId) {
      setMedicalRequests([]);
      setLoadingMedicalRequests(false);
      return;
    }
    setLoadingMedicalRequests(true);
    try {
      const response = await hospitalService.getMedicalRequests(callId);
      const list = extractMedicalRequestsFromEnvelope(response);
      setMedicalRequests(flattenMedicalRequestRows(list));
      onRequestCountChange?.(list.length);
    } catch {
      setMedicalRequests([]);
      onRequestCountChange?.(0);
    } finally {
      setLoadingMedicalRequests(false);
    }
  }, [callId, onRequestCountChange]);

  useEffect(() => {
    void fetchMedicalRequests();
  }, [fetchMedicalRequests]);

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
        setLoadingHospitals(true);
        const { data } = await hospitalService.getHospitalData({
          params: { page: 1, limit: 500, search: "" },
        });
        const list = data?.data ?? [];
        if (!cancelled) setHospitals(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setHospitals([]);
      } finally {
        if (!cancelled) setLoadingHospitals(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const hospitalId = formValues.medicalServiceSelectedHospital;
    if (!hospitalId) {
      setHospitalServices([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingServices(true);
        const { data } = await hospitalService.getServiceByHospital(hospitalId);
        const payload = data?.data ?? data;
        const list = payload?.services ?? [];
        if (!cancelled) setHospitalServices(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setHospitalServices([]);
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formValues.medicalServiceSelectedHospital]);

  const hospitalOptions = hospitals.map((h) => ({
    value: String(h.hospital_id ?? h._id ?? ""),
    label: h.hospital_name ?? "",
  }));

  const medicalServiceOptions = hospitalServices.map((s) => ({
    value: String(s.service_id ?? s._id ?? ""),
    label: s.service_name ?? "",
  }));

  const handleHospitalChange = (e) => {
    handleChange("medicalServiceSelectedHospital")(e);
    handleChange("medicalServiceSelectedService")({ target: { value: "" } });
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
    handleChange("medicalServiceRequestEmail")({
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
      handleChange("medicalServiceRequestEmail")({
        target: { value: [fileToAttachment(allowed[0])] },
      });
    }
    if (requestEmailInputRef.current) {
      requestEmailInputRef.current.value = "";
    }
  };

  const handleRequestEmailRemoveAttachment = () => {
    handleChange("medicalServiceRequestEmail")({ target: { value: [] } });
  };

  const handleDocumentsDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDocumentsDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDocumentsDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDocumentsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const current = formValues.medicalServiceDocuments || [];
      const added = files.map(fileToAttachment);
      handleChange("medicalServiceDocuments")({ target: { value: [...current, ...added] } });
    }
  };

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const current = formValues.medicalServiceDocuments || [];
      const added = files.map(fileToAttachment);
      handleChange("medicalServiceDocuments")({ target: { value: [...current, ...added] } });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDocumentsRemoveAttachment = (index) => {
    const current = formValues.medicalServiceDocuments || [];
    handleChange("medicalServiceDocuments")({ target: { value: current.filter((_, i) => i !== index) } });
  };

  const handleSave = useCallback(async () => {
    if (!callId) {
      notify("Call is required to save a medical request.", "error", "top-center");
      return;
    }

    if (!formValues.medicalServiceSelectedHospital) {
      notify("Hospital is required.", "error", "top-center");
      return;
    }

    if (!formValues.medicalServiceSelectedService) {
      notify("Medical service is required.", "error", "top-center");
      return;
    }

    let launchHireBookingDatetime = "";
    if (isLaunchHire) {
      if (!formValues.medicalServiceLaunchHireLocation) {
        notify("Launch hire location is required.", "error", "top-center");
        return;
      }
      launchHireBookingDatetime = buildPickupDateTime(
        formValues.medicalServiceLaunchHireBookingDate,
        formValues.medicalServiceLaunchHireBookingTime
      );
      if (!launchHireBookingDatetime) {
        notify("Launch hire booking date and time are required.", "error", "top-center");
        return;
      }
    }

    const payload = {
      call_id: Number(callId),
      hospital_id: Number(formValues.medicalServiceSelectedHospital),
      medical_service_id: Number(formValues.medicalServiceSelectedService),
      remarks: formValues.medicalServiceDescription || "",
      crew: (formValues.medicalServiceSelectedCrew || []).map((id) => ({ crew_change_id: Number(id) })),
      launch_hire: isLaunchHire ? 1 : 0,
      location: isLaunchHire ? formValues.medicalServiceLaunchHireLocation || "" : "",
      booking_datetime: isLaunchHire ? launchHireBookingDatetime : "",
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    const requestEmailFile = formValues.medicalServiceRequestEmail?.[0]?.file;
    if (requestEmailFile) {
      formData.append("request_email", requestEmailFile);
    }

    const documents = formValues.medicalServiceDocuments || [];
    let docIndex = 0;
    documents.forEach((attachment) => {
      const file = attachment?.file ?? attachment;
      if (file instanceof File) {
        formData.append(`attachments[${docIndex}]`, file);
        docIndex += 1;
      }
    });

    setIsSaving(true);
    try {
      const response = await hospitalService.createMedicalRequest(formData);
      notify(
        response?.data?.message || "Medical request created successfully",
        "success",
        "top-center"
      );
      handleChange("medicalServiceSelectedHospital")({ target: { value: "" } });
      handleChange("medicalServiceSelectedService")({ target: { value: "" } });
      handleChange("medicalServiceSelectedCrew")({ target: { value: [] } });
      handleChange("medicalServiceRequestEmail")({ target: { value: [] } });
      handleChange("medicalServiceDocuments")({ target: { value: [] } });
      handleChange("medicalServiceDescription")({ target: { value: "" } });
      handleChange("medicalServiceLaunchHire")({ target: { value: true } });
      handleChange("medicalServiceLaunchHireLocation")({ target: { value: "" } });
      handleChange("medicalServiceLaunchHireBookingDate")({ target: { value: "" } });
      handleChange("medicalServiceLaunchHireBookingTime")({ target: { value: "" } });
      await fetchMedicalRequests();
    } catch (error) {
      notify(
        error?.response?.data?.message || "Failed to create medical request",
        "error",
        "top-center"
      );
    } finally {
      setIsSaving(false);
    }
  }, [callId, formValues, fetchMedicalRequests, isLaunchHire, handleChange]);

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form medicalservice-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
            <div className="general-info-left crew-pass-premium-left">
              <div className={`crew-pass-request-details-card husb-accent-${MEDICAL_ACCENT}`}>
                <PremiumCardHeader
                  icon="medicalService"
                  title="New medical request"
                  subtitle="Arrange hospital care for crew"
                  headerClassName="crew-pass-request-details-card__header"
                  titleClassName="crew-pass-request-details-card__title"
                />
                <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                <FormGroup icon="mail" label="Request Email *" accent={MEDICAL_ACCENT}>
                  <FormField>
                    <div className="transport-upload-box">
                      <AttachmentsList
                        attachments={formValues.medicalServiceRequestEmail || []}
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
                  selected={formValues.medicalServiceSelectedCrew || []}
                  onChange={(ids) => handleChange("medicalServiceSelectedCrew")({ target: { value: ids } })}
                  accent={MEDICAL_ACCENT}
                  onGoToCrew={onGoToCrew}
                  uploadMode={crewUploadMode}
                />

                <FormGroup icon="medicalService" label="Care Details" accent={MEDICAL_ACCENT}>
                  <FieldRow>
                    <FormField label="Hospital">
                      <FormSelect
                        value={formValues.medicalServiceSelectedHospital || ""}
                        onChange={handleHospitalChange}
                        options={hospitalOptions}
                        placeholder={loadingHospitals ? "Loading hospitals..." : "Select hospital..."}
                        disabled={loadingHospitals}
                      />
                    </FormField>

                    <FormField label="Medical Service">
                      <FormSelect
                        value={formValues.medicalServiceSelectedService || ""}
                        onChange={handleChange("medicalServiceSelectedService")}
                        options={medicalServiceOptions}
                        placeholder={
                          !formValues.medicalServiceSelectedHospital
                            ? "Select a hospital first..."
                            : loadingServices
                              ? "Loading services..."
                              : "Select medical service..."
                        }
                        disabled={!formValues.medicalServiceSelectedHospital || loadingServices}
                      />
                    </FormField>
                  </FieldRow>
                </FormGroup>

                {launchHireEnabled && (
                  <FormGroup icon="LAUNCH_HIRE" label="Launch Hire" accent={MEDICAL_ACCENT}>
                    <FormField>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isLaunchHire}
                          onChange={(e) => handleChange("medicalServiceLaunchHire")({ target: { value: e.target.checked } })}
                          style={{ width: 16, height: 16, accentColor: "var(--card-color)" }}
                        />
                        Launch hire required
                      </label>
                    </FormField>
                    {isLaunchHire && (
                      <FieldRow>
                        <FormField label="Location">
                          <FormSelect
                            value={formValues.medicalServiceLaunchHireLocation || ""}
                            onChange={handleChange("medicalServiceLaunchHireLocation")}
                            options={LAUNCH_HIRE_LOCATION_OPTIONS}
                            placeholder="Select location..."
                          />
                        </FormField>
                        <FormField label="Booking Date Time">
                          <DateTimePickerField
                            dateValue={formValues.medicalServiceLaunchHireBookingDate || ""}
                            timeValue={formValues.medicalServiceLaunchHireBookingTime || ""}
                            onDateChange={handleChange("medicalServiceLaunchHireBookingDate")}
                            onTimeChange={handleChange("medicalServiceLaunchHireBookingTime")}
                            dateFieldName="medicalServiceLaunchHireBookingDate"
                            timeFieldName="medicalServiceLaunchHireBookingTime"
                            placeholder="Select date and time"
                          />
                        </FormField>
                      </FieldRow>
                    )}
                  </FormGroup>
                )}

                <FormGroup icon="folder" label="Documents *" accent={MEDICAL_ACCENT}>
                  <FormField className="cf-field-full">
                    <div className="transport-upload-box">
                      <AttachmentsList
                        attachments={formValues.medicalServiceDocuments || []}
                        onAdd={() => {}}
                        onRemove={handleDocumentsRemoveAttachment}
                        cardColor={cardColor}
                        isDragging={isDragging}
                        onDragEnter={handleDocumentsDragEnter}
                        onDragLeave={handleDocumentsDragLeave}
                        onDragOver={handleDocumentsDragOver}
                        onDrop={handleDocumentsDrop}
                        fileInputRef={fileInputRef}
                        onFileInputChange={handleDocumentsFileInputChange}
                      />
                    </div>
                  </FormField>
                </FormGroup>

                <FormGroup icon="notebook" label="Remarks" accent={MEDICAL_ACCENT}>
                  <div className="cgpass-remarks">
                    <FormField>
                      <ReactQuillEditor
                        value={formValues?.medicalServiceDescription || ""}
                        onChange={handleChange("medicalServiceDescription")}
                        placeholder="Enter remarks..."
                        name="medicalServiceDescription"
                      />
                    </FormField>
                  </div>
                </FormGroup>

                </div>
                <div className="form-save-button-wrapper cgpass-save-footer">
                  <button type="button" className="form-save-button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>

            <div className="general-info-right crew-pass-requests-sidebar">
              <HusbandryServiceRequestsTable
                title="Medical requests"
                subtitle="All medical bookings for this job"
                icon="list"
                requests={medicalRequests}
                loading={loadingMedicalRequests}
                columns={MEDICAL_REQUEST_COLUMNS}
                emptyMessage="No medical requests found"
                serviceType="medical"
                accent={MEDICAL_ACCENT}
                groupKey="medical_request_id"
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

MedicalServiceContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  onRequestCountChange: PropTypes.func,
  onGoToCrew: PropTypes.func,
  crewUploadMode: PropTypes.bool,
};

export default MedicalServiceContent;
