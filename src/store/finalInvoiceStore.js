import { create } from "zustand";
import daService from "../services/daService";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

/* The backend sends status "success" on some DA routes and true on others. */
const isSuccessStatus = (status) => status === "success" || status === true;

export const getPageKey = (page) => `${page.source}:${page.page}`;

/* Takes the pages named by keys out of the list and puts them back as one block at insertIndex of what is
   left, keeping their current order. */
const placePages = (pages, keys, insertIndex) => {
  const keySet = new Set(keys);
  const moved = pages.filter((page) => keySet.has(getPageKey(page)));
  const rest = pages.filter((page) => !keySet.has(getPageKey(page)));
  const index = Math.min(Math.max(insertIndex, 0), rest.length);
  return [...rest.slice(0, index), ...moved, ...rest.slice(index)];
};

/* Index, in the list without the moved pages, of the page that sits at or after beforeKey (the end of the
   list when beforeKey is null or nothing movable follows it). */
const getInsertIndexBefore = (pages, keys, beforeKey) => {
  const keySet = new Set(keys);
  const rest = pages.filter((page) => !keySet.has(getPageKey(page)));
  if (beforeKey == null) return rest.length;
  const startIndex = pages.findIndex((page) => getPageKey(page) === beforeKey);
  if (startIndex === -1) return rest.length;
  const nextKept = pages.slice(startIndex).find((page) => !keySet.has(getPageKey(page)));
  if (!nextKept) return rest.length;
  return rest.findIndex((page) => getPageKey(page) === getPageKey(nextKept));
};

/**
 * "Arrange invoice pages" on the Default DA workflow's "AR Invoice Issued" column, for the one ticked card.
 * The editor loads the pages the final invoice PDF is made of (da/final_invoice_pages), lets the user drag
 * them into order or move them to the Removed tray, and Save sends that order to da/save_final_invoice,
 * which builds the PDF and moves the card on.
 */
const useFinalInvoiceStore = create((set, get) => ({
  showFinalInvoiceModal: false,
  /** { call_id, card_id } - the ticked card. */
  selectedFinalInvoiceCard: null,
  /** [{ source, name, url, page_count }] - the PDFs the pages come from. */
  finalInvoiceSources: [],
  /** [{ source, page }] - the pages as the backend suggested them; Reset goes back to this. */
  finalInvoiceInitialPages: [],
  /** [{ source, page }] - the pages in the order the user arranged them. */
  finalInvoicePages: [],
  /** [{ source, page }] - the pages moved to the Removed tray. */
  finalInvoiceRemovedPages: [],
  /** da/save_final_invoice's data once saved: { document, zip, moved, page_count, size_mb, warnings }. */
  savedFinalInvoice: null,
  isLoadingFinalInvoicePages: false,
  isSavingFinalInvoice: false,

  /** Opens the editor and loads the pages. Resolves to an error message on failure. */
  openFinalInvoiceModal: async (card) => {
    set({
      showFinalInvoiceModal: true,
      selectedFinalInvoiceCard: card,
      finalInvoiceSources: [],
      finalInvoiceInitialPages: [],
      finalInvoicePages: [],
      finalInvoiceRemovedPages: [],
      savedFinalInvoice: null,
      isLoadingFinalInvoicePages: true,
    });
    try {
      const { data } = await daService.getFinalInvoicePages(card.call_id, card.card_id);
      if (!isSuccessStatus(data?.status)) return data?.message || "Failed to load the invoice pages";
      const pages = data.data?.pages ?? [];
      set({
        finalInvoiceSources: data.data?.sources ?? [],
        finalInvoiceInitialPages: pages,
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
      finalInvoiceInitialPages: [],
      finalInvoicePages: [],
      finalInvoiceRemovedPages: [],
      savedFinalInvoice: null,
    }),

  /** Moves the pages named by keys in front of the page beforeKey (to the end when it is null). */
  movePagesBefore: (keys, beforeKey) =>
    set((state) => ({
      finalInvoicePages: placePages(
        state.finalInvoicePages,
        keys,
        getInsertIndexBefore(state.finalInvoicePages, keys, beforeKey)
      ),
    })),

  /** Moves the pages named by keys so the first of them lands at the 1-based position. */
  movePagesToPosition: (keys, position) =>
    set((state) => ({ finalInvoicePages: placePages(state.finalInvoicePages, keys, position - 1) })),

  /** Moves the pages named by keys one place back (delta -1) or forward (delta 1). */
  shiftPages: (keys, delta) =>
    set((state) => {
      const keySet = new Set(keys);
      const indexes = state.finalInvoicePages
        .map((page, index) => (keySet.has(getPageKey(page)) ? index : -1))
        .filter((index) => index !== -1);
      if (!indexes.length) return {};
      const insertIndex = delta < 0 ? Math.min(...indexes) - 1 : Math.max(...indexes) + 2 - indexes.length;
      return { finalInvoicePages: placePages(state.finalInvoicePages, keys, insertIndex) };
    }),

  /** Moves the pages named by keys to the Removed tray. */
  removePages: (keys) =>
    set((state) => {
      const keySet = new Set(keys);
      return {
        finalInvoicePages: state.finalInvoicePages.filter((page) => !keySet.has(getPageKey(page))),
        finalInvoiceRemovedPages: [
          ...state.finalInvoiceRemovedPages,
          ...state.finalInvoicePages.filter((page) => keySet.has(getPageKey(page))),
        ],
      };
    }),

  /** Puts removed pages back in front of the page beforeKey; without one, each goes back to its place from
   *  the suggested order (before the first remaining page that followed it there). */
  restorePages: (keys, beforeKey = null) =>
    set((state) => {
      const keySet = new Set(keys);
      const restored = state.finalInvoiceRemovedPages.filter((page) => keySet.has(getPageKey(page)));
      const pages = [...state.finalInvoicePages];
      if (beforeKey != null) {
        const beforeIndex = pages.findIndex((page) => getPageKey(page) === beforeKey);
        pages.splice(beforeIndex === -1 ? pages.length : beforeIndex, 0, ...restored);
      } else {
        const initialKeys = state.finalInvoiceInitialPages.map(getPageKey);
        restored.forEach((page) => {
          const initialIndex = initialKeys.indexOf(getPageKey(page));
          const insertIndex = pages.findIndex((item) => initialKeys.indexOf(getPageKey(item)) > initialIndex);
          pages.splice(insertIndex === -1 ? pages.length : insertIndex, 0, page);
        });
      }
      return {
        finalInvoicePages: pages,
        finalInvoiceRemovedPages: state.finalInvoiceRemovedPages.filter((page) => !keySet.has(getPageKey(page))),
      };
    }),

  resetPages: () =>
    set((state) => ({ finalInvoicePages: state.finalInvoiceInitialPages, finalInvoiceRemovedPages: [] })),

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
          pages: finalInvoicePages.map(({ source, page }) => ({ source, page })),
        }));
      } catch (error) {
        data = error?.response?.data;
      }
      if (!isSuccessStatus(data?.status)) {
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
