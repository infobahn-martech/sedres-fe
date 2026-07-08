import PropTypes from "prop-types";
import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import "../../../../../design/scss/general.scss";

dayjs.extend(customParseFormat);

const toDayjsValue = (dateValue) => {
  if (!dateValue || String(dateValue).trim() === "") return null;
  const parsed = dayjs(String(dateValue).trim().slice(0, 10), "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed : null;
};

const toPickerDate = (newValue) => {
  if (newValue == null || !dayjs(newValue).isValid()) return "";
  return dayjs(newValue).format("YYYY-MM-DD");
};

const formatDisplayDate = (dateValue) => {
  const parsed = toDayjsValue(dateValue);
  if (!parsed) return "";
  return parsed.toDate().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const DatePickerField = ({
  dateValue = "",
  onDateChange,
  onDateTimeChange,
  dateFieldName,
  disabled = false,
  hasError = false,
  placeholder = "Select date",
  minDate,
  maxDate,
  popperClassName = "",
  className = "",
  renderTrigger,
  slots,
  slotProps,
}) => {
  const externalValue = useMemo(() => toDayjsValue(dateValue), [dateValue]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(null);
  const draftRef = useRef(null);

  useEffect(() => {
    draftRef.current = draftValue;
  }, [draftValue]);

  const minDateValue = useMemo(() => (minDate ? dayjs(minDate) : undefined), [minDate]);
  const maxDateValue = useMemo(() => (maxDate ? dayjs(maxDate) : undefined), [maxDate]);

  const pickerValue = pickerOpen ? (draftValue ?? externalValue) : externalValue;

  const isWithinRange = useCallback(
    (value) => {
      if (!value) return true;
      if (minDateValue && value.isBefore(minDateValue, "day")) return false;
      if (maxDateValue && value.isAfter(maxDateValue, "day")) return false;
      return true;
    },
    [minDateValue, maxDateValue]
  );

  const emitDateChange = useCallback(
    (nextDate) => {
      const dateEvent = { target: { name: dateFieldName || "", value: nextDate } };
      if (onDateChange) onDateChange(dateEvent);
      if (onDateTimeChange) onDateTimeChange({ date: nextDate, time: "" });
    },
    [dateFieldName, onDateChange, onDateTimeChange]
  );

  const commitDraft = useCallback(
    (value) => {
      const next = value != null && dayjs(value).isValid() ? dayjs(value) : null;
      if (next && !isWithinRange(next)) return;
      emitDateChange(next ? toPickerDate(next) : "");
    },
    [emitDateChange, isWithinRange]
  );

  const handleOpen = useCallback(() => {
    setDraftValue(externalValue);
    draftRef.current = externalValue;
    setPickerOpen(true);
  }, [externalValue]);

  const handleClose = useCallback(() => {
    const draft = draftRef.current;
    if (pickerOpen && draft != null && dayjs(draft).isValid() && isWithinRange(dayjs(draft))) {
      const nextDate = toPickerDate(draft);
      const currentDate = toPickerDate(externalValue);
      if (nextDate !== currentDate) {
        emitDateChange(nextDate);
      }
    }
    setPickerOpen(false);
    setDraftValue(null);
    draftRef.current = null;
  }, [pickerOpen, externalValue, emitDateChange, isWithinRange]);

  const handleChange = useCallback(
    (newValue, context) => {
      const next = newValue != null && dayjs(newValue).isValid() ? dayjs(newValue) : null;
      setDraftValue(next);
      draftRef.current = next;

      if (context?.source === "field") {
        commitDraft(next);
      }
    },
    [commitDraft]
  );

  const handleAccept = useCallback(
    (newValue) => {
      const next = newValue != null && dayjs(newValue).isValid() ? dayjs(newValue) : null;
      setDraftValue(next);
      draftRef.current = next;
      commitDraft(next);
      setPickerOpen(false);
    },
    [commitDraft]
  );

  return (
    <div
      className={[
        "cf-input date-time-row cf-datetime-picker cf-date-picker",
        hasError ? "is-invalid" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={formatDisplayDate(dateValue)}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {renderTrigger
          ? renderTrigger({
              disabled,
              onOpen: handleOpen,
              displayValue: formatDisplayDate(dateValue),
            })
          : null}
        <DatePicker
          value={pickerValue}
          referenceDate={pickerValue || externalValue || undefined}
          open={renderTrigger ? pickerOpen : undefined}
          onOpen={handleOpen}
          onClose={handleClose}
          onChange={handleChange}
          onAccept={handleAccept}
          disabled={disabled}
          minDate={minDateValue}
          maxDate={maxDateValue}
          format="YYYY-MM-DD"
          slots={slots}
          slotProps={{
            ...slotProps,
            textField: {
              placeholder,
              fullWidth: true,
              error: hasError,
              className: [
                "cf-datetime-input-field",
                renderTrigger ? "cf-datetime-input-field--visually-hidden" : "",
              ]
                .filter(Boolean)
                .join(" "),
              sx: {
                "& .MuiInputBase-input.Mui-disabled": {
                  WebkitTextFillColor: "rgb(26, 26, 26)",
                  color: "rgb(26, 26, 26)",
                  opacity: 1,
                },
              },
              ...(slotProps?.textField || {}),
            },
            popper: {
              className: ["cf-datetime-popper", popperClassName].filter(Boolean).join(" "),
              ...(slotProps?.popper || {}),
            },
            actionBar: {
              actions: ["accept", "cancel"],
              ...(slotProps?.actionBar || {}),
            },
          }}
        />
      </LocalizationProvider>
    </div>
  );
};

DatePickerField.propTypes = {
  dateValue: PropTypes.string,
  onDateChange: PropTypes.func,
  onDateTimeChange: PropTypes.func,
  dateFieldName: PropTypes.string,
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
  placeholder: PropTypes.string,
  minDate: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  maxDate: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  popperClassName: PropTypes.string,
  className: PropTypes.string,
  renderTrigger: PropTypes.func,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
};

export default DatePickerField;
