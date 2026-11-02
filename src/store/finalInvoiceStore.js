import { create } from "zustand";
import daService from "../services/daService";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

/* The final invoice routes answer { status: true } (older DA routes answer "success"). */
const isSuccess = (data) => data?.status === true || data?.status === "success";

/** A page is identified by its source and 1-based page number; that pair is also what the backend takes. */
export const getPageKey = (page) => `${page.source}:${page.page}`;

/**
 * "Arrange invoice pages" on the Default DA workflow's "AR Invoice Issued" column, for the one ticked card.
 * The full-screen editor loads the pages the final invoice PDF is made of (da/final_invoice_pages), the user
 * drags them into order or moves them to the removed tray, and Save sends that order to
 * da/save_final_invoice, which builds the PDF and moves the card on.
 */
const useFinalInvoiceStore = create((set, get) => ({
  showFinalInvoiceModal: false,
  /** { call_id, card_id } - the ticked card. */
  selectedFinalInvoiceCard: null,
  /** [{ source, name, url, page_count }] - the PDFs the pages come from. */
  finalInvoiceSources: [],
  /** [{ source, page }] - the pages in the starting order the backend suggested. */
  originalFinalInvoicePages: [],
  /** [{ source, page }] - the pages in the order the user arranged them. */
  finalInvoicePages: [],
  /** [{ source, page }] - pages moved out of the invoice; they can be dragged back. */
  removedFinalInvoicePages: [],
  isLoadingFinalInvoicePages: false,
  isSavingFinalInvoice: false,

  /** Opens the editor and loads the pages. Resolves to an error message on failure. */
  openFinalInvoiceModal: async (card) => {
    set({
      showFinalInvoiceModal: true,
      selectedFinalInvoiceCard: card,
      finalInvoiceSources: [],
      originalFinalInvoicePages: [],
      finalInvoicePages: [],
      removedFinalInvoicePages: [],
      isLoadingFinalInvoicePages: true,
    });
    try {
      const { data } = await daService.getFinalInvoicePages(card.call_id, card.card_id);
      if (!isSuccess(data)) return data?.message || "Failed to load the invoice pages";
      const pages = data.data?.pages ?? [];
      set({
        finalInvoiceSources: data.data?.sources ?? [],
        originalFinalInvoicePages: pages,
        finalInvoicePages: pages,
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
      originalFinalInvoicePages: [],
      finalInvoicePages: [],
      removedFinalInvoicePages: [],
    }),

  /** Moves the pages with these keys (kept in their grid order) so they start at insertIndex of the pages
   *  left after taking them out. Pages from the removed tray are restored there too. */
  movePages: (keys, insertIndex) =>
    set((state) => {
      const keySet = new Set(keys);
      const moving = [...state.finalInvoicePages, ...state.removedFinalInvoicePages].filter((page) =>
        keySet.has(getPageKey(page))
      );
      const rest = state.finalInvoicePages.filter((page) => !keySet.has(getPageKey(page)));
      const removedBefore = state.finalInvoicePages
        .slice(0, insertIndex)
        .filter((page) => keySet.has(getPageKey(page))).length;
      const target = Math.max(0, Math.min(insertIndex - removedBefore, rest.length));
      rest.splice(target, 0, ...moving);
      return {
        finalInvoicePages: rest,
        removedFinalInvoicePages: state.removedFinalInvoicePages.filter((page) => !keySet.has(getPageKey(page))),
      };
    }),

  removePages: (keys) =>
    set((state) => {
      const keySet = new Set(keys);
      return {
        finalInvoicePages: state.finalInvoicePages.filter((page) => !keySet.has(getPageKey(page))),
        removedFinalInvoicePages: [
          ...state.removedFinalInvoicePages,
          ...state.finalInvoicePages.filter((page) => keySet.has(getPageKey(page))),
        ],
      };
    }),

  resetPages: () =>
    set((state) => ({ finalInvoicePages: state.originalFinalInvoicePages, removedFinalInvoicePages: [] })),

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
      if (!isSuccess(data)) {
        return { errorMessage: data?.message || "Failed to save the final invoice" };
      }
      set({
        showFinalInvoiceModal: false,
        selectedFinalInvoiceCard: null,
        finalInvoiceSources: [],
        originalFinalInvoicePages: [],
        finalInvoicePages: [],
        removedFinalInvoicePages: [],
      });
      return { result: data.data };
    } finally {
      set({ isSavingFinalInvoice: false });
    }
  },
}));

export default useFinalInvoiceStore;
