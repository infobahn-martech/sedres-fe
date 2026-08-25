import PropTypes from "prop-types";
import { useMemo } from "react";
import "../../../../../../design/scss/invoice.scss";

// Six invoice types shown in a flat list (no category headers)
const INVOICE_TYPES = [
  "Launch Hire",
  "Sailing Clearance",
  "Port Dues",
  "Pilotage",
  "Berthing",
  "Agency Fees",
];


const InvoiceItem = ({ label, document, onDownload, onDelete, cardColor }) => {
  const hasDocument = document && (document.fileName || document.fileUrl);

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = Math.round((bytes / Math.pow(k, i)) * 100) / 100;
    return size.toFixed(2) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${month} ${day}, ${year}, ${time}`;
  };

  return (
    <div className="invoice-item">
      <div className="invoice-icon-wrapper">
        <div className="file-icon-default">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#6B7280" />
            <path
              d="M9 6H16L21 11V26C21 26.5523 20.5523 27 20 27H10C9.44772 27 9 26.5523 9 26V7C9 6.44772 9.44772 6 10 6Z"
              fill="white"
              opacity="0.9"
            />
            <path
              d="M16 6V11H21"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <div className="invoice-details">
        <div className="invoice-name">{label}</div>
        <div className="invoice-meta">
          {hasDocument ? (
            <>
              <span className="invoice-size">{formatFileSize(document.fileSize)}</span>
              <span className="invoice-separator">•</span>
              <span className="invoice-date">{formatDate(document.uploadedAt)}</span>
              {document.uploadedBy && (
                <>
                  <span className="invoice-separator">•</span>
                  <span className="invoice-uploader">by {document.uploadedBy}</span>
                </>
              )}
            </>
          ) : (
            <span className="invoice-no-doc">— No document</span>
          )}
        </div>
      </div>
      <div className="invoice-actions">
        {onDownload && (
          <button
            className="invoice-action-btn download"
            onClick={() => hasDocument && onDownload(document)}
            type="button"
            title="Download"
            disabled={!hasDocument}
            style={{ "--card-color": cardColor }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 12V3M9 12L6 9M9 12L12 9M3 15H15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            className="invoice-action-btn delete"
            onClick={() => hasDocument && onDelete(document)}
            type="button"
            title="Delete"
            disabled={!hasDocument}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

InvoiceItem.propTypes = {
  label: PropTypes.string.isRequired,
  document: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    fileName: PropTypes.string,
    fileSize: PropTypes.number,
    uploadedAt: PropTypes.string,
    uploadedBy: PropTypes.string,
    fileUrl: PropTypes.string,
  }),
  onDownload: PropTypes.func,
  onDelete: PropTypes.func,
  cardColor: PropTypes.string,
};

function Invoice({ card }) {
  const cardColor = card?.color || "#2A00FF";

  // Map invoice types to documents from card.invoices if available
  const invoiceDocuments = useMemo(() => {
    const fromCard = card?.invoices || {};
    return INVOICE_TYPES.map((type) => {
      const key = type.toLowerCase().replace(/\s+/g, "_");
      return fromCard[key] || null;
    });
  }, [card?.invoices]);

  const handleDownload = (doc) => {
    if (doc?.fileUrl) {
      window.open(doc.fileUrl, "_blank");
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this document?`)) {
      // TODO: Implement delete
    }
  };

  return (
    <div className="cardform-body">
      <div className="invoice-content-wrapper" style={{ "--card-color": cardColor }}>
        <div className="invoice-list-header">
          <h3 className="invoice-list-title">
            <span className="invoice-list-title-bar"></span>
            INVOICE LIST
          </h3>
        </div>
        <div className="invoice-list">
          {INVOICE_TYPES.map((label, index) => (
            <InvoiceItem
              key={label}
              label={label}
              document={invoiceDocuments[index]}
              onDownload={handleDownload}
              onDelete={handleDelete}
              cardColor={cardColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

Invoice.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
};

export default Invoice;
