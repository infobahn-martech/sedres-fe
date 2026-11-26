import PropTypes from "prop-types";
import { FiNavigation } from "react-icons/fi";
import { SummaryIcon } from "./GroSummaryCard";
import { isGroBlankDisplay as isBlankValue } from "./groCardUtils";

/**
 * Task card header with a clear hierarchy instead of six equal tiles:
 *  1. Identity — the vessel, the thing the whole card is about.
 *  2. Context  — call type, port, billing entity, operator as quiet inline facts.
 *  3. Action   — the assignee, the only editable value, set apart on the right.
 */
export default function GroCardContextBar({ vesselName, vesselMeta = [], facts, assignee = null }) {
  const vesselBlank = isBlankValue(vesselName);
  const vesselMetaShown = vesselMeta.filter(({ value }) => !isBlankValue(value));

  return (
    <section className="gro-context-bar" aria-label="Call details">
      <div className="gro-context-identity">
        <span className="gro-context-identity-icon" aria-hidden="true">
          <FiNavigation />
        </span>
        <div className="gro-context-identity-text">
          <span className="gro-context-eyebrow">Vessel</span>
          <h2
            className={`gro-context-vessel${vesselBlank ? " gro-context-vessel--empty" : ""}`}
            title={vesselBlank ? undefined : String(vesselName)}
          >
            {vesselBlank ? "Vessel not set" : vesselName}
          </h2>
          {vesselMetaShown.length > 0 ? (
            <p
              className="gro-context-vessel-meta"
              title={vesselMetaShown.map(({ label, value }) => `${label}: ${value}`).join(" · ")}
            >
              {vesselMetaShown.map(({ label, value }) => (
                <span key={label}>
                  <span className="gro-context-vessel-meta-label">{label}</span> {value}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="gro-context-facts">
        {facts.map(({ label, value, title, icon }) => {
          const blank = isBlankValue(value);
          return (
            <div key={label} className="gro-context-fact" title={title || undefined}>
              <SummaryIcon label={label} kind={icon} />
              <div className="gro-context-fact-text">
                <dt>{label}</dt>
                <dd className={blank ? "is-empty" : undefined} title={blank || title ? undefined : String(value)}>
                  {blank ? "Not set" : value}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>

      {assignee ? <div className="gro-context-assignee">{assignee}</div> : null}
    </section>
  );
}

GroCardContextBar.propTypes = {
  vesselName: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  vesselMeta: PropTypes.arrayOf(
    PropTypes.shape({ label: PropTypes.string.isRequired, value: PropTypes.string })
  ),
  facts: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      title: PropTypes.string,
      icon: PropTypes.oneOf(["time"]),
    })
  ).isRequired,
  assignee: PropTypes.node,
};
