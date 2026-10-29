import PropTypes from "prop-types";
import NavTabButton from "../../../../../../../components/NavTabButton";

const TABS = [
  { id: "assign", label: "Assign Task" },
  { id: "documents", label: "Document Library" },
];

function GROSupervisorTabs({ activeTab, onTabChange }) {
  return (
    <nav className="gro-supervisor-left" aria-label="GRO Supervisor sections">
      {TABS.map((tab) => (
        <NavTabButton
          key={tab.id}
          className="gro-supervisor-tab"
          active={activeTab === tab.id}
          locked={false}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </NavTabButton>
      ))}
    </nav>
  );
}

GROSupervisorTabs.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
};

export default GROSupervisorTabs;
