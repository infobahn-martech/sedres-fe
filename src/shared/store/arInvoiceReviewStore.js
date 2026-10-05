import { create } from "zustand";
import daService from "../../services/daService";

/* da/ar_invoice_review lists every SE Received card, a page at a time; after page 1 the remaining
   pages are fetched a few calls at a time. */
const REVIEW_PER_PAGE = 20;
const REVIEW_CONCURRENCY = 6;

/* Keeps the upload's invoice where da/ar_invoice_review has none, and adds the review's SE/WO numbers. */
const mergeReviewCard = (card, review) => {
  if (!review) return card;
  const uploadedById = Object.fromEntries(
    (card.sales_orders ?? []).map((salesOrder) => [salesOrder.sales_order_id, salesOrder])
  );
  return {
    ...card,
    ready: review.ready ?? card.ready,
    sales_orders: (review.sales_orders ?? card.sales_orders ?? []).map((salesOrder) => {
      const uploaded = uploadedById[salesOrder.sales_order_id];
      return {
        ...uploaded,
        ...salesOrder,
        invoice: salesOrder.invoice ?? uploaded?.invoice ?? null,
      };
    }),
  };
};

/**
 * AR invoice review popup, opened after a bulk da/upload_ar_invoices upload: SAIPEM "SE Received",
 * or McDermott "Issue AR Invoice" (which must send its workflow_id to da/ar_invoice_review).
 * Seeded with the upload response's cards, then refreshed from da/ar_invoice_review's paged list.
 */
const useArInvoiceReviewStore = create((set, get) => ({
  showArInvoiceReviewModal: false,
  /** [{ call_id, card_id, ready, sales_orders: [{ sales_order_no, se_numbers, invoice }] }] */
  selectedArInvoiceReviewCards: [],
  /** The McDermott workflow the review is for; null for SAIPEM. */
  selectedArInvoiceReviewWorkflowId: null,
  isArInvoiceReviewLoading: false,

  openArInvoiceReviewModal: (cards, { workflowId = null } = {}) =>
    set({
      showArInvoiceReviewModal: true,
      selectedArInvoiceReviewCards: Array.isArray(cards) ? cards : [],
      selectedArInvoiceReviewWorkflowId: workflowId,
    }),

  closeArInvoiceReviewModal: () =>
    set({
      showArInvoiceReviewModal: false,
      selectedArInvoiceReviewCards: [],
      selectedArInvoiceReviewWorkflowId: null,
      isArInvoiceReviewLoading: false,
    }),

  /** Resolves to an error message when a review page could not be loaded, otherwise null. */
  fetchArInvoiceReview: async () => {
    if (!get().selectedArInvoiceReviewCards.length) return null;
    const workflowId = get().selectedArInvoiceReviewWorkflowId;

    const fetchPage = async (page) => {
      let data;
      try {
        ({ data } = await daService.getArInvoiceReview({
          ...(workflowId != null && { workflow_id: workflowId }),
          page,
          per_page: REVIEW_PER_PAGE,
        }));
      } catch (error) {
        data = error?.response?.data;
      }
      return data?.status === "success"
        ? data.data
        : { errorMessage: data?.message || "Failed to load the invoice review" };
    };

    set({ isArInvoiceReviewLoading: true });
    const firstPage = await fetchPage(1);
    if (!get().showArInvoiceReviewModal) return null;
    if (firstPage.errorMessage) {
      set({ isArInvoiceReviewLoading: false });
      return firstPage.errorMessage;
    }

    const pages = [firstPage];
    const totalPages = Number(firstPage.pagination?.total_pages) || 1;
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
    for (let start = 0; start < remainingPages.length; start += REVIEW_CONCURRENCY) {
      const batch = remainingPages.slice(start, start + REVIEW_CONCURRENCY);
      pages.push(...(await Promise.all(batch.map(fetchPage))));
      if (!get().showArInvoiceReviewModal) return null;
    }

    const reviewByCardId = {};
    pages.forEach((page) =>
      (page.cards ?? []).forEach((card) => {
        reviewByCardId[String(card.card_id)] = card;
      })
    );
    set((state) => ({
      isArInvoiceReviewLoading: false,
      selectedArInvoiceReviewCards: state.selectedArInvoiceReviewCards.map((card) =>
        mergeReviewCard(card, reviewByCardId[String(card.card_id)])
      ),
    }));
    return pages.find((page) => page.errorMessage)?.errorMessage ?? null;
  },

  isConfirmingArInvoices: false,

  /** Resolves to { errorMessage } on failure, or { result } with da/confirm_ar_invoices' moved cards. */
  confirmArInvoices: async (cards) => {
    set({ isConfirmingArInvoices: true });
    try {
      let data;
      try {
        ({ data } = await daService.confirmArInvoices({ cards }));
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

export default useArInvoiceReviewStore;
