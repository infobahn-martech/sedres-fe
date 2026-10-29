import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../../components/Toaster";
import { FormSection, FormField, FormInput, FormSelect, FormGroup, FieldRow, PremiumCardHeader, ReactQuillEditor } from "./Husbandry.components";
import AttachmentsList from "../../appointment/AttachmentsList";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
import thirdPartyService from "../../../../../../../services/thirdPartyService";
import useThirdPartyServiceRequestReducer from "../../../../../../../store/ThirdPartyServiceRequestReducer";
import { buildPickupDateTime } from "../../../../../../../store/TransportContent";
import { MAIN_TABS, SERVICE_ACCENT, LAUNCH_HIRE_LOCATION_OPTIONS } from "./Husbandry.constants";

const THIRD_PARTY_ACCENT = SERVICE_ACCENT[MAIN_TABS.THIRD_PARTY_SERVICES];

const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;
const DOCUMENTS_ACCEPT_ATTR = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

const THIRD_PARTY_REQUEST_COLUMNS = [
  { key: "service_name", header: "Service Type", accessor: (r) => r?.service_name },
  { key: "remarks", header: "Remarks", accessor: (r) => r?.remarks },
  { key: "status", header: "Status", accessor: (r) => r?.status, type: "status" },
  { key: "requested_date", header: "Requested", accessor: (r) => r?.created_date, type: "date" },
  { key: "document", header: "Document", accessor: (r) => r?.document_url, type: "document" },
];

