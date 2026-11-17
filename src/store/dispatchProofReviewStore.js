import { create } from "zustand";
import daService from "../services/daService";

/**
 * L&T dispatch proof confirm: after a bulk da/upload_dispatch_proof, the cards with a proof are sent to
 * da/confirm_dispatch_proofs, which moves them to the next column.
 */
const useDispatchProofReviewStore = create((set) => ({
  isConfirmingDispatchProofs: false,

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
