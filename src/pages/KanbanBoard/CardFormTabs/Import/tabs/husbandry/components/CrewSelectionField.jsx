import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  getCrewListForPass,
  mapAxiosResponseToCrewOptions,
} from "../../../../../../../services/cgAndZwailpassService";
import callFileService from "../../../../../../../services/callFileService";
import useCrewReducer from "../../../../../../../store/CrewReducer";
import { notify } from "../../../../../../../components/Toaster";
import { FormGroup, FormField } from "./Husbandry.components";
import CrewListUploadBox from "./CrewListUploadBox";
import ChecklistMultiSelect from "../../appointment/checklistTab/ChecklistMultiSelect";
import "../../../../../../../design/scss/checklist.scss";

// Same tag the Crew Management dashboard applies to its crew list uploads.
const UPLOAD_MOVEMENT_TYPE = "Sign On";

const fetchCrewOptions = async (callId) => mapAxiosResponseToCrewOptions(await getCrewListForPass(callId));

/**
 * Multi-select of crew for a call, auto-populated from the crew roster. Reports selected crew_change_ids via onChange.
 * In uploadMode (service opened straight from the service overview) it shows a crew list upload instead: the file is
 * imported via crew/import_crew_ai and the newly imported crew are selected automatically.
 */
const CrewSelectionField = ({ callId, selected, onChange, accent = "purple", onGoToCrew, uploadMode = false }) => {
  const importCrewFile = useCrewReducer((state) => state.importCrewFile);
  const [crewOptions, setCrewOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("pending");

  useEffect(() => {
    if (!callId) {
      setCrewOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const options = await fetchCrewOptions(callId);
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

  const handleCrewListUpload = useCallback(
    async (files) => {
      if (!callId || uploadStatus === "uploading") return;
      setUploadStatus("uploading");
      try {
        const { data: callDetailResponse } = await callFileService.getCallDetail(callId);
        const callDetailData =
          callDetailResponse?.data?.[0] || callDetailResponse?.data || callDetailResponse?.detail || callDetailResponse;
        const vesselId = Number(callDetailData?.vessel_id);
        if (!vesselId) {
          notify("Unable to upload: missing vessel information.", "error");
          setUploadStatus("failed");
          return;
        }

        const formData = new FormData();
        formData.append("call_id", String(callId));
        formData.append("vessel_id", String(vesselId));
        formData.append("movement_type", UPLOAD_MOVEMENT_TYPE);
        files.forEach((file) => formData.append("files[]", file));
        await importCrewFile({ formData });

        // Select the crew this upload added; if it only re-imported crew
        // already on the call (no new ids), select the whole roster.
        const previousIds = new Set(crewOptions.map((option) => String(option.value)));
        const options = await fetchCrewOptions(callId);
        const newIds = options.map((option) => String(option.value)).filter((id) => !previousIds.has(id));
        const idsToSelect = newIds.length > 0 ? newIds : options.map((option) => String(option.value));
        setCrewOptions(options);
        onChange(idsToSelect);
        setUploadStatus("completed");
        notify(`Crew list uploaded — ${idsToSelect.length} crew member(s) added to this request.`, "success");
      } catch {
        // import errors are already surfaced by the store
        setUploadStatus("failed");
      }
    },
    [callId, uploadStatus, crewOptions, importCrewFile, onChange]
  );

  const selectedIds = Array.isArray(selected) ? selected.map(String) : [];

  if (uploadMode) {
    const selectedNames = crewOptions
      .filter((option) => selectedIds.includes(String(option.value)))
      .map((option) => option.label);

    return (
      <FormGroup icon="crew" label="Crew List" accent={accent}>
        <FormField className="cf-field-full">
          <CrewListUploadBox
            movementType={UPLOAD_MOVEMENT_TYPE}
            movementTypeLabel="Crew List"
            status={uploadStatus === "completed" ? "pending" : uploadStatus}
            onSelectFile={handleCrewListUpload}
          />
          {selectedNames.length > 0 && (
            <div className="husb-crew-upload-summary" title={selectedNames.join(", ")}>
              {selectedNames.length} crew member(s) added: {selectedNames.join(", ")}
            </div>
          )}
        </FormField>
      </FormGroup>
    );
  }

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
  uploadMode: PropTypes.bool,
};

export default CrewSelectionField;
