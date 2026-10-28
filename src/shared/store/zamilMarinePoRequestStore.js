import { create } from "zustand";
import zamilMarinePoRequestService from "../../services/zamilMarinePoRequestService";

const getErrorMessage = (error) => error?.response?.data?.message || error?.message;

/**
 * Zamil Marine "Send for PO Request" email, opened from the DA board's "Request for PO" column for the
 * ticked cards. The draft comes from da/po_request_draft; sending posts to da/send_po_request.
 */
const useZamilMarinePoRequestStore = create((set) => ({
  showPoRequestEmailModal: false,
  /** [{ id, callId }] - the ticked cards the request is for. */
  selectedPoRequestCards: [],
  /** { to, cc, subject, body, stage_document_id, document_url } from da/po_request_draft. */
  poRequestEmailDraft: null,
  isPoRequestDraftLoading: false,
  isPoRequestSending: false,

  /** @param {Array<{ id: string|number, callId: string|number }>} cards
   * @returns {Promise<{ ok: boolean, message?: string }>} */
  openPoRequestEmailModal: async (cards) => {
    const requestCards = (cards ?? []).filter((card) => card?.callId);
    if (!requestCards.length) {
      return { ok: false, message: "The selected cards have no call to request a PO for" };
    }
    set({ isPoRequestDraftLoading: true });
    try {
      const { data } = await zamilMarinePoRequestService.getPoRequestDraft(
        requestCards.map((card) => card.callId),
        requestCards.map((card) => card.id)
      );
      if (data?.status !== "success" || !data?.data) {
        return { ok: false, message: data?.message || "Failed to load PO request email draft" };
      }
      set({
        showPoRequestEmailModal: true,
        selectedPoRequestCards: requestCards,
        poRequestEmailDraft: data.data,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to load PO request email draft" };
    } finally {
      set({ isPoRequestDraftLoading: false });
    }
  },

  closePoRequestEmailModal: () =>
    set({ showPoRequestEmailModal: false, selectedPoRequestCards: [], poRequestEmailDraft: null }),

  /** @param {FormData} formData
   * @returns {Promise<{ ok: boolean, message?: string }>} */
  sendPoRequest: async (formData) => {
    set({ isPoRequestSending: true });
    try {
      const { data } = await zamilMarinePoRequestService.sendPoRequest(formData);
      if (data?.status !== "success") {
        return { ok: false, message: data?.message || "Failed to send PO request" };
      }
      set({ showPoRequestEmailModal: false, selectedPoRequestCards: [], poRequestEmailDraft: null });
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to send PO request" };
    } finally {
      set({ isPoRequestSending: false });
    }
  },
}));

export default useZamilMarinePoRequestStore;
