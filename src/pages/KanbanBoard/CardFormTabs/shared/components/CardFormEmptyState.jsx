import PropTypes from "prop-types";
import "./CardFormEmptyState.scss";

// Centered "nothing here yet" panel for card drawer tabs: icon badge, title and a short hint.
// variant="error" switches the badge to the danger palette.
function CardFormEmptyState({ icon: Icon, title, message, variant = "default", className = "" }) {
  return (
    <div
      className={`cf-empty-state cf-empty-state--${variant} ${className}`.trim()}
      role={variant === "error" ? "alert" : "status"}
    >
      {Icon && (
        <div className="cf-empty-state__badge" aria-hidden="true">
          <Icon size={22} />
        </div>
      )}
      <p className="cf-empty-state__title">{title}</p>
      {message && <p className="cf-empty-state__message">{message}</p>}
    </div>
  );
}

CardFormEmptyState.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string.isRequired,
  message: PropTypes.node,
  variant: PropTypes.oneOf(["default", "error"]),
  className: PropTypes.string,
};

export default CardFormEmptyState;
