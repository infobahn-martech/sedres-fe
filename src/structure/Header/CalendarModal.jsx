import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  FiAlignLeft,
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDroplet,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import ToolModal from './ToolModal';
import { useCalendarStore } from '../../store/calendarStore';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => MIN_YEAR + index);
const isWeekend = (dayIndex) => dayIndex === 0 || dayIndex === 6;
const COLORS = ['blue', 'green', 'red', 'amber', 'purple', 'teal'];
const DATE_FORMAT = 'YYYY-MM-DD';
// Always render 6 weeks so the grid keeps the same height from month to month.
const GRID_DAYS = 42;
const MAX_CHIPS = 3;
// Must match the calendar breakpoint in ToolModals.scss, where chips collapse to dots.
const COMPACT_QUERY = '(max-width: 576px)';

const formatTime = (date, time) => dayjs(`${date}T${time}`).format('h:mm A');
const colorStyle = (color) => ({ '--event': `var(--cal-${color})` });

// "1 hr 30 min"; empty when either time is missing or the range is invalid.
const formatDuration = (startTime, endTime) => {
  const minutes = dayjs(`2000-01-01T${endTime}`).diff(dayjs(`2000-01-01T${startTime}`), 'minute');
  if (!(minutes > 0)) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours && `${hours} hr`, rest && `${rest} min`].filter(Boolean).join(' ');
};

// All-day events first, then by start time.
const sortEvents = (a, b) => {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.startTime.localeCompare(b.startTime);
};

const createDraft = (date) => ({
  title: '',
  date,
  allDay: false,
  startTime: '09:00',
  endTime: '10:00',
  color: COLORS[0],
  notes: '',
});

const getErrors = ({ title, date, allDay, startTime, endTime }) => ({
  title: title.trim() ? '' : 'Title is required.',
  date: date ? '' : 'Date is required.',
  time:
    allDay || (startTime && endTime && endTime > startTime) ? '' : 'End time must be after start time.',
});

function EventChip({ event, onSelect }) {
  return (
    <button
      type="button"
      className={`calendar-chip${event.allDay ? ' calendar-chip--all-day' : ''}`}
      style={colorStyle(event.color)}
      title={event.title}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
    >
      {!event.allDay && <span className="calendar-chip-time">{formatTime(event.date, event.startTime)}</span>}
      <span className="calendar-chip-title">{event.title}</span>
    </button>
  );
}

