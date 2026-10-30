import { create } from "zustand";
import daService from "../services/daService";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

/**
 * Check Invoice on the Default DA workflow's "AR Invoice Issued" column, for the one ticked card. The popup
 * loads the pages the final invoice PDF is made of (da/final_invoice_pages), lets the user drag them into
 * order or remove them, and Save sends that order to da/save_final_invoice, which builds the PDF and moves
 * the card on.
 */
const useFinalInvoiceStore = create((set, get) => ({
  showFinalInvoiceModal: false,
  /** { call_id, card_id } - the ticked card. */
  selectedFinalInvoiceCard: null,
  /** [{ source, name, url, page_count }] - the PDFs the pages come from. */
  finalInvoiceSources: [],
  /** [{ source, page }] - the pages in the order the user arranged them. */
  finalInvoicePages: [],
  /** da/save_final_invoice's data once saved: { document, zip, moved, page_count, size_mb, warnings }. */
  savedFinalInvoice: null,
  isLoadingFinalInvoicePages: false,
  isSavingFinalInvoice: false,

  /** Opens the popup and loads the pages. Resolves to an error message on failure. */
  openFinalInvoiceModal: async (card) => {
    set({
      showFinalInvoiceModal: true,
      selectedFinalInvoiceCard: card,
      finalInvoiceSources: [],
      finalInvoicePages: [],
      savedFinalInvoice: null,
      isLoadingFinalInvoicePages: true,
    });
    try {
      const { data } = await daService.getFinalInvoicePages(card.call_id, card.card_id);
      if (data?.status !== "success") return data?.message || "Failed to load the invoice pages";
      set({
        finalInvoiceSources: data.data?.sources ?? [],
        finalInvoicePages: data.data?.pages ?? [],
      });
      return undefined;
    } catch (error) {
      return getErrorMessage(error, "Failed to load the invoice pages");
    } finally {
      set({ isLoadingFinalInvoicePages: false });
    }
  },

  closeFinalInvoiceModal: () =>
    set({
      showFinalInvoiceModal: false,
      selectedFinalInvoiceCard: null,
      finalInvoiceSources: [],
      finalInvoicePages: [],
      savedFinalInvoice: null,
    }),

  movePage: (fromIndex, toIndex) =>
    set((state) => {
      const pages = [...state.finalInvoicePages];
      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);
      return { finalInvoicePages: pages };
    }),

  removePage: (index) =>
    set((state) => ({ finalInvoicePages: state.finalInvoicePages.filter((_, pageIndex) => pageIndex !== index) })),

  /** Resolves to { errorMessage } on failure, or { result } with da/save_final_invoice's data. */
  saveFinalInvoice: async () => {
    const { selectedFinalInvoiceCard, finalInvoicePages } = get();
    set({ isSavingFinalInvoice: true });
    try {
      let data;
      try {
        ({ data } = await daService.saveFinalInvoice({
          call_id: selectedFinalInvoiceCard.call_id,
          card_id: selectedFinalInvoiceCard.card_id,
          pages: finalInvoicePages,
        }));
      } catch (error) {
        data = error?.response?.data;
      }
      if (data?.status !== "success") {
        return { errorMessage: data?.message || "Failed to save the final invoice" };
      }
      set({ savedFinalInvoice: data.data });
      return { result: data.data };
    } finally {
      set({ isSavingFinalInvoice: false });
    }
  },
}));

export default useFinalInvoiceStore;
