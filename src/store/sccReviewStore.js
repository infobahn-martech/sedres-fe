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

export const getSalesOrderObjects = (card) =>
  (card.sales_orders ?? []).map((salesOrder) =>
    typeof salesOrder === "object" ? salesOrder : { sales_order_no: salesOrder }
  );

export const hasSccDocument = (card) =>
  getSalesOrderObjects(card).some((salesOrder) => salesOrder.scc?.document_id != null);

/* The approved-SCC confirm body: each card with the SCC placed on each of its sales orders. */
export const buildApprovedSccPayload = (cards) =>
  cards.map((card) => ({
    call_id: card.call_id,
    card_id: card.card_id,
    sales_orders: getSalesOrderObjects(card)
      .filter((salesOrder) => salesOrder.scc?.document_id != null)
      .map((salesOrder) => ({ sales_order_no: salesOrder.sales_order_no, scc_id: salesOrder.scc.document_id })),
  }));

/**
 * SCC review popup, opened after a bulk da/upload_scc_documents upload on L&T "SCC Received".
 * Seeded with the upload response's cards, then refreshed from da/scc_document_review;
 * Confirm sends the ticked ones to da/confirm_scc_documents.
 */
const useSccReviewStore = create((set, get) => ({
  showSccReviewModal: false,
  /** [{ call_id, card_id, ready, sales_orders: [string], documents: { signed_so, scc, approval_email } }]
   *  or, for the approved-SCC upload, [{ call_id, card_id, ready, approval_email,
   *  sales_orders: [{ sales_order_no, scc: { document_id, name, url, signed } }] }] */
  selectedSccReviewCards: [],
  /** File names the backend could not place on any selected card. */
  selectedSccReviewNotPlacedFiles: [],
  /** The L&T workflow the review is for, sent to da/scc_document_review. */
  selectedSccReviewWorkflowId: null,
  /** True for the Operator board's L&T "Approval Received" upload: per sales order SCC and signature status,
   *  and unsigned cards can be confirmed too (the backend leaves them in the column). */
  isApprovedSccReview: false,
  isSccReviewLoading: false,
  isConfirmingScc: false,

  openSccReviewModal: (cards, { notPlacedFiles = [], workflowId = null, isApprovedScc = false } = {}) =>
    set({
      showSccReviewModal: true,
      selectedSccReviewCards: Array.isArray(cards) ? cards : [],
      selectedSccReviewNotPlacedFiles: Array.isArray(notPlacedFiles) ? notPlacedFiles : [],
      selectedSccReviewWorkflowId: workflowId,
      isApprovedSccReview: isApprovedScc,
    }),

  closeSccReviewModal: () =>
    set({
      showSccReviewModal: false,
      selectedSccReviewCards: [],
      selectedSccReviewNotPlacedFiles: [],
      selectedSccReviewWorkflowId: null,
      isApprovedSccReview: false,
      isSccReviewLoading: false,
    }),

  /** Cards the approved-SCC confirm left in "Approval Received" for a missing signature; the board shows them red. */
  unsignedSccCardIds: {},

  /** Marks the cards left unsigned by a confirm and clears the mark on the other confirmed cards. */
  markCardsUnsigned: (unsignedCardIds, confirmedCardIds = []) =>
    set((state) => {
      const next = { ...state.unsignedSccCardIds };
      confirmedCardIds.forEach((id) => delete next[String(id)]);
      unsignedCardIds.forEach((id) => {
        next[String(id)] = true;
      });
      return { unsignedSccCardIds: next };
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

  /**
   * Operator "Approval Received" upload: no review popup. The uploaded cards are refreshed from
   * da/scc_document_review and every card with an SCC is sent straight to da/confirm_scc_documents,
   * which moves the signed ones on and answers not_moved for the rest.
   * Resolves to { errorMessage } on failure, or { result, payload } (payload is empty when no card has an SCC).
   */
  confirmApprovedSccUpload: async (cards, { workflowId = null } = {}) => {
    let reviewCards = cards;
    try {
      const { data } = await daService.getSccDocumentReview({
        ...(workflowId != null && { workflow_id: workflowId }),
        card_ids: cards.map((card) => card.card_id).join(","),
      });
      if (data?.status === "success") {
        const reviewByCardId = {};
        (data.data?.cards ?? []).forEach((card) => {
          reviewByCardId[String(card.card_id)] = card;
        });
        reviewCards = cards.map((card) => mergeReviewCard(card, reviewByCardId[String(card.card_id)]));
      }
    } catch {
      reviewCards = cards;
    }

    const payload = buildApprovedSccPayload(reviewCards.filter(hasSccDocument));
    if (!payload.length) return { payload };
    const { errorMessage, result } = await get().confirmSccDocuments(payload);
    return errorMessage ? { errorMessage } : { result, payload };
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
