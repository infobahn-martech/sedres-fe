import { create } from "zustand";
import daService from "../../services/daService";

/* A review of 300+ cards is fetched a few calls at a time instead of all at once. */
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
 * "SE Received" AR invoice review popup, opened after a bulk da/upload_ar_invoices upload.
 * Seeded with the upload response's cards, then refreshed per card from da/ar_invoice_review.
 */
const useArInvoiceReviewStore = create((set, get) => ({
  showArInvoiceReviewModal: false,
  /** [{ call_id, card_id, ready, sales_orders: [{ sales_order_no, se_numbers, invoice }] }] */
  selectedArInvoiceReviewCards: [],
  isArInvoiceReviewLoading: false,

  openArInvoiceReviewModal: (cards) =>
    set({
      showArInvoiceReviewModal: true,
      selectedArInvoiceReviewCards: Array.isArray(cards) ? cards : [],
    }),

  closeArInvoiceReviewModal: () =>
    set({
      showArInvoiceReviewModal: false,
      selectedArInvoiceReviewCards: [],
      isArInvoiceReviewLoading: false,
    }),

  /** Resolves to an error message when no card's review could be loaded, otherwise null. */
  fetchArInvoiceReview: async () => {
    const callIds = get()
      .selectedArInvoiceReviewCards.map((card) => card.call_id)
      .filter((callId) => callId != null);
    if (!callIds.length) return null;

    set({ isArInvoiceReviewLoading: true });
    const results = [];
    for (let start = 0; start < callIds.length; start += REVIEW_CONCURRENCY) {
      const batch = callIds.slice(start, start + REVIEW_CONCURRENCY);
      results.push(
        ...(await Promise.allSettled(batch.map((callId) => daService.getArInvoiceReview(callId))))
      );
      if (!get().showArInvoiceReviewModal) return null;
    }
    const reviewByCallId = {};
    let errorMessage = null;
    results.forEach((result, index) => {
      const data =
        result.status === "fulfilled" ? result.value?.data : result.reason?.response?.data;
      if (data?.status === "success" && data.data) {
        reviewByCallId[String(callIds[index])] = data.data;
      } else {
        errorMessage = errorMessage || data?.message;
      }
    });

    if (!get().showArInvoiceReviewModal) return null;
    set((state) => ({
      isArInvoiceReviewLoading: false,
      selectedArInvoiceReviewCards: state.selectedArInvoiceReviewCards.map((card) =>
        mergeReviewCard(card, reviewByCallId[String(card.call_id)])
      ),
    }));
    return Object.keys(reviewByCallId).length
      ? null
      : errorMessage || "Failed to load the invoice review";
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
