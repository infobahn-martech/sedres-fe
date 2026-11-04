import { create } from "zustand";
import lamprellUaePoApprovalService from "../services/lamprellUaePoApprovalService";

const getErrorMessage = (error) => error?.response?.data?.message || error?.message;

/** Editable PO columns, in display order; name is the da/confirm_po_approval field. */
export const LAMPRELL_UAE_PO_COLUMNS = [
  { name: "sales_order_no", label: "SO No" },
  { name: "po_number", label: "PO #" },
  { name: "received_qty", label: "Received Qty" },
  { name: "srn_no", label: "SRN No" },
];

const buildBlankReviewCards = (cards) =>
  cards.map((card) => ({
    call_id: Number(card.callId),
    card_id: Number(card.id),
    ready: true,
    sales_orders: [{ sales_order_no: card.salesOrderNo ?? "", po_number: "", received_qty: "", srn_no: "", srn_used_by: null }],
  }));

/**
 * Lamprell UAE "Upload PO" on the Operations board, for the ticked cards. It opens one PO review popup with a
 * row per ticked card, to be filled by hand. Optionally the client's reply is uploaded to da/upload_po_approval,
 * which replaces the rows with one row per SO, pre-filled. Confirming posts to da/confirm_po_approval, with
 * document_id only when a reply was uploaded.
 */
const useLamprellUaePoApprovalStore = create((set, get) => ({
  /** [{ id, callId, salesOrderNo }] - the ticked cards the PO is for; salesOrderNo pre-fills the SO No column. */
  selectedPoUploadCards: [],
  isPoUploading: false,

  showPoReviewModal: false,
  /** [{ call_id, card_id, ready, sales_orders: [{ sales_order_no, po_number, received_qty, srn_no, srn_used_by }] }] */
  poReviewCards: [],
  /** The uploaded reply's document_id; null when the review is filled by hand. */
  poReviewDocumentId: null,
  /** Name of the uploaded reply, shown in the popup. */
  poReviewDocumentName: "",
  isPoConfirming: false,

  /** @param {Array<{ id: string|number, callId: string|number, salesOrderNo?: string }>} cards
   * @returns {{ ok: boolean, message?: string }} */
  openPoUploadModal: (cards) => {
    const uploadCards = (cards ?? []).filter((card) => card?.callId);
    if (!uploadCards.length) {
      return { ok: false, message: "The selected cards have no call to upload a PO for" };
    }
    set({
      showPoReviewModal: true,
      selectedPoUploadCards: uploadCards,
      poReviewCards: buildBlankReviewCards(uploadCards),
      poReviewDocumentId: null,
      poReviewDocumentName: "",
    });
    return { ok: true };
  },

  closePoReviewModal: () =>
    set({
      showPoReviewModal: false,
      selectedPoUploadCards: [],
      poReviewCards: [],
      poReviewDocumentId: null,
      poReviewDocumentName: "",
    }),

  /** @param {File} file - the client's reply (PDF, EML, MSG, JPG or PNG).
   * @returns {Promise<{ ok: boolean, message?: string }>} */
  uploadPo: async (file) => {
    const { selectedPoUploadCards } = get();
    const formData = new FormData();
    formData.append("call_ids", selectedPoUploadCards.map((card) => card.callId).join(","));
    formData.append("card_ids", selectedPoUploadCards.map((card) => card.id).join(","));
    formData.append("po_approval[]", file);

    set({ isPoUploading: true });
    try {
      const { data } = await lamprellUaePoApprovalService.uploadPoApproval(formData);
      if (data?.status !== "success") {
        return { ok: false, message: data?.message || "Failed to upload the PO" };
      }
      set({
        poReviewDocumentId: data.data?.document?.document_id ?? null,
        poReviewDocumentName: data.data?.document?.name ?? file.name,
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
      get().closePoReviewModal();
      return { ok: true, message: data.message, result: data.data };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to save the PO details" };
    } finally {
      set({ isPoConfirming: false });
    }
  },
}));

export default useLamprellUaePoApprovalStore;