const unwrapApiList = (axiosData) => {
  const payload = axiosData?.data ?? axiosData;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const ThirdPartyServicesContent = ({ formValues, handleChange, cardColor, showLaunchHire = true }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const fileInputRef = useRef(null);
  const requestEmailInputRef = useRef(null);

  const [thirdPartyServiceCatalog, setThirdPartyServiceCatalog] = useState([]);
  const [loadingThirdPartyServiceCatalog, setLoadingThirdPartyServiceCatalog] = useState(false);

  const callId = formValues.call_id || formValues.callId || formValues.card_call_id;
  const isLaunchHire = showLaunchHire && formValues.thirdPartyServicesLaunchHire !== false;
  const {
    thirdPartyServiceRequests,
    isLoadingList,
    isSaving,
    getThirdPartyServiceRequests,
    createThirdPartyServiceRequest,
  } = useThirdPartyServiceRequestReducer();

  useEffect(() => {
    void getThirdPartyServiceRequests(callId);
  }, [callId, getThirdPartyServiceRequests]);

  const thirdPartyServiceRequestRows = thirdPartyServiceRequests.map((row) => ({
    ...row,
    document_url: row?.request_email_url || row?.documents?.[0]?.file_url || "",
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingThirdPartyServiceCatalog(true);
        const { data } = await thirdPartyService.getThirdPartyServices({
          params: {
            page: 1,
            limit: 1000,
            sortBy: "third_party_service",
            sortOrder: "ASC",
          },
        });
        const list = unwrapApiList(data);
        if (!cancelled) setThirdPartyServiceCatalog(list);
      } catch {
        if (!cancelled) setThirdPartyServiceCatalog([]);
      } finally {
        if (!cancelled) setLoadingThirdPartyServiceCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fileToAttachment = (file) => ({
    name: file.name,
    file,
    size: file.size,
    type: file.type,
  });

  const normalizeAttachmentList = (items) =>
    (items || []).map((item) =>
      item && typeof item === "object" && "file" in item && item.file instanceof File
        ? item
        : item instanceof File
          ? fileToAttachment(item)
          : item
    );

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
    handleChange("thirdPartyServicesRequestEmailDocuments")({
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
      handleChange("thirdPartyServicesRequestEmailDocuments")({
        target: { value: [fileToAttachment(allowed[0])] },
      });
    }
    if (requestEmailInputRef.current) {
      requestEmailInputRef.current.value = "";
    }
  };

  const handleRequestEmailRemoveAttachment = () => {
    handleChange("thirdPartyServicesRequestEmailDocuments")({ target: { value: [] } });
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
      const current = normalizeAttachmentList(formValues.thirdPartyServicesDocuments || []);
      const added = files.map(fileToAttachment);
      handleChange("thirdPartyServicesDocuments")({ target: { value: [...current, ...added] } });
    }
  };

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const current = normalizeAttachmentList(formValues.thirdPartyServicesDocuments || []);
      const added = files.map(fileToAttachment);
      handleChange("thirdPartyServicesDocuments")({ target: { value: [...current, ...added] } });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDocumentsRemoveAttachment = (index) => {
    const current = normalizeAttachmentList(formValues.thirdPartyServicesDocuments || []);
    handleChange("thirdPartyServicesDocuments")({
      target: { value: current.filter((_, i) => i !== index) },
    });
  };

  const serviceTypeOptions = useMemo(() => {
    const fromApi = thirdPartyServiceCatalog.map((row) => ({
      value: String(row.third_party_service_id ?? row._id ?? ""),
      label: row.third_party_service ?? "",
    }));
    return fromApi.filter((o) => o.value);
  }, [thirdPartyServiceCatalog]);

  const handleSave = useCallback(async () => {
    if (!callId) {
      notify("Call is required to save a third-party service request.", "error", "top-center");
      return;
    }
    if (!formValues.thirdPartyServiceType) {
      notify("Service type is required.", "error", "top-center");
      return;
    }

    let launchHireBookingDatetime = "";
    if (isLaunchHire) {
      if (!formValues.thirdPartyServicesLaunchHireLocation) {
        notify("Launch hire location is required.", "error", "top-center");
        return;
      }
      launchHireBookingDatetime = buildPickupDateTime(
        formValues.thirdPartyServicesLaunchHireBookingDate,
        formValues.thirdPartyServicesLaunchHireBookingTime
      );
      if (!launchHireBookingDatetime) {
        notify("Launch hire booking date and time are required.", "error", "top-center");
        return;
      }
    }

    const payload = {
      call_id: Number(callId),
      third_party_service_id: Number(formValues.thirdPartyServiceType),
      charge_code: formValues.thirdPartyServicesChargeCode || "",
      remarks: formValues.thirdPartyServicesDescription || "",
      launch_hire: isLaunchHire ? 1 : 0,
      location: isLaunchHire ? formValues.thirdPartyServicesLaunchHireLocation || "" : "",
      booking_datetime: isLaunchHire ? launchHireBookingDatetime : "",
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    const requestEmailFile = normalizeAttachmentList(
      formValues.thirdPartyServicesRequestEmailDocuments || []
    )[0]?.file;
    if (requestEmailFile instanceof File) {
      formData.append("request_email", requestEmailFile);
    }

    normalizeAttachmentList(formValues.thirdPartyServicesDocuments || []).forEach((attachment) => {
      const file = attachment?.file ?? attachment;
      if (file instanceof File) {
        formData.append("attachments[]", file);
      }
    });

    try {
      const response = await createThirdPartyServiceRequest(formData);
      notify(
        response?.data?.message || "Third-party service request created successfully",
        "success",
        "top-center"
      );
      handleChange("thirdPartyServiceType")({ target: { value: "" } });
      handleChange("thirdPartyServicesChargeCode")({ target: { value: "" } });
      handleChange("thirdPartyServicesDescription")({ target: { value: "" } });
      handleChange("thirdPartyServicesRequestEmailDocuments")({ target: { value: [] } });
      handleChange("thirdPartyServicesDocuments")({ target: { value: [] } });
      handleChange("thirdPartyServicesLaunchHire")({ target: { value: true } });
      handleChange("thirdPartyServicesLaunchHireLocation")({ target: { value: "" } });
      handleChange("thirdPartyServicesLaunchHireBookingDate")({ target: { value: "" } });
      handleChange("thirdPartyServicesLaunchHireBookingTime")({ target: { value: "" } });
      await getThirdPartyServiceRequests(callId);
    } catch (error) {
      notify(
        error?.response?.data?.message || "Failed to create third-party service request",
        "error",
        "top-center"
      );
    }
  }, [callId, formValues, isLaunchHire, createThirdPartyServiceRequest, getThirdPartyServiceRequests, handleChange]);

  const requestEmailAttachments = normalizeAttachmentList(
    formValues.thirdPartyServicesRequestEmailDocuments || []
  );
  const documentsAttachments = normalizeAttachmentList(formValues.thirdPartyServicesDocuments || []);

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form third-party-services-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
            <div className="general-info-left crew-pass-premium-left">
              <div className={`crew-pass-request-details-card husb-accent-${THIRD_PARTY_ACCENT}`}>
                <PremiumCardHeader
                  icon="thirdPartyServices"
                  title="Request Details"
                  subtitle="Submit a third-party service request for this call"
                  headerClassName="crew-pass-request-details-card__header"
                  titleClassName="crew-pass-request-details-card__title"
                />
                <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                  <FormGroup icon="mail" label="Request Email" accent={THIRD_PARTY_ACCENT}>
                    <FormField>
                      <div className="transport-upload-box">
                        <AttachmentsList
                          attachments={requestEmailAttachments}
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
                        />
                      </div>
                    </FormField>
                  </FormGroup>
                      <FormGroup icon="list" label="Service Type" accent={THIRD_PARTY_ACCENT}>
                    <FormField>
                      <FormSelect
                        value={formValues.thirdPartyServiceType || ""}
                        onChange={handleChange("thirdPartyServiceType")}
                        options={serviceTypeOptions}
                        placeholder={
                          loadingThirdPartyServiceCatalog
                            ? "Loading service types..."
                            : "Select service type..."
                        }
                        disabled={loadingThirdPartyServiceCatalog}
                      />
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="notebook" label="Charge Code/Project Name" accent={THIRD_PARTY_ACCENT}>
                    <FormField>
                      <FormInput
                        type="text"
                        value={formValues.thirdPartyServicesChargeCode || ""}
                        onChange={handleChange("thirdPartyServicesChargeCode")}
                        placeholder="Enter charge code / project name..."
                      />
                    </FormField>
                  </FormGroup>

                  {showLaunchHire && (
                  <FormGroup icon="LAUNCH_HIRE" label="Launch Hire" accent={THIRD_PARTY_ACCENT}>
                    <FormField>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isLaunchHire}
                          onChange={(e) => handleChange("thirdPartyServicesLaunchHire")({ target: { value: e.target.checked } })}
                          style={{ width: 16, height: 16, accentColor: "var(--card-color)" }}
                        />
                        Launch hire required
                      </label>
                    </FormField>
                    {isLaunchHire && (
                      <FieldRow>
                        <FormField label="Location">
                          <FormSelect
                            value={formValues.thirdPartyServicesLaunchHireLocation || ""}
                            onChange={handleChange("thirdPartyServicesLaunchHireLocation")}
                            options={LAUNCH_HIRE_LOCATION_OPTIONS}
                            placeholder="Select location..."
                          />
                        </FormField>
                        <FormField label="Booking Date Time">
                          <DateTimePickerField
                            dateValue={formValues.thirdPartyServicesLaunchHireBookingDate || ""}
                            timeValue={formValues.thirdPartyServicesLaunchHireBookingTime || ""}
                            onDateChange={handleChange("thirdPartyServicesLaunchHireBookingDate")}
                            onTimeChange={handleChange("thirdPartyServicesLaunchHireBookingTime")}
                            dateFieldName="thirdPartyServicesLaunchHireBookingDate"
                            timeFieldName="thirdPartyServicesLaunchHireBookingTime"
                            placeholder="Select date and time"
                          />
                        </FormField>
                      </FieldRow>
                    )}
                  </FormGroup>
                  )}

                  <FormGroup icon="folder" label="Documents" accent={THIRD_PARTY_ACCENT}>
                    <FormField className="cf-field-full">
                      <div className="transport-upload-box">
                        <AttachmentsList
                          attachments={documentsAttachments}
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
                          accept={DOCUMENTS_ACCEPT_ATTR}
                          multiple
                        />
                      </div>
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="notebook" label="Remarks" accent={THIRD_PARTY_ACCENT}>
                    <div className="cgpass-remarks">
                      <FormField>
                        <ReactQuillEditor
                          value={formValues?.thirdPartyServicesDescription || ""}
                          onChange={handleChange("thirdPartyServicesDescription")}
                          placeholder="Enter remarks..."
                          name="thirdPartyServicesDescription"
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
                title="Third-Party Service Requests"
                requests={thirdPartyServiceRequestRows}
                loading={isLoadingList}
                columns={THIRD_PARTY_REQUEST_COLUMNS}
                serviceType="THIRD_PARTY"
                emptyMessage="No service requests found"
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

ThirdPartyServicesContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  showLaunchHire: PropTypes.bool,
};

export default ThirdPartyServicesContent;
