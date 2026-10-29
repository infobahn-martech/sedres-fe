import { create } from "zustand";
import daService from "../services/daService";

/* Keeps the upload's documents where da/scc_document_review has none. */
const mergeReviewCard = (card, review) => {
  if (!review) return card;
  return {
    ...card,
    ...review,
    sales_orders: review.sales_orders ?? card.sales_orders ?? [],
    documents: { ...card.documents, ...review.documents },
  };
};

/**
 * SCC review popup, opened after a bulk da/upload_scc_documents upload on L&T "SCC Received".
 * Seeded with the upload response's cards, then refreshed from da/scc_document_review;
 * Confirm sends the ticked ones to da/confirm_scc_documents.
 */
const useSccReviewStore = create((set, get) => ({
  showSccReviewModal: false,
  /** [{ call_id, card_id, ready, sales_orders: [string], documents: { signed_so, scc, approval_email } }] */
  selectedSccReviewCards: [],
  /** File names the backend could not place on any selected card. */
  selectedSccReviewNotPlacedFiles: [],
  /** The L&T workflow the review is for, sent to da/scc_document_review. */
  selectedSccReviewWorkflowId: null,
  isSccReviewLoading: false,
  isConfirmingScc: false,

  openSccReviewModal: (cards, { notPlacedFiles = [], workflowId = null } = {}) =>
    set({
      showSccReviewModal: true,
      selectedSccReviewCards: Array.isArray(cards) ? cards : [],
      selectedSccReviewNotPlacedFiles: Array.isArray(notPlacedFiles) ? notPlacedFiles : [],
      selectedSccReviewWorkflowId: workflowId,
    }),

  closeSccReviewModal: () =>
    set({
      showSccReviewModal: false,
      selectedSccReviewCards: [],
      selectedSccReviewNotPlacedFiles: [],
      selectedSccReviewWorkflowId: null,
      isSccReviewLoading: false,
    }),

  /** Resolves to an error message when the review could not be loaded, otherwise null. */
  fetchSccReview: async () => {
    if (!get().selectedSccReviewCards.length) return null;
    const workflowId = get().selectedSccReviewWorkflowId;
    const cardIds = get().selectedSccReviewCards.map((card) => card.card_id).join(",");

    set({ isSccReviewLoading: true });
    let data;
    try {
      ({ data } = await daService.getSccDocumentReview({
        ...(workflowId != null && { workflow_id: workflowId }),
        card_ids: cardIds,
      }));
    } catch (error) {
      data = error?.response?.data;
    }
    if (!get().showSccReviewModal) return null;
    if (data?.status !== "success") {
      set({ isSccReviewLoading: false });
      return data?.message || "Failed to load the SCC review";
    }

    const reviewByCardId = {};
    (data.data?.cards ?? []).forEach((card) => {
      reviewByCardId[String(card.card_id)] = card;
    });
    set((state) => ({
      isSccReviewLoading: false,
      selectedSccReviewCards: state.selectedSccReviewCards.map((card) =>
        mergeReviewCard(card, reviewByCardId[String(card.card_id)])
      ),
    }));
    return null;
  },

  /** Resolves to { errorMessage } on failure, or { result } with da/confirm_scc_documents' moved cards. */
  confirmSccDocuments: async (cards) => {
    set({ isConfirmingScc: true });
    try {
      let data;
      try {
        ({ data } = await daService.confirmSccDocuments({ cards }));
      } catch (error) {
        data = error?.response?.data;
      }
      return data?.status === "success"
        ? { result: data.data }
        : { errorMessage: data?.message || "Failed to confirm the SCC documents" };
    } finally {
      set({ isConfirmingScc: false });
    }
  },
}));

export default useSccReviewStore;
