import PropTypes from "prop-types";
import {
  formatGroDocumentDisplayName,
  getGroDocumentVerifyStatus,
  groDocumentHasDownloadableUrl,
} from "../../GRO/User/groCardUtils";
import TaskDocumentFilePreview from "./TaskDocumentFilePreview";

const IconCross = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const IconTick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconView = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

function TaskDocumentItem({
  doc,
  showVerifyActions = false,
  isSubmittingAction = false,
  onApproveClick,
  onRejectClick,
  onDocumentDownload,
}) {
  const rowKey = doc.__rowKey;
  const label = formatGroDocumentDisplayName(doc.document_name ?? "");
  const status = getGroDocumentVerifyStatus(doc);
  const isNotUploaded = status === 0;
  // 3 = re-uploaded after a rejection: verified again like a fresh upload.
  const isReuploaded = status === 3;
  const isPendingVerification = status === 1 || isReuploaded;
  const isVerified = status === 2;
  const isRejected = status === 4;
  const remarksTextRaw = doc?.remarks != null && String(doc.remarks).trim() !== "" ? String(doc.remarks).trim() : "";
  const showRemarksBadge = Boolean(remarksTextRaw) && !isNotUploaded && !isVerified;
  const hasFile = groDocumentHasDownloadableUrl(doc);
  const showDownload = hasFile && !isNotUploaded;

  let rowStatusClass = "gro-document-row-status-not-uploaded";
  if (isPendingVerification) rowStatusClass = "gro-document-row-status-pending";
  else if (isVerified) rowStatusClass = "gro-document-row-status-verified";
  else if (isRejected) rowStatusClass = "gro-document-row-status-rejected";

  return (
    <div key={rowKey} className={`gro-document-row ${rowStatusClass}`}>
      <TaskDocumentFilePreview fileName={doc.file_name} fileUrl={doc.file_url} document={doc} />
      <div className="gro-document-main">
        <div className="gro-document-main-top">
          <span className="gro-document-title">{label}</span>
          {showRemarksBadge ? (
            <span className="gro-document-remarks-badge" title={remarksTextRaw}>
              {isReuploaded ? "Previously rejected" : "Remarks"}: {remarksTextRaw}
            </span>
          ) : null}
        </div>
      </div>
      <div className="gro-document-actions">
      
        {showVerifyActions && isPendingVerification ? (
          <button
            type="button"
            className="gro-doc-action-btn gro-doc-action-btn--approved"
            disabled={isSubmittingAction}
            onClick={() => onApproveClick(doc)}
          >
            <IconTick />
            <span>Approve</span>
          </button>
        ) : null}
        {showVerifyActions && isPendingVerification ? (
          <button
            type="button"
            className="gro-doc-action-btn gro-doc-action-btn--reject"
            aria-label="Reject document"
            disabled={isSubmittingAction}
            onClick={() => onRejectClick(doc)}
          >
            <IconCross />
            <span>Reject</span>
          </button>
        ) : null}
        {isRejected ? (
          <button type="button" className="gro-doc-action-btn gro-doc-action-btn--rejected gro-doc-action-btn--readonly" tabIndex={-1} aria-label="Rejected">
            <IconCross />
            <span>Rejected</span>
          </button>
        ) : null}
          {hasFile && !isNotUploaded ? (
          <button
            type="button"
            className="gro-doc-action-btn gro-doc-action-btn--download gro-doc-action-btn--icon-only"
            title="View"
            aria-label="View"
            onClick={() => onDocumentDownload(doc)}
          >
            <IconView />
          </button>
        ) : null}
        {showVerifyActions && showDownload ? (
          <button
            type="button"
            className="gro-doc-action-btn gro-doc-action-btn--download gro-doc-action-btn--icon-only"
            title="Download"
            aria-label="Download"
            onClick={() => onDocumentDownload(doc)}
          >
            <IconDownload />
          </button>
        ) : null}
        {isNotUploaded ? (
          <span className="document-empty-text" title="No file uploaded for this document">
            No attachment
          </span>
        ) : null}
      </div>
    </div>
  );
}

TaskDocumentItem.propTypes = {
  doc: PropTypes.object.isRequired,
  showVerifyActions: PropTypes.bool,
  isSubmittingAction: PropTypes.bool,
  onApproveClick: PropTypes.func.isRequired,
  onRejectClick: PropTypes.func.isRequired,
  onDocumentDownload: PropTypes.func.isRequired,
};

export default TaskDocumentItem;
