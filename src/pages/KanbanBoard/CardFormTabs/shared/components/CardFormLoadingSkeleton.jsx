import PropTypes from "prop-types";
import "@/design/scss/card-form-loading-skeleton.scss";

// Widths roughly matching the real tab labels, so the bar doesn't jump when tabs arrive.
const TAB_WIDTHS = [148, 84, 92, 96, 92, 78, 56, 68, 132];
const DETAIL_BOXES = [
  { rows: 2 },
  { rows: 3 },
  { rows: 4 },
];

const Bone = ({ className = "", style }) => <span className={`cfl-bone ${className}`.trim()} style={style} aria-hidden />;

Bone.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
};

// Placeholder for the card drawer while its call detail (and template tabs) load. Mirrors
// the drawer layout: tab bar, then the Appointment Details "General Information" section
// with the detail boxes, Daily Tasks and Operation Tasks columns.
function CardFormLoadingSkeleton({ accentColor = "#2A00FF", message = "Loading card details..." }) {
  return (
    <div className="cfl-skeleton" style={{ "--cfl-accent": accentColor }} role="status" aria-live="polite" aria-busy="true">
      <span className="cfl-visually-hidden">{message}</span>
      <div className="cfl-progress" aria-hidden />

      <div className="cardform-tabs cfl-tabs" aria-hidden>
        {TAB_WIDTHS.map((width, index) => (
          <Bone key={width + index} className={`cfl-tab ${index === 0 ? "cfl-tab--active" : ""}`} style={{ width }} />
        ))}
      </div>

      <div className="cfl-body" aria-hidden>
        <div className="cfl-section">
          <div className="cfl-section-header">
            <Bone className="cfl-section-title" />
          </div>

          <div className="cfl-columns">
            <div className="cfl-column cfl-column--details">
              {DETAIL_BOXES.map((box, boxIndex) => (
                <div key={boxIndex} className="cfl-card cfl-detail-box">
                  <div className="cfl-detail-box-header">
                    <Bone className="cfl-heading" style={{ width: `${46 - boxIndex * 6}%` }} />
                  </div>
                  <div className="cfl-detail-grid">
                    {Array.from({ length: box.rows * 2 }, (_, cell) => (
                      <div key={cell} className="cfl-detail-cell">
                        <Bone className="cfl-label" style={{ width: `${48 + ((cell * 13) % 30)}%` }} />
                        <Bone className="cfl-value" style={{ width: `${62 + ((cell * 17) % 30)}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="cfl-column">
              <div className="cfl-card cfl-panel">
                <div className="cfl-panel-header">
                  <Bone className="cfl-dot" />
                  <Bone className="cfl-heading" style={{ width: "38%" }} />
                </div>
                {[0, 1, 2].map((item) => (
                  <div key={item} className="cfl-task">
                    <Bone className="cfl-check" />
                    <div className="cfl-task-lines">
                      <Bone className="cfl-value" style={{ width: `${70 - item * 12}%` }} />
                      <Bone className="cfl-label" style={{ width: "88%" }} />
                      <Bone className="cfl-pill" />
                    </div>
                  </div>
                ))}
                <div className="cfl-panel-footer">
                  <Bone className="cfl-label" style={{ width: "28%" }} />
                  <Bone className="cfl-label" style={{ width: "8%" }} />
                </div>
              </div>
            </div>

            <div className="cfl-column">
              <div className="cfl-card cfl-panel">
                <div className="cfl-panel-header">
                  <Bone className="cfl-heading" style={{ width: "52%" }} />
                </div>
                {[0, 1].map((group) => (
                  <div key={group} className="cfl-op-group">
                    <Bone className="cfl-label" style={{ width: "40%" }} />
                    <Bone className="cfl-op-row" />
                    <Bone className="cfl-op-row" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

CardFormLoadingSkeleton.propTypes = {
  accentColor: PropTypes.string,
  message: PropTypes.string,
};

export default CardFormLoadingSkeleton;