function EventForm({ initial, onSave, onDelete, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = Boolean(initial.id);
  const errors = getErrors(draft);

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave({ ...draft, title: draft.title.trim(), notes: draft.notes.trim() });
  };

  const duration = draft.allDay ? '' : formatDuration(draft.startTime, draft.endTime);

  // The card is tinted with the selected color, so picking a swatch previews it live.
  return (
    <form className="calendar-form" style={colorStyle(draft.color)} onSubmit={handleSubmit} noValidate>
      <div className="calendar-form-head">
        <button type="button" className="calendar-icon-btn" onClick={onCancel} aria-label="Back">
          <FiArrowLeft />
        </button>
        <div className="calendar-form-heading">
          <h3 className="calendar-title">{isEdit ? 'Edit event' : 'New event'}</h3>
          {draft.date && <span className="calendar-form-subtitle">{dayjs(draft.date).format('dddd, D MMMM YYYY')}</span>}
        </div>
      </div>

      <div className="calendar-form-body">
        <div>
          <input
            className={`calendar-title-input${submitted && errors.title ? ' has-error' : ''}`}
            value={draft.title}
            onChange={update('title')}
            placeholder="Add title"
            aria-label="Title"
            maxLength={120}
            autoFocus
          />
          {submitted && errors.title && <small className="calendar-field-error">{errors.title}</small>}
        </div>

        <div className="calendar-form-row">
          <FiCalendar className="calendar-form-icon" />
          <div className="calendar-form-controls">
            <input
              type="date"
              className="calendar-input"
              value={draft.date}
              onChange={update('date')}
              aria-label="Date"
            />
            <label className="calendar-toggle">
              <input type="checkbox" checked={draft.allDay} onChange={update('allDay')} />
              <span className="calendar-toggle-track" aria-hidden="true" />
              All day
            </label>
            {submitted && errors.date && <small className="calendar-field-error">{errors.date}</small>}
          </div>
        </div>

        {!draft.allDay && (
          <div className="calendar-form-row">
            <FiClock className="calendar-form-icon" />
            <div className="calendar-form-controls">
              <input
                type="time"
                className="calendar-input"
                value={draft.startTime}
                onChange={update('startTime')}
                aria-label="Start time"
              />
              <span className="calendar-form-sep">–</span>
              <input
                type="time"
                className="calendar-input"
                value={draft.endTime}
                onChange={update('endTime')}
                aria-label="End time"
              />
              {duration && <span className="calendar-duration">{duration}</span>}
              {submitted && errors.time && <small className="calendar-field-error">{errors.time}</small>}
            </div>
          </div>
        )}

        <div className="calendar-form-row">
          <FiDroplet className="calendar-form-icon" />
          <div className="calendar-swatches" role="radiogroup" aria-label="Event color">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={draft.color === color}
                aria-label={color}
                className={`calendar-swatch${draft.color === color ? ' is-active' : ''}`}
                style={colorStyle(color)}
                onClick={() => setDraft((current) => ({ ...current, color }))}
              >
                {draft.color === color && <FiCheck />}
              </button>
            ))}
          </div>
        </div>

        <div className="calendar-form-row calendar-form-row--notes">
          <FiAlignLeft className="calendar-form-icon" />
          <textarea
            className="calendar-input calendar-textarea"
            rows={4}
            value={draft.notes}
            onChange={update('notes')}
            placeholder="Add description"
            aria-label="Notes"
          />
        </div>
      </div>

      <div className="calendar-form-footer">
        {isEdit &&
          (confirmDelete ? (
            <div className="calendar-confirm">
              <span>Delete this event?</span>
              <button type="button" className="calendar-btn" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
              <button type="button" className="calendar-btn calendar-btn--danger" onClick={() => onDelete(initial.id)}>
                Delete
              </button>
            </div>
          ) : (
            <button type="button" className="calendar-btn calendar-btn--ghost-danger" onClick={() => setConfirmDelete(true)}>
              <FiTrash2 /> Delete
            </button>
          ))}
        <div className="calendar-form-actions-end">
          <button type="button" className="calendar-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="calendar-btn calendar-btn--primary">
            <FiCheck /> Save
          </button>
        </div>
      </div>
    </form>
  );
}

