import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  getCrewListForPass,
  mapAxiosResponseToCrewOptions,
} from "../../../../../../../services/cgAndZwailpassService";
import { FormGroup, FormField } from "./Husbandry.components";
import ChecklistMultiSelect from "../../appointment/checklistTab/ChecklistMultiSelect";
import "../../../../../../../design/scss/checklist.scss";

/** Multi-select of crew for a call, auto-populated from the crew roster. Reports selected crew_change_ids via onChange. */
const CrewSelectionField = ({ callId, selected, onChange, accent = "purple", onGoToCrew }) => {
  const [crewOptions, setCrewOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!callId) {
      setCrewOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = await getCrewListForPass(callId);
        const options = mapAxiosResponseToCrewOptions(response);
        if (!cancelled) setCrewOptions(options);
      } catch {
        if (!cancelled) setCrewOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callId]);

  const selectedIds = Array.isArray(selected) ? selected.map(String) : [];

  return (
    <FormGroup icon="crew" label="Crew Selection" accent={accent}>
      <FormField className="cf-field-full">
        <ChecklistMultiSelect
          className="husb-crew-multiselect"
          value={selectedIds}
          onChange={(e) => onChange(e.target.value)}
          options={crewOptions}
          placeholder={
            loading
              ? "Loading crew..."
              : crewOptions.length === 0
                ? "No crew found for this call"
                : "Select crew..."
          }
          disabled={loading || crewOptions.length === 0}
        />
        {!loading && crewOptions.length === 0 && onGoToCrew && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
            No crew uploaded yet.{" "}
            <button
              type="button"
              onClick={onGoToCrew}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--card-color, #2563eb)",
                fontWeight: 600,
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Upload crew list
            </button>
          </div>
        )}
      </FormField>
    </FormGroup>
  );
};

CrewSelectionField.propTypes = {
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selected: PropTypes.array,
  onChange: PropTypes.func.isRequired,
  accent: PropTypes.oneOf(["blue", "teal", "purple", "amber", "rose", "slate", "green", "pink"]),
  onGoToCrew: PropTypes.func,
};

export default CrewSelectionField;
