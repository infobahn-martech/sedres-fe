import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../../components/Toaster";
import {
  FormSection,
  FormField,
  ReactQuillEditor,
  FormGroup,
  PremiumCardHeader,
} from "./Husbandry.components";
import AttachmentsList from "../../appointment/AttachmentsList";
import CrewPassRequestsTable from "./CrewPassRequestsTable";
import CrewSelectionField from "./CrewSelectionField";
import { useCrewPassTabApi } from "./useCrewPassTabApi";
import { CREW_MANAGEMENT_SUBTABS, SERVICE_ACCENT } from "./Husbandry.constants";

const REQUEST_EMAIL_ACCEPT_ATTR = ".msg,.eml,.pdf,.doc,.docx";
const REQUEST_EMAIL_EXT_RE = /\.(msg|eml|pdf|doc|docx)$/i;
const ZAWIL_PASS_ACCENT = SERVICE_ACCENT[CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS];

const ZawilPassContent = ({ formValues, handleChange, cardColor, card, onRequestCountChange, onGoToCrew, crewUploadMode = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const fileInputRef = useRef(null);
  const requestEmailInputRef = useRef(null);

  const {
    saving,
    handleSave,
    passRequests,
    passRequestsLoading,
    callId,
  } = useCrewPassTabApi({
    passType: "Zawil",
    formValues,
    card,
    remarksField: "zawilPassDescription",
    documentsField: "zawilPassDocuments",
    requestEmailFileField: "zawilPassRequestEmailFile",
    crewField: "zawilPassSelectedCrew",
  });

  useEffect(() => {
    onRequestCountChange?.(passRequests?.zawil?.length || 0);
  }, [passRequests, onRequestCountChange]);

  // Discard any draft entered on a previous visit — this tab always opens blank.
  useEffect(() => {
    handleChange("zawilPassRequestEmailFile")({ target: { value: [] } });
    handleChange("zawilPassSelectedCrew")({ target: { value: [] } });
    handleChange("zawilPassDocuments")({ target: { value: [] } });
    handleChange("zawilPassDescription")({ target: { value: "" } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    handleChange("zawilPassRequestEmailFile")({
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
      handleChange("zawilPassRequestEmailFile")({
        target: { value: [fileToAttachment(allowed[0])] },
      });
    }
    if (requestEmailInputRef.current) {
      requestEmailInputRef.current.value = "";
    }
  };

  const handleRequestEmailRemoveAttachment = () => {
    handleChange("zawilPassRequestEmailFile")({ target: { value: [] } });
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
      const current = formValues.zawilPassDocuments || [];
      const added = files.map(fileToAttachment);
      handleChange("zawilPassDocuments")({ target: { value: [...current, ...added] } });
    }
  };

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const current = formValues.zawilPassDocuments || [];
      const added = files.map(fileToAttachment);
      handleChange("zawilPassDocuments")({ target: { value: [...current, ...added] } });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDocumentsRemoveAttachment = (index) => {
    const current = formValues.zawilPassDocuments || [];
    handleChange("zawilPassDocuments")({ target: { value: current.filter((_, i) => i !== index) } });
  };

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form zawilpass-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid">
            <div className="general-info-left crew-pass-premium-left">
              <div className={`crew-pass-request-details-card husb-accent-${ZAWIL_PASS_ACCENT}`}>
                <PremiumCardHeader
                  icon="zawilPass"
                  title="New Zawil pass request"
                  subtitle="Submit crew documents for port access clearance"
                  headerClassName="crew-pass-request-details-card__header"
                  titleClassName="crew-pass-request-details-card__title"
                />
                <div className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar">
                  <FormGroup icon="mail" label="Request Email *" accent={ZAWIL_PASS_ACCENT}>
                    <FormField>
                      <div className="transport-upload-box">
                        <AttachmentsList
                          attachments={formValues.zawilPassRequestEmailFile || []}
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
                    selected={formValues.zawilPassSelectedCrew || []}
                    onChange={(ids) => handleChange("zawilPassSelectedCrew")({ target: { value: ids } })}
                    accent={ZAWIL_PASS_ACCENT}
                    onGoToCrew={onGoToCrew}
                    uploadMode={crewUploadMode}
                  />

                  <FormGroup icon="folder" label="Documents *" accent={ZAWIL_PASS_ACCENT}>
                    <FormField className="cf-field-full">
                      <div className="transport-upload-box">
                        <AttachmentsList
                          attachments={formValues.zawilPassDocuments || []}
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

                  <FormGroup icon="notebook" label="Remarks" accent={ZAWIL_PASS_ACCENT}>
                    <div className="zawilpass-remarks">
                      <FormField>
                        <ReactQuillEditor
                          value={formValues?.zawilPassDescription || ""}
                          onChange={handleChange("zawilPassDescription")}
                          placeholder="Enter remarks..."
                          name="zawilPassDescription"
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
              <CrewPassRequestsTable
                title="Zawil Pass requests"
                subtitle="All Zawil pass bookings for this job"
                icon="list"
                requests={passRequests?.zawil || []}
                loading={passRequestsLoading}
                passType="Zawil"
                accent={ZAWIL_PASS_ACCENT}
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

ZawilPassContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  card: PropTypes.object,
  onRequestCountChange: PropTypes.func,
  onGoToCrew: PropTypes.func,
  crewUploadMode: PropTypes.bool,
};

export default ZawilPassContent;
