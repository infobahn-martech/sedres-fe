import PropTypes from "prop-types";
import { useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FiEye } from "react-icons/fi";
import Gateway from "../../../../../../gateway/gateway";
import { notify } from "../../../../../../components/Toaster";
import { getOptionLabel, normalizePreviewValue } from "./generalHelpers";
import {
  formatPreviewDate,
  getPreviewSubject,
  resolveAppointmentAcceptanceCcEmails,
  resolveEditablePreviewFieldValue,
} from "./emailPreviewHelpers";

const createQuillImageUploadHandler = (quillRef) => () => {
  const input = document.createElement("input");
  input.setAttribute("type", "file");
  input.setAttribute("accept", "image/*");
  input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image_file", file);

    try {
      const response = await Gateway.post("/report_template/upload_image", formData);
      const fileUrl = response?.data?.file_url ?? response?.data?.data?.file_url;

      if (fileUrl) {
        const quill = quillRef.current?.getEditor();
        const range = quill?.getSelection(true);
        quill.insertEmbed(range?.index ?? 0, "image", fileUrl, "user");
        quill.setSelection((range?.index ?? 0) + 1);
      }
    } catch {
      notify("Image upload failed.", "error");
    }
  };
};

const buildQuillModules = (toolbar, quillRef) => {
  const flatToolbar = toolbar.flat(Infinity);
  if (!flatToolbar.includes("image")) {
    return { toolbar };
  }

  return {
    toolbar: {
      container: toolbar,
      handlers: {
        image: createQuillImageUploadHandler(quillRef),
      },
    },
  };
};

const EMAIL_PREVIEW_MESSAGE_QUILL_TOOLBAR = [
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

const EMAIL_PREVIEW_MESSAGE_QUILL_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "font",
  "size",
  "script",
  "blockquote",
  "code-block",
  "indent",
  "list",
  "bullet",
  "align",
  "direction",
  "link",
  "image",
];

const EmailPreviewAttachmentChip = ({ attachment, onRemove }) => {
  const fileName = attachment?.name || "Untitled";
  const fileSize = attachment?.size || "";
  const fileUrl = attachment?.url || "";
  const hasUrl = Boolean(fileUrl && String(fileUrl).trim());

  const handleOpen = (event) => {
    event.stopPropagation();
    if (hasUrl) {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleRemove = (event) => {
    event.stopPropagation();
    if (typeof onRemove === "function") {
      onRemove(attachment?.id);
    }
  };

  return (
    <div className="email-preview-attachment-chip" title={fileName}>
      <span className="email-preview-attachment-link">
        <span className="email-preview-attachment-name">{fileName}</span>
        {fileSize ? <span className="email-preview-attachment-size"> ({fileSize})</span> : null}
      </span>
      {hasUrl ? (
        <button
          type="button"
          className="email-preview-attachment-view"
          onClick={handleOpen}
          aria-label={`View ${fileName}`}
          title="View attachment"
        >
          <FiEye size={14} strokeWidth={2.2} aria-hidden />
        </button>
      ) : null}
      {typeof onRemove === "function" ? (
        <button
          type="button"
          className="email-preview-attachment-remove"
          onClick={handleRemove}
          aria-label={`Remove ${fileName}`}
          title="Remove"
        >
          ×
        </button>
      ) : null}
    </div>
  );
};

EmailPreviewAttachmentChip.propTypes = {
  attachment: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    size: PropTypes.string,
    url: PropTypes.string,
  }).isRequired,
  onRemove: PropTypes.func,
};

