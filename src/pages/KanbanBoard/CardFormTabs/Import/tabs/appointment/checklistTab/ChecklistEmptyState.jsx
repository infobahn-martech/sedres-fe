import PropTypes from "prop-types";

const ICON_PATHS = {
  // Clipboard with a clock — waiting on data from Appointment Details.
  prerequisite: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M8.5 10h4M8.5 13.5h2.5" />
      <circle cx="16.5" cy="16.5" r="3.5" fill="currentColor" fillOpacity="0.12" />
      <path d="M16.5 15v1.6l1 .8" />
    </>
  ),
  // Clipboard with a plus — nothing selected yet.
  noData: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M12 10v6M9 13h6" />
    </>
  ),
  // Warning triangle.
  error: (
    <>
      <path d="M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 16.8v.2" />
    </>
  ),
};

const ClIcon = ({ variant }) => (
  <div className="cl-empty-ico" aria-hidden>
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[variant] || ICON_PATHS.noData}
    </svg>
  </div>
);

ClIcon.propTypes = { variant: PropTypes.string };

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5 10 17 19 7.5" />
  </svg>
);

/**
 * @param {Array<{label: string, done: boolean}>} [requirements] — optional list rendered as a
 *   step-by-step status, so the user sees exactly what is still missing.
 */
const ChecklistEmptyState = ({ title, message, variant = "default", requirements, hint }) => (
  <div className={`cl-empty cl-empty--${variant}`} role={variant === "error" ? "alert" : "status"}>
    <ClIcon variant={variant} />
    <h5 className="cl-empty__title">{title}</h5>
    <p className="cl-empty__msg">{message}</p>

    {Array.isArray(requirements) && requirements.length > 0 ? (
      <ul className="cl-empty__reqs">
        {requirements.map((req) => (
          <li key={req.label} className={`cl-empty__req ${req.done ? "is-done" : "is-pending"}`}>
            <span className="cl-empty__req-dot">{req.done ? <CheckIcon /> : null}</span>
            <span className="cl-empty__req-label">{req.label}</span>
            <span className="cl-empty__req-status">{req.done ? "Added" : "Missing"}</span>
          </li>
        ))}
      </ul>
    ) : null}

    {hint ? <p className="cl-empty__hint">{hint}</p> : null}
  </div>
);

ChecklistEmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  variant: PropTypes.string,
  requirements: PropTypes.arrayOf(
    PropTypes.shape({ label: PropTypes.string.isRequired, done: PropTypes.bool })
  ),
  hint: PropTypes.string,
};

export default ChecklistEmptyState;
