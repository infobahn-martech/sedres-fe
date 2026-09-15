import React from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import DocumentLibrary from "../appointment/documentLibrary/DocumentLibrary";

// Reuses the real "Document Library" tab (folder tree + preview) as an attachment picker for
// SoApprovalEmailModal's "From Document Library" option — per request, staff should browse the
// exact same Document Library they already use elsewhere, not a separate flat document list.
// DocumentLibrary itself is otherwise untouched (still just a read-only browser/tab); the only
// addition is the optional onAttachDocument prop (see its own comment) that surfaces an
// "Attach" button in the preview pane when passed, which is only ever true here.
const DocumentLibraryPickerModal = ({ show, onClose, onAttach, callId }) => {
  if (!show) return null;

  const handleAttach = (document) => {
    onAttach({ id: document.id, name: document.name, url: document.previewUrl });
    onClose();
  };

  // SoApprovalEmailModal renders this as a sibling of CustomModal, which is a react-bootstrap
  // Modal — those portal themselves to document.body internally, escaping the card's own nested
  // stacking contexts. A plain in-place div here doesn't get that for free: reported as opening
  // but staying hidden behind the card (2026-09-15) — an ancestor further up (the card modal
  // itself) establishes its own stacking context, which traps this div's z-index no matter how
  // high, since position:fixed is relative to that ancestor rather than the viewport once one
  // exists. Portaling to document.body — the same fix every other custom modal in this codebase
  // uses (BusinessRuleFormModal, TypesModal, etc.) — sidesteps that entirely.
  return createPortal(
    <div
      className="document-library-picker-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="document-library-picker-dialog">
        <div className="document-library-picker-header">
          <h3 className="document-library-picker-title">Document Library</h3>
          <button
            type="button"
            className="document-library-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="document-library-picker-body">
          <DocumentLibrary card={{ call_id: callId }} onAttachDocument={handleAttach} />
        </div>
      </div>
    </div>,
    document.body
  );
};

DocumentLibraryPickerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAttach: PropTypes.func.isRequired,
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default DocumentLibraryPickerModal;
