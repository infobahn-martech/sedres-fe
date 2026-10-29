import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { MAIN_TABS, CREW_MANAGEMENT_SUBTABS, MATERIAL_MANAGEMENT_SUBTABS, LAUNCH_HIRE_SUBTABS, TAB_ICON_COLORS, TAB_ICON_PATHS } from "./Husbandry.constants";
import NavTabButton from "../../../../../../../components/NavTabButton";
import { getInitials } from "../../../../../../../shared/utils/utils";

// Sub-components
const CREW_DIRECT_NAV_SUBTABS = [
  // { id: "crewChange", label: "Crew Change" },
  { id: CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS, label: "Zawil Pass" },
  { id: CREW_MANAGEMENT_SUBTABS.CG_PASS, label: "CG Pass" },
  { id: CREW_MANAGEMENT_SUBTABS.TRANSPORT, label: "Transport" },
  { id: CREW_MANAGEMENT_SUBTABS.HOTEL, label: "Hotel" },
  { id: CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE, label: "Medical" },
];

const TabIcon = ({ id }) => {
  const path = TAB_ICON_PATHS[id];
  if (!path) return null;
  const color = TAB_ICON_COLORS[id] || "#64748b";
  return (
    <span className="op-tab-icon" style={{ "--tab-icon-color": color }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d={path} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

TabIcon.propTypes = {
  id: PropTypes.string.isRequired,
};

// Premium redesign — small icon set for section headers/groups that aren't
// already covered by TAB_ICON_PATHS (mail, calendar, folder, notebook, list).
// Reuses TAB_ICON_PATHS for car/users/hotel/medical/cg-pass/zawil-pass so the
// same glyph appears in both the left nav and the content-area headers.
const HUSB_ICON_PATHS = {
  mail: "M2 4h12v8H2V4zm0 0l6 5 6-5",
  calendar: "M3 3h10v10H3V3zm0 3h10M6 2v2M10 2v2",
  folder: "M2 4h4l1.5 2H14v7H2V4z",
  notebook: "M4 2h8v12H4V2zm2 3h4M6 8h4M6 11h2",
  list: "M2 4h12M2 8h12M2 12h8",
  billing: "M4 2h8a1 1 0 011 1v11l-2-1.2-2 1.2-2-1.2-2 1.2V3a1 1 0 011-1z M6 6h4M6 9h2",
  crewChange: "M2 5H11L9 3M11 5L9 7M14 11H5L7 9M5 11L7 13",
  portPass: "M2 3H14C14.5523 3 15 3.44772 15 4V12C15 12.5523 14.5523 13 14 13H2C1.44772 13 1 12.5523 1 12V4C1 3.44772 1.44772 3 2 3ZM5.5 8.5C6.32843 8.5 7 7.82843 7 7C7 6.17157 6.32843 5.5 5.5 5.5C4.67157 5.5 4 6.17157 4 7C4 7.82843 4.67157 8.5 5.5 8.5ZM3.5 11C3.5 9.89543 4.39543 9 5.5 9C6.60457 9 7.5 9.89543 7.5 11M9.5 6H12.5M9.5 8.5H12.5",
};

/** Section/card icon — `id` looks up TAB_ICON_PATHS first (shared with the left nav), then HUSB_ICON_PATHS. */
export const HusbIcon = ({ id }) => {
  const path = TAB_ICON_PATHS[id] || HUSB_ICON_PATHS[id];
  if (!path) return null;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={path} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

HusbIcon.propTypes = {
  id: PropTypes.string.isRequired,
};

/** Premium card header — tinted icon box + title + optional subtitle + optional count badge. Pair with a `husb-accent-*` class on the card wrapper. */
export const PremiumCardHeader = ({ icon, title, subtitle, count, headerClassName, titleClassName }) => (
  <div className={headerClassName}>
    <div className="crew-pass-requests-table-card__header-main">
      <span className="husb-icon-box">
        <HusbIcon id={icon} />
      </span>
      <div className="husb-header-text">
        <h3 className={titleClassName}>{title}</h3>
        {subtitle && <p className="husb-header-subtitle">{subtitle}</p>}
      </div>
    </div>
    {count != null && (
      <span className="crew-pass-requests-table-card__count" aria-live="polite">
        {count}
      </span>
    )}
  </div>
);

PremiumCardHeader.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  headerClassName: PropTypes.string.isRequired,
  titleClassName: PropTypes.string.isRequired,
};

/** Splits a label on "*" and wraps the marker in a red span, so a single label can also carry the required indicator. */
export const renderRequiredLabel = (text) => {
  const parts = text.split("*");
  if (parts.length === 1) return text;
  return (
    <>
      {parts[0]}<span className="text-danger">*</span>{parts.slice(1).join("*")}
    </>
  );
};

/** Groups a related run of fields under a small colored icon + label + divider. Pass an empty `label` to omit the header when no field description is needed. Pass `accent` matching a `husb-accent-*` class. */
export const FormGroup = ({ icon, label, accent = "slate", children }) => (
  <div className={`husb-group husb-accent-${accent}`}>
    {label && (
      <div className="husb-group__label">
        <span className="husb-group__icon">
          <HusbIcon id={icon} />
        </span>
        <span className="husb-group__label-text">{renderRequiredLabel(label)}</span>
      </div>
    )}
    <div className="husb-group__body">{children}</div>
  </div>
);

FormGroup.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string,
  accent: PropTypes.oneOf(["blue", "teal", "purple", "amber", "rose", "slate", "green", "pink"]),
  children: PropTypes.node.isRequired,
};

/** Places two fields side by side on wide viewports, stacking on narrow ones. */
export const FieldRow = ({ children }) => <div className="husb-group__row">{children}</div>;

FieldRow.propTypes = {
  children: PropTypes.node.isRequired,
};

const AVATAR_PALETTE = ["purple", "orange", "blue", "green"];

/** Initials avatar for crew-name table cells — same palette/rotation as CrewContent's avatar chips, so both feel like one system. */
export const CrewAvatar = ({ name, index = 0 }) => {
  const initials = getInitials(name) || "?";
  const palette = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  return <span className={`husb-avatar husb-avatar--${palette}`}>{initials}</span>;
};

CrewAvatar.propTypes = {
  name: PropTypes.string,
  index: PropTypes.number,
};

/** Crew-name cell: avatar + name, or an em-dash when there's no name. */
export const CrewCell = ({ name }) => {
  if (!name || !String(name).trim()) {
    return <span className="crew-pass-requests-table__empty-cell">—</span>;
  }
  return (
    <span className="husb-crew-cell">
      {/* <CrewAvatar name={name} index={index} /> */}
      <span className="husb-crew-cell__name">{name}</span>
    </span>
  );
};

CrewCell.propTypes = {
  name: PropTypes.string,
  index: PropTypes.number,
};

/** Work-order number rendered as a tinted chip, or an em-dash when absent. */
export const WorkOrderChip = ({ value }) => {
  if (!value && value !== 0) {
    return <span className="crew-pass-requests-table__empty-cell">—</span>;
  }
  return <span className="husb-wo-chip">{value}</span>;
};

WorkOrderChip.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

/** From → To route cell. Renders exactly what the data provides — no fabricated secondary line. */
export const RouteCell = ({ from, to }) => {
  const hasFrom = from && String(from).trim() !== "";
  const hasTo = to && String(to).trim() !== "";
  if (!hasFrom && !hasTo) {
    return <span className="crew-pass-requests-table__empty-cell">—</span>;
  }
  return (
    <span className="husb-route">
      <span className="husb-route__point">{hasFrom ? from : "—"}</span>
      <span className="husb-route__arrow">→</span>
      <span className="husb-route__point">{hasTo ? to : "—"}</span>
    </span>
  );
};

RouteCell.propTypes = {
  from: PropTypes.string,
  to: PropTypes.string,
};

export const HusbandryTabs = ({ activeMainTab, activeSubTab, onMainTabChange, onSubTabChange, onNavigateToTab, selectedServices = [], onBackToServiceSelection, cardColor = "#00368c", crewCount, subTabCounts = {}, materialManagementVisibleSubTabIds = null, hiddenMainTabIds = [] }) => {
  const hasCrewCount = typeof crewCount === "number";
  // Mobile-only: the stacked main+submenu list pushes real content far down
  // the page on phones, so it starts collapsed behind a toggle there. Has no
  // effect on desktop, where the toggle is hidden by CSS and the list always shows.
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const collapseNav = () => setIsNavExpanded(false);

  // Filter main tabs based on selected services
  const allMainTabs = [
    { id: MAIN_TABS.CREW_MANAGEMENT, label: "Crew Management" },
    { id: "LAUNCH_HIRE", label: "Launch Hire" },
    { id: MAIN_TABS.WAREHOUSE, label: "Warehouse" },
    { id: MAIN_TABS.ON_OFF_HIRE_SURVEY, label: "On/Off-Hire Survey" },
    { id: MAIN_TABS.ON_STATION, label: "On Station" },
    { id: MAIN_TABS.MATERIAL_MANAGEMENT, label: "Material Management" },
    { id: MAIN_TABS.WASTE_DISPOSAL, label: "Waste Disposal" },
    { id: MAIN_TABS.MWP_RENEWAL, label: "MWP Renewal" },
    { id: MAIN_TABS.THIRD_PARTY_SERVICES, label: "Third-Party Services" },
    { id: MAIN_TABS.ADD_ON_SERVICES, label: "Add-on Services" },
  ];

  const mainTabs = (selectedServices.length > 0
    ? allMainTabs.filter(tab => selectedServices.includes(tab.id))
    : allMainTabs
  ).filter((tab) => !hiddenMainTabIds.includes(tab.id));

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
      {
        id: MATERIAL_MANAGEMENT_SUBTABS.ORDER_HISTORY,
        label: "Order History"
      },
    ];
    // KANBAN_CARD > MATERIAL_MANAGEMENT per-tab VIEW gates — null means the
    // caller didn't pass a permission filter, so nothing changes for callers
    // that don't care about it.
    if (materialManagementVisibleSubTabIds) {
      subTabs = subTabs.filter((tab) => materialManagementVisibleSubTabIds.includes(tab.id));
    }
  } else if (activeMainTab === "LAUNCH_HIRE") {
    subTabs = [
      { id: LAUNCH_HIRE_SUBTABS.REQUESTS, label: "Requests" },
      { id: LAUNCH_HIRE_SUBTABS.INBOUND_ORDERS, label: "Inbound Orders" },
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
  } else if (activeMainTab === MAIN_TABS.ADD_ON_SERVICES) {
    // Add-on Services - no sub-tabs for now
    subTabs = [];
  }

  const activeMainTabLabel = mainTabs.find((tab) => tab.id === activeMainTab)?.label || "Menu";
  const activeSubTabLabel = subTabs.find((tab) => tab.id === activeSubTab)?.label;

  return (
    <div className={`operation-left ${isNavExpanded ? "husbandry-nav-expanded" : ""}`} style={{ "--card-color": cardColor }}>
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
      <button
        type="button"
        className="husbandry-nav-toggle"
        onClick={() => setIsNavExpanded((prev) => !prev)}
        aria-expanded={isNavExpanded}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="husbandry-nav-toggle-label">
          {activeSubTabLabel ? `${activeMainTabLabel} · ${activeSubTabLabel}` : activeMainTabLabel}
        </span>
        <svg className="husbandry-nav-toggle-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="husbandry-nav-collapsible">
        {mainTabs.map((tab) => {
          const isActive = activeMainTab === tab.id;
          const currentSubTabs = isActive ? subTabs : [];

          return (
            <div key={tab.id} className="op-tab-group">
              <NavTabButton
                className="op-tab op-tab-main"
                active={isActive}
                onClick={() => {
                  onMainTabChange(tab.id);
                  collapseNav();
                }}
              >
                <TabIcon id={tab.id} />
                <span className="op-tab-label">{tab.label}</span>
                {hasCrewCount && <span className="op-tab-count">{crewCount}</span>}
              </NavTabButton>
              {isActive && currentSubTabs.length > 0 && (
                <div className="op-submenu">
                  {currentSubTabs.map((subTab) => {
                    const isDirectCrewNav = CREW_DIRECT_NAV_SUBTABS.some((tab) => tab.id === subTab.id);
                    const handleSubTabClick = () => {
                      if (isDirectCrewNav && onNavigateToTab) {
                        onNavigateToTab(subTab.id);
                      } else {
                        onSubTabChange(subTab.id);
                      }
                      collapseNav();
                    };

                    const subTabCount = subTabCounts?.[subTab.id];
                    const hasSubTabCount = typeof subTabCount === "number";

                    return (
                      <NavTabButton
                        key={subTab.id}
                        className="op-tab op-tab-sub"
                        active={activeSubTab === subTab.id}
                        onClick={handleSubTabClick}
                      >
                        <TabIcon id={subTab.id} />
                        <span className="op-tab-label">{subTab.label}</span>
                        {hasSubTabCount ? (
                          <span className="op-tab-count">{subTabCount}</span>
                        ) : (
                          hasCrewCount && <span className="op-tab-count">{crewCount}</span>
                        )}
                      </NavTabButton>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

HusbandryTabs.propTypes = {
  activeMainTab: PropTypes.string.isRequired,
  activeSubTab: PropTypes.string,
  onMainTabChange: PropTypes.func.isRequired,
  onSubTabChange: PropTypes.func.isRequired,
  onNavigateToTab: PropTypes.func,
  selectedActionTab: PropTypes.string,
  selectedServices: PropTypes.array,
  onBackToServiceSelection: PropTypes.func,
  cardColor: PropTypes.string,
  crewCount: PropTypes.number,
  subTabCounts: PropTypes.object,
  materialManagementVisibleSubTabIds: PropTypes.arrayOf(PropTypes.string),
  hiddenMainTabIds: PropTypes.arrayOf(PropTypes.string),
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

export const FormField = ({ label, children, className = "" }) => (
  <div className={`cf-field ${className}`}>
    {label && <label>{renderRequiredLabel(label)}</label>}
    {children}
  </div>
);

FormField.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export const FormInput = ({ type = "text", value, onChange, placeholder, className = "", readOnly = false, disabled = false }) => {
  const hasError = className.includes("is-invalid");
  return (
    <div className={`cf-input ${className}`} style={hasError ? { borderColor: "#dc3545" } : {}}>
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
  const portalRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current?.contains(event.target)) return;
      if (portalRef.current?.contains(event.target)) return;
      setIsOpen(false);
      setSearchTerm("");
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

  // The portal is positioned via the trigger's bounding rect at open time only, so
  // scrolling an ancestor (e.g. an internally-scrollable panel) leaves it stranded
  // at a stale position. Close it on any scroll outside the dropdown itself.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleScroll = (event) => {
      if (portalRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
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

  const hasError = className.includes("is-invalid");
  return (
    <div ref={wrapperRef} className={`cf-multi-select-email ${disabled ? "disabled" : ""} ${className}`}>
      <div
        ref={triggerRef}
        className={`cf-multi-select-email-input ${disabled ? "disabled" : ""}`}
        onClick={disabled ? undefined : () => setIsOpen(!isOpen)}
        style={{ pointerEvents: disabled ? "none" : "auto", ...(hasError ? { borderColor: "#dc3545" } : {}) }}
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

      {isOpen && createPortal(
        <div
          ref={portalRef}
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
        </div>,
        document.body
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

