import { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../../components/Toaster";
import { FormSection, FormField, FormGroup, PremiumCardHeader, ReactQuillEditor } from "./Husbandry.components";
import AttachmentsList from "../../appointment/AttachmentsList";
import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import useMWPRenewalReducer from "../../../../../../../store/MWPRenewalReducer";
import { MAIN_TABS, SERVICE_ACCENT } from "./Husbandry.constants";

const MWP_RENEWAL_ACCENT = SERVICE_ACCENT[MAIN_TABS.MWP_RENEWAL];

const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;
const DOCUMENTS_ACCEPT_ATTR = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

const MWP_RENEWAL_REQUEST_COLUMNS = [
  { key: "expiry_date", header: "Expiry Date", accessor: (r) => r?.expiry_date, type: "date" },
  { key: "remarks", header: "Remarks", accessor: (r) => r?.remarks },
  { key: "status", header: "Status", accessor: (r) => r?.status, type: "status" },
  { key: "requested_date", header: "Requested", accessor: (r) => r?.created_date, type: "date" },
  { key: "document", header: "Document", accessor: (r) => r?.document_url, type: "document" },
];

const parseMwpExpiryDateValue = (value) => {
  const v = String(value || "").trim();
  if (!v) return { date: "", time: "00:00" };
  const mDate = v.match(/^(\d{4}-\d{2}-\d{2})/);
  const datePart = mDate ? mDate[1] : "";
  const mTime = v.match(/T(\d{2}:\d{2})/);
  const timePart = mTime ? mTime[1] : "00:00";
  return { date: datePart, time: timePart };
};

const mergeMwpExpiryDateValue = (dateStr, timeStr) => {
  if (!dateStr) return "";
  if (!timeStr || timeStr === "00:00") return dateStr;
  return `${dateStr}T${timeStr}`;
};

const toApiDateTime = (dateStr, timeStr) => {
  if (!dateStr) return "";
  return `${dateStr} ${timeStr || "00:00"}:00`;
};

const MWPRenewalContent = ({ formValues, handleChange, cardColor }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const fileInputRef = useRef(null);
  const requestEmailInputRef = useRef(null);

  const callId = formValues.call_id || formValues.callId || formValues.card_call_id;
  const {
    mwpRenewalRequests,
    isLoadingList,
    isSaving,
    getMwpRenewalRequests,
    createMwpRenewalRequest,
  } = useMWPRenewalReducer();

  useEffect(() => {
    void getMwpRenewalRequests(callId);
  }, [callId, getMwpRenewalRequests]);

  const mwpRenewalRequestRows = mwpRenewalRequests.map((row) => ({
    ...row,
    document_url: row?.request_email_url || row?.documents?.[0]?.file_url || "",
  }));

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
    handleChange("mwpRenewalRequestEmailDocuments")({
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
      handleChange("mwpRenewalRequestEmailDocuments")({
        target: { value: [fileToAttachment(allowed[0])] },
      });
    }
    if (requestEmailInputRef.current) {
      requestEmailInputRef.current.value = "";
    }
  };

  const handleRequestEmailRemoveAttachment = () => {
    handleChange("mwpRenewalRequestEmailDocuments")({ target: { value: [] } });
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
      const current = normalizeAttachmentList(formValues.mwpRenewalDocuments || []);
      const added = files.map(fileToAttachment);
      handleChange("mwpRenewalDocuments")({ target: { value: [...current, ...added] } });
    }
  };

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const current = normalizeAttachmentList(formValues.mwpRenewalDocuments || []);
      const added = files.map(fileToAttachment);
      handleChange("mwpRenewalDocuments")({ target: { value: [...current, ...added] } });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDocumentsRemoveAttachment = (index) => {
    const current = normalizeAttachmentList(formValues.mwpRenewalDocuments || []);
    handleChange("mwpRenewalDocuments")({
      target: { value: current.filter((_, i) => i !== index) },
    });
  };

  const expiryDateParts = parseMwpExpiryDateValue(formValues.mwpRenewalExpiryDate);

  const handleExpiryDateTimeChange = (next) => {
    const merged = mergeMwpExpiryDateValue(next?.date ?? "", next?.time ?? "");
    handleChange("mwpRenewalExpiryDate")({ target: { value: merged } });
  };

  const handleSave = useCallback(async () => {
    if (!callId) {
      notify("Call is required to save an MWP renewal request.", "error", "top-center");
      return;
    }
    if (!formValues.mwpRenewalExpiryDate) {
      notify("Expiry date is required.", "error", "top-center");
      return;
    }

    const payload = {
      call_id: Number(callId),
      expiry_date: toApiDateTime(expiryDateParts.date, expiryDateParts.time),
      remarks: formValues.mwpRenewalDescription || "",
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    const requestEmailFile = normalizeAttachmentList(
      formValues.mwpRenewalRequestEmailDocuments || []
    )[0]?.file;
    if (requestEmailFile instanceof File) {
      formData.append("request_email", requestEmailFile);
    }

    normalizeAttachmentList(formValues.mwpRenewalDocuments || []).forEach((attachment) => {
      const file = attachment?.file ?? attachment;
      if (file instanceof File) {
        formData.append("attachments[]", file);
      }
    });

    try {
      const response = await createMwpRenewalRequest(formData);
      notify(
        response?.data?.message || "MWP renewal request created successfully",
        "success",
        "top-center"
      );
      handleChange("mwpRenewalExpiryDate")({ target: { value: "" } });
      handleChange("mwpRenewalDescription")({ target: { value: "" } });
      handleChange("mwpRenewalRequestEmailDocuments")({ target: { value: [] } });
      handleChange("mwpRenewalDocuments")({ target: { value: [] } });
      await getMwpRenewalRequests(callId);
    } catch (error) {
      notify(
        error?.response?.data?.message || "Failed to create MWP renewal request",
        "error",
        "top-center"
      );
    }
  }, [callId, formValues, expiryDateParts, createMwpRenewalRequest, getMwpRenewalRequests, handleChange]);

  const requestEmailAttachments = normalizeAttachmentList(
    formValues.mwpRenewalRequestEmailDocuments || []
  );
  const documentsAttachments = normalizeAttachmentList(formValues.mwpRenewalDocuments || []);

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form mwp-renewal-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
            <div className="general-info-left crew-pass-premium-left">
              <div className={`crew-pass-request-details-card husb-accent-${MWP_RENEWAL_ACCENT}`}>
                <PremiumCardHeader
                  icon="mwpRenewal"
                  title="Request Details"
                  subtitle="Submit an MWP renewal request for this call"
                  headerClassName="crew-pass-request-details-card__header"
                  titleClassName="crew-pass-request-details-card__title"
                />
                <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                  <FormGroup icon="mail" label="Request Email" accent={MWP_RENEWAL_ACCENT}>
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

                  <FormGroup icon="calendar" label="Expiry Date" accent={MWP_RENEWAL_ACCENT}>
                    <FormField>
                      <div className="transport-date-time-field">
                        <DateTimePickerField
                          dateValue={expiryDateParts.date}
                          timeValue={expiryDateParts.time}
                          onDateTimeChange={handleExpiryDateTimeChange}
                          dateFieldName="mwpRenewalExpiryDate"
                          timeFieldName="mwpRenewalExpiryDate"
                          placeholder="Select date and time"
                        />
                      </div>
                    </FormField>
                  </FormGroup>

                  <FormGroup icon="folder" label="MWP Documents" accent={MWP_RENEWAL_ACCENT}>
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

                  <FormGroup icon="notebook" label="Remarks" accent={MWP_RENEWAL_ACCENT}>
                    <div className="cgpass-remarks">
                      <FormField>
                        <ReactQuillEditor
                          value={formValues?.mwpRenewalDescription || ""}
                          onChange={handleChange("mwpRenewalDescription")}
                          placeholder="Enter remarks..."
                          name="mwpRenewalDescription"
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
                title="MWP Renewal Requests"
                requests={mwpRenewalRequestRows}
                loading={isLoadingList}
                columns={MWP_RENEWAL_REQUEST_COLUMNS}
                serviceType="MWP"
                emptyMessage="No renewal requests found"
                accent={MWP_RENEWAL_ACCENT}
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

MWPRenewalContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default MWPRenewalContent;
