import { create } from "zustand";
import callFileService from "../../services/callFileService";
import { isExportCallType } from "../../pages/KanbanBoard/CardFormTabs/shared/utils/callTypes";

/**
 * Export approval state per call, read from the call detail for board cards whose
 * get_full_board is_export_approval_card key is missing or true. Only Export calls go through
 * export approval, so any other call type (e.g. Husbandry) is "not_export"; an Export call reads
 * export_approval_status ("1" = approved).
 * Values: "loading" | "approved" | "pending" | "not_export" | "unknown" (request failed).
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
          const callDetail = data?.data;
          let status = "pending";
          if (!isExportCallType(callDetail?.call_type_id)) status = "not_export";
          else if (String(callDetail?.export_approval_status ?? "") === "1") status = "approved";
          set((state) => ({ statusByCallId: { ...state.statusByCallId, [callId]: status } }));
        })
        .catch(() => {
          set((state) => ({ statusByCallId: { ...state.statusByCallId, [callId]: "unknown" } }));
        });
    });
  },
}));

export default useExportApprovalStatusStore;