const EmailPreviewPanel = ({
  ownerOptions,
  dailyReportEmailOptions,
  callTypeOptions,
  vesselNameOptions,
  portSelectOptions,
  getFieldValue,
  previewData,
  editableFields,
  touchedFields,
  onEditableFieldChange,
  messageValue,
  messageEditorKey,
  onMessageChange,
  emailAttachments = [],
  onUploadEmailAttachments,
  onRemoveEmailAttachment,
  isUploadingEmailAttachments = false,
  isBillingEntitySelected = true,
}) => {
  const messageQuillRef = useRef(null);
  const emailAttachmentInputRef = useRef(null);
  const [isAttachmentDragging, setIsAttachmentDragging] = useState(false);

  const displayAttachments = (Array.isArray(emailAttachments) ? emailAttachments : [])
    .map((item, index) => ({
      id: `att-${item?._source ?? "x"}-${item?._index ?? index}`,
      raw: item,
      name: item?.file_name || `Attachment ${index + 1}`,
      url: item?.file_url || "",
    }))
    .filter((item) => item.name || item.url);

  const handleAttachmentFilesSelected = (fileList) => {
    const files = Array.from(fileList || []).filter((file) => Number(file?.size) > 0);
    if (files.length && typeof onUploadEmailAttachments === "function") {
      onUploadEmailAttachments(files);
    }
  };

  const handleAttachmentDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploadingEmailAttachments) return;
    setIsAttachmentDragging(true);
  };

  const handleAttachmentDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsAttachmentDragging(false);
  };

  const handleAttachmentDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsAttachmentDragging(false);
    if (isUploadingEmailAttachments) return;
    handleAttachmentFilesSelected(event.dataTransfer?.files);
  };
  const messageQuillModules = useMemo(
    () => ({
      ...buildQuillModules(EMAIL_PREVIEW_MESSAGE_QUILL_TOOLBAR, messageQuillRef),
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  );

  const previewFromApi = previewData && typeof previewData === "object" ? previewData : {};
  const ownerLabel = getOptionLabel(ownerOptions, getFieldValue("owner"));
  const fallbackFromValue = ownerLabel ? `${ownerLabel} <noreply@sedres.com>` : "operations@shipping.com";
  const fromValue = touchedFields?.from_email
    ? (editableFields?.from_email ?? "")
    : resolveEditablePreviewFieldValue(false, editableFields?.from_email, previewFromApi.from, fallbackFromValue) ||
    "operations@shipping.com";
  const fallbackToValue = normalizePreviewValue(getFieldValue("serviceRequestorEmail")) || "—";
  const toValue = resolveEditablePreviewFieldValue(
    touchedFields?.to_email,
    editableFields?.to_email,
    previewFromApi.to,
    fallbackToValue
  );
  const subjectFallback = getPreviewSubject({
    typeOfCall: getOptionLabel(callTypeOptions, getFieldValue("typeOfCall")) || getFieldValue("typeOfCall"),
    vesselName: getOptionLabel(vesselNameOptions, getFieldValue("vesselName")) || getFieldValue("vesselName"),
    port: getOptionLabel(portSelectOptions, getFieldValue("port")) || getFieldValue("port"),
  });
  const ccValue = resolveAppointmentAcceptanceCcEmails({
    isTouched: touchedFields?.cc_emails,
    editedValue: editableFields?.cc_emails,
    previewFromApiCc: previewFromApi.cc,
    dailyReportEmailOptions,
    dailyValues: getFieldValue("dailyReportEmail"),
  });
  const subjectValue = touchedFields?.subject
    ? (editableFields?.subject ?? "")
    : resolveEditablePreviewFieldValue(false, editableFields?.subject, previewFromApi.subject, subjectFallback) ||
    "Appointment Update";
  return (
    <div className="general-add-preview-panel general-add-preview-panel--split-scroll">
      <div className="email-preview-topbar">
        <div className="email-preview-topbar-title">Email Preview</div>
        <div className="email-preview-topbar-status">
          <span className="email-preview-status-dot" />
          <span>{formatPreviewDate()}</span>
          {/* <button type="button" className="email-preview-topbar-action" aria-label="Copy preview">⧉</button>
          <button type="button" className="email-preview-topbar-action" aria-label="Expand preview">⛶</button> */}
        </div>
      </div>
      <div className="general-add-preview-scroll-inner">
        <div className="email-preview-card">
          <div className="email-preview-content">
            <div className="email-preview-meta">
              <div className="email-preview-row">
                <div className="email-preview-row-label">From</div>
                <div className="email-preview-row-value">
                  <input
                    type="text"
                    className="email-preview-inline-input"
                    value={fromValue}
                    onChange={onEditableFieldChange("from_email")}
                    placeholder="From email"
                  />
                </div>
              </div>
              <div className="email-preview-row">
                <div className="email-preview-row-label">To</div>
                <div className="email-preview-row-value">
                  <input
                    type="text"
                    className="email-preview-inline-input"
                    value={toValue}
                    onChange={onEditableFieldChange("to_email")}
                    placeholder="—"
                  />
                </div>
              </div>
              <div className="email-preview-row">
                <div className="email-preview-row-label">Cc</div>
                <div className="email-preview-row-value">
                  <input
                    type="text"
                    className="email-preview-inline-input"
                    value={ccValue}
                    onChange={onEditableFieldChange("cc_emails")}
                    placeholder="—"
                  />
                </div>
              </div>
              <div className="email-preview-row">
                <div className="email-preview-row-label">Subject</div>
                <div className="email-preview-row-value">
                  <input
                    type="text"
                    className="email-preview-inline-input"
                    value={subjectValue}
                    onChange={onEditableFieldChange("subject")}
                    placeholder="Email subject"
                  />
                </div>
              </div>
              <div className="email-preview-row email-preview-row--attachments">
                <div className="email-preview-row-label">Attachments</div>
                <div className="email-preview-row-value">
                  <div
                    className={`email-preview-attachments-list${isAttachmentDragging ? " is-dragging" : ""}`}
                    onDragOver={handleAttachmentDragOver}
                    onDragEnter={handleAttachmentDragOver}
                    onDragLeave={handleAttachmentDragLeave}
                    onDrop={handleAttachmentDrop}
                  >
                    {displayAttachments.map((attachment) => (
                      <EmailPreviewAttachmentChip
                        key={attachment.id}
                        attachment={attachment}
                        onRemove={() => {
                          if (typeof onRemoveEmailAttachment === "function") {
                            onRemoveEmailAttachment(attachment.raw);
                          }
                        }}
                      />
                    ))}
                    {isUploadingEmailAttachments ? (
                      <span className="email-preview-attachment-uploading">
                        <span className="document-upload-spinner" aria-hidden="true" />
                        <span>Uploading...</span>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="email-preview-attachment-add"
                      onClick={() => emailAttachmentInputRef.current?.click()}
                      title={
                        isBillingEntitySelected
                          ? "Add attachments"
                          : "Select a Main Billing entity to upload attachments"
                      }
                      disabled={isUploadingEmailAttachments || !isBillingEntitySelected}
                    >
                      + Add
                    </button>
                    <input
                      ref={emailAttachmentInputRef}
                      type="file"
                      multiple
                      className="file-input-hidden"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        handleAttachmentFilesSelected(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="email-preview-message-section email-preview-message-section--quill">
              <div className="email-preview-message-title">Message</div>
              <div className="react-quill-wrapper email-preview-message-quill-react">
                <ReactQuill
                  ref={messageQuillRef}
                  key={messageEditorKey}
                  theme="snow"
                  value={messageValue ?? ""}
                  onChange={(html, _delta, source) => {
                    if (typeof onMessageChange === "function") {
                      onMessageChange(html ?? "", source);
                    }
                  }}
                  modules={messageQuillModules}
                  formats={EMAIL_PREVIEW_MESSAGE_QUILL_FORMATS}
                  placeholder="Type email content here..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

EmailPreviewPanel.propTypes = {
  ownerOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  dailyReportEmailOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  callTypeOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  vesselNameOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  portSelectOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
    })
  ),
  getFieldValue: PropTypes.func.isRequired,
  previewData: PropTypes.shape({
    from: PropTypes.string,
    to: PropTypes.string,
    cc: PropTypes.string,
    subject: PropTypes.string,
    messageHtml: PropTypes.string,
    message: PropTypes.string,
  }),
  editableFields: PropTypes.shape({
    from_email: PropTypes.string,
    to_email: PropTypes.string,
    cc_emails: PropTypes.string,
    subject: PropTypes.string,
  }),
  touchedFields: PropTypes.shape({
    from_email: PropTypes.bool,
    to_email: PropTypes.bool,
    cc_emails: PropTypes.bool,
    subject: PropTypes.bool,
  }),
  onEditableFieldChange: PropTypes.func.isRequired,
  messageValue: PropTypes.string,
  messageEditorKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Receives HTML from ReactQuill; second arg is Quill change source (e.g. "user"). */
  onMessageChange: PropTypes.func.isRequired,
  emailAttachments: PropTypes.arrayOf(
    PropTypes.shape({
      file_name: PropTypes.string,
      file_url: PropTypes.string,
      _source: PropTypes.string,
      _index: PropTypes.number,
    })
  ),
  onUploadEmailAttachments: PropTypes.func,
  onRemoveEmailAttachment: PropTypes.func,
  isUploadingEmailAttachments: PropTypes.bool,
  isBillingEntitySelected: PropTypes.bool,
};
export default EmailPreviewPanel;
