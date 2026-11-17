import PropTypes from "prop-types";
import { Users } from "lucide-react";
import CommonSelect from "@/components/CommonSelect";
import { PREMIUM_SELECT_MODAL_Z_INDEX } from "@/components/form/PremiumSelect";
import "@/design/scss/husbandry-crew-coordinators.scss";

// Static options for now — to be replaced by an API-driven list later.
const crewCoordinatorOptions = [
  { value: 1, label: "Ahmed" },
  { value: 2, label: "Mohammed" },
  { value: 3, label: "John" },
  { value: 4, label: "Arun" },
  { value: 5, label: "Kevin" },
];

// Visual styling lives in husbandry-crew-coordinators.scss (classNamePrefix based).
// Only the portal stacking is set inline so the menu sits above the card modal and
// is never clipped by the scrollable service list.
const SELECT_STYLES = {
  menuPortal: (base) => ({ ...base, zIndex: PREMIUM_SELECT_MODAL_Z_INDEX }),
};

const CrewCoordinatorsSelect = ({ value = [], onChange, options = crewCoordinatorOptions }) => {
  const handleChange = (selected) => {
    onChange((selected || []).map((opt) => opt.value));
  };

  return (
    <div className="crew-coordinators-field">
      <label className="crew-coordinators-label" htmlFor="crew-coordinators-select">
        <Users size={14} strokeWidth={2} aria-hidden="true" />
        <span>Crew Coordinators</span>
      </label>
      <CommonSelect
        inputId="crew-coordinators-select"
        isMulti
        isSearchable
        showIndicator
        options={options}
        value={value}
        onChange={handleChange}
        placeholder="Select crew coordinators"
        noOptionsMessage="No coordinators found"
        className="crew-coordinators-select"
        classNamePrefix="crew-coord-select"
        maxheight={220}
        styles={SELECT_STYLES}
        aria-label="Crew Coordinators"
      />
    </div>
  );
};

CrewCoordinatorsSelect.propTypes = {
  value: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
};

export default CrewCoordinatorsSelect;
