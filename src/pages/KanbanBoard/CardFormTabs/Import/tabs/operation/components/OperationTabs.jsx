import PropTypes from "prop-types";
import NavTabButton from "../../../../../../../components/NavTabButton";
import { OPERATION_TABS } from "../operationConstants";

// Small stroke-icon set for this nav only, following the same inline-SVG
// convention used by the Husbandry left nav (TabIcon in Husbandry.components.jsx)
// without importing from that file, so this stays isolated from Husbandry.
const TAB_ICON_PATHS = {
  [OPERATION_TABS.CREW_IMMIGRATION]:
    "M6 14C6 11.7909 7.79086 10 10 10C12.2091 10 14 11.7909 14 14M10 10C11.3807 10 12.5 8.88071 12.5 7.5C12.5 6.11929 11.3807 5 10 5C8.61929 5 7.5 6.11929 7.5 7.5C7.5 8.88071 8.61929 10 10 10ZM2.5 6L3.5 7L5.5 5M2.5 12L3.5 13L5.5 11",
  [OPERATION_TABS.PRE_ARRIVAL]:
    "M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z M8 4.5V8L10.5 9.5",
  [OPERATION_TABS.ARRIVAL]:
    "M8 2V4M8 4C8.82843 4 9.5 3.32843 9.5 2.5C9.5 1.67157 8.82843 1 8 1C7.17157 1 6.5 1.67157 6.5 2.5C6.5 3.32843 7.17157 4 8 4ZM8 4V13M3 9C3 9 3 13 8 13C13 13 13 9 13 9M4.5 6L8 4L11.5 6",
  [OPERATION_TABS.DEPARTURE]: "M4 12L12 4M12 4H6M12 4V10",
  [OPERATION_TABS.CHECK_LIST]:
    "M2.5 4L3.5 5L5.5 3M2.5 8L3.5 9L5.5 7M2.5 12L3.5 13L5.5 11M7.5 4H13.5M7.5 8H13.5M7.5 12H13.5",
};

const TAB_ICON_COLORS = {
  [OPERATION_TABS.CREW_IMMIGRATION]: "#DB2777",
  [OPERATION_TABS.PRE_ARRIVAL]: "#2563EB",
  [OPERATION_TABS.ARRIVAL]: "#16A34A",
  [OPERATION_TABS.DEPARTURE]: "#D97706",
  [OPERATION_TABS.CHECK_LIST]: "#7C3AED",
};

const OperationTabIcon = ({ id }) => {
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

OperationTabIcon.propTypes = {
  id: PropTypes.string.isRequired,
};

const OperationTabs = ({ activeTab, onTabChange, allowedTabIds }) => {
  const allTabs = [
    { id: OPERATION_TABS.PRE_ARRIVAL, label: "Pre Arrival" },
    { id: OPERATION_TABS.CREW_IMMIGRATION, label: "Crew Immigration" },
    { id: OPERATION_TABS.ARRIVAL, label: "Arrival" },
    { id: OPERATION_TABS.DEPARTURE, label: "Departure" },
    { id: OPERATION_TABS.CHECK_LIST, label: "Check List" },
  ];
  // KANBAN_CARD sub-tab permissions (PRE_ARRIVAL/CREW_IMMIGRATION/ARRIVAL/
  // DEPARTURE/CHECKLIST VIEW) — when omitted, all tabs show (existing behavior).
  const tabs = allowedTabIds ? allTabs.filter((tab) => allowedTabIds.includes(tab.id)) : allTabs;

  return (
    <div className="operation-left op-tab-nav--main">
      <div className="op-tab-list">
        {tabs.map((tab) => (
          <NavTabButton
            key={tab.id}
            className="op-tab"
            active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            <OperationTabIcon id={tab.id} />
            <span className="op-tab-label">{tab.label}</span>
          </NavTabButton>
        ))}
      </div>
    </div>
  );
};

OperationTabs.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  allowedTabIds: PropTypes.arrayOf(PropTypes.string),
};

export default OperationTabs;
