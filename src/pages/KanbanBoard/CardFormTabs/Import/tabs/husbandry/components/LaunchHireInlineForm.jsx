import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { FiNavigation, FiSend } from "react-icons/fi";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import ChecklistMultiSelect from "../../appointment/checklistTab/ChecklistMultiSelect";

const LOCATION_OPTIONS = ["Freighter Anchorage", "RT7", "Sea Island", "Juaymah"];

// Compact inline scheduling panel for the Crew Summary "Request Launch
// Hire" action. Always mounted (even collapsed) so open/close can transition
// smoothly via max-height/opacity instead of mount/unmount.
const LaunchHireInlineForm = ({
  open,
  cardColor,
  dateValue,
  timeValue,
  error,
  isSubmitting,
  onDateTimeChange,
  onCancel,
  onSubmit,
  selectValue,
  onSelectChange,
  selectOptions = [],
  locationValue,
  onLocationChange,
}) => {
  const fieldWrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // DateTimePickerField doesn't expose an inputRef, so focus the MUI
    // input it renders directly rather than extending the shared component.
    const timer = setTimeout(() => {
      fieldWrapperRef.current?.querySelector("input")?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, onCancel]);

  return (
    <div
      className={`crew-launch-hire-panel${open ? " crew-launch-hire-panel--open" : ""}`}
      style={{ "--card-color": cardColor }}
      aria-hidden={!open}
    >
      <div className="crew-launch-hire-panel__inner">
        <div className="crew-launch-hire-panel__info">
          <span className="crew-launch-hire-panel__icon" aria-hidden="true">
            <FiNavigation size={16} />
          </span>
          <span className="crew-launch-hire-panel__text">
            <span className="crew-launch-hire-panel__title">Schedule Launch Hire</span>
            <span className="crew-launch-hire-panel__hint">Choose the required launch hire details.</span>
          </span>
        </div>

        {onSelectChange && (
          <div className="crew-launch-hire-panel__field">
            <label className="crew-launch-hire-panel__label">Batch</label>
            <ChecklistMultiSelect
              value={selectValue}
              onChange={(e) => onSelectChange(e.target.value)}
              options={selectOptions.map((option) => ({ value: option, label: option }))}
              placeholder="Select batch(es)"
              disabled={isSubmitting}
              id="launch-hire-batch-multiselect"
            />
          </div>
        )}

        {onLocationChange && (
          <div className="crew-launch-hire-panel__field">
            <label className="crew-launch-hire-panel__label">Location</label>
            <select
              className="crew-launch-hire-panel__select"
              value={locationValue}
              disabled={isSubmitting}
              onChange={(e) => onLocationChange(e.target.value)}
            >
              <option value="">Select location</option>
              {LOCATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="crew-launch-hire-panel__field" ref={fieldWrapperRef}>
          <label className="crew-launch-hire-panel__label">Launch Date &amp; Time *</label>
          <DateTimePickerField
            dateValue={dateValue}
            timeValue={timeValue}
            onDateTimeChange={onDateTimeChange}
            disabled={isSubmitting}
            hasError={Boolean(error)}
            placeholder="Select date and time"
            minDate={new Date()}
          />
          {error && <span className="crew-launch-hire-panel__error">{error}</span>}
        </div>

        <div className="crew-launch-hire-panel__actions">
          <button
            type="button"
            className="crew-launch-hire-panel__btn crew-launch-hire-panel__btn--cancel"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crew-launch-hire-panel__btn crew-launch-hire-panel__btn--submit"
            disabled={isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? (
              <>
                <span className="crew-launch-hire-panel__spinner" aria-hidden="true" />
                Submitting…
              </>
            ) : (
              <>
                Submit Request
                <FiSend size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

LaunchHireInlineForm.propTypes = {
  open: PropTypes.bool.isRequired,
  cardColor: PropTypes.string,
  dateValue: PropTypes.string,
  timeValue: PropTypes.string,
  error: PropTypes.string,
  isSubmitting: PropTypes.bool,
  onDateTimeChange: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  selectValue: PropTypes.arrayOf(PropTypes.string),
  onSelectChange: PropTypes.func,
  selectOptions: PropTypes.arrayOf(PropTypes.string),
  locationValue: PropTypes.string,
  onLocationChange: PropTypes.func,
};

export default LaunchHireInlineForm;
