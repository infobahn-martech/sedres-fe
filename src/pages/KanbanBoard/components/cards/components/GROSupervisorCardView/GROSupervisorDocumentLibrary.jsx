import PropTypes from "prop-types";
import {
  formatGroDocumentDisplayName,
  getGroDocumentVerifyStatus,
  groDocumentHasDownloadableUrl,
} from "../GROCardView/groCardUtils";
import { GroDocumentFilePreview } from "../GROCardView/InwardClearanceView";
import { GRO_SUPERVISOR_DOC_STATUS_META } from "./groSupervisorStaticDocuments";

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

function GROSupervisorDocumentLibrary({
  documents,
  hideHeading = false,
  isLoading = false,
  emptyMessage = null,
}) {
  const showEmptyState = !isLoading && documents.length === 0;

  return (
    <div className="gro-document-section gro-supervisor-doc-section" role="tabpanel" aria-label="Document Library">
      {!hideHeading ? (
        <div className="gro-document-header">
          <h3 className="gro-documents-heading">Document Library</h3>
        </div>
      ) : null}
      <div className="gro-document-list gro-supervisor-document-list">
        {isLoading ? (
          <div className="gro-document-loading">Loading documents…</div>
        ) : null}
        {showEmptyState ? (
          <div className="gro-supervisor-doc-empty" role="status">
            {emptyMessage || "No documents found for this task."}
          </div>
        ) : null}
        {!isLoading && !showEmptyState
          ? documents.map((doc) => {
              const rowKey = doc.__rowKey;
              const label = formatGroDocumentDisplayName(doc.document_name ?? "");
              const status = getGroDocumentVerifyStatus(doc);
              const meta = GRO_SUPERVISOR_DOC_STATUS_META[status] ?? GRO_SUPERVISOR_DOC_STATUS_META[0];
              const isNotUploaded = status === 0;
              const isPendingVerification = status === 1;
              const isVerified = status === 2;
              const isReupload = status === 3;
              const isRejected = status === 4;
              const hasFile = groDocumentHasDownloadableUrl(doc);

              let rowStatusClass = "gro-document-row-status-not-uploaded";
              if (isPendingVerification) rowStatusClass = "gro-document-row-status-pending";
              else if (isVerified) rowStatusClass = "gro-document-row-status-verified";
              else if (isReupload) rowStatusClass = "gro-document-row-status-reupload";
              else if (isRejected) rowStatusClass = "gro-document-row-status-rejected";

              return (
                <div
                  key={rowKey}
                  className={`gro-document-row gro-supervisor-document-row ${rowStatusClass}`}
                  aria-readonly="true"
                >
                  <GroDocumentFilePreview fileName={doc.file_name} fileUrl={doc.file_url} document={doc} />
                  <div className="gro-document-main">
                    <div className="gro-document-main-top">
                      <span className="gro-document-title">{label}</span>
                      <span className={`gro-supervisor-doc-status ${meta.badgeClass}`}>{meta.label}</span>
                    </div>
                  </div>
                  <div className="gro-document-actions gro-supervisor-document-actions">
                    <button
                      type="button"
                      className="gro-doc-action-btn gro-doc-action-btn--download gro-doc-action-btn--icon-only gro-doc-action-btn--readonly"
                      title="View document"
                      aria-label="View document"
                      disabled
                      tabIndex={-1}
                    >
                      <IconView />
                    </button>
                    {hasFile && !isNotUploaded ? (
                      <button
                        type="button"
                        className="gro-doc-action-btn gro-doc-action-btn--download gro-doc-action-btn--icon-only gro-doc-action-btn--readonly"
                        title="Download"
                        aria-label="Download"
                        disabled
                        tabIndex={-1}
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
            })
          : null}
      </div>
    </div>
  );
}

GROSupervisorDocumentLibrary.propTypes = {
  documents: PropTypes.array.isRequired,
  hideHeading: PropTypes.bool,
  isLoading: PropTypes.bool,
  emptyMessage: PropTypes.string,
};

export default GROSupervisorDocumentLibrary;
