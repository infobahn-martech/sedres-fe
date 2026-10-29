import { create } from "zustand";
import groArrivalService from "../services/groService/arrivalService";

/**
 * Pure helpers for GRO task-card documents (numeric status from API).
 */
export const isGroDocumentApproved = (doc) => Number(doc?.status) === 1;

export const isGroDocumentRejected = (doc) => Number(doc?.status) === 2;

/**
 * Zustand store for GRO card arrival popover save.
 * Toasts remain in GROCardView for consistent UX with the rest of the board.
 */
const useGROReducer = create((set) => ({
  isSavingArrivalDocument: false,
  arrivalDocumentError: "",

  saveArrivalDocument: async ({ formData } = {}) => {
    try {
      set({ isSavingArrivalDocument: true, arrivalDocumentError: "" });
      const { data } = await groArrivalService.saveArrivalDocument(formData);
      set({ isSavingArrivalDocument: false });
      return data;
    } catch (err) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        "Failed to save arrival document.";
      set({ isSavingArrivalDocument: false, arrivalDocumentError: message });
      throw err;
    }
  },

  resetGroArrivalSaveState: () =>
    set({
      isSavingArrivalDocument: false,
      arrivalDocumentError: "",
    }),
}));

export default useGROReducer;
