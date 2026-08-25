import PropTypes from "prop-types";

const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M13 2v7h7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const EmptyIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M13 2v7h7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M9 13h6M9 16.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const formatFileSize = (bytes) => {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Wide horizontal preview card for one movement type's uploaded crew list —
// icon | file details (grows, filename truncates with a title tooltip) |
// movement-type badge (top-right), with Preview spanning the full width on
// its own row below. Multiple crew list files can be uploaded into the same
// movement type, so there's no Replace/Remove here — just keep uploading
// more via the box above.
const CrewUploadedCard = ({ upload, movementTypeLabel }) => {
  const isUploading = upload.status === "uploading";
  const isFailed = upload.status === "failed";

  return (
    <div className="crew-uploaded-card">
      <span className="crew-uploaded-card__icon" aria-hidden="true">
        <FileIcon />
      </span>
      <div className="crew-uploaded-card__details">
        <span className="crew-uploaded-card__title">{movementTypeLabel} Crew List</span>
        <div className="crew-uploaded-card__filename" title={upload.name}>{upload.name}</div>
        <div className="crew-uploaded-card__meta">
          {upload.crewCount} crew member{upload.crewCount === 1 ? "" : "s"}
          {upload.size ? ` · ${formatFileSize(upload.size)}` : ""}
          {upload.uploadedAt ? ` · Uploaded ${upload.uploadedAt}` : ""}
        </div>
        {isUploading && (
          <span className="crew-uploaded-card__status crew-uploaded-card__status--uploading">Uploading…</span>
        )}
        {!isUploading && isFailed && (
          <span className="crew-uploaded-card__status crew-uploaded-card__status--failed">Upload failed</span>
        )}
        {!isUploading && !isFailed && (
          <span className="crew-uploaded-card__status crew-uploaded-card__status--success">Uploaded successfully</span>
        )}
      </div>
      <span className="crew-uploaded-card__badge">{movementTypeLabel}</span>
    </div>
  );
};

CrewUploadedCard.propTypes = {
  upload: PropTypes.shape({
    name: PropTypes.string,
    size: PropTypes.number,
    movementType: PropTypes.string,
    status: PropTypes.string,
    crewCount: PropTypes.number,
    uploadedAt: PropTypes.string,
    fileUrl: PropTypes.string,
  }).isRequired,
  movementTypeLabel: PropTypes.string.isRequired,
  onPreview: PropTypes.func.isRequired,
};

// Right-side "Uploaded Crew Lists" panel — the single place Sign On / Sign
// Off upload state is shown. Renders an empty state until at least one
// movement type has an uploaded file, then a compact stacked card per
// uploaded type (never an empty card for a type that hasn't been uploaded).
const CrewUploadedListsPanel = ({ movementTypeOptions, crewUploads, cardColor, onPreview }) => {
  const uploadedOptions = movementTypeOptions.filter((option) => crewUploads[option.value]);

  return (
    <div className="crew-uploaded-lists-panel" style={{ "--card-color": cardColor }}>
      <span className="crew-mgmt-section-label">Uploaded Crew Lists</span>
      {uploadedOptions.length === 0 ? (
        <div className="crew-uploaded-lists-panel__empty">
          <span className="crew-uploaded-lists-panel__empty-icon" aria-hidden="true">
            <EmptyIcon />
          </span>
          <span className="crew-uploaded-lists-panel__empty-title">No crew lists uploaded yet</span>
          <span className="crew-uploaded-lists-panel__empty-subtitle">
            Select Sign On or Sign Off, then upload a crew list.
          </span>
        </div>
      ) : (
        <div className="crew-uploaded-lists-panel__stack crew-uploaded-lists-panel__stack--grid">
          {uploadedOptions.map((option) => (
            <CrewUploadedCard
              key={option.value}
              upload={crewUploads[option.value]}
              movementTypeLabel={option.label}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
};

CrewUploadedListsPanel.propTypes = {
  movementTypeOptions: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })
  ).isRequired,
  crewUploads: PropTypes.object.isRequired,
  cardColor: PropTypes.string,
  onPreview: PropTypes.func.isRequired,
};

export default CrewUploadedListsPanel;
