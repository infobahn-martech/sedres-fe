import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import dayjs from "dayjs";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VALUE_FORMAT = "YYYY-MM-DD";
const DISPLAY_FORMAT = "DD MMM YYYY";

const toDay = (value) => (value ? dayjs(value) : null);

// Monday-first grid: leading nulls pad the first week.
const buildMonthDays = (month) => {
  const leading = (month.day() + 6) % 7;
  const days = Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1));
  return [...Array(leading).fill(null), ...days];
};

const MonthGrid = ({ month, from, to, hoverDay, onSelect, onHover }) => {
  // While picking the end date, preview the range up to the hovered day.
  const rangeEnd = to ?? (from && hoverDay?.isAfter(from, "day") ? hoverDay : null);

  return (
    <div className="drp-month">
      <div className="drp-month-title">{month.format("MMMM YYYY")}</div>
      <div className="drp-grid">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="drp-weekday">
            {weekday}
          </span>
        ))}
        {buildMonthDays(month).map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const isStart = from?.isSame(day, "day");
          const isEnd = rangeEnd?.isSame(day, "day");
          const inRange = from && rangeEnd && day.isAfter(from, "day") && day.isBefore(rangeEnd, "day");
          const className = [
            "drp-day",
            isStart && "is-start",
            isEnd && "is-end",
            inRange && "in-range",
            isStart && rangeEnd && "has-range",
            day.isSame(dayjs(), "day") && "is-today",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={day.format(VALUE_FORMAT)}
              type="button"
              className={className}
              onClick={() => onSelect(day)}
              onMouseEnter={() => onHover(day)}
              aria-pressed={Boolean(isStart || isEnd)}
              aria-label={day.format("dddd, D MMMM YYYY")}
            >
              {day.date()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const DateRangePicker = ({ from, to, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeField, setActiveField] = useState("from");
  const [hoverDay, setHoverDay] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => (toDay(from) ?? dayjs()).startOf("month"));
  const rootRef = useRef(null);

  const fromDay = toDay(from);
  const toDayValue = toDay(to);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const open = (field) => {
    setActiveField(field);
    setIsOpen(true);
  };

  const handleSelect = (day) => {
    const value = day.format(VALUE_FORMAT);
    if (activeField === "from" || (fromDay && day.isBefore(fromDay, "day"))) {
      // A new start after the current end invalidates the end.
      const keepEnd = toDayValue && !day.isAfter(toDayValue, "day") && activeField === "from";
      onChange({ from: value, to: keepEnd ? to : "" });
      setActiveField("to");
      return;
    }
    onChange({ from, to: value });
    setIsOpen(false);
  };

  const clearField = (field) => {
    onChange({ from: field === "from" ? "" : from, to: "" });
    setActiveField(field);
  };

  const triggerLabel =
    fromDay || toDayValue
      ? `${fromDay?.format(DISPLAY_FORMAT) ?? "…"} – ${toDayValue?.format(DISPLAY_FORMAT) ?? "…"}`
      : "Select dates";

  const renderField = (field, day, placeholder) => (
    <div
      className={`drp-field ${isOpen && activeField === field ? "is-active" : ""}`}
      onClick={() => setActiveField(field)}
    >
      <input readOnly value={day?.format(DISPLAY_FORMAT) ?? ""} placeholder={placeholder} aria-label={placeholder} />
      {day && (
        <button
          type="button"
          className="drp-field-clear"
          onClick={(e) => {
            e.stopPropagation();
            clearField(field);
          }}
          aria-label={`Clear ${field === "from" ? "start" : "end"} date`}
        >
          <FiX />
        </button>
      )}
    </div>
  );

  return (
    <div className="drp" ref={rootRef}>
      <button
        type="button"
        className={`drp-trigger ${fromDay || toDayValue ? "has-value" : ""}`}
        onClick={() => (isOpen ? setIsOpen(false) : open(fromDay && !toDayValue ? "to" : "from"))}
        aria-expanded={isOpen}
      >
        <FiCalendar />
        <span>{triggerLabel}</span>
      </button>

      {isOpen && (
        <div className="drp-popover" role="dialog" aria-label="Select date range">
          <div className="drp-fields">
            {renderField("from", fromDay, "Select starting date...")}
            <span className="drp-fields-sep">-</span>
            {renderField("to", toDayValue, "Select ending date...")}
          </div>

          <div className="drp-calendars" onMouseLeave={() => setHoverDay(null)}>
            <button
              type="button"
              className="drp-nav drp-nav--prev"
              onClick={() => setViewMonth((m) => m.subtract(1, "month"))}
              aria-label="Previous month"
            >
              <FiChevronLeft />
            </button>
            {[viewMonth, viewMonth.add(1, "month")].map((month) => (
              <MonthGrid
                key={month.format("YYYY-MM")}
                month={month}
                from={fromDay}
                to={toDayValue}
                hoverDay={activeField === "to" ? hoverDay : null}
                onSelect={handleSelect}
                onHover={setHoverDay}
              />
            ))}
            <button
              type="button"
              className="drp-nav drp-nav--next"
              onClick={() => setViewMonth((m) => m.add(1, "month"))}
              aria-label="Next month"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

DateRangePicker.propTypes = {
  from: PropTypes.string,
  to: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

export default DateRangePicker;
