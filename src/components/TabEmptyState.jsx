import PropTypes from "prop-types";
import { FiAlertTriangle, FiFolder, FiPaperclip, FiSend } from "react-icons/fi";
import "@/design/scss/tabEmptyState.scss";

// Illustrations use currentColor + the --tes-accent token, so they follow the card color
// and adapt to light/dark themes via the surface tokens.

const DocumentsIllustration = () => (
  <div className="tes-art tes-art--documents" aria-hidden="true">
    <span className="tes-art__halo" />
    <span className="tes-art__sheet tes-art__sheet--back" />
    <span className="tes-art__sheet tes-art__sheet--mid">
      <i />
      <i />
      <i />
    </span>
    <span className="tes-art__folder">
      <span className="tes-art__folder-tab" />
      <FiFolder size={26} />
    </span>
    <span className="tes-art__badge">
      <FiPaperclip size={13} />
    </span>
  </div>
);

const ReportsIllustration = () => (
  <div className="tes-art tes-art--reports" aria-hidden="true">
    <span className="tes-art__halo" />
    <span className="tes-art__report">
      <span className="tes-art__report-head" />
      <span className="tes-art__bars">
        <i style={{ "--h": "38%" }} />
        <i style={{ "--h": "64%" }} />
        <i style={{ "--h": "46%" }} />
        <i style={{ "--h": "82%" }} />
      </span>
      <span className="tes-art__report-line" />
      <span className="tes-art__report-line tes-art__report-line--short" />
    </span>
    <span className="tes-art__plane">
      <FiSend size={15} />
    </span>
    <span className="tes-art__trail" />
  </div>
);

const ErrorIllustration = () => (
  <div className="tes-art tes-art--error" aria-hidden="true">
    <span className="tes-art__halo" />
    <span className="tes-art__error-icon">
      <FiAlertTriangle size={28} />
    </span>
  </div>
);

const ILLUSTRATIONS = {
  documents: DocumentsIllustration,
  reports: ReportsIllustration,
  error: ErrorIllustration,
};

function TabEmptyState({ variant = "documents", title, description, hints, action }) {
  const Illustration = ILLUSTRATIONS[variant] ?? DocumentsIllustration;

  return (
    <div className={`tab-empty-state tab-empty-state--${variant}`} role="status">
      <Illustration />
      <h3 className="tab-empty-state__title">{title}</h3>
      {description ? <p className="tab-empty-state__desc">{description}</p> : null}
      {hints?.length ? (
        <ul className="tab-empty-state__hints">
          {hints.map(({ icon: Icon, label }) => (
            <li key={label}>
              {Icon ? <Icon size={13} /> : null}
              <span>{label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {action ? <div className="tab-empty-state__action">{action}</div> : null}
    </div>
  );
}

TabEmptyState.propTypes = {
  variant: PropTypes.oneOf(["documents", "reports", "error"]),
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  hints: PropTypes.arrayOf(
    PropTypes.shape({ icon: PropTypes.elementType, label: PropTypes.string.isRequired })
  ),
  action: PropTypes.node,
};

export default TabEmptyState;
