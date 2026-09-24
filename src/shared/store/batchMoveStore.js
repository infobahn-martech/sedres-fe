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

  moveCardsToColumn: (cardIds, columnKey, batchNumber) =>
    set((state) => {
      if (!cardIds?.length || !columnKey) return state;
      const columnByCardId = { ...state.columnByCardId };
      const batchByCardId = { ...state.batchByCardId };
      cardIds.forEach((cardId) => {
        columnByCardId[cardId] = columnKey;
        if (batchNumber) batchByCardId[cardId] = batchNumber;
      });
      return { columnByCardId, batchByCardId };
    }),

  clearMoves: () => set({ columnByCardId: {}, batchByCardId: {} }),
}));

export default useBatchMoveStore;
