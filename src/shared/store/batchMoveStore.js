import { create } from "zustand";
import daService from "../../services/daService";

/**
 * Where a batch has pushed its cards on the SAIPEM board.
 *
 * Moving a batch to the next column is the backend's job — it is giving us a function for it.
 * Until then the move is recorded here and the board draws the cards in the new column, so the
 * flow can be reviewed end to end (nothing is persisted, and a refresh clears it).
 */
const requestSeApprovalLines = async (batchId) => {
  try {
    const { data } = await daService.getSeApprovalLines(batchId);
    return data;
  } catch (error) {
    return error?.response?.data;
  }
};

/* da/se_approval_lines also answers for batches with no SE upload yet (nothing approved, no WO/SE
   numbers), so any approval or WO/SE number is what marks the upload as done. */
const hasSeUpload = (seReview) =>
  (seReview?.cards ?? []).some(
    (card) =>
      card?.approved ||
      (card?.sales_orders ?? []).some(
        (salesOrder) => salesOrder?.approved || salesOrder?.wo_number || salesOrder?.se_numbers?.length
      )
  );

/* A "Consolidated" card's submission_id from da/create_submission_documents is kept in browser storage, so
   "Send For Final Submission" is still offered after a reload; the board data does not carry it. */
const SUBMISSION_ID_STORAGE_KEY = "sedres-da-submission-id-by-card";

const readStoredSubmissionIds = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SUBMISSION_ID_STORAGE_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
};

const storeSubmissionIds = (submissionIdByCardId) => {
  try {
    localStorage.setItem(SUBMISSION_ID_STORAGE_KEY, JSON.stringify(submissionIdByCardId));
  } catch {
    /* Without storage the ids only last until a reload. */
  }
};

