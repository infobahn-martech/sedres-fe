import PropTypes from "prop-types";
import SearchableSelect, { deriveSearchPlaceholder } from "./SearchableSelect";
import "../../design/scss/components/form/PremiumSelect.scss";

/** Keep dropdown above modal + sticky footer/header layers. */
export const PREMIUM_SELECT_MODAL_Z_INDEX = 999999;

/**
 * Thin wrapper around SearchableSelect for master/admin modals — consistent
 * premium styling (see PremiumSelect.scss) and safe stacking inside modals.
 */
export default function PremiumSelect({
  value,
  onChange,
  options = [],
  placeholder,
  searchPlaceholder,
  searchInMenu = false,
  disabled = false,
  hasError = false,
  className = "",
  menuZIndex = PREMIUM_SELECT_MODAL_Z_INDEX,
  noResultsText,
  menuPortalTarget,
  menuPosition = "fixed",
  menuPlacement = "auto",
  menuShouldBlockScroll = false,
  menuClassName,
  ...rest
}) {
  const mergedClass = ["premium-select", className].filter(Boolean).join(" ");
  const resolvedMenuPortalTarget =
    menuPortalTarget === undefined
      ? (typeof document !== "undefined" ? document.body : null)
      : menuPortalTarget;

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder ?? deriveSearchPlaceholder(placeholder)}
      searchInMenu={searchInMenu}
      disabled={disabled}
      hasError={hasError}
      className={mergedClass}
      menuZIndex={menuZIndex}
      noResultsText={noResultsText}
      menuPortalTarget={resolvedMenuPortalTarget}
      menuPosition={menuPosition}
      menuPlacement={menuPlacement}
      menuShouldBlockScroll={menuShouldBlockScroll}
      menuClassName={menuClassName}
      {...rest}
    />
  );
}

PremiumSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
  className: PropTypes.string,
  menuZIndex: PropTypes.number,
  noResultsText: PropTypes.string,
  menuPortalTarget: PropTypes.any,
  menuPosition: PropTypes.oneOf(["absolute", "fixed"]),
  menuPlacement: PropTypes.oneOf(["auto", "top", "bottom"]),
  menuShouldBlockScroll: PropTypes.bool,
  menuClassName: PropTypes.string,
  searchInMenu: PropTypes.bool,
};
