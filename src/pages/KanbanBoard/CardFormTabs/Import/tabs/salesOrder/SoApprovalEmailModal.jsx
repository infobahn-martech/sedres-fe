import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FiMail, FiPaperclip, FiSend, FiX } from "react-icons/fi";
import CustomModal from "../../../../../../components/CustomModal";
import DocumentLibraryPickerModal from "./DocumentLibraryPickerModal";
import {
  OPERATION_EMAIL_MESSAGE_QUILL_FORMATS,
  OPERATION_EMAIL_MESSAGE_QUILL_MODULES,
} from "../operation/components/OperationCommon";
import { ensureHtmlForQuill } from "../operation/operationReportMessageHtml";
import "../../../../../../design/scss/pages/kanban-board/seApprovalUploadModal.scss";

// Standard Sedres wording for the SO approval request body (per ops team), same for every stage.
const DEFAULT_MESSAGE_HTML =
  "<p>Greetings from Sedres.</p>" +
  "<p><br></p>" +
  "<p>Please find the attached Sales orders with supporting documents. Kindly review our sales order and confirm so we can submit our final invoice.</p>";

// Opened from the SO Status stepper's "To Be Sent for SO Approval" step. Built on the
// app's common CustomModal (react-bootstrap Modal wrapper, used across ~80 other modals in
// this codebase) instead of a bespoke backdrop, so positioning/stacking (above the card's
// own header/footer, above everything else) is handled the same proven way as every other
// modal in the app. Local-only for now — no backend send endpoint yet; onCreate just
// advances the SO status.
// stageLabel is the real current stage name from api/da/status_timeline (e.g. "SO approval",
// "To be sent for SRF") — wording varies per call (see the "NOT name-matched" comment in
// SalesOrderList.jsx), so the modal title/subject/send button must echo that real label
// instead of a fixed "SO Approval" string that would be wrong on calls using different wording.
// defaultTo is the recipient from api/da/da_action_email_draft/{call_id} (fetched by
// SalesOrderList right before opening this modal) — prefills "To" with the backend's own
// suggested recipient instead of making staff type it every time; still freely editable.
// defaultCc is that same draft response's `cc` — the backend owns this stage's cc list too,
// so it prefills "Cc" the same way (empty when the backend sends none); also editable.
// defaultBody is that draft's `body` — HTML (text + Sedres signature + logo), loaded into the
// editor the same way as the report email templates; DEFAULT_MESSAGE_HTML only when it's empty.
const SoApprovalEmailModal = ({ show, onClose, onCreate, isSubmitting = false, soCustomerName = "", stageLabel = "SO Approval", actionLabel = "", defaultTo = "", defaultCc = "", defaultBody = "", preLoadedDocuments = [], callId = null }) => {
  const [fromValue, setFromValue] = useState("operations@shipping.com");
  const [toValue, setToValue] = useState("");
  const [ccValue, setCcValue] = useState("");
  const [subjectValue, setSubjectValue] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [toError, setToError] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [messageError, setMessageError] = useState("");
  // "From Document Library" — lets staff also attach a document straight from the call's real
  // Document Library tab (folder tree + preview, api/attachments/get_all_attachments) instead
  // of only browsing their own device — per request, reusing that exact tab rather than a
  // separate flat document list.
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const addMenuTriggerRef = useRef(null);
  const addMenuPanelRef = useRef(null);

  useEffect(() => {
    if (!showAddMenu) return undefined;
    const onDocMouseDown = (e) => {
      if (addMenuPanelRef.current?.contains(e.target)) return;
      if (addMenuTriggerRef.current?.contains(e.target)) return;
      setShowAddMenu(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [showAddMenu]);

  useEffect(() => {
    if (show) {
      // Subject always mirrors the footer step button's own action text (actionLabel, e.g.
      // "Closed Paid", "Send for SO approval") instead of a generic "{stageLabel} Request" —
      // the two used to drift apart (e.g. footer said "Closed Paid" while the subject read
      // "Closed paid Request"), so this keeps them in sync for every stage.
      setSubjectValue(`${actionLabel || stageLabel}${soCustomerName ? ` — ${soCustomerName}` : ""}`);
      setToValue(defaultTo);
      setCcValue(defaultCc);
      setToError("");
      setSubjectError("");
      // Prefilled (not just a placeholder) — api/da/da_send_action_email requires a non-empty
      // body and rejects the whole request otherwise ({"status":"error","message":"call_id,
      // to, subject and body are required"}), so an empty Quill editor used to let staff submit
      // a doomed request with no warning. Still freely editable before sending.
      setMessage(defaultBody ? ensureHtmlForQuill(defaultBody) : DEFAULT_MESSAGE_HTML);
      setMessageError("");
      // Pre-load the stage document (sales order) from api/da/da_action_email_draft
      setAttachments(preLoadedDocuments || []);
    }
  }, [show, soCustomerName, stageLabel, actionLabel, defaultTo, defaultCc, defaultBody, preLoadedDocuments]);

  const handleFilesSelected = (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file);
    if (files.length) setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // One document at a time from the Document Library picker (its own "Attach" button, next to
  // View/Download) — appended like any other attachment; deduped by id in case the same
  // document gets attached twice.
  const handleAttachFromLibrary = (doc) => {
    setAttachments((prev) => (prev.some((a) => a?.id === doc.id) ? prev : [...prev, doc]));
  };

  // Pre-loaded entries (the stage document from api/da/da_action_email_draft) are plain { name, url? } objects, not browser Files —
  // URL.createObjectURL only accepts a Blob, so it would throw for these. Open their own url
  // when one is known; otherwise there's nothing to preview from the frontend alone.
  const handleOpenAttachment = (file) => {
    if (!(file instanceof File)) {
      if (file?.url) window.open(file.url, "_blank");
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleCreate = () => {
    if (isSubmitting) return;
    if (!toValue.trim()) {
      setToError("Please enter at least one recipient.");
      return;
    }
    // Subject is prefilled from the stage's action label, but staff can clear it — and
    // api/da/da_send_action_email rejects the whole request then ({"status":"error",
    // "message":"call_id, to, subject and body are required"}), same as an empty body.
    // Caught here so it fails inline instead of as a toast after a pointless round trip.
    if (!subjectValue.trim()) {
      setSubjectError("Please enter a subject.");
      return;
    }
    // Quill's empty state isn't "" once touched (e.g. "<p><br></p>"), so strip tags before
    // checking — otherwise a cleared/whitespace-only message would still pass as non-empty
    // and hit the same backend rejection this validation exists to prevent.
    if (!message.replace(/<[^>]*>/g, "").trim()) {
      setMessageError("Please enter a message.");
      return;
    }
    onCreate?.({
      from: fromValue,
      to: toValue,
      cc: ccValue,
      subject: subjectValue,
      message,
      attachments,
    });
  };

  const renderHeader = () => (
    <div className="se-approval-header">
      <span className="se-approval-header__icon">
        <FiMail />
      </span>
      <div className="se-approval-header__text">
        <h5 className="se-approval-header__title">New {stageLabel} Email</h5>
        <p className="se-approval-header__subtitle">Send the sales order to the client for approval</p>
      </div>
      <button
        type="button"
        className="se-approval-header__close"
        onClick={onClose}
        disabled={isSubmitting}
        aria-label="Close"
      >
        <FiX />
      </button>
    </div>
  );

  const renderTextField = ({ label, value, onChange, placeholder, error, required = false }) => (
    <div className="col-12">
      <div className="se-approval-field">
        <label className="se-approval-field__label">
          {label}
          {required && <span className="se-approval-field__required">*</span>}
        </label>
        <input
          type="text"
          className={`form-control so-approval-email-input-box${error ? " is-invalid" : ""}`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={isSubmitting}
        />
        {error && <div className="se-approval-dropzone__error">{error}</div>}
      </div>
    </div>
  );

  const renderBody = () => (
    <div className="modal-body se-approval-body">
      <div className="row g-3">
        {renderTextField({
          label: "From",
          value: fromValue,
          onChange: (e) => setFromValue(e.target.value),
          placeholder: "sender@example.com",
        })}
        {renderTextField({
          label: "To",
          value: toValue,
          onChange: (e) => {
            setToValue(e.target.value);
            if (toError) setToError("");
          },
          placeholder: "recipient@example.com",
          error: toError,
          required: true,
        })}
        {renderTextField({
          label: "Cc",
          value: ccValue,
          onChange: (e) => setCcValue(e.target.value),
          placeholder: "cc@example.com",
        })}
        {renderTextField({
          label: "Subject",
          value: subjectValue,
          onChange: (e) => {
            setSubjectValue(e.target.value);
            if (subjectError) setSubjectError("");
          },
          placeholder: "Email subject",
          error: subjectError,
          required: true,
        })}
      </div>

      <div className="se-approval-attachments">
        <div className="so-approval-email-attachments-toolbar">
          <span className="se-approval-attachments__label">
            <FiPaperclip className="se-approval-attachments__clip" />
            Attachments ({attachments.length})
          </span>
          <div className="so-approval-email-add-attachment">
            <button
              type="button"
              ref={addMenuTriggerRef}
              className={`so-approval-email-attachments-btn${isSubmitting ? " so-approval-email-attachments-btn--disabled" : ""}`}
              onClick={() => setShowAddMenu((prev) => !prev)}
              disabled={isSubmitting}
              aria-haspopup="menu"
              aria-expanded={showAddMenu}
            >
              + Add
            </button>
            {showAddMenu && (
              <div className="so-approval-email-add-menu" ref={addMenuPanelRef} role="menu">
                {/* A <label> wrapping the hidden input (not a button + ref.click()) — the same
                    pattern SalesOrderList's own "Upload New" (DocumentListModal) uses, where
                    multi-select is confirmed working. Triggering the native picker via a
                    button's onClick + fileInputRef.current.click() only ever added one file
                    even after Ctrl-selecting several and clicking Open (reported 2026-09-15) —
                    switched to the browser's native label-for-input association (no
                    JS-triggered .click()) instead. The menu is closed from onChange, not the
                    label's onClick — closing on click unmounted this input before the picker
                    returned, so onChange never fired and nothing got attached. */}
                <label className="so-approval-email-add-menu-item">
                  Upload from device
                  <input
                    type="file"
                    multiple
                    className="so-approval-email-file-input-hidden"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      handleFilesSelected(e.target.files);
                      e.target.value = "";
                      setShowAddMenu(false);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="so-approval-email-add-menu-item"
                  onClick={() => {
                    setShowAddMenu(false);
                    setShowLibraryPicker(true);
                  }}
                >
                  From Document Library
                </button>
              </div>
            )}
          </div>
        </div>
        {attachments.length > 0 && (
          <div className="se-approval-attachments__items">
            {attachments.map((file, index) => (
              <div key={`${file.name}-${index}`} className="se-approval-attachments__item">
                <button
                  type="button"
                  className="se-approval-attachments__name"
                  onClick={() => handleOpenAttachment(file)}
                  title={`Open ${file.name}`}
                  disabled={isSubmitting}
                >
                  {file.name}
                </button>
                <button
                  type="button"
                  className="se-approval-attachments__remove"
                  onClick={() => removeAttachment(index)}
                  aria-label={`Remove ${file.name}`}
                  disabled={isSubmitting}
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="se-approval-field so-approval-email-message-field">
        <label className="se-approval-field__label">
          Message
          <span className="se-approval-field__required">*</span>
        </label>
        <div className="so-approval-email-quill-wrap">
          <ReactQuill
            theme="snow"
            value={message}
            onChange={(value) => {
              setMessage(value);
              if (messageError) setMessageError("");
            }}
            modules={OPERATION_EMAIL_MESSAGE_QUILL_MODULES}
            formats={OPERATION_EMAIL_MESSAGE_QUILL_FORMATS}
            placeholder="Type your message..."
            readOnly={isSubmitting}
          />
        </div>
        {messageError && <div className="se-approval-dropzone__error">{messageError}</div>}
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-approval-footer">
      <button type="button" className="se-approval-footer__cancel" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button type="button" className="se-approval-footer__upload" onClick={handleCreate} disabled={isSubmitting}>
        <FiSend />
        {isSubmitting ? "Sending..." : `Send for ${stageLabel}`}
      </button>
    </div>
  );

  return (
    <>
      <CustomModal
        show={show}
        closeModal={onClose}
        className="se-approval-modal-root so-approval-email-se-root"
        dialgName="se-approval-dialog"
        header={renderHeader()}
        body={renderBody()}
        footer={renderFooter()}
      />
      <DocumentLibraryPickerModal
        show={showLibraryPicker}
        onClose={() => setShowLibraryPicker(false)}
        onAttach={handleAttachFromLibrary}
        callId={callId}
      />
    </>
  );
};

SoApprovalEmailModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func,
  isSubmitting: PropTypes.bool,
  soCustomerName: PropTypes.string,
  stageLabel: PropTypes.string,
  actionLabel: PropTypes.string,
  defaultTo: PropTypes.string,
  defaultCc: PropTypes.string,
  defaultBody: PropTypes.string,
  preLoadedDocuments: PropTypes.arrayOf(PropTypes.object),
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default SoApprovalEmailModal;
