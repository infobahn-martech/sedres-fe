import PropTypes from "prop-types";
import {
  FiAnchor,
  FiBriefcase,
  FiCalendar,
  FiInfo,
  FiLayers,
  FiMapPin,
  FiNavigation,
  FiUser,
  FiUserCheck,
} from "react-icons/fi";
import { isGroBlankDisplay as isBlankValue } from "./groCardUtils";

/**
 * Icon + tone per summary label, so every card view (GRO, Custom, Taxi Boat…)
 * gets a consistent visual language without each caller wiring icons.
 */
const SUMMARY_ICON_RULES = [
  { match: /call type/i, Icon: FiLayers, tone: "indigo" },
  { match: /billing|entity|company/i, Icon: FiBriefcase, tone: "amber" },
  { match: /port/i, Icon: FiAnchor, tone: "sky" },
  { match: /vessel|ship/i, Icon: FiNavigation, tone: "teal" },
  { match: /location/i, Icon: FiMapPin, tone: "rose" },
  { match: /date|time|eta|etd/i, Icon: FiCalendar, tone: "violet" },
  { match: /assigned|captain|captian/i, Icon: FiUserCheck, tone: "emerald" },
  { match: /operator|user|requested/i, Icon: FiUser, tone: "blue" },
];

const resolveSummaryIcon = (label) =>
  SUMMARY_ICON_RULES.find((rule) => rule.match.test(label || "")) ?? { Icon: FiInfo, tone: "slate" };

const TIME_ICON = { Icon: FiCalendar, tone: "violet" };

export const SummaryIcon = ({ label, icon, kind }) => {
  const { Icon, tone } = kind === "time" ? TIME_ICON : resolveSummaryIcon(label);
  return (
    <span className={`gro-summary-icon gro-summary-icon--${tone}`} aria-hidden="true">
      {icon ?? <Icon size={17} />}
    </span>
  );
};

SummaryIcon.propTypes = {
  label: PropTypes.string,
  kind: PropTypes.oneOf(["time"]),
  icon: PropTypes.node,
};

const GroSummaryCard = ({ label, value, icon }) => {
  const blank = isBlankValue(value);
  return (
    <div className="gro-summary-card">
      <SummaryIcon label={label} icon={icon} />
      <div className="gro-summary-body">
        <div className="gro-summary-label">{label}</div>
        <div
          className={`gro-summary-value${blank ? " gro-summary-value--empty" : ""}`}
          title={blank ? undefined : String(value)}
        >
          {blank ? "Not set" : value}
        </div>
      </div>
    </div>
  );
};

GroSummaryCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  icon: PropTypes.node,
};

export const GroSummaryFieldCard = ({ label, children, error, icon }) => (
  <div className={`gro-summary-card gro-summary-card--field${error ? " gro-summary-card--error" : ""}`}>
    <SummaryIcon label={label} icon={icon} />
    <div className="gro-summary-body">
      <div className="gro-summary-label">{label}</div>
      <div className="gro-summary-value gro-summary-value--select">{children}</div>
      {error ? <div className="gro-summary-field-error">{error}</div> : null}
    </div>
  </div>
);

GroSummaryFieldCard.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
  error: PropTypes.string,
  icon: PropTypes.node,
};

export default GroSummaryCard;
