import { create } from "zustand";
import zamilMarinePoUploadService from "../services/zamilMarinePoUploadService";

const getErrorMessage = (error) => error?.response?.data?.message || error?.message;

/**
 * Zamil Marine "Upload PO" on the DA board's "PO Requested" column, for the ticked cards.
 * The upload posts to da/upload_po_approval.
 */
const useZamilMarinePoUploadStore = create((set) => ({
  showPoUploadModal: false,
  /** [{ id, callId }] - the ticked cards the PO is for. */
  selectedPoUploadCards: [],
  isPoUploading: false,

  /** @param {Array<{ id: string|number, callId: string|number }>} cards
   * @returns {{ ok: boolean, message?: string }} */
  openPoUploadModal: (cards) => {
    const uploadCards = (cards ?? []).filter((card) => card?.callId);
    if (!uploadCards.length) {
      return { ok: false, message: "The selected cards have no call to upload a PO for" };
    }
    set({ showPoUploadModal: true, selectedPoUploadCards: uploadCards });
    return { ok: true };
  },

  closePoUploadModal: () => set({ showPoUploadModal: false, selectedPoUploadCards: [] }),

  /** @param {FormData} formData
   * @returns {Promise<{ ok: boolean, message?: string }>} */
  uploadPo: async (formData) => {
    set({ isPoUploading: true });
    try {
      const { data } = await zamilMarinePoUploadService.uploadPoApproval(formData);
      if (data?.status !== "success") {
        return { ok: false, message: data?.message || "Failed to upload the PO" };
      }
      set({ showPoUploadModal: false, selectedPoUploadCards: [] });
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to upload the PO" };
    } finally {
      set({ isPoUploading: false });
    }
  },
}));

export default useZamilMarinePoUploadStore;
