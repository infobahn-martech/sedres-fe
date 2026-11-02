import { create } from "zustand";
import lamprellUaePoApprovalService from "../services/lamprellUaePoApprovalService";

const getErrorMessage = (error) => error?.response?.data?.message || error?.message;

/**
 * Lamprell UAE "Upload PO" on the Operations board, for the ticked cards. The client's reply is uploaded to
 * da/upload_po_approval, which pre-fills the PO review; the review can also be filled by hand with no file.
 * Confirming the review posts to da/confirm_po_approval.
 */
const useLamprellUaePoApprovalStore = create((set, get) => ({
  showPoUploadModal: false,
  /** [{ id, callId }] - the ticked cards the PO is for. */
  selectedPoUploadCards: [],
  isPoUploading: false,

  showPoReviewModal: false,
  /** [{ call_id, card_id, ready, sales_orders: [{ sales_order_no, po_number, received_qty, srn_no, srn_used_by }] }] */
  poReviewCards: [],
  /** The uploaded reply's document_id; null when the review is filled by hand. */
  poReviewDocumentId: null,
  isPoConfirming: false,

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

  closePoReviewModal: () => set({ showPoReviewModal: false, poReviewCards: [], poReviewDocumentId: null }),

  /** Opens the review with one blank row per ticked card, to be filled by hand. */
  openManualPoReview: () => {
    const { selectedPoUploadCards } = get();
    set({
      showPoUploadModal: false,
      showPoReviewModal: true,
      poReviewDocumentId: null,
      poReviewCards: selectedPoUploadCards.map((card) => ({
        call_id: Number(card.callId),
        card_id: Number(card.id),
        ready: true,
        sales_orders: [{ sales_order_no: "", po_number: "", received_qty: "", srn_no: "", srn_used_by: null }],
      })),
    });
  },

  /** @param {FormData} formData
   * @returns {Promise<{ ok: boolean, message?: string }>} */
  uploadPo: async (formData) => {
    set({ isPoUploading: true });
    try {
      const { data } = await lamprellUaePoApprovalService.uploadPoApproval(formData);
      if (data?.status !== "success") {
        return { ok: false, message: data?.message || "Failed to upload the PO" };
      }
      set({
        showPoUploadModal: false,
        selectedPoUploadCards: [],
        showPoReviewModal: true,
        poReviewDocumentId: data.data?.document?.document_id ?? null,
        poReviewCards: data.data?.cards ?? [],
      });
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to upload the PO" };
    } finally {
      set({ isPoUploading: false });
    }
  },

  /** @param {Array<{ call_id: number, card_id: number, sales_orders: object[] }>} cards - the reviewed rows.
   * @returns {Promise<{ ok: boolean, message?: string, result?: object }>} */
  confirmPo: async (cards) => {
    const { poReviewDocumentId } = get();
    const payload = { cards };
    if (poReviewDocumentId != null) payload.document_id = poReviewDocumentId;
    set({ isPoConfirming: true });
    try {
      const { data } = await lamprellUaePoApprovalService.confirmPoApproval(payload);
      if (data?.status !== "success") {
        return { ok: false, message: data?.message || "Failed to save the PO details" };
      }
      set({ showPoReviewModal: false, poReviewCards: [], poReviewDocumentId: null });
      return { ok: true, message: data.message, result: data.data };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to save the PO details" };
    } finally {
      set({ isPoConfirming: false });
    }
  },
}));

export default useLamprellUaePoApprovalStore;
