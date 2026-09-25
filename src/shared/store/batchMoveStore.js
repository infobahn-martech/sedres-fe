import { create } from "zustand";

/**
 * Where a batch has pushed its cards on the SAIPEM board.
 *
 * Moving a batch to the next column is the backend's job — it is giving us a function for it.
 * Until then the move is recorded here and the board draws the cards in the new column, so the
 * flow can be reviewed end to end (nothing is persisted, and a refresh clears it).
 */
const useBatchMoveStore = create((set) => ({
  /** { [cardId]: columnKey } */
  columnByCardId: {},
  /** { [cardId]: batchNumber } — what the card is grouped under in its new column. */
  batchByCardId: {},
  /** { [batchNumber]: batchId } — backend id from create_hub_batch, used for the SE email draft. */
  batchIdByNumber: {},

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

  clearMoves: () => set({ columnByCardId: {}, batchByCardId: {}, batchIdByNumber: {} }),
}));

export default useBatchMoveStore;
