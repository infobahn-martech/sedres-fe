import PropTypes from "prop-types";
import "@/design/scss/stage-form-skeleton.scss";

// Static (non-animated) placeholder for the Pre Arrival / Arrival / Departure
// stage forms while call detail loads. Mirrors their layout — title, a
// fields column of label + input pairs, and the email preview card — so the
// page doesn't jump when the real form renders.
const FIELD_LABEL_WIDTHS = [32, 44, 28, 38, 46, 30, 40, 34];
const EMAIL_LINE_WIDTHS = [92, 80, 88, 64, 90, 72, 84, 56];

const StageFormSkeleton = ({ label = "Loading stage details…" }) => (
  <div className="stage-form-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span className="stage-form-skeleton__sr-only">{label}</span>

    <div className="stage-form-skeleton__header" aria-hidden="true">
      <span className="stage-form-skeleton__bone stage-form-skeleton__bone--title" />
      <span className="stage-form-skeleton__bone stage-form-skeleton__bone--action" />
    </div>

    <div className="stage-form-skeleton__grid" aria-hidden="true">
      <div className="stage-form-skeleton__card">
        <span className="stage-form-skeleton__bone stage-form-skeleton__bone--section" />
        <div className="stage-form-skeleton__fields">
          {FIELD_LABEL_WIDTHS.map((width, index) => (
            <div key={index} className="stage-form-skeleton__field">
              <span className="stage-form-skeleton__bone stage-form-skeleton__bone--label" style={{ width: `${width}%` }} />
              <span className="stage-form-skeleton__bone stage-form-skeleton__bone--input" />
            </div>
          ))}
        </div>
        <span className="stage-form-skeleton__bone stage-form-skeleton__bone--section" />
        <div className="stage-form-skeleton__fields">
          {FIELD_LABEL_WIDTHS.slice(0, 4).map((width, index) => (
            <div key={index} className="stage-form-skeleton__field">
              <span className="stage-form-skeleton__bone stage-form-skeleton__bone--label" style={{ width: `${width}%` }} />
              <span className="stage-form-skeleton__bone stage-form-skeleton__bone--input" />
            </div>
          ))}
        </div>
      </div>

      <div className="stage-form-skeleton__card">
        <span className="stage-form-skeleton__bone stage-form-skeleton__bone--section" />
        <div className="stage-form-skeleton__email">
          {EMAIL_LINE_WIDTHS.map((width, index) => (
            <span key={index} className="stage-form-skeleton__bone stage-form-skeleton__bone--line" style={{ width: `${width}%` }} />
          ))}
        </div>
        <div className="stage-form-skeleton__footer">
          <span className="stage-form-skeleton__bone stage-form-skeleton__bone--button" />
          <span className="stage-form-skeleton__bone stage-form-skeleton__bone--button" />
        </div>
      </div>
    </div>
  </div>
);

StageFormSkeleton.propTypes = {
  label: PropTypes.string,
};

export default StageFormSkeleton;