function CalendarModal({ show, onClose }) {
  const events = useCalendarStore((state) => state.events);
  const addEvent = useCalendarStore((state) => state.addEvent);
  const updateEvent = useCalendarStore((state) => state.updateEvent);
  const deleteEvent = useCalendarStore((state) => state.deleteEvent);

  const today = dayjs().format(DATE_FORMAT);
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [selectedDate, setSelectedDate] = useState(null);
  const [formDraft, setFormDraft] = useState(null);

  const eventsByDate = useMemo(() => {
    const grouped = {};
    events.forEach((event) => {
      (grouped[event.date] ||= []).push(event);
    });
    Object.values(grouped).forEach((list) => list.sort(sortEvents));
    return grouped;
  }, [events]);

  const days = useMemo(() => {
    const start = month.startOf('week');
    return Array.from({ length: GRID_DAYS }, (_, index) => start.add(index, 'day'));
  }, [month]);

  // On phones chips are dots, so a day with events opens its list instead of a blank form.
  const handleDayClick = (date) => {
    if (eventsByDate[date]?.length && window.matchMedia(COMPACT_QUERY).matches) {
      setSelectedDate(date);
    } else {
      setFormDraft(createDraft(date));
    }
  };

  const handleSave = ({ id, ...fields }) => {
    if (id) updateEvent(id, fields);
    else addEvent(fields);
    setMonth(dayjs(fields.date).startOf('month'));
    if (selectedDate) setSelectedDate(fields.date);
    setFormDraft(null);
  };

  const handleDelete = (id) => {
    deleteEvent(id);
    setFormDraft(null);
  };

  const renderMonth = () => (
    <>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" className="calendar-btn" onClick={() => setMonth(dayjs().startOf('month'))}>
            Today
          </button>
          <button
            type="button"
            className="calendar-icon-btn"
            onClick={() => setMonth((current) => current.subtract(1, 'month'))}
            disabled={month.year() === MIN_YEAR && month.month() === 0}
            aria-label="Previous month"
          >
            <FiChevronLeft />
          </button>
          <button
            type="button"
            className="calendar-icon-btn"
            onClick={() => setMonth((current) => current.add(1, 'month'))}
            disabled={month.year() === MAX_YEAR && month.month() === 11}
            aria-label="Next month"
          >
            <FiChevronRight />
          </button>
        </div>
        <div className="calendar-jump">
          <select
            className="calendar-select"
            value={month.month()}
            onChange={(e) => setMonth((current) => current.month(Number(e.target.value)))}
            aria-label="Month"
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="calendar-select"
            value={month.year()}
            onChange={(e) => setMonth((current) => current.year(Number(e.target.value)))}
            aria-label="Year"
          >
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="calendar-btn calendar-btn--primary" onClick={() => setFormDraft(createDraft(today))}>
          <FiPlus /> Create
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((weekday, index) => (
          <div key={weekday} className={`calendar-weekday${isWeekend(index) ? ' is-weekend' : ''}`}>
            {weekday}
          </div>
        ))}
        {days.map((day) => {
          const date = day.format(DATE_FORMAT);
          const dayEvents = eventsByDate[date] || [];
          // Keep at most MAX_CHIPS rows per cell, counting the "+N more" link as one.
          const visibleCount = dayEvents.length > MAX_CHIPS ? MAX_CHIPS - 1 : dayEvents.length;
          const hiddenCount = dayEvents.length - visibleCount;
          const className = [
            'calendar-day',
            isWeekend(day.day()) && 'is-weekend',
            !day.isSame(month, 'month') && 'is-outside',
            date === today && 'is-today',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={date} className={className} onClick={() => handleDayClick(date)}>
              <button type="button" className="calendar-day-number" aria-label={day.format('D MMMM YYYY')}>
                {day.date()}
              </button>
              <div className="calendar-day-events">
                {dayEvents.slice(0, visibleCount).map((event) => (
                  <EventChip key={event.id} event={event} onSelect={setFormDraft} />
                ))}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className="calendar-more"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate(date);
                    }}
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
              {dayEvents.length > 0 && (
                <div className="calendar-day-dots" aria-hidden="true">
                  {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                    <span key={event.id} style={colorStyle(event.color)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderDay = () => {
    const dayEvents = eventsByDate[selectedDate] || [];
    return (
      <>
        <div className="calendar-toolbar">
          <button type="button" className="calendar-icon-btn" onClick={() => setSelectedDate(null)} aria-label="Back to month">
            <FiArrowLeft />
          </button>
          <h3 className="calendar-title">{dayjs(selectedDate).format('dddd, D MMMM YYYY')}</h3>
          <button
            type="button"
            className="calendar-btn calendar-btn--primary"
            onClick={() => setFormDraft(createDraft(selectedDate))}
          >
            <FiPlus /> Add
          </button>
        </div>

        {dayEvents.length ? (
          <ul className="calendar-day-list">
            {dayEvents.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  className="calendar-agenda-item"
                  style={colorStyle(event.color)}
                  onClick={() => setFormDraft(event)}
                >
                  <span className="calendar-agenda-time">
                    {event.allDay
                      ? 'All day'
                      : `${formatTime(event.date, event.startTime)} – ${formatTime(event.date, event.endTime)}`}
                  </span>
                  <span className="calendar-agenda-title">{event.title}</span>
                  {event.notes && <span className="calendar-agenda-notes">{event.notes}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tool-state">No events on this day.</p>
        )}
      </>
    );
  };

  const renderView = () => {
    if (formDraft) {
      return (
        <EventForm initial={formDraft} onSave={handleSave} onDelete={handleDelete} onCancel={() => setFormDraft(null)} />
      );
    }
    return selectedDate ? renderDay() : renderMonth();
  };

  return (
    <ToolModal show={show} onClose={onClose} title="Calendar" icon={<FiCalendar />} className="calendar-modal">
      {renderView()}
    </ToolModal>
  );
}

export default CalendarModal;
