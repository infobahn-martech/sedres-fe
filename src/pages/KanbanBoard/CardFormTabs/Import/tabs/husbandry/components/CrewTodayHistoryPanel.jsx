import PropTypes from "prop-types";

const ClockIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 8V12L14.5 14.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M13 2v7h7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const formatHistoryTime = (isoString) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

// One row in today's upload history — same wide-card visual language as
// CrewUploadedCard (see CrewUploadedListsPanel.jsx) so the two side-by-side
// panels read as one family.
const CrewHistoryCard = ({ entry }) => (
  <div className="crew-uploaded-card">
    <span className="crew-uploaded-card__icon" aria-hidden="true">
      <FileIcon />
    </span>
    <div className="crew-uploaded-card__details">
      <span className="crew-uploaded-card__title">{entry.movementTypeLabel} Crew List</span>
      <div className="crew-uploaded-card__filename" title={entry.name}>{entry.name}</div>
      <div className="crew-uploaded-card__meta">
        {entry.crewCount} crew member{entry.crewCount === 1 ? "" : "s"} · {formatHistoryTime(entry.uploadedAt)}
      </div>
    </div>
    <span className="crew-uploaded-card__badge">{entry.movementTypeLabel}</span>
  </div>
);

CrewHistoryCard.propTypes = {
  entry: PropTypes.shape({
    name: PropTypes.string,
    movementTypeLabel: PropTypes.string,
    crewCount: PropTypes.number,
    uploadedAt: PropTypes.string,
  }).isRequired,
};

// Left-side twin of CrewUploadedListsPanel — every crew list uploaded today
// (this session), newest first. Purely a same-day activity feed, not a
// persisted upload log.
const CrewTodayHistoryPanel = ({ entries, cardColor }) => (
  <div className="crew-uploaded-lists-panel" style={{ "--card-color": cardColor }}>
    <span className="crew-mgmt-section-label">Today&apos;s History</span>
    {entries.length === 0 ? (
      <div className="crew-uploaded-lists-panel__empty">
        <span className="crew-uploaded-lists-panel__empty-icon" aria-hidden="true">
          <ClockIcon />
        </span>
        <span className="crew-uploaded-lists-panel__empty-title">No uploads yet today</span>
        <span className="crew-uploaded-lists-panel__empty-subtitle">
          Crew lists uploaded today will show up here.
        </span>
      </div>
    ) : (
      <div className="crew-uploaded-lists-panel__stack">
        {entries.map((entry) => (
          <CrewHistoryCard key={entry.id} entry={entry} />
        ))}
      </div>
    )}
  </div>
);

CrewTodayHistoryPanel.propTypes = {
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      movementTypeLabel: PropTypes.string,
      crewCount: PropTypes.number,
      uploadedAt: PropTypes.string,
    })
  ).isRequired,
  cardColor: PropTypes.string,
};

export default CrewTodayHistoryPanel;
