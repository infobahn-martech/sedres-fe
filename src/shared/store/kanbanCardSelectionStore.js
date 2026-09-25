import { create } from "zustand";

/**
 * Multi-card selection on the Kanban board. Holds only card ids (order = selection order) —
 * the board page resolves ids to full card data via its own `cardsById`, so this store
 * never risks going stale relative to the board's live data.
 */
const useKanbanCardSelectionStore = create((set) => ({
  selectedCardIds: [],

  toggleCardId: (id) =>
    set((state) => ({
      selectedCardIds: state.selectedCardIds.includes(id)
        ? state.selectedCardIds.filter((existingId) => existingId !== id)
        : [...state.selectedCardIds, id],
    })),

  /* Idempotent set (vs. toggleCardId) — needed for click-and-drag "paint" selection, where the
     same card can be re-entered mid-drag and must not flip back to its previous state. */
  setCardSelected: (id, isSelected) =>
    set((state) => {
      const alreadySelected = state.selectedCardIds.includes(id);
      if (alreadySelected === isSelected) return state;
      return {
        selectedCardIds: isSelected
          ? [...state.selectedCardIds, id]
          : state.selectedCardIds.filter((existingId) => existingId !== id),
      };
    }),

  removeCardId: (id) =>
    set((state) => ({
      selectedCardIds: state.selectedCardIds.filter((existingId) => existingId !== id),
    })),

  clearSelection: () => set({ selectedCardIds: [] }),
}));

export default useKanbanCardSelectionStore;
