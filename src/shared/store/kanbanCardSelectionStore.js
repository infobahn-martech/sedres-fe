import { create } from "zustand";

/**
 * Cross-component "select cards on the Kanban board, then act from the global header"
 * flow for Sales Order / Generate PO. Holds only card ids (order = selection order) —
 * the board page resolves ids to full card data via its own `cardsById`, so this store
 * never risks going stale relative to the board's live data.
 */
const useKanbanCardSelectionStore = create((set, get) => ({
  selectedCardIds: [],
  isPoFlowOpen: false,

  toggleCardId: (id) =>
    set((state) => ({
      selectedCardIds: state.selectedCardIds.includes(id)
        ? state.selectedCardIds.filter((existingId) => existingId !== id)
        : [...state.selectedCardIds, id],
    })),

  removeCardId: (id) =>
    set((state) => ({
      selectedCardIds: state.selectedCardIds.filter((existingId) => existingId !== id),
    })),

  clearSelection: () => set({ selectedCardIds: [], isPoFlowOpen: false }),

  openPoFlow: () => {
    if (get().selectedCardIds.length === 0) return;
    set({ isPoFlowOpen: true });
  },

  closePoFlow: () => set({ isPoFlowOpen: false }),
}));

export default useKanbanCardSelectionStore;
