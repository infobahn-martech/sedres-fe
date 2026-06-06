import { useRef, useState, useEffect } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import GroupSettingsIcon from "../../../../../../assets/images/cv.png";
import { MAIN_TABS, CREW_MANAGEMENT_SUBTABS, MATERIAL_MANAGEMENT_SUBTABS } from "./Husbandry.constants";
import NavTabButton from "../../../../../../components/NavTabButton";

// Sub-components
const CREW_DIRECT_NAV_SUBTABS = [
  { id: CREW_MANAGEMENT_SUBTABS.TRANSPORT, label: "Transport" },
  { id: CREW_MANAGEMENT_SUBTABS.CG_PASS, label: "CG Pass" },
  { id: CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS, label: "Zawil Pass" },
  { id: CREW_MANAGEMENT_SUBTABS.HOTEL, label: "Hotel" },
  { id: CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE, label: "Medical" },
];

export const HusbandryTabs = ({ activeMainTab, activeSubTab, onMainTabChange, onSubTabChange, onNavigateToTab, selectedActionTab = null, selectedServices = [], onBackToServiceSelection, cardColor = "#00368c" }) => {

  // Filter main tabs based on selected services
  const allMainTabs = [
    { id: MAIN_TABS.CREW_MANAGEMENT, label: "Crew Management" },
    { id: MAIN_TABS.WAREHOUSE, label: "Warehouse" },
    { id: MAIN_TABS.ON_OFF_HIRE_SURVEY, label: "On/Off-Hire Survey" },
    { id: MAIN_TABS.ON_STATION, label: "On Station" },
    { id: MAIN_TABS.MATERIAL_MANAGEMENT, label: "Material Management" },
    { id: MAIN_TABS.WASTE_DISPOSAL, label: "Waste Disposal" },
    { id: MAIN_TABS.MWP_RENEWAL, label: "MWP Renewal" },
    { id: MAIN_TABS.THIRD_PARTY_SERVICES, label: "Third-Party Services" },
  ];

  const mainTabs = selectedServices.length > 0
    ? allMainTabs.filter(tab => selectedServices.includes(tab.id))
    : allMainTabs;

  let subTabs = [];
  if (activeMainTab === MAIN_TABS.CREW_MANAGEMENT) {
    subTabs = [
      { id: CREW_MANAGEMENT_SUBTABS.CREW, label: "Crew" },
      ...CREW_DIRECT_NAV_SUBTABS,
    ];
  } else if (activeMainTab === MAIN_TABS.MATERIAL_MANAGEMENT) {
    subTabs = [
      {
        id: MATERIAL_MANAGEMENT_SUBTABS.INBOUND_ORDERS,
        label: "Inbound Orders"
      },
      {
        id: MATERIAL_MANAGEMENT_SUBTABS.LANDING_NOTE,
        label: "Landing Note"
      },
      {
        id: MATERIAL_MANAGEMENT_SUBTABS.DISPATCH_NOTE,
        label: "Dispatch Note"
      },
    ];
  } else if (activeMainTab === MAIN_TABS.WAREHOUSE) {
    // Warehouse - no sub-tabs for now
    subTabs = [];
  } else if (activeMainTab === MAIN_TABS.ON_OFF_HIRE_SURVEY) {
    // On/Off-Hire Survey - no sub-tabs for now
    subTabs = [];
  } else if (activeMainTab === MAIN_TABS.ON_STATION) {
    // On Station - no sub-tabs for now
    subTabs = [];
  } else if (activeMainTab === MAIN_TABS.WASTE_DISPOSAL) {
    // Waste Disposal - no sub-tabs for now
    subTabs = [];
  } else if (activeMainTab === MAIN_TABS.MWP_RENEWAL) {
    // MWP Renewal - no sub-tabs for now
    subTabs = [];
  } else if (activeMainTab === MAIN_TABS.THIRD_PARTY_SERVICES) {
    // Third-Party Services - no sub-tabs for now
    subTabs = [];
  }

  return (
    <div className="operation-left" style={{ "--card-color": cardColor }}>
      {onBackToServiceSelection && (
        <button
          type="button"
          className="husbandry-back-link-small"
          onClick={onBackToServiceSelection}
          style={{ "--card-color": cardColor }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>What services do you need?</span>
        </button>
      )}
      {mainTabs.map((tab) => {
        const isActive = activeMainTab === tab.id;
        const currentSubTabs = isActive ? subTabs : [];

        return (
          <div key={tab.id} className="op-tab-group">
            <NavTabButton
              className="op-tab op-tab-main"
              active={isActive}
              onClick={() => onMainTabChange(tab.id)}
            >
              {tab.label}
            </NavTabButton>
            {isActive && currentSubTabs.length > 0 && (
              <div className="op-submenu">
                {currentSubTabs.map((subTab) => {
                  const isDirectCrewNav = CREW_DIRECT_NAV_SUBTABS.some((tab) => tab.id === subTab.id);
                  const handleSubTabClick = () => {
                    if (isDirectCrewNav && onNavigateToTab) {
                      onNavigateToTab(subTab.id);
                      return;
                    }
                    onSubTabChange(subTab.id);
                  };

                  return (
                    <NavTabButton
                      key={subTab.id}
                      className="op-tab op-tab-sub"
                      active={activeSubTab === subTab.id}
                      onClick={handleSubTabClick}
                    >
                      {subTab.label}
                    </NavTabButton>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

HusbandryTabs.propTypes = {
  activeMainTab: PropTypes.string.isRequired,
  activeSubTab: PropTypes.string.isRequired,
  onMainTabChange: PropTypes.func.isRequired,
  onSubTabChange: PropTypes.func.isRequired,
  onNavigateToTab: PropTypes.func,
  selectedActionTab: PropTypes.string,
  selectedServices: PropTypes.array,
  onBackToServiceSelection: PropTypes.func,
  cardColor: PropTypes.string,
};

export const FormSection = ({ icon, title, children }) => {
  return (
    <>
      {title && (
        <div className="cf-section-header">
          <span className="cf-section-icon">
            <img src={icon} alt={title} />
          </span>
          <span className="cf-section-title">{title}</span>
        </div>
      )}
      <div className="cf-section-body">{children}</div>
    </>
  );
};

FormSection.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export const FormField = ({ label, children, className = "" }) => {
  return (
    <div className={`cf-field ${className}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
};

FormField.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export const FormInput = ({ type = "text", value, onChange, placeholder, className = "", readOnly = false, disabled = false }) => {
  return (
    <div className={`cf-input ${className}`}>
      <input
        type={type}
        value={value}
        onChange={disabled ? undefined : onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
      />
    </div>
  );
};

FormInput.propTypes = {
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  readOnly: PropTypes.bool,
  disabled: PropTypes.bool,
};

// Custom Select Component (similar to MultiSelectEmail UI)
const CustomSelect = ({ value, onChange, options = [], placeholder, className = "", disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    if (!isOpen) setSearchTerm("");
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : "";

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div ref={wrapperRef} className={`cf-multi-select-email ${disabled ? "disabled" : ""} ${className}`}>
      <div
        ref={triggerRef}
        className={`cf-multi-select-email-input ${disabled ? "disabled" : ""}`}
        onClick={disabled ? undefined : () => setIsOpen(!isOpen)}
        style={{ pointerEvents: disabled ? "none" : "auto", opacity: disabled ? 0.6 : 1 }}
      >
        <div className="cf-multi-select-email-tags">
          {displayValue ? (
            <span className="cf-multi-select-selected-value">{displayValue}</span>
          ) : (
            <span className="cf-multi-select-placeholder">{placeholder || "Select..."}</span>
          )}
        </div>
        <span className="cf-multi-select-arrow">▼</span>
      </div>

      {isOpen && (
        <div
          className="cf-select-portal"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxWidth: dropdownPos.width,
            minWidth: dropdownPos.width,
          }}
        >
          <div className="cf-multi-select-search">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="cf-multi-select-search-input"
            />
          </div>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className={`cf-multi-select-option ${value === option.value ? "selected" : ""}`}
                onMouseDown={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
              </div>
            ))
          ) : (
            <div className="cf-multi-select-no-results">No results found</div>
          )}
        </div>
      )}
    </div>
  );
};

CustomSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export const FormSelect = ({ value, onChange, options = [], placeholder, className = "", disabled = false }) => {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};

FormSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export const FormTextarea = ({ value, onChange, placeholder, className = "", rows = 3 }) => {
  return (
    <div className={`cf-textarea ${className}`}>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
};

FormTextarea.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  rows: PropTypes.number,
};

const crewMenuStyles = (cardColor) => ({
  menu: (base) => ({
    ...base,
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    border: "1px solid #e2e2ea",
    marginTop: "4px",
    zIndex: 9999,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 12000,
  }),
  menuList: (base) => ({
    ...base,
    padding: "4px",
    maxHeight: "200px",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? cardColor
      : state.isFocused
        ? "rgba(0, 54, 140, 0.1)"
        : "#ffffff",
    color: state.isSelected ? "#ffffff" : "#1a1a1a",
    fontSize: "13px",
    padding: "10px 12px",
    borderRadius: "6px",
    margin: "2px 0",
    cursor: "pointer",
    "&:active": {
      backgroundColor: cardColor,
      color: "#ffffff",
    },
  }),
});

/** `options.transportCompact` — used by Transport husbandry only; other screens use default styles. */
export const getCrewMultiSelectStyles = (cardColor = "#00368c", options = {}) => {
  if (options.transportCompact) {
    return {
      ...crewMenuStyles(cardColor),
      container: (base) => ({
        ...base,
        width: "100%",
      }),
      control: (base, state) => ({
        ...base,
        minHeight: 40,
        height:
          state.hasValue && state.selectProps?.isMulti ? "auto" : 40,
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #ddd",
        borderRadius: "6px",
        boxShadow: state.isFocused ? "0 0 0 1px #3e5cb6" : "none",
        backgroundColor: "#ffffff",
        padding: 0,
        cursor: "default",
        alignItems: "center",
        overflow: "hidden",
        "&:hover": {
          borderColor: state.isFocused ? "#3e5cb6" : "#999",
        },
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "0 12px",
        minHeight: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: "4px",
        minWidth: 0,
        flex: "1 1 auto",
        alignItems: "center",
        alignContent: "center",
        overflow: "hidden",
      }),
      multiValue: (base) => ({
        ...base,
        backgroundColor: cardColor,
        borderRadius: "4px",
        margin: "0 4px 0 0",
        minHeight: 22,
        maxWidth: "100%",
      }),
      multiValueLabel: (base) => ({
        ...base,
        color: "#ffffff",
        fontSize: "11px",
        fontWeight: 500,
        padding: "2px 4px 2px 6px",
        lineHeight: 1.25,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }),
      multiValueRemove: (base) => ({
        ...base,
        color: "#ffffff",
        borderRadius: "2px",
        padding: "2px 4px",
        "&:hover": {
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          color: "#ffffff",
        },
      }),
      placeholder: (base) => ({
        ...base,
        color: "#999",
        fontSize: "13px",
        margin: 0,
        marginLeft: 0,
      }),
      input: (base) => ({
        ...base,
        color: "#1a1a1a",
        fontSize: "13px",
        margin: 0,
        padding: 0,
        minWidth: "2px",
      }),
      indicatorsContainer: (base) => ({
        ...base,
        minHeight: 40,
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        padding: 0,
      }),
      indicatorSeparator: () => ({
        display: "none",
      }),
      dropdownIndicator: (base) => ({
        ...base,
        color: "#666",
        padding: "0 10px",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover": {
          color: cardColor,
        },
      }),
      clearIndicator: (base) => ({
        ...base,
        color: "#999",
        padding: "0 6px",
        height: "100%",
        display: "flex",
        alignItems: "center",
        "&:hover": {
          color: "#ff0000",
        },
      }),
    };
  }

  return {
    ...crewMenuStyles(cardColor),
    control: (base) => ({
      ...base,
      minHeight: "42px",
      border: "none",
      boxShadow: "none",
      backgroundColor: "transparent",
      borderRadius: "8px",
      padding: "0",
      width: "100%",
      overflow: "hidden",
    }),
    valueContainer: (base) => ({
      ...base,
      minHeight: "34px",
      padding: "0",
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      minWidth: 0,
      overflow: "hidden",
      flex: 1,
      alignContent: "center",
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: cardColor,
      borderRadius: "6px",
      margin: "0",
      minHeight: "26px",
      maxWidth: "100%",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "#ffffff",
      fontSize: "12px",
      fontWeight: "500",
      padding: "4px 6px",
      paddingRight: "4px",
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "#ffffff",
      borderRadius: "4px",
      padding: "2px 4px",
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        color: "#ffffff",
      },
    }),
    placeholder: (base) => ({
      ...base,
      color: "#999",
      fontSize: "13px",
      marginLeft: 0,
    }),
    input: (base) => ({
      ...base,
      color: "#1a1a1a",
      fontSize: "13px",
      margin: 0,
      padding: 0,
      minWidth: "60px",
    }),
    indicatorsContainer: (base) => ({
      ...base,
      paddingRight: "4px",
      flexShrink: 0,
      alignSelf: "stretch",
    }),
    indicatorSeparator: () => ({
      display: "none",
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: "#666",
      padding: "4px",
      "&:hover": {
        color: cardColor,
      },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: "#999",
      padding: "4px",
      "&:hover": {
        color: "#ff0000",
      },
    }),
  };
};

export const truncateCrewLabel = (text = "") => {
  if (typeof text !== "string") return "";
  return text.length > 9 ? `${text.slice(0, 9)}...` : text;
};

export const formatCrewOptionLabel = (option, { context }) => {
  const fullLabel = option?.label || "";
  if (context !== "value") {
    return fullLabel;
  }

  return (
    <span title={fullLabel}>
      {truncateCrewLabel(fullLabel)}
    </span>
  );
};

// Yes/No Icon Components
export const YesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" fill="#00B894" stroke="#00B894" strokeWidth="2" />
    <path d="M6 10L9 13L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const NoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" fill="#FF0000" stroke="#FF0000" strokeWidth="2" />
    <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// React Quill Editor Component
export const ReactQuillEditor = ({ value, onChange, placeholder, name = "description", className = "" }) => {
  const quillRef = useRef(null);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      ["link", "image"],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "link",
    "image",
  ];

  const handleChange = (content) => {
    const syntheticEvent = { target: { value: content, name: name } };
    onChange(syntheticEvent);
  };

  return (
    <div className={`react-quill-wrapper ${className}`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ""}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || "Enter remarks..."}
      />
    </div>
  );
};

ReactQuillEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  name: PropTypes.string,
  className: PropTypes.string,
};

