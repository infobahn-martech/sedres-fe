/**
 * Pre-Arrival "Document Handling" state (GRO / Custom Clearance).
 * Rows are API-friendly: { id, name, is_required, files } where files is an attachment array.
 */

export const DEFAULT_PRE_ARRIVAL_DOCUMENT_HANDLING = {
  selectedProcesses: {
    gro: false,
    customClearance: false,
  },
  roleGroups: [],
  documents: {
    gro: [],
    customClearance: [],
  },
};

