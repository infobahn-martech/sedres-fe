import PropTypes from "prop-types";
import { FiAlertTriangle, FiCheckCircle, FiArrowRight } from "react-icons/fi";

const MAX_LINKS = 2;

/**
 * Summary above the checklist when a task card rejected documents: what still needs a
 * re-upload (with jump links to each row), and what is replaced but not yet saved.
 */
const ChecklistRejectedBanner = ({ pending, replaced, onJump }) => {
  if (pending.length === 0 && replaced.length === 0) return null;

  if (pending.length === 0) {
    return (
      <div className="cl-review-banner cl-review-banner--ready" role="status">
        <FiCheckCircle className="cl-review-banner__icon" aria-hidden />
        <div className="cl-review-banner__body">
          <p className="cl-review-banner__title">Replacement added. Save to resubmit</p>
        </div>
      </div>
    );
  }

  const shown = pending.slice(0, MAX_LINKS);
  const more = pending.length - shown.length;

  return (
    <div className="cl-review-banner cl-review-banner--rejected" role="alert">
      <FiAlertTriangle className="cl-review-banner__icon" aria-hidden />
      <div className="cl-review-banner__body">
        <p className="cl-review-banner__title">
          {pending.length === 1 ? "Rejected:" : `${pending.length} rejected:`}
          {replaced.length > 0 ? (
            <span className="cl-review-banner__sub"> ({replaced.length} unsaved)</span>
          ) : null}
        </p>
        <div className="cl-review-banner__links">
          {shown.map((row) => (
            <button
              key={row.id}
              type="button"
              className="cl-review-banner__link"
              onClick={() => onJump(row.id)}
              title={`Go to ${row.title}`}
            >
              <span className="cl-review-banner__link-text">{row.title}</span>
              <FiArrowRight aria-hidden />
            </button>
          ))}
          {more > 0 ? <span className="cl-review-banner__more">+{more} more</span> : null}
        </div>
      </div>
    </div>
  );
};

ChecklistRejectedBanner.propTypes = {
  pending: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, title: PropTypes.string })).isRequired,
  replaced: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, title: PropTypes.string })).isRequired,
  onJump: PropTypes.func.isRequired,
};

export default ChecklistRejectedBanner;
