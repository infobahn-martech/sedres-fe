/**
 * Crew sent with a service request.
 *
 * CrewSelectionField always reports the selection as crew_change_ids. When the crew came from the
 * manual "Add crew" grid it also reports their crew_ids (onChange's second argument), which the
 * services send instead as `crew_ids` / `crew_id`. Uploaded or picked crew keep `crew_change_ids`.
 */

/** Form key holding the manual-entry crew_ids for a selected-crew field. */
export const manualCrewIdsField = (crewField) => `${crewField}ManualCrewIds`;

/** onChange(ids, meta) → the manual crew_ids to store, or null when the crew didn't come from manual entry. */
export const manualCrewIdsFromChange = (meta) =>
  meta?.source === "manual" && Array.isArray(meta.crewIds) ? meta.crewIds : null;

/**
 * @returns {{ useCrewIds: boolean, ids: number[], listKey: "crew_ids" | "crew_change_ids", itemKey: "crew_id" | "crew_change_id" }}
 */
export const resolveCrewPayloadIds = (selected, manualCrewIds) => {
  const selectedIds = Array.isArray(selected) ? selected : [];
  // Only trust the manual ids while they still describe the current selection.
  const useCrewIds =
    Array.isArray(manualCrewIds) && manualCrewIds.length > 0 && manualCrewIds.length === selectedIds.length;
  return {
    useCrewIds,
    ids: (useCrewIds ? manualCrewIds : selectedIds).map(Number),
    listKey: useCrewIds ? "crew_ids" : "crew_change_ids",
    itemKey: useCrewIds ? "crew_id" : "crew_change_id",
  };
};

/** `crew: [{ crew_change_id }]` or, for manual entry, `crew: [{ crew_id }]`. */
export const buildCrewPayloadList = (selected, manualCrewIds) => {
  const { ids, itemKey } = resolveCrewPayloadIds(selected, manualCrewIds);
  return ids.map((id) => ({ [itemKey]: id }));
};
