import PropTypes from "prop-types";
import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { splitApiDateTimeParts } from "../../../../shared/helpers/dateTimeFieldUtils";
import "../../../../design/scss/general.scss";

dayjs.extend(customParseFormat);

const parseDateTimeParts = (dateValue, timeValue) =>
  splitApiDateTimeParts(dateValue, timeValue);

const toDayjsValue = (dateValue, timeValue) => {
  const { date, time } = parseDateTimeParts(dateValue, timeValue);
  if (!date) return null;

  const effectiveTime = time || "00:00";
  const parsed = dayjs(`${date} ${effectiveTime}`, "YYYY-MM-DD HH:mm", true);
  return parsed.isValid() ? parsed : null;
};

const toPickerParts = (newValue) => {
  if (newValue == null || !dayjs(newValue).isValid()) {
    return { date: "", time: "" };
  }
  const parsed = dayjs(newValue);
  return {
    date: parsed.format("YYYY-MM-DD"),
    time: parsed.format("HH:mm"),
  };
};

const formatDisplayDateTime = (dateValue, timeValue) => {
  const parsed = toDayjsValue(dateValue, timeValue);
  if (!parsed) return "";
  return parsed.toDate().toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const DateTimePickerField = ({
  dateValue = "",
  timeValue = "",
  onDateChange,
  onTimeChange,
  onDateTimeChange,
  dateFieldName,
  timeFieldName,
  disabled = false,
  hasError = false,
  placeholder = "Select date and time",
  minDate,
  maxDate,
  popperClassName = "",
  openOnClick = false,
}) => {
  const externalValue = useMemo(() => toDayjsValue(dateValue, timeValue), [dateValue, timeValue]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(null);
  const draftRef = useRef(null);

  useEffect(() => {
    draftRef.current = draftValue;
  }, [draftValue]);

  const minDateValue = useMemo(() => (minDate ? dayjs(minDate) : undefined), [minDate]);
  const maxDateValue = useMemo(() => (maxDate ? dayjs(maxDate) : undefined), [maxDate]);

  const pickerValue = pickerOpen ? (draftValue ?? externalValue) : externalValue;

  const emitDateTimeChange = useCallback(
    (nextValues) => {
      const dateEvent = { target: { name: dateFieldName || "", value: nextValues.date } };
      const timeEvent = { target: { name: timeFieldName || "", value: nextValues.time } };

      if (onDateChange) onDateChange(dateEvent);
      if (onTimeChange) onTimeChange(timeEvent);
      if (onDateTimeChange) onDateTimeChange(nextValues);
    },
    [dateFieldName, onDateChange, onDateTimeChange, onTimeChange, timeFieldName]
  );

  const commitDraft = useCallback(
    (value) => {
      const next = value != null && dayjs(value).isValid() ? dayjs(value) : null;
      if (!next) {
        emitDateTimeChange({ date: "", time: "" });
        return;
      }
      emitDateTimeChange(toPickerParts(next));
    },
    [emitDateTimeChange]
  );

  const handleOpen = useCallback(() => {
    setDraftValue(externalValue);
    draftRef.current = externalValue;
    setPickerOpen(true);
  }, [externalValue]);

  const handleClose = useCallback(() => {
    const draft = draftRef.current;
    if (pickerOpen && draft != null && dayjs(draft).isValid()) {
      const next = toPickerParts(draft);
      const current = parseDateTimeParts(dateValue, timeValue);
      if (next.date !== current.date || next.time !== current.time) {
        emitDateTimeChange(next);
      }
    }
    setPickerOpen(false);
    setDraftValue(null);
    draftRef.current = null;
  }, [pickerOpen, dateValue, timeValue, emitDateTimeChange]);

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
    <div className={`cf-input date-time-row cf-datetime-picker ${hasError ? "is-invalid" : ""}`} title={formatDisplayDateTime(dateValue, timeValue)}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateTimePicker
          {...(openOnClick ? { open: pickerOpen } : {})}
          value={pickerValue}
          referenceDate={pickerValue || externalValue || undefined}
          onOpen={handleOpen}
          onClose={handleClose}
          onChange={handleChange}
          onAccept={handleAccept}
          disabled={disabled}
          minDate={minDateValue}
          maxDate={maxDateValue}
          minutesStep={5}
          format="YYYY-MM-DD HH:mm"
          slotProps={{
            textField: {
              placeholder,
              fullWidth: true,
              error: hasError,
              className: "cf-datetime-input-field",
              ...(openOnClick ? { onClick: () => { if (!pickerOpen) handleOpen(); } } : {}),
              sx: {
                "& .MuiInputBase-input.Mui-disabled": {
                  WebkitTextFillColor: "rgb(26, 26, 26)",
                  color: "rgb(26, 26, 26)",
                  opacity: 1,
                },
                ...(openOnClick ? { "& .MuiInputBase-input": { cursor: "pointer" } } : {}),
              },
            },
            popper: {
              className: ["cf-datetime-popper", popperClassName].filter(Boolean).join(" "),
            },
            actionBar: {
              actions: ["accept", "cancel"],
            },
          }}
        />
      </LocalizationProvider>
    </div>
  );
};

DateTimePickerField.propTypes = {
  dateValue: PropTypes.string,
  timeValue: PropTypes.string,
  onDateChange: PropTypes.func,
  onTimeChange: PropTypes.func,
  onDateTimeChange: PropTypes.func,
  dateFieldName: PropTypes.string,
  timeFieldName: PropTypes.string,
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
  placeholder: PropTypes.string,
  minDate: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  maxDate: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  popperClassName: PropTypes.string,
  openOnClick: PropTypes.bool,
};

export default DateTimePickerField;
