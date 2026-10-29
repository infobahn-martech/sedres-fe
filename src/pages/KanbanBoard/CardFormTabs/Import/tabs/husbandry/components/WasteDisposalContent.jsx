import { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../../components/Toaster";
import { FormSection, FormField, FormSelect, FormGroup, PremiumCardHeader, ReactQuillEditor } from "./Husbandry.components";
import AttachmentsList from "../../appointment/AttachmentsList";
import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import wasteTypeService from "../../../../../../../services/wasteTypeService";
import useWasteDisposalReducer from "../../../../../../../store/WasteDisposalReducer";
import { MAIN_TABS, SERVICE_ACCENT } from "./Husbandry.constants";

const WASTE_DISPOSAL_ACCENT = SERVICE_ACCENT[MAIN_TABS.WASTE_DISPOSAL];

const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;
const DOCUMENTS_ACCEPT_ATTR = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

const WASTE_DISPOSAL_REQUEST_COLUMNS = [
  { key: "waste_type", header: "Waste Type", accessor: (r) => r?.waste_type },
  { key: "disposal_date", header: "Disposal Date", accessor: (r) => r?.disposal_date, type: "date" },
  { key: "status", header: "Status", accessor: (r) => r?.status, type: "status" },
  { key: "requested_date", header: "Requested", accessor: (r) => r?.created_date, type: "date" },
  { key: "document", header: "Document", accessor: (r) => r?.document_url, type: "document" },
];

const parseWasteDisposalDateValue = (value) => {
  const v = String(value || "").trim();
  if (!v) return { date: "", time: "00:00" };
  const mDate = v.match(/^(\d{4}-\d{2}-\d{2})/);
  const datePart = mDate ? mDate[1] : "";
  const mTime = v.match(/T(\d{2}:\d{2})/);
  const timePart = mTime ? mTime[1] : "00:00";
  return { date: datePart, time: timePart };
};

const mergeWasteDisposalDateValue = (dateStr, timeStr) => {
  if (!dateStr) return "";
  if (!timeStr || timeStr === "00:00") return dateStr;
  return `${dateStr}T${timeStr}`;
};

const toApiDateTime = (dateStr, timeStr) => {
  if (!dateStr) return "";
  return `${dateStr} ${timeStr || "00:00"}:00`;
};

const WasteDisposalContent = ({ formValues, handleChange, cardColor }) => {
  const callId = formValues.call_id || formValues.callId || formValues.card_call_id;
  const {
    wasteDisposalRequests,
    isLoadingList,
    isSaving,
    getWasteDisposalRequests,
    createWasteDisposalRequest,
  } = useWasteDisposalReducer();

  useEffect(() => {
    void getWasteDisposalRequests(callId);
  }, [callId, getWasteDisposalRequests]);

  const wasteDisposalRequestRows = wasteDisposalRequests.map((row) => ({
    ...row,
    document_url: row?.request_email_url || row?.documents?.[0]?.file_url || "",
  }));

  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const fileInputRef = useRef(null);
  const requestEmailInputRef = useRef(null);

  const [wasteTypes, setWasteTypes] = useState([]);
  const [loadingWasteTypes, setLoadingWasteTypes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingWasteTypes(true);
        const { data } = await wasteTypeService.getWasteTypes({
          params: { page: 1, limit: 500 },
        });
        const rawList = data?.data ?? data?.waste_types ?? [];
        const list = Array.isArray(rawList) ? rawList : [];
        if (!cancelled) setWasteTypes(list);
      } catch {
        if (!cancelled) setWasteTypes([]);
      } finally {
        if (!cancelled) setLoadingWasteTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const wasteTypeOptions = wasteTypes.map((w) => ({
    value: String(w.waste_type_id ?? w._id ?? ""),
    label: w.waste_type ?? "",
  }));

  const handleWasteTypeChange = (e) => {
    handleChange("wasteTypeId")(e);
    const id = e.target.value;
    const row = wasteTypes.find((w) => String(w.waste_type_id ?? w._id) === id);
    handleChange("wasteType")({ target: { value: row?.waste_type ?? "" } });
  };

  const disposalDateParts = parseWasteDisposalDateValue(formValues.wasteDisposalDate);

  const handleDisposalDateTimeChange = (next) => {
    const merged = mergeWasteDisposalDateValue(next?.date ?? "", next?.time ?? "");
    handleChange("wasteDisposalDate")({ target: { value: merged } });
  };

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
    handleChange("wasteDisposalRequestEmailDocuments")({
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
      handleChange("wasteDisposalRequestEmailDocuments")({
        target: { value: [fileToAttachment(allowed[0])] },
      });
    }
    if (requestEmailInputRef.current) {
      requestEmailInputRef.current.value = "";
    }
  };

  const handleRequestEmailRemoveAttachment = () => {
    handleChange("wasteDisposalRequestEmailDocuments")({ target: { value: [] } });
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
      const current = normalizeAttachmentList(formValues.wasteDisposalDocuments || []);
      const added = files.map(fileToAttachment);
      handleChange("wasteDisposalDocuments")({ target: { value: [...current, ...added] } });
    }
  };

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const current = normalizeAttachmentList(formValues.wasteDisposalDocuments || []);
      const added = files.map(fileToAttachment);
      handleChange("wasteDisposalDocuments")({ target: { value: [...current, ...added] } });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDocumentsRemoveAttachment = (index) => {
    const current = normalizeAttachmentList(formValues.wasteDisposalDocuments || []);
    handleChange("wasteDisposalDocuments")({
      target: { value: current.filter((_, i) => i !== index) },
    });
  };

  const handleSave = useCallback(async () => {
    if (!callId) {
      notify("Call is required to save a waste disposal request.", "error", "top-center");
      return;
    }
    if (!formValues.wasteTypeId) {
      notify("Waste type is required.", "error", "top-center");
      return;
    }
    if (!formValues.wasteDisposalDate) {
      notify("Disposal date is required.", "error", "top-center");
      return;
    }

    const payload = {
      call_id: Number(callId),
      waste_type_id: Number(formValues.wasteTypeId),
      disposal_date: toApiDateTime(disposalDateParts.date, disposalDateParts.time),
      remarks: formValues.wasteDisposalDescription || "",
      po_number: formValues.wasteDisposalPONumber || "",
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    const requestEmailFile = normalizeAttachmentList(
      formValues.wasteDisposalRequestEmailDocuments || []
    )[0]?.file;
    if (requestEmailFile instanceof File) {
      formData.append("request_email", requestEmailFile);
    }

    normalizeAttachmentList(formValues.wasteDisposalDocuments || []).forEach((attachment) => {
      const file = attachment?.file ?? attachment;
      if (file instanceof File) {
        formData.append("documents[]", file);
      }
    });

    try {
      const response = await createWasteDisposalRequest(formData);
      notify(
        response?.data?.message || "Waste disposal request created successfully",
        "success",
        "top-center"
      );
      handleChange("wasteDisposalPONumber")({ target: { value: "" } });
      handleChange("wasteTypeId")({ target: { value: "" } });
      handleChange("wasteType")({ target: { value: "" } });
      handleChange("wasteDisposalDate")({ target: { value: "" } });
      handleChange("wasteDisposalDescription")({ target: { value: "" } });
      handleChange("wasteDisposalRequestEmailDocuments")({ target: { value: [] } });
      handleChange("wasteDisposalDocuments")({ target: { value: [] } });
      await getWasteDisposalRequests(callId);
    } catch (error) {
      notify(
        error?.response?.data?.message || "Failed to create waste disposal request",
        "error",
        "top-center"
      );
    }
  }, [callId, formValues, disposalDateParts, createWasteDisposalRequest, getWasteDisposalRequests, handleChange]);

  const requestEmailAttachments = normalizeAttachmentList(
    formValues.wasteDisposalRequestEmailDocuments || []
  );
  const documentsAttachments = normalizeAttachmentList(formValues.wasteDisposalDocuments || []);

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form waste-disposal-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
            <div className="general-info-left crew-pass-premium-left">
              <div className={`crew-pass-request-details-card husb-accent-${WASTE_DISPOSAL_ACCENT}`}>
                <PremiumCardHeader
                  icon="wasteDisposal"
                  title="Request Details"
                  subtitle="Submit a waste disposal request for this call"
                  headerClassName="crew-pass-request-details-card__header"
                  titleClassName="crew-pass-request-details-card__title"
                />
                <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                  <FormGroup icon="mail" label="Request Email" accent={WASTE_DISPOSAL_ACCENT}>
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

                  <FormGroup icon="billing" label="PO Number" accent={WASTE_DISPOSAL_ACCENT}>
                    <FormField>
                      <div className="cf-input">
                        <input
                          type="text"
                          value={formValues.wasteDisposalPONumber || ""}
                          onChange={handleChange("wasteDisposalPONumber")}
                          placeholder="Enter PO number..."
                        />
                      </div>
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="list" label="Waste Type" accent={WASTE_DISPOSAL_ACCENT}>
                    <FormField>
                      <FormSelect
                        value={formValues.wasteTypeId || ""}
                        onChange={handleWasteTypeChange}
                        options={wasteTypeOptions}
                        placeholder={loadingWasteTypes ? "Loading waste types..." : "Select waste type..."}
                        disabled={loadingWasteTypes}
                      />
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="calendar" label="Disposal Date" accent={WASTE_DISPOSAL_ACCENT}>
                    <FormField>
                      <div className="transport-date-time-field">
                        <DateTimePickerField
                          dateValue={disposalDateParts.date}
                          timeValue={disposalDateParts.time}
                          onDateTimeChange={handleDisposalDateTimeChange}
                          dateFieldName="wasteDisposalDate"
                          timeFieldName="wasteDisposalDate"
                          placeholder="Select date and time"
                        />
                      </div>
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="folder" label="Documents" accent={WASTE_DISPOSAL_ACCENT}>
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

                  <FormGroup icon="notebook" label="Remarks" accent={WASTE_DISPOSAL_ACCENT}>
                    <div className="cgpass-remarks">
                      <FormField>
                        <ReactQuillEditor
                          value={formValues?.wasteDisposalDescription || ""}
                          onChange={handleChange("wasteDisposalDescription")}
                          placeholder="Enter remarks..."
                          name="wasteDisposalDescription"
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
                title="Waste Disposal Requests"
                requests={wasteDisposalRequestRows}
                loading={isLoadingList}
                columns={WASTE_DISPOSAL_REQUEST_COLUMNS}
                serviceType="WASTE_DISPOSAL"
                emptyMessage="No waste disposal requests found"
                accent={WASTE_DISPOSAL_ACCENT}
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

WasteDisposalContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default WasteDisposalContent;
