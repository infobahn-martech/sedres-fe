import { create } from "zustand";
import daService from "../../services/daService";

/* da/po_review lists every Requested PO card of the workflow, a page at a time; after page 1 the
   remaining pages are fetched a few calls at a time. */
const REVIEW_PER_PAGE = 20;
const REVIEW_CONCURRENCY = 6;

/* Keeps the upload's PO where da/po_review has none. */
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
        po: salesOrder.po ?? uploaded?.po ?? null,
      };
    }),
  };
};

/**
 * PO review popup, opened after a bulk da/upload_pos upload on McDermott "Requested PO".
 * Seeded with the upload response's cards, then refreshed from da/po_review's paged list;
 * Confirm sends the ticked ones to da/confirm_pos.
 */
const usePoReviewStore = create((set, get) => ({
  showPoReviewModal: false,
  /** [{ call_id, card_id, ready, sales_orders: [{ sales_order_id, sales_order_no, invoice_no, po }] }] */
  selectedPoReviewCards: [],
  /** [{ file_name, reason }] — uploaded files the backend could not place on any selected card. */
  selectedPoReviewNotPlacedFiles: [],
  /** The McDermott workflow the review is for, sent to da/po_review. */
  selectedPoReviewWorkflowId: null,
  isPoReviewLoading: false,

  openPoReviewModal: (cards, { notPlacedFiles = [], workflowId = null } = {}) =>
    set({
      showPoReviewModal: true,
      selectedPoReviewCards: Array.isArray(cards) ? cards : [],
      selectedPoReviewNotPlacedFiles: Array.isArray(notPlacedFiles) ? notPlacedFiles : [],
      selectedPoReviewWorkflowId: workflowId,
    }),

  closePoReviewModal: () =>
    set({
      showPoReviewModal: false,
      selectedPoReviewCards: [],
      selectedPoReviewNotPlacedFiles: [],
      selectedPoReviewWorkflowId: null,
      isPoReviewLoading: false,
    }),

  /** Resolves to an error message when a review page could not be loaded, otherwise null. */
  fetchPoReview: async () => {
    if (!get().selectedPoReviewCards.length) return null;
    const workflowId = get().selectedPoReviewWorkflowId;
    /* The upload only returns the ticked cards, so the review is limited to them too. */
    const cardIds = get().selectedPoReviewCards.map((card) => card.card_id).join(",");

    const fetchPage = async (page) => {
      let data;
      try {
        ({ data } = await daService.getPoReview({
          ...(workflowId != null && { workflow_id: workflowId }),
          card_ids: cardIds,
          page,
          per_page: REVIEW_PER_PAGE,
        }));
      } catch (error) {
        data = error?.response?.data;
      }
      return data?.status === "success"
        ? data.data
        : { errorMessage: data?.message || "Failed to load the PO review" };
    };

    set({ isPoReviewLoading: true });
    const firstPage = await fetchPage(1);
    if (!get().showPoReviewModal) return null;
    if (firstPage.errorMessage) {
      set({ isPoReviewLoading: false });
      return firstPage.errorMessage;
    }

    const pages = [firstPage];
    const totalPages = Number(firstPage.pagination?.total_pages) || 1;
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
    for (let start = 0; start < remainingPages.length; start += REVIEW_CONCURRENCY) {
      const batch = remainingPages.slice(start, start + REVIEW_CONCURRENCY);
      pages.push(...(await Promise.all(batch.map(fetchPage))));
      if (!get().showPoReviewModal) return null;
    }

    const reviewByCardId = {};
    pages.forEach((page) =>
      (page.cards ?? []).forEach((card) => {
        reviewByCardId[String(card.card_id)] = card;
      })
    );
    set((state) => ({
      isPoReviewLoading: false,
      selectedPoReviewCards: state.selectedPoReviewCards.map((card) =>
        mergeReviewCard(card, reviewByCardId[String(card.card_id)])
      ),
    }));
    return pages.find((page) => page.errorMessage)?.errorMessage ?? null;
  },

  isConfirmingPos: false,

  /** Resolves to { errorMessage } on failure, or { result } with da/confirm_pos' moved cards. */
  confirmPos: async (cards) => {
    set({ isConfirmingPos: true });
    try {
      let data;
      try {
        ({ data } = await daService.confirmPos({ cards }));
      } catch (error) {
        data = error?.response?.data;
      }
      return data?.status === "success"
        ? { result: data.data }
        : { errorMessage: data?.message || "Failed to confirm POs" };
    } finally {
      set({ isConfirmingPos: false });
    }
  },
}));

export default usePoReviewStore;
