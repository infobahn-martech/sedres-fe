import { create } from "zustand";
import daService from "../services/daService";

/**
 * Dispatch proof review popup, opened straight from a bulk da/upload_dispatch_proof response on L&T
 * "Uploaded to Portal". Confirm sends the ticked cards to da/confirm_dispatch_proofs.
 */
const useDispatchProofReviewStore = create((set) => ({
  showDispatchProofReviewModal: false,
  /** [{ call_id, card_id, invoice_nos, ready, proof: { document_id, name, url } | null }] */
  selectedDispatchProofReviewCards: [],
  /** [string] - uploaded file names the backend could not place on any selected card. */
  selectedDispatchProofReviewNotPlacedFiles: [],
  isConfirmingDispatchProofs: false,

  openDispatchProofReviewModal: (cards, { notPlacedFiles = [] } = {}) =>
    set({
      showDispatchProofReviewModal: true,
      selectedDispatchProofReviewCards: Array.isArray(cards) ? cards : [],
      selectedDispatchProofReviewNotPlacedFiles: Array.isArray(notPlacedFiles) ? notPlacedFiles : [],
    }),

  closeDispatchProofReviewModal: () =>
    set({
      showDispatchProofReviewModal: false,
      selectedDispatchProofReviewCards: [],
      selectedDispatchProofReviewNotPlacedFiles: [],
    }),

  /** Resolves to { errorMessage } on failure, or { result } with da/confirm_dispatch_proofs' moved cards. */
  confirmDispatchProofs: async (cards) => {
    set({ isConfirmingDispatchProofs: true });
    try {
      let data;
      try {
        ({ data } = await daService.confirmDispatchProofs({ cards }));
      } catch (error) {
        data = error?.response?.data;
      }
      return data?.status === "success"
        ? { result: data.data }
        : { errorMessage: data?.message || "Failed to confirm dispatch proofs" };
    } finally {
      set({ isConfirmingDispatchProofs: false });
    }
  },
}));

export default useDispatchProofReviewStore;
