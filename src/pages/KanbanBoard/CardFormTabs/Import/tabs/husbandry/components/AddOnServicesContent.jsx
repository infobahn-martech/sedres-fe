import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../../components/Toaster";
import { FormSection, FormField, FormSelect, FormGroup, FieldRow, PremiumCardHeader, ReactQuillEditor } from "./Husbandry.components";
import AttachmentsList from "../../appointment/AttachmentsList";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
import addOnService from "../../../../../../../services/addOnService";
import useAddOnServiceRequestReducer from "../../../../../../../store/AddOnServiceRequestReducer";
import { buildPickupDateTime } from "../../../../../../../store/TransportContent";
import {
  MAIN_TABS,
  SERVICE_ACCENT,
  LAUNCH_HIRE_LOCATION_OPTIONS,
  ADD_ON_SERVICE_TYPE_IDS,
  TANKER_CLEARANCE_DOCUMENT_NAMES,
} from "./Husbandry.constants";

const ADD_ON_SERVICE_ACCENT = SERVICE_ACCENT[MAIN_TABS.ADD_ON_SERVICES];

const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;
const DOCUMENTS_ACCEPT_ATTR = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

const unwrapApiList = (axiosData) => {
  const payload = axiosData?.data ?? axiosData;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const ADD_ON_SERVICE_REQUEST_COLUMNS = [
  { key: "service_name", header: "Service Type", accessor: (r) => r?.service_name },
  { key: "remarks", header: "Remarks", accessor: (r) => r?.remarks },
  { key: "status", header: "Status", accessor: (r) => r?.status, type: "status" },
  { key: "requested_date", header: "Requested", accessor: (r) => r?.created_date, type: "date" },
  { key: "document", header: "Document", accessor: (r) => r?.document_url, type: "document" },
];

const AddOnServicesContent = ({ formValues, handleChange, cardColor, showLaunchHire = true }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const fileInputRef = useRef(null);
  const requestEmailInputRef = useRef(null);

  const [addOnServiceCatalog, setAddOnServiceCatalog] = useState([]);
  const [loadingAddOnServiceCatalog, setLoadingAddOnServiceCatalog] = useState(false);

  const callId = formValues.call_id || formValues.callId || formValues.card_call_id;
  const isOthersSelected = formValues.addOnServiceType === "Others";
  const selectedServiceId = isOthersSelected ? null : Number(formValues.addOnServiceType);
  const isProvisionDelivery = selectedServiceId === ADD_ON_SERVICE_TYPE_IDS.PROVISION_DELIVERY;
  const isTankerClearance = selectedServiceId === ADD_ON_SERVICE_TYPE_IDS.TANKER_CLEARANCE;
  const isLaunchHire = showLaunchHire && !isTankerClearance && formValues.addOnServicesLaunchHire !== false;
  const {
    addOnServiceRequests,
    isLoadingList,
    isSaving,
    getAddOnServiceRequests,
    createAddOnServiceRequest,
  } = useAddOnServiceRequestReducer();

  useEffect(() => {
    void getAddOnServiceRequests(callId);
  }, [callId, getAddOnServiceRequests]);

  const addOnServiceRequestRows = addOnServiceRequests.map((row) => ({
    ...row,
    document_url: row?.request_email_url || row?.documents?.[0]?.file_url || "",
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingAddOnServiceCatalog(true);
        const { data } = await addOnService.getAllAddOnServices();
        const list = unwrapApiList(data);
        if (!cancelled) setAddOnServiceCatalog(list);
      } catch {
        if (!cancelled) setAddOnServiceCatalog([]);
      } finally {
        if (!cancelled) setLoadingAddOnServiceCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addOnServiceTypeOptions = useMemo(() => {
    const fromApi = addOnServiceCatalog.map((row) => ({
      value: String(row.addon_service_id ?? row._id ?? ""),
      label: row.service_name ?? "",
    }));
    return [...fromApi.filter((o) => o.value), { value: "Others", label: "Others" }];
  }, [addOnServiceCatalog]);

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
    handleChange("addOnServicesRequestEmailDocuments")({
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
      handleChange("addOnServicesRequestEmailDocuments")({
        target: { value: [fileToAttachment(allowed[0])] },
      });
    }
    if (requestEmailInputRef.current) {
      requestEmailInputRef.current.value = "";
    }
  };

  const handleRequestEmailRemoveAttachment = () => {
    handleChange("addOnServicesRequestEmailDocuments")({ target: { value: [] } });
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
      const current = normalizeAttachmentList(formValues.addOnServicesDocuments || []);
      const added = files.map(fileToAttachment);
      handleChange("addOnServicesDocuments")({ target: { value: [...current, ...added] } });
    }
  };

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const current = normalizeAttachmentList(formValues.addOnServicesDocuments || []);
      const added = files.map(fileToAttachment);
      handleChange("addOnServicesDocuments")({ target: { value: [...current, ...added] } });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDocumentsRemoveAttachment = (index) => {
    const current = normalizeAttachmentList(formValues.addOnServicesDocuments || []);
    handleChange("addOnServicesDocuments")({
      target: { value: current.filter((_, i) => i !== index) },
    });
  };

  const tankerDocuments = formValues.addOnServicesTankerDocuments || {};

  const handleTankerDocumentFileChange = (docName) => (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleChange("addOnServicesTankerDocuments")({
        target: { value: { ...tankerDocuments, [docName]: fileToAttachment(file) } },
      });
    }
    e.target.value = "";
  };

  const handleTankerDocumentRemove = (docName) => () => {
    const next = { ...tankerDocuments };
    delete next[docName];
    handleChange("addOnServicesTankerDocuments")({ target: { value: next } });
  };

  const handleSave = useCallback(async () => {
    if (!callId) {
      notify("Call is required to save an add-on service request.", "error", "top-center");
      return;
    }
    if (!formValues.addOnServiceType) {
      notify("Service type is required.", "error", "top-center");
      return;
    }
    if (isOthersSelected && !formValues.addOnServiceTypeOther) {
      notify("Please specify the other service type.", "error", "top-center");
      return;
    }

    let launchHireBookingDatetime = "";
    if (isLaunchHire) {
      if (!formValues.addOnServicesLaunchHireLocation) {
        notify("Launch hire location is required.", "error", "top-center");
        return;
      }
      launchHireBookingDatetime = buildPickupDateTime(
        formValues.addOnServicesLaunchHireBookingDate,
        formValues.addOnServicesLaunchHireBookingTime
      );
      if (!launchHireBookingDatetime) {
        notify("Launch hire booking date and time are required.", "error", "top-center");
        return;
      }
    }

    const tankerDocumentEntries = TANKER_CLEARANCE_DOCUMENT_NAMES.filter(
      (docName) => tankerDocuments[docName]?.file instanceof File
    ).map((docName) => ({ name: docName, file: tankerDocuments[docName].file }));

    const payload = {
      call_id: Number(callId),
      ...(isOthersSelected
        ? { service_name: formValues.addOnServiceTypeOther || "" }
        : { addon_service_id: Number(formValues.addOnServiceType) }),
      remarks: formValues.addOnServicesDescription || "",
      ...(isProvisionDelivery && {
        handling_required: formValues.addOnServicesHandlingRequired ? "Yes" : "No",
        pallets_handled: Number(formValues.addOnServicesPalletsHandled) || 0,
        handling_amount: Number(formValues.addOnServicesHandlingAmount) || 0,
      }),
      ...(isTankerClearance
        ? { document_names: tankerDocumentEntries.map((entry) => entry.name) }
        : {
            launch_hire: isLaunchHire ? 1 : 0,
            location: isLaunchHire ? formValues.addOnServicesLaunchHireLocation || "" : "",
            booking_datetime: isLaunchHire ? launchHireBookingDatetime : "",
          }),
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    const requestEmailFile = normalizeAttachmentList(
      formValues.addOnServicesRequestEmailDocuments || []
    )[0]?.file;
    if (requestEmailFile instanceof File) {
      formData.append("request_email", requestEmailFile);
    }

    if (isTankerClearance) {
      tankerDocumentEntries.forEach((entry) => {
        formData.append("attachments[]", entry.file);
      });
    } else {
      normalizeAttachmentList(formValues.addOnServicesDocuments || []).forEach((attachment) => {
        const file = attachment?.file ?? attachment;
        if (file instanceof File) {
          formData.append("attachments[]", file);
        }
      });
    }

    try {
      const response = await createAddOnServiceRequest(formData);
      notify(
        response?.data?.message || "Add-on service request created successfully",
        "success",
        "top-center"
      );
      handleChange("addOnServiceType")({ target: { value: "" } });
      handleChange("addOnServiceTypeOther")({ target: { value: "" } });
      handleChange("addOnServicesDescription")({ target: { value: "" } });
      handleChange("addOnServicesRequestEmailDocuments")({ target: { value: [] } });
      handleChange("addOnServicesDocuments")({ target: { value: [] } });
      handleChange("addOnServicesLaunchHire")({ target: { value: true } });
      handleChange("addOnServicesLaunchHireLocation")({ target: { value: "" } });
      handleChange("addOnServicesLaunchHireBookingDate")({ target: { value: "" } });
      handleChange("addOnServicesLaunchHireBookingTime")({ target: { value: "" } });
      handleChange("addOnServicesHandlingRequired")({ target: { value: false } });
      handleChange("addOnServicesPalletsHandled")({ target: { value: "" } });
      handleChange("addOnServicesHandlingAmount")({ target: { value: "" } });
      handleChange("addOnServicesTankerDocuments")({ target: { value: {} } });
      await getAddOnServiceRequests(callId);
    } catch (error) {
      notify(
        error?.response?.data?.message || "Failed to create add-on service request",
        "error",
        "top-center"
      );
    }
  }, [
    callId,
    formValues,
    isOthersSelected,
    isProvisionDelivery,
    isTankerClearance,
    isLaunchHire,
    tankerDocuments,
    createAddOnServiceRequest,
    getAddOnServiceRequests,
    handleChange,
  ]);

  const requestEmailAttachments = normalizeAttachmentList(
    formValues.addOnServicesRequestEmailDocuments || []
  );
  const documentsAttachments = normalizeAttachmentList(formValues.addOnServicesDocuments || []);

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form add-on-services-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
            <div className="general-info-left crew-pass-premium-left">
              <div className={`crew-pass-request-details-card husb-accent-${ADD_ON_SERVICE_ACCENT}`}>
                <PremiumCardHeader
                  icon="addOnServices"
                  title="Request Details"
                  subtitle="Submit an add-on service request for this call"
                  headerClassName="crew-pass-request-details-card__header"
                  titleClassName="crew-pass-request-details-card__title"
                />
                <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                  <FormGroup icon="list" label="Service Type" accent={ADD_ON_SERVICE_ACCENT}>
                    <FormField>
                      <FormSelect
                        value={formValues.addOnServiceType || ""}
                        onChange={handleChange("addOnServiceType")}
                        options={addOnServiceTypeOptions}
                        placeholder={
                          loadingAddOnServiceCatalog
                            ? "Loading service types..."
                            : "Select service type..."
                        }
                        disabled={loadingAddOnServiceCatalog}
                      />
                    </FormField>
                  </FormGroup>

                  {isOthersSelected && (
                    <FormField label="Specify Other Service Type">
                      <div className="cf-input">
                        <input
                          type="text"
                          value={formValues.addOnServiceTypeOther || ""}
                          onChange={handleChange("addOnServiceTypeOther")}
                          placeholder="Enter other service type..."
                        />
                      </div>
                    </FormField>
                  )}

                  {isProvisionDelivery && (
                    <FormGroup icon="billing" label="Handling Details" accent={ADD_ON_SERVICE_ACCENT}>
                      <FormField>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={!!formValues.addOnServicesHandlingRequired}
                            onChange={(e) => handleChange("addOnServicesHandlingRequired")({ target: { value: e.target.checked } })}
                            style={{ width: 16, height: 16, accentColor: "var(--card-color)" }}
                          />
                          Handling required
                        </label>
                      </FormField>
                      <FieldRow>
                        <FormField label="Pallets Handled">
                          <div className="cf-input">
                            <input
                              type="number"
                              min="0"
                              value={formValues.addOnServicesPalletsHandled || ""}
                              onChange={handleChange("addOnServicesPalletsHandled")}
                              placeholder="Enter pallets handled..."
                            />
                          </div>
                        </FormField>
                        <FormField label="Handling Amount">
                          <div className="cf-input">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formValues.addOnServicesHandlingAmount || ""}
                              onChange={handleChange("addOnServicesHandlingAmount")}
                              placeholder="Enter handling amount..."
                            />
                          </div>
                        </FormField>
                      </FieldRow>
                    </FormGroup>
                  )}

                  <FormGroup icon="mail" label="Request Email" accent={ADD_ON_SERVICE_ACCENT}>
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

                  {showLaunchHire && !isTankerClearance && (
                  <FormGroup icon="LAUNCH_HIRE" label="Launch Hire" accent={ADD_ON_SERVICE_ACCENT}>
                    <FormField>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isLaunchHire}
                          onChange={(e) => handleChange("addOnServicesLaunchHire")({ target: { value: e.target.checked } })}
                          style={{ width: 16, height: 16, accentColor: "var(--card-color)" }}
                        />
                        Launch hire required
                      </label>
                    </FormField>
                    {isLaunchHire && (
                      <FieldRow>
                        <FormField label="Location">
                          <FormSelect
                            value={formValues.addOnServicesLaunchHireLocation || ""}
                            onChange={handleChange("addOnServicesLaunchHireLocation")}
                            options={LAUNCH_HIRE_LOCATION_OPTIONS}
                            placeholder="Select location..."
                          />
                        </FormField>
                        <FormField label="Booking Date Time">
                          <DateTimePickerField
                            dateValue={formValues.addOnServicesLaunchHireBookingDate || ""}
                            timeValue={formValues.addOnServicesLaunchHireBookingTime || ""}
                            onDateChange={handleChange("addOnServicesLaunchHireBookingDate")}
                            onTimeChange={handleChange("addOnServicesLaunchHireBookingTime")}
                            dateFieldName="addOnServicesLaunchHireBookingDate"
                            timeFieldName="addOnServicesLaunchHireBookingTime"
                            placeholder="Select date and time"
                          />
                        </FormField>
                      </FieldRow>
                    )}
                  </FormGroup>
                  )}

                  {isTankerClearance ? (
                    <FormGroup icon="folder" label="Documents" accent={ADD_ON_SERVICE_ACCENT}>
                      <FormField className="cf-field-full">
                        <div className="add-on-tanker-documents-list">
                          {TANKER_CLEARANCE_DOCUMENT_NAMES.map((docName) => {
                            const attachment = tankerDocuments[docName];
                            return (
                              <div
                                key={docName}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                  padding: "8px 0",
                                  borderBottom: "1px solid var(--husb-border, #e2e8f0)",
                                  fontSize: "13px",
                                }}
                              >
                                <span>{docName}</span>
                                {attachment ? (
                                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ color: "#64748b" }}>{attachment.name}</span>
                                    <button
                                      type="button"
                                      onClick={handleTankerDocumentRemove(docName)}
                                      style={{ border: "none", background: "none", cursor: "pointer", color: "#e11d48" }}
                                    >
                                      Remove
                                    </button>
                                  </span>
                                ) : (
                                  <label style={{ cursor: "pointer", color: "var(--card-color)", fontWeight: 500 }}>
                                    Attach
                                    <input
                                      type="file"
                                      accept={DOCUMENTS_ACCEPT_ATTR}
                                      onChange={handleTankerDocumentFileChange(docName)}
                                      style={{ display: "none" }}
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </FormField>
                    </FormGroup>
                  ) : (
                    <FormGroup icon="folder" label="Documents" accent={ADD_ON_SERVICE_ACCENT}>
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
                  )}

                  <FormGroup icon="notebook" label="Remarks" accent={ADD_ON_SERVICE_ACCENT}>
                    <div className="cgpass-remarks">
                      <FormField>
                        <ReactQuillEditor
                          value={formValues?.addOnServicesDescription || ""}
                          onChange={handleChange("addOnServicesDescription")}
                          placeholder="Enter remarks..."
                          name="addOnServicesDescription"
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
                title="Add-on Service Requests"
                requests={addOnServiceRequestRows}
                loading={isLoadingList}
                columns={ADD_ON_SERVICE_REQUEST_COLUMNS}
                serviceType="ADD_ON"
                emptyMessage="No service requests found"
                accent={ADD_ON_SERVICE_ACCENT}
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

AddOnServicesContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  showLaunchHire: PropTypes.bool,
};

export default AddOnServicesContent;
