import PropTypes from "prop-types";

export const FormTextarea = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  className = "",
  rows = 3,
  disabled = false,
}) => {
  return (
    <div className={`cf-textarea ${className}`}>
      <textarea
        value={value || ""}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
      />
    </div>
  );
};

FormTextarea.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  onKeyDown: PropTypes.func,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  rows: PropTypes.number,
  disabled: PropTypes.bool,
};
