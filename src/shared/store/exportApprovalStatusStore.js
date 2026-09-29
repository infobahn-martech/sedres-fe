import { create } from "zustand";
import callFileService from "../../services/callFileService";

/**
 * Export approval state per call, for board cards whose get_full_board payload has no
 * is_export_approval_card key. Read from the call detail's export_approval_status
 * ("1" = approved). Values: "loading" | "approved" | "pending" | "unknown" (request failed).
 */
const useExportApprovalStatusStore = create((set, get) => ({
  statusByCallId: {},

  /* Re-reads every given call so an approval done elsewhere shows on the next board load; a call
     that already has a status keeps it while the new request is in flight. */
  loadStatuses: (callIds) => {
    callIds.forEach((callId) => {
      if (!get().statusByCallId[callId]) {
        set((state) => ({ statusByCallId: { ...state.statusByCallId, [callId]: "loading" } }));
      }
      callFileService
        .getCallDetail(callId)
        .then(({ data }) => {
          const isApproved = String(data?.data?.export_approval_status ?? "") === "1";
          set((state) => ({
            statusByCallId: { ...state.statusByCallId, [callId]: isApproved ? "approved" : "pending" },
          }));
        })
        .catch(() => {
          set((state) => ({ statusByCallId: { ...state.statusByCallId, [callId]: "unknown" } }));
        });
    });
  },
}));

export default useExportApprovalStatusStore;
