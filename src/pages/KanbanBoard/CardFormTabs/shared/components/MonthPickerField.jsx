import PropTypes from "prop-types";
import { useMemo, useCallback } from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import "@/design/scss/general.scss";

dayjs.extend(customParseFormat);

const VALUE_FORMAT = "YYYY-MM";
const DISPLAY_FORMAT = "MMMM YYYY";

const toDayjsValue = (monthValue) => {
  if (!monthValue || String(monthValue).trim() === "") return null;
  const parsed = dayjs(String(monthValue).trim().slice(0, 7), VALUE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
};

/**
 * Month + year picker with the same look as DatePickerField.
 * Value in / out is "YYYY-MM" ("" when cleared).
 */
const MonthPickerField = ({
  monthValue = "",
  onMonthChange,
  disabled = false,
  hasError = false,
  placeholder = "Select month",
  minMonth,
  maxMonth,
  popperClassName = "",
  className = "",
  ariaLabel = "Month",
}) => {
  const value = useMemo(() => toDayjsValue(monthValue), [monthValue]);
  const minDate = useMemo(() => toDayjsValue(minMonth) ?? undefined, [minMonth]);
  const maxDate = useMemo(() => toDayjsValue(maxMonth) ?? undefined, [maxMonth]);

  const handleAccept = useCallback(
    (newValue) => {
      const next = newValue != null && dayjs(newValue).isValid() ? dayjs(newValue).format(VALUE_FORMAT) : "";
      if (next !== monthValue) onMonthChange?.(next);
    },
    [monthValue, onMonthChange]
  );

  return (
    <div
      className={["cf-input date-time-row cf-datetime-picker cf-date-picker cf-month-picker", hasError ? "is-invalid" : "", className]
        .filter(Boolean)
        .join(" ")}
      title={value ? value.format(DISPLAY_FORMAT) : ""}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          value={value}
          onAccept={handleAccept}
          views={["year", "month"]}
          openTo="month"
          format={DISPLAY_FORMAT}
          disabled={disabled}
          minDate={minDate}
          maxDate={maxDate}
          closeOnSelect
          slotProps={{
            textField: {
              placeholder,
              fullWidth: true,
              error: hasError,
              className: "cf-datetime-input-field",
              inputProps: { "aria-label": ariaLabel },
            },
            popper: {
              className: ["cf-datetime-popper", popperClassName].filter(Boolean).join(" "),
            },
          }}
        />
      </LocalizationProvider>
    </div>
  );
};

MonthPickerField.propTypes = {
  monthValue: PropTypes.string,
  onMonthChange: PropTypes.func,
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
  placeholder: PropTypes.string,
  minMonth: PropTypes.string,
  maxMonth: PropTypes.string,
  popperClassName: PropTypes.string,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};

export default MonthPickerField;
