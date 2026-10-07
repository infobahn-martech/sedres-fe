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
  /** { [cardId]: true } — "Awaiting SE" cards the user ticked, before the SE upload or after it (the SE
   * review is AI-detected, so only cards ticked here are confirmed); unticked cards show as plain cards. */
  seTickedByCardId: {},
  /** { [cardId]: true } — cards the user left unticked for the SE upload; an SE review never auto-ticks them. */
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

  /** The user's ticks are kept across uploads, so a card ticked before the SE upload stays ticked. A card
   * the SE review newly approves is ticked here, so "Review and Move" opens with the approved cards ticked
   * (also after a reload); a later untick by the user is not undone by a refresh, and a card the user left
   * unticked for the upload (seUntickedByCardId) is never ticked by it. */
  setSeReview: (seReview) =>
    set((state) => {
      const seApprovedByCardId = { ...state.seApprovedByCardId };
      const seTickedByCardId = { ...state.seTickedByCardId };
      (Array.isArray(seReview?.cards) ? seReview.cards : []).forEach((card) => {
        if (card?.card_id == null) return;
        const key = String(card.card_id);
        if (card.approved && !state.seApprovedByCardId[key] && !state.seUntickedByCardId[key]) {
          seTickedByCardId[key] = true;
        }
        seApprovedByCardId[key] = Boolean(card.approved);
      });
      const seReviewByBatchId =
        seReview?.batch_id != null
          ? { ...state.seReviewByBatchId, [seReview.batch_id]: seReview }
          : state.seReviewByBatchId;
      return { seApprovedByCardId, seTickedByCardId, seReviewByBatchId };
    }),

  /** Ticks an "Awaiting SE" card, or unticks it. Before the batch's SE upload any card can be
   * toggled; after it, cards the SE review did not approve stay unticked. */
  toggleSeReviewCard: (cardId, { isSeUploadDone = false } = {}) =>
    set((state) => {
      const key = String(cardId);
      if (isSeUploadDone && !state.seApprovedByCardId[key]) return state;
      const seTickedByCardId = { ...state.seTickedByCardId };
      const seUntickedByCardId = { ...state.seUntickedByCardId };
      if (seTickedByCardId[key]) {
        delete seTickedByCardId[key];
        seUntickedByCardId[key] = true;
      } else {
        seTickedByCardId[key] = true;
        delete seUntickedByCardId[key];
      }
      return { seTickedByCardId, seUntickedByCardId };
    }),

  /** Remembers the cards left unticked when the SE upload was done. */
  markSeUnticked: (cardIds) =>
    set((state) => {
      if (!cardIds?.length) return state;
      const seUntickedByCardId = { ...state.seUntickedByCardId };
      cardIds.forEach((cardId) => {
        seUntickedByCardId[String(cardId)] = true;
      });
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
   * `batchCardIds` are every card of the batch as drawn, so their unticks are dropped too.
   * Returns { errorMessage } on failure, or { result } with moved_to_se_received / returned_to_backlog. */
  confirmSeReview: async (batchId, batchCardIds = []) => {
    const { seReviewByBatchId, seTickedByCardId } = get();
    const seReview = seReviewByBatchId[batchId];
    const cards = (seReview?.cards ?? [])
      .filter((card) => card?.approved && seTickedByCardId[String(card.card_id)])
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
         let the board draw them where it now says they are. Ticks go too, so a card sent back to
         Backlog arrives unticked the next time a batch brings it to "Awaiting SE". */
      set((state) => {
        const columnByCardId = { ...state.columnByCardId };
        const seTickedByCardId = { ...state.seTickedByCardId };
        const seUntickedByCardId = { ...state.seUntickedByCardId };
        const seReviewByBatchId = { ...state.seReviewByBatchId };
        (seReview?.cards ?? []).forEach((card) => {
          delete columnByCardId[String(card?.card_id)];
          delete seTickedByCardId[String(card?.card_id)];
          delete seUntickedByCardId[String(card?.card_id)];
        });
        batchCardIds.forEach((cardId) => {
          delete seTickedByCardId[String(cardId)];
          delete seUntickedByCardId[String(cardId)];
        });
        delete seReviewByBatchId[batchId];
        return { columnByCardId, seTickedByCardId, seUntickedByCardId, seReviewByBatchId };
      });
      return { result: data.data };
    } finally {
      set({ isConfirmingSeReview: false });
    }
  },

  /** Drops the ticks of cards entering "Awaiting SE", so they arrive unticked. */
  clearSeTicks: (cardIds) =>
    set((state) => {
      if (!cardIds?.length) return state;
      const seTickedByCardId = { ...state.seTickedByCardId };
      cardIds.forEach((cardId) => delete seTickedByCardId[String(cardId)]);
      return { seTickedByCardId };
    }),

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

  /** Forgets where the app itself placed cards (batch column moves and batch grouping), so the next board
   * load decides, as it does after a page reload. */
  resetCardPlacement: () => set({ columnByCardId: {}, batchByCardId: {}, batchIdByNumber: {} }),

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
      seTickedByCardId: {},
      seUntickedByCardId: {},
      seReviewByBatchId: {},
      showSeReviewMoveModal: false,
      selectedSeReviewBatch: null,
    }),
}));

export default useBatchMoveStore;