const useBatchMoveStore = create((set, get) => ({
  /** { [cardId]: columnKey } */
  columnByCardId: {},
  /** { [cardId]: batchNumber } — what the card is grouped under in its new column. */
  batchByCardId: {},
  /** { [batchNumber]: batchId } — backend id from create_hub_batch, used for the SE email draft. */
  batchIdByNumber: {},
  /** { [batchId]: true } — batches whose SE document is already uploaded, so later uploads may skip it. */
  seDocumentUploadedByBatchId: {},
  /** { [cardId]: bool } — per-card SE approval from da/upload_se_approval's se_review.cards. */
  seApprovedByCardId: {},
  /** { [cardId]: true } — SE-approved cards the user unticked (the SE review is AI-detected and can be
   * wrong); they show as plain cards and are left out of the confirm. */
  seUntickedByCardId: {},
  /** { [batchId]: se_review } — da/upload_se_approval's se_review; its presence means the SE upload is done. */
  seReviewByBatchId: {},
  /** { [cardId]: submissionId } — "Consolidated" cards whose submission documents are created, so the column
   * offers "Send For Final Submission" for them. Survives a reload (see readStoredSubmissionIds). */
  submissionIdByCardId: readStoredSubmissionIds(),
  showSeReviewMoveModal: false,
  /** The batch whose "Review and Move" popup is open. */
  selectedSeReviewBatch: null,
  isSeReviewLoading: false,
  isConfirmingSeReview: false,

  /** `resetUnticks` drops the user's unticks for the batch's cards, for a fresh SE upload. */
  setSeReview: (seReview, { resetUnticks = false } = {}) =>
    set((state) => {
      const seApprovedByCardId = { ...state.seApprovedByCardId };
      const seUntickedByCardId = { ...state.seUntickedByCardId };
      (Array.isArray(seReview?.cards) ? seReview.cards : []).forEach((card) => {
        if (card?.card_id == null) return;
        seApprovedByCardId[String(card.card_id)] = Boolean(card.approved);
        if (resetUnticks) delete seUntickedByCardId[String(card.card_id)];
      });
      const seReviewByBatchId =
        seReview?.batch_id != null
          ? { ...state.seReviewByBatchId, [seReview.batch_id]: seReview }
          : state.seReviewByBatchId;
      return { seApprovedByCardId, seUntickedByCardId, seReviewByBatchId };
    }),

  /** Unticks an SE-approved card, or ticks it back. Cards the SE review did not approve stay unticked. */
  toggleSeReviewCard: (cardId) =>
    set((state) => {
      const key = String(cardId);
      if (!state.seApprovedByCardId[key]) return state;
      const seUntickedByCardId = { ...state.seUntickedByCardId };
      if (seUntickedByCardId[key]) delete seUntickedByCardId[key];
      else seUntickedByCardId[key] = true;
      return { seUntickedByCardId };
    }),

  /** Refreshes a batch's se_review from da/se_approval_lines. Returns the error message on failure. */
  fetchSeReview: async (batchId) => {
    set({ isSeReviewLoading: true });
    try {
      const data = await requestSeApprovalLines(batchId);
      if (data?.status !== "success") return data?.message || "Failed to load approved sales orders";
      get().setSeReview(data.data);
      return null;
    } finally {
      set({ isSeReviewLoading: false });
    }
  },

  /** Restores a batch's se_review after a reload (green ticks + "Review and Move"); silent on failure. */
  loadSeReview: async (batchId) => {
    const data = await requestSeApprovalLines(batchId);
    if (data?.status === "success" && hasSeUpload(data.data)) get().setSeReview(data.data);
  },

  /** Sends the batch's SE-approved cards (with their approved SOs) to da/confirm_se_approval.
   * Returns { errorMessage } on failure, or { result } with moved_to_se_received / returned_to_backlog. */
  confirmSeReview: async (batchId) => {
    const { seReviewByBatchId, seUntickedByCardId } = get();
    const seReview = seReviewByBatchId[batchId];
    const cards = (seReview?.cards ?? [])
      .filter((card) => card?.approved && !seUntickedByCardId[String(card.card_id)])
      .map((card) => ({
        call_id: card.call_id,
        card_id: card.card_id,
        sales_orders: (card.sales_orders ?? [])
          .filter((salesOrder) => salesOrder?.approved)
          .map((salesOrder) => ({
            sales_order_no: salesOrder.sales_order_no,
            wo_number: salesOrder.wo_number,
            se_numbers: salesOrder.se_numbers ?? [],
            project_split: salesOrder.project_split,
          })),
      }));

    set({ isConfirmingSeReview: true });
    try {
      let data;
      try {
        ({ data } = await daService.confirmSeApproval({ batch_id: Number(batchId), cards }));
      } catch (error) {
        data = error?.response?.data;
      }
      if (data?.status !== "success") {
        return { errorMessage: data?.message || "Failed to confirm SE approval" };
      }

      /* The backend has moved every card of the batch, so drop the local column overrides and
         let the board draw them where it now says they are. */
      set((state) => {
        const columnByCardId = { ...state.columnByCardId };
        const seUntickedByCardId = { ...state.seUntickedByCardId };
        const seReviewByBatchId = { ...state.seReviewByBatchId };
        (seReview?.cards ?? []).forEach((card) => {
          delete columnByCardId[String(card?.card_id)];
          delete seUntickedByCardId[String(card?.card_id)];
        });
        delete seReviewByBatchId[batchId];
        return { columnByCardId, seUntickedByCardId, seReviewByBatchId };
      });
      return { result: data.data };
    } finally {
      set({ isConfirmingSeReview: false });
    }
  },

  openSeReviewMoveModal: (batch) => set({ showSeReviewMoveModal: true, selectedSeReviewBatch: batch }),

  closeSeReviewMoveModal: () => set({ showSeReviewMoveModal: false, selectedSeReviewBatch: null }),

  markSeDocumentUploaded: (batchId) =>
    set((state) => ({
      seDocumentUploadedByBatchId: { ...state.seDocumentUploadedByBatchId, [batchId]: true },
    })),

  moveCardsToColumn: (cardIds, columnKey, batchNumber, batchId) =>
    set((state) => {
      if (!cardIds?.length || !columnKey) return state;
      const columnByCardId = { ...state.columnByCardId };
      const batchByCardId = { ...state.batchByCardId };
      cardIds.forEach((cardId) => {
        columnByCardId[cardId] = columnKey;
        if (batchNumber) batchByCardId[cardId] = batchNumber;
      });
      const batchIdByNumber =
        batchNumber && batchId ? { ...state.batchIdByNumber, [batchNumber]: batchId } : state.batchIdByNumber;
      return { columnByCardId, batchByCardId, batchIdByNumber };
    }),

  /** Drops the local column overrides of cards the backend has since moved, so the board draws them
   * where get_full_board now says they are. */
  clearCardColumns: (cardIds) =>
    set((state) => {
      if (!cardIds?.length) return state;
      const columnByCardId = { ...state.columnByCardId };
      cardIds.forEach((cardId) => delete columnByCardId[String(cardId)]);
      return { columnByCardId };
    }),

  setSubmissionId: (cardIds, submissionId) =>
    set((state) => {
      if (!cardIds?.length || submissionId == null) return state;
      const submissionIdByCardId = { ...state.submissionIdByCardId };
      cardIds.forEach((cardId) => {
        submissionIdByCardId[String(cardId)] = submissionId;
      });
      storeSubmissionIds(submissionIdByCardId);
      return { submissionIdByCardId };
    }),

  /** Drops a submission once it is sent or has gone stale, so its cards offer "Create documents" again. */
  clearSubmissionId: (submissionId) =>
    set((state) => {
      const submissionIdByCardId = Object.fromEntries(
        Object.entries(state.submissionIdByCardId).filter(([, id]) => String(id) !== String(submissionId))
      );
      storeSubmissionIds(submissionIdByCardId);
      return { submissionIdByCardId };
    }),

  /** Replaces the grouping with da/batches, which is fetched alongside every board load. */
  setBatches: (batches) =>
    set(() => {
      const batchByCardId = {};
      const batchIdByNumber = {};
      (Array.isArray(batches) ? batches : []).forEach((batch) => {
        if (!batch?.batch_number) return;
        if (batch.batch_id != null) batchIdByNumber[batch.batch_number] = batch.batch_id;
        (batch.card_ids || []).forEach((cardId) => {
          batchByCardId[String(cardId)] = batch.batch_number;
        });
      });
      return { batchByCardId, batchIdByNumber };
    }),

  clearMoves: () =>
    set({
      columnByCardId: {},
      batchByCardId: {},
      batchIdByNumber: {},
      seDocumentUploadedByBatchId: {},
      seApprovedByCardId: {},
      seUntickedByCardId: {},
      seReviewByBatchId: {},
      showSeReviewMoveModal: false,
      selectedSeReviewBatch: null,
    }),
}));

export default useBatchMoveStore;
