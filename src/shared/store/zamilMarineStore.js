import { create } from "zustand";
import zamilMarineService from "../../services/zamilMarineService";

/**
 * Zamil Marine "Send For PR" email, opened from the Sales Order tab once every line item is verified.
 * The draft comes from da/da_action_email_draft/{call_id}; sending posts to da/da_send_action_email.
 */
const useZamilMarineStore = create((set) => ({
  showPrEmailModal: false,
  /** { recipient, cc, subject, body, stage_document_id, document_url } from the email draft. */
  selectedPrEmailDraft: null,
  isPrEmailDraftLoading: false,
  isPrEmailSending: false,
  showUploadDocumentsModal: false,
  isUploadingDocuments: false,
  uploadDocumentsError: "",

  /** Resolves to true once the modal is open. The modal still opens with an empty draft when the draft
   * cannot be loaded, so the email can be written by hand. */
  openPrEmailModal: async (callId) => {
    set({ isPrEmailDraftLoading: true });
    let draft = null;
    try {
      const { data } = await zamilMarineService.getActionEmailDraft(callId);
      draft = data?.status === "success" ? data.data ?? null : null;
    } catch {
      draft = null;
    }
    set({ showPrEmailModal: true, selectedPrEmailDraft: draft, isPrEmailDraftLoading: false });
  },

  closePrEmailModal: () => set({ showPrEmailModal: false, selectedPrEmailDraft: null }),

  /** @param {FormData} formData
   * @returns {Promise<{ ok: boolean, message?: string }>} */
  sendPrEmail: async (formData) => {
    set({ isPrEmailSending: true });
    try {
      const { data } = await zamilMarineService.sendActionEmail(formData);
      if (!data || data.status === "error" || data.status === false) {
        return { ok: false, message: data?.message };
      }
      set({ showPrEmailModal: false, selectedPrEmailDraft: null });
      return { ok: true, message: data.message };
    } catch (err) {
      return {
        ok: false,
        message: err?.response?.data?.message || err?.response?.data?.error || err?.message,
      };
    } finally {
      set({ isPrEmailSending: false });
    }
  },

  openUploadDocumentsModal: () => set({ showUploadDocumentsModal: true, uploadDocumentsError: "" }),

  closeUploadDocumentsModal: () => set({ showUploadDocumentsModal: false, uploadDocumentsError: "" }),

  /** @param {FormData} formData
   * @returns {Promise<{ ok: boolean, movedToDa: boolean }>} movedToDa is true when the backend moved the card to DA,
   * or when every required document is uploaded (the process is complete, so the card is done on this board). */
  uploadDocuments: async (formData) => {
    set({ isUploadingDocuments: true, uploadDocumentsError: "" });
    try {
      const { data } = await zamilMarineService.uploadSoApprovalProof(formData);
      if (data?.status !== "success") {
        throw new Error(data?.message || "Failed to upload the documents.");
      }
      set({ showUploadDocumentsModal: false });
      const requiredDocuments = Object.values(data?.documents ?? {}).filter((document) => document?.required);
      const allRequiredUploaded = requiredDocuments.length > 0 && requiredDocuments.every((document) => document.uploaded);
      const movedToDa =
        (Array.isArray(data?.moved_to_da) && data.moved_to_da.length > 0) ||
        Boolean(data?.moved_to_column) ||
        allRequiredUploaded;
      return { ok: true, movedToDa };
    } catch (err) {
      set({
        uploadDocumentsError:
          err?.response?.data?.message || err?.message || "Upload failed. Please try again.",
      });
      return { ok: false, movedToDa: false };
    } finally {
      set({ isUploadingDocuments: false });
    }
  },
}));

export default useZamilMarineStore;
