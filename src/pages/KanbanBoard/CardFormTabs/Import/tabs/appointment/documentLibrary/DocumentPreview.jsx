import PropTypes from "prop-types";

const ViewIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M1.25 7.5C1.25 7.5 3.25 3.25 7.5 3.25C11.75 3.25 13.75 7.5 13.75 7.5C13.75 7.5 11.75 11.75 7.5 11.75C3.25 11.75 1.25 7.5 1.25 7.5Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="7.5" cy="7.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M7.5 2.5V9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M5 7.5L7.5 10L10 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 12.5H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const LinkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M6.25 8.75L8.75 6.25M5.5 10.25L4.25 11.5C3.42157 12.3284 3.42157 13.6716 4.25 14.5C5.07843 15.3284 6.42157 15.3284 7.25 14.5L8.5 13.25M9.75 4.75L11 3.5C11.8284 2.67157 13.1716 2.67157 14 3.5C14.8284 4.32843 14.8284 5.67157 14 6.5L12.75 7.75"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

const StarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M7.5 2.25L8.89711 5.81802L12.75 6.10983L9.875 8.68198L10.7942 12.5157L7.5 10.568L4.20577 12.5157L5.125 8.68198L2.25 6.10983L6.10289 5.81802L7.5 2.25Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);

const getTypeLabel = (type) => {
  if (type === "pdf") return "PDF Document";
  if (type === "doc") return "Word Document";
  if (type === "xls") return "Excel Spreadsheet";
  return "Document";
};

const getFileType = (document) => document.fileType || document.type;

const getUploadedDate = (document) => document.date || document.uploadDate;

const PdfPreviewMock = ({ fileName }) => (
  <div className="doc-lib-preview-mock doc-lib-preview-mock--pdf">
    <div className="doc-lib-preview-mock-toolbar">
      <span className="doc-lib-preview-mock-page">Page 1 of 2</span>
      <span className="doc-lib-preview-mock-zoom">100%</span>
    </div>
    <div className="doc-lib-preview-mock-page-content">
      <div className="doc-lib-preview-mock-letterhead">
        <div className="doc-lib-preview-mock-logo" aria-hidden />
        <div>
          <p className="doc-lib-preview-mock-company">Horizon Maritime Services</p>
          <p className="doc-lib-preview-mock-subtitle">Appointment Confirmation</p>
        </div>
      </div>
      <div className="doc-lib-preview-mock-divider" />
      <p className="doc-lib-preview-mock-filename">{fileName}</p>
      <div className="doc-lib-preview-mock-block">
        <p className="doc-lib-preview-mock-label">Vessel</p>
        <p className="doc-lib-preview-mock-value">MV Horizon Star</p>
      </div>
      <div className="doc-lib-preview-mock-block">
        <p className="doc-lib-preview-mock-label">Port of Call</p>
        <p className="doc-lib-preview-mock-value">Jebel Ali, UAE</p>
      </div>
      <div className="doc-lib-preview-mock-block">
        <p className="doc-lib-preview-mock-label">ETA</p>
        <p className="doc-lib-preview-mock-value">June 18, 2026 — 06:30 UTC</p>
      </div>
      <table className="doc-lib-preview-mock-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Port Agency</td>
            <td>1</td>
            <td>$2,450.00</td>
          </tr>
          <tr>
            <td>Pilotage</td>
            <td>1</td>
            <td>$890.00</td>
          </tr>
          <tr>
            <td>Documentation</td>
            <td>1</td>
            <td>$320.00</td>
          </tr>
        </tbody>
      </table>
      <div className="doc-lib-preview-mock-total">
        <span>Total</span>
        <span>$3,660.00</span>
      </div>
    </div>
  </div>
);

PdfPreviewMock.propTypes = {
  fileName: PropTypes.string.isRequired,
};

const PlaceholderPreview = ({ type }) => (
  <div className="doc-lib-preview-mock doc-lib-preview-mock--placeholder">
    <div className="doc-lib-preview-placeholder-icon" aria-hidden>
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="8" width="32" height="40" rx="4" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" />
        <path d="M20 22H36M20 28H32M20 34H28" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
    <p className="doc-lib-preview-placeholder-title">Preview not available</p>
    <p className="doc-lib-preview-placeholder-text">
      {getTypeLabel(type)} preview will appear here when connected to the document service.
    </p>
  </div>
);

PlaceholderPreview.propTypes = {
  type: PropTypes.string.isRequired,
};

const DocumentPreview = ({ document }) => {
  if (!document) {
    return (
      <div className="doc-lib-preview doc-lib-preview--empty">
        <div className="doc-lib-preview-empty-state">
          <p>Select a document to preview</p>
        </div>
      </div>
    );
  }

  const fileType = getFileType(document);
  const isPdf = fileType === "pdf";
  const hasPreviewUrl = Boolean(document.previewUrl);

  const handleView = () => {
    if (document.previewUrl) {
      window.open(document.previewUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = () => {
    if (!document.previewUrl) return;

    const link = window.document.createElement("a");
    link.href = document.previewUrl;
    link.download = document.name;
    link.rel = "noopener";
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  return (
    <div className="doc-lib-preview">
      <div className="doc-lib-preview-header">
        <div className="doc-lib-preview-details">
          <h3 className="doc-lib-preview-filename" title={document.name}>
            {document.name}
          </h3>
          <dl className="doc-lib-preview-meta">
            <div className="doc-lib-preview-meta-row">
              <dt>Type</dt>
              <dd>{getTypeLabel(fileType)}</dd>
            </div>
            <div className="doc-lib-preview-meta-row">
              <dt>Size</dt>
              <dd>{document.size}</dd>
            </div>
            <div className="doc-lib-preview-meta-row">
              <dt>Uploaded by</dt>
              <dd>{document.uploadedBy}</dd>
            </div>
            <div className="doc-lib-preview-meta-row">
              <dt>Uploaded</dt>
              <dd>{getUploadedDate(document)}</dd>
            </div>
          </dl>
        </div>

        <div className="doc-lib-preview-actions">
          <button
            type="button"
            className="doc-lib-preview-action-btn"
            onClick={handleView}
            disabled={!hasPreviewUrl}
          >
            <ViewIcon />
            <span>View</span>
          </button>
          <button
            type="button"
            className="doc-lib-preview-action-btn"
            onClick={handleDownload}
            disabled={!hasPreviewUrl}
          >
            <DownloadIcon />
            <span>Download</span>
          </button>
          <button type="button" className="doc-lib-preview-action-btn">
            <LinkIcon />
            <span>Copy Link</span>
          </button>
          {/* <button type="button" className="doc-lib-preview-action-btn doc-lib-preview-action-btn--icon" aria-label="Favorite">
            <StarIcon />
          </button> */}
        </div>
      </div>

      <div className="doc-lib-preview-body">
        {hasPreviewUrl ? (
          <iframe
            src={document.previewUrl}
            title={document.name}
            className="document-preview__iframe"
          />
        ) : isPdf ? (
          <PdfPreviewMock fileName={document.name} />
        ) : (
          <PlaceholderPreview type={fileType} />
        )}
      </div>
    </div>
  );
};

DocumentPreview.propTypes = {
  document: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    type: PropTypes.string.isRequired,
    fileType: PropTypes.string,
    name: PropTypes.string.isRequired,
    size: PropTypes.string.isRequired,
    uploadedBy: PropTypes.string.isRequired,
    date: PropTypes.string,
    uploadDate: PropTypes.string,
    previewUrl: PropTypes.string,
  }),
};

export default DocumentPreview;
