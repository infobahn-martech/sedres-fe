import { create } from "zustand";
import subsea7ArInvoiceService from "../services/subsea7ArInvoiceService";

/**
 * Subsea 7 AR invoice review popup, opened after a bulk da/upload_ar_invoices upload ("Upload Invoices")
 * from the DA board's "Received from Ops". Seeded with the upload response's `invoices`: one entry per
 * invoice the backend identified, each with its QR flag, file and the sales orders it can be placed on.
 */
const useSubsea7ArInvoiceStore = create((set) => ({
  showArInvoiceReviewModal: false,
  /** [{ invoice_id, invoice_no, qr_code_present, file_name, file_url, sales_order_options: [{ call_id, card_id, sales_order_no }] }] */
  selectedArInvoiceReviewInvoices: [],

  openArInvoiceReviewModal: (invoices) =>
    set({
      showArInvoiceReviewModal: true,
      selectedArInvoiceReviewInvoices: Array.isArray(invoices) ? invoices : [],
    }),

  closeArInvoiceReviewModal: () =>
    set({ showArInvoiceReviewModal: false, selectedArInvoiceReviewInvoices: [] }),

  isConfirmingArInvoices: false,

  /** Resolves to { errorMessage } on failure, or { result } with da/confirm_ar_invoices' response data. */
  confirmArInvoices: async (cards) => {
    set({ isConfirmingArInvoices: true });
    try {
      let data;
      try {
        ({ data } = await subsea7ArInvoiceService.confirmArInvoices({ cards }));
      } catch (error) {
        data = error?.response?.data;
      }
      return data?.status === "success"
        ? { result: data.data }
        : { errorMessage: data?.message || "Failed to confirm invoices" };
    } finally {
      set({ isConfirmingArInvoices: false });
    }
  },
}));

export default useSubsea7ArInvoiceStore;
