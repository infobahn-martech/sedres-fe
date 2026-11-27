import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  getCrewListForPass,
  mapAxiosResponseToCrewOptions,
} from "@/services/cgAndZwailpassService";
import callFileService from "@/services/callFileService";
import useCrewReducer from "@/store/CrewReducer";
import { notify } from "@/components/Toaster";
import { FormGroup, FormField } from "./Husbandry.components";
import { getApiMessage } from "./apiMessage";
import CrewListUploadBox from "./CrewListUploadBox";
import CrewEntryGrid from "./CrewEntryGrid";
import { CREW_ENTRY_COLUMNS, createEmptyCrewRows } from "./Husbandry.constants";
import ChecklistMultiSelect from "../../appointment/checklistTab/ChecklistMultiSelect";
import "@/design/scss/checklist.scss";

// Same tag the Crew Management dashboard applies to its crew list uploads.
const UPLOAD_MOVEMENT_TYPE = "Sign On";

const fetchCrewOptions = async (callId) => mapAxiosResponseToCrewOptions(await getCrewListForPass(callId));

const linkButtonStyle = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--card-color, #2563eb)",
  fontWeight: 600,
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: 12,
};

/**
 * Multi-select of crew for a call, auto-populated from the crew roster. Reports selected crew_change_ids via onChange.
 * Crew saved from the manual entry grid are reported as onChange(ids, { source: "manual", crewIds }) so the service
 * can send `crew_ids` instead (see crewPayloadIds.js); every other change calls onChange(ids) alone.
 * In uploadMode (service opened straight from the service overview) it shows a crew list upload instead: the file is
 * imported via crew/import_crew_ai and the newly imported crew are selected automatically.
 */
const CrewSelectionField = ({ callId, selected, onChange, accent = "purple", onGoToCrew, uploadMode = false, error = "" }) => {
  const importCrewFile = useCrewReducer((state) => state.importCrewFile);
  const saveCrewData = useCrewReducer((state) => state.saveCrewData);
  const [crewOptions, setCrewOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("pending");
  const [isManualEntry, setIsManualEntry] = useState(false);
  // Lives here (not in the grid) so entered/saved crew stay visible when toggling to file upload and back.
  const [gridRows, setGridRows] = useState(() => createEmptyCrewRows());

  // When the form clears the crew (e.g. after the request is saved), start the crew entry over too.
  const selectedCount = Array.isArray(selected) ? selected.length : 0;
  const previousSelectedCount = useRef(selectedCount);
  useEffect(() => {
    if (previousSelectedCount.current > 0 && selectedCount === 0) {
      setGridRows(createEmptyCrewRows());
      setUploadStatus("pending");
    }
    previousSelectedCount.current = selectedCount;
  }, [selectedCount]);

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

  // Runs a save action (file import or manual save), then selects the crew it added;
  // if it only touched crew already on the call (no new ids), selects the whole roster.
  const runCrewSave = useCallback(
    async (save, successLabel, source) => {
      if (!callId || uploadStatus === "uploading") return false;
      setUploadStatus("uploading");
      try {
        const saved = await save();
        if (saved === false) {
          setUploadStatus("failed");
          return false;
        }

        const previousIds = new Set(crewOptions.map((option) => String(option.value)));
        const options = await fetchCrewOptions(callId);
        const newIds = options.map((option) => String(option.value)).filter((id) => !previousIds.has(id));
        const idsToSelect = newIds.length > 0 ? newIds : options.map((option) => String(option.value));
        setCrewOptions(options);
        if (source === "manual") {
          const optionById = new Map(options.map((option) => [String(option.value), option]));
          const crewIds = idsToSelect.map((id) => String(optionById.get(id)?.crew_id ?? id));
          onChange(idsToSelect, { source, crewIds });
        } else {
          onChange(idsToSelect);
        }
        setUploadStatus("completed");
        notify(
          getApiMessage(saved, `${successLabel} — ${idsToSelect.length} crew member(s) added to this request.`),
          "success"
        );
        return true;
      } catch {
        // save errors are already surfaced by the store
        setUploadStatus("failed");
        return false;
      }
    },
    [callId, uploadStatus, crewOptions, onChange]
  );

  const handleCrewListUpload = useCallback(
    (files) =>
      runCrewSave(async () => {
        const { data: callDetailResponse } = await callFileService.getCallDetail(callId);
        const callDetailData =
          callDetailResponse?.data?.[0] || callDetailResponse?.data || callDetailResponse?.detail || callDetailResponse;
        const vesselId = Number(callDetailData?.vessel_id);
        if (!vesselId) {
          notify("Unable to upload: missing vessel information.", "error");
          return false;
        }

        const formData = new FormData();
        formData.append("call_id", String(callId));
        formData.append("vessel_id", String(vesselId));
        formData.append("movement_type", UPLOAD_MOVEMENT_TYPE);
        files.forEach((file) => formData.append("files[]", file));
        return (await importCrewFile({ formData })) ?? true;
      }, "Crew list uploaded", "upload"),
    [callId, importCrewFile, runCrewSave]
  );

  const selectedIds = Array.isArray(selected) ? selected.map(String) : [];

  // Manually entered grid rows are saved directly via crew/save_crew
  // (the store resolves call_id / vessel_id from the call detail).
  const handleGridSubmit = (rows) =>
    runCrewSave(async () => {
      const response = await saveCrewData({
        payload: {
          call_id: Number(callId),
          crew: rows.map((row) => {
            const entry = {};
            CREW_ENTRY_COLUMNS.forEach(({ key }) => {
              entry[key] = String(row[key] ?? "").trim();
            });
            // The grid no longer collects movement type; tag manual crew with the upload default.
            entry.movement_type = UPLOAD_MOVEMENT_TYPE;
            return entry;
          }),
        },
      });
      return response ?? true;
    }, "Crew saved", "manual");

  if (uploadMode) {
    const selectedNames = crewOptions
      .filter((option) => selectedIds.includes(String(option.value)))
      .map((option) => option.label);

    return (
      <FormGroup icon="crew" label="Crew List *" accent={accent} error={error}>
        <FormField className="cf-field-full">
          {isManualEntry ? (
            <CrewEntryGrid
              rows={gridRows}
              onRowsChange={setGridRows}
              onSubmit={handleGridSubmit} submitting={uploadStatus === "uploading"} />
          ) : (
            <CrewListUploadBox
              movementType={UPLOAD_MOVEMENT_TYPE}
              movementTypeLabel="Crew List"
              status={uploadStatus === "completed" ? "pending" : uploadStatus}
              onSelectFile={handleCrewListUpload}
            />
          )}
          <div className="husb-crew-link-hint" style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
            {isManualEntry ? "Have a crew list file? " : "No file? "}
            <button type="button" className="husb-crew-link" style={linkButtonStyle} onClick={() => setIsManualEntry((prev) => !prev)}>
              {isManualEntry ? "Upload crew list" : "Enter crew details manually"}
            </button>
          </div>
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
    <FormGroup icon="crew" label="Crew Selection *" accent={accent} error={error}>
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
          <div className="husb-crew-link-hint" style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
            No crew uploaded yet.{" "}
            <button type="button" className="husb-crew-link" onClick={onGoToCrew} style={linkButtonStyle}>
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
  /** Inline validation message (e.g. crew required). */
  error: PropTypes.string,
};

export default CrewSelectionField;
