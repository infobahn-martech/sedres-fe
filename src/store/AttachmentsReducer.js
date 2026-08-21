import { create } from "zustand";
import useAlertReducer from "./AlertReducer";
import attachmentsService from "../services/attachmentsService";

const mapSupportingDoc = (doc) => {
  const rawName = doc?.file_name != null ? String(doc.file_name) : "";
  const baseName = rawName.split("/").pop() || rawName;
  const ext = (baseName.split(".").pop() || "").toUpperCase();
  return {
    id: rawName || doc?.document_name || baseName,
    name: doc?.document_name || baseName,
    type: ext || "FILE",
    url: doc?.file_url || "",
  };
};

const useAttachmentsReducer = create((set) => ({
  supportingDocs: [],
  isLoadingSupportingDocs: false,

  getAllSupportingDocs: async (callId) => {
    if (!callId) {
      set({ supportingDocs: [] });
      return;
    }
    set({ isLoadingSupportingDocs: true });
    try {
      const { data } = await attachmentsService.getAllSupportingDocs(callId);
      const list = Array.isArray(data?.data) ? data.data : [];
      set({ supportingDocs: list.map(mapSupportingDoc), isLoadingSupportingDocs: false });
    } catch (err) {
      set({ supportingDocs: [], isLoadingSupportingDocs: false });
      useAlertReducer.getState().error(err?.response?.data?.message ?? err.message);
    }
  },
}));

export default useAttachmentsReducer;
