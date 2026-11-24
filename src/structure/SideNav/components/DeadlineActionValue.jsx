import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiFilter, FiInfo, FiX } from 'react-icons/fi';
import DatePickerField from '@/pages/KanbanBoard/CardFormTabs/shared/components/DatePickerField';
import InlineTextDropdown from './InlineTextDropdown';
import { DEADLINE_MODE_OPTIONS, WEEKDAY_OPTIONS } from './businessRulesData';

const RELATIVE_MODE_KEY = DEADLINE_MODE_OPTIONS[0].key;
const MODE_CHOICES = DEADLINE_MODE_OPTIONS.map((mode) => ({ value: mode.key, label: mode.label }));
// Monday first, like the week the rest of the form lists.
const WEEK_DAYS = [...WEEKDAY_OPTIONS.slice(1), WEEKDAY_OPTIONS[0]];

// "to a relative date v" / "to an absolute date v" beside the Set deadline title.
export function DeadlineModeDropdown({ mode, onChange }) {
  return (
    <InlineTextDropdown
      value={mode}
      options={MODE_CHOICES}
      triggerClassName="business-rule-form-condition-label-btn br-condition-value-text d-inline-flex align-items-center"
      onChange={onChange}
    />
  );
}

DeadlineModeDropdown.propTypes = {
  mode: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function ToggleRow({ day, checked, onToggle }) {
  return (
    <label className="br-nonworking-toggle-row">
      <span className="br-toggle-switch">
        <input type="checkbox" checked={checked} onChange={() => onToggle(day.key)} />
        <span className="br-toggle-slider" />
      </span>
      {day.label}
    </label>
  );
}

ToggleRow.propTypes = {
  day: PropTypes.shape({ key: PropTypes.string, label: PropTypes.string }).isRequired,
  checked: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

// Body of the Set deadline card: the number of days (relative) or the date (absolute), and the
// non-working days to skip, picked with one toggle per weekday.
function DeadlineActionValue({ value, onChange }) {
  const isRelative = value.mode === RELATIVE_MODE_KEY;
  const patch = (next) => onChange({ ...value, ...next });
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const toggleOpen = () => {
    setFilterText('');
    setOpen((prev) => !prev);
  };

  const toggleDay = (dayKey) => patch({
    nonWorkingDays: value.nonWorkingDays.includes(dayKey)
      ? value.nonWorkingDays.filter((k) => k !== dayKey)
      : [...value.nonWorkingDays, dayKey],
  });

  const query = filterText.trim().toLowerCase();
  const visibleDays = query ? WEEK_DAYS.filter((d) => d.label.toLowerCase().includes(query)) : WEEK_DAYS;
  const selectedDays = visibleDays.filter((d) => value.nonWorkingDays.includes(d.key));
  const otherDays = visibleDays.filter((d) => !value.nonWorkingDays.includes(d.key));

  return (
    <>
      {isRelative ? (
        <div className="br-deadline-relative-row">
          <input
            type="number"
            min="0"
            className="br-deadline-days-input"
            aria-label="Deadline days"
            value={value.days}
            onChange={(e) => patch({ days: e.target.value })}
          />
          <span className="br-deadline-days-label">days in the future</span>
        </div>
      ) : (
        <DatePickerField
          dateValue={value.date}
          onDateChange={(e) => patch({ date: e.target.value })}
          placeholder="Select date"
        />
      )}

      <div className="br-deadline-nonworking">
        <span className="br-deadline-nonworking-label">
          Non-working days
          <FiInfo size={13} aria-hidden />
        </span>
        <div className="board-minimap-picker-wrap br-update-user-wrap">
          <div
            role="button"
            tabIndex={0}
            ref={triggerRef}
            className="business-rule-form-input business-rule-form-control business-rule-form-tags-input br-nonworking-trigger"
            onClick={toggleOpen}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleOpen();
              }
            }}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            {value.nonWorkingDays.length === 0 ? (
              <span className="br-nonworking-placeholder">Not Set</span>
            ) : (
              WEEK_DAYS.filter((d) => value.nonWorkingDays.includes(d.key)).map((day) => (
                <span key={day.key} className="business-rule-form-tag-pill">
                  {day.label}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDay(day.key);
                    }}
                    aria-label={`Remove ${day.label}`}
                  >
                    <FiX size={12} />
                  </button>
                </span>
              ))
            )}
          </div>

          {open && (
            <div className="br-owner-picker-panel" ref={panelRef}>
              <div className="br-owner-picker-search">
                <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                <input
                  type="text"
                  placeholder="Filter"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="br-owner-picker-list">
                {selectedDays.length > 0 && (
                  <>
                    <div className="br-nonworking-section-title">Recently selected</div>
                    {selectedDays.map((day) => <ToggleRow key={day.key} day={day} checked onToggle={toggleDay} />)}
                  </>
                )}
                {otherDays.length > 0 && (
                  <>
                    <div className="br-nonworking-section-title">Other</div>
                    {otherDays.map((day) => <ToggleRow key={day.key} day={day} checked={false} onToggle={toggleDay} />)}
                  </>
                )}
                {selectedDays.length === 0 && otherDays.length === 0 && (
                  <div className="br-property-picker-empty">No matches</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

DeadlineActionValue.propTypes = {
  value: PropTypes.shape({
    mode: PropTypes.string,
    days: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    date: PropTypes.string,
    nonWorkingDays: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default DeadlineActionValue;
