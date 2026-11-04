import { create } from "zustand";
import lamprellAlgihazSoApprovalService from "../services/lamprellAlgihazSoApprovalService";

const getErrorMessage = (error) => error?.response?.data?.message || error?.message;

const getCallIds = (cards) => [...new Set((cards ?? []).map((card) => card?.callId).filter(Boolean))];

/**
 * Lamprell Algihaz SO approval, per batch. "Send SO" on "To be sent for SO Approval" opens the email draft from
 * da/po_request_draft/{batch_id} and sends it with da/send_po_request; "Upload approved SOs" on "Awaiting SO"
 * posts the approved SO files to da/upload_approved_so for the whole batch or its ticked cards.
 */
const useLamprellAlgihazSoApprovalStore = create((set) => ({
  showSoEmailModal: false,
  /** { batchId, title, cards, isPartial } - the batch the email is for; cards are the ones the email covers. */
  soEmailBatch: null,
  /** { to, cc, subject, body, stage_document_id, folder_link, attachments } from da/po_request_draft. */
  soEmailDraft: null,
  isSoDraftLoading: false,
  isSoSending: false,

  showSoUploadModal: false,
  /** { batchId, title, cards, isPartial } - isPartial is true when only ticked cards are uploaded for. */
  soUploadBatch: null,
  isSoUploading: false,

  /** @param {{ batchId: string|number, title: string, cards: object[], isPartial: boolean }} batch
   * @returns {Promise<{ ok: boolean, message?: string }>} */
  openSoEmailModal: async (batch) => {
    if (!batch?.batchId) return { ok: false, message: "Batch not found" };
    set({ isSoDraftLoading: true });
    try {
      const { data } = await lamprellAlgihazSoApprovalService.getSoRequestDraft(
        batch.batchId,
        batch.isPartial ? getCallIds(batch.cards) : []
      );
      if (data?.status !== "success" || !data?.data) {
        return { ok: false, message: data?.message || "Failed to load SO approval email draft" };
      }
      set({ showSoEmailModal: true, soEmailBatch: batch, soEmailDraft: data.data });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to load SO approval email draft" };
    } finally {
      set({ isSoDraftLoading: false });
    }
  },

  closeSoEmailModal: () => set({ showSoEmailModal: false, soEmailBatch: null, soEmailDraft: null }),

  /** @param {FormData} formData
   * @returns {Promise<{ ok: boolean, message?: string }>} */
  sendSoEmail: async (formData) => {
    set({ isSoSending: true });
    try {
      const { data } = await lamprellAlgihazSoApprovalService.sendSoRequest(formData);
      if (data?.status !== "success") {
        return { ok: false, message: data?.message || "Failed to send SO approval request" };
      }
      set({ showSoEmailModal: false, soEmailBatch: null, soEmailDraft: null });
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to send SO approval request" };
    } finally {
      set({ isSoSending: false });
    }
  },

  /** @param {{ batchId: string|number, title: string, cards: object[], isPartial: boolean }} batch
   * @returns {{ ok: boolean, message?: string }} */
  openSoUploadModal: (batch) => {
    if (!batch?.batchId) return { ok: false, message: "Batch not found" };
    if (batch.isPartial && !getCallIds(batch.cards).length) {
      return { ok: false, message: "The selected cards have no call to upload SOs for" };
    }
    set({ showSoUploadModal: true, soUploadBatch: batch });
    return { ok: true };
  },

  closeSoUploadModal: () => set({ showSoUploadModal: false, soUploadBatch: null }),

  /** @param {FormData} formData
   * @returns {Promise<{ ok: boolean, message?: string, result?: object }>} */
  uploadApprovedSos: async (formData) => {
    set({ isSoUploading: true });
    try {
      const { data } = await lamprellAlgihazSoApprovalService.uploadApprovedSos(formData);
      if (data?.status !== "success") {
        return { ok: false, message: data?.message || "Failed to upload approved SOs" };
      }
      set({ showSoUploadModal: false, soUploadBatch: null });
      return { ok: true, message: data.message, result: data.data };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to upload approved SOs" };
    } finally {
      set({ isSoUploading: false });
    }
  },
}));

export default useLamprellAlgihazSoApprovalStore;
