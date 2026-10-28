import { create } from "zustand";
import zamilCrewService from "../../services/zamilCrewService";

/**
 * Zamil Crew "Send Invoice" on "AR Invoice Issued": the final invoice email draft of the one ticked
 * card, and sending it (the backend moves the card to "Invoice dispatched").
 */
const useZamilCrewFinalInvoiceStore = create(() => ({
  /** Resolves to { errorMessage } on failure, or { draft } with da/final_invoice_email_draft's data. */
  fetchFinalInvoiceDraft: async (callId, cardId) => {
    let data;
    try {
      ({ data } = await zamilCrewService.getFinalInvoiceEmailDraft(callId, cardId));
    } catch (error) {
      data = error?.response?.data;
    }
    return data?.status === "success" && data?.data
      ? { draft: data.data }
      : { errorMessage: data?.message || "Failed to load invoice email draft" };
  },

  /** Resolves to { errorMessage } on failure, or { message } with the success message. */
  sendFinalInvoice: async (formData) => {
    let data;
    try {
      ({ data } = await zamilCrewService.sendFinalInvoiceEmail(formData));
    } catch (error) {
      data = error?.response?.data;
    }
    return data?.status === "success"
      ? { message: data.message }
      : { errorMessage: data?.message || "Failed to send invoice" };
  },
}));

export default useZamilCrewFinalInvoiceStore;
