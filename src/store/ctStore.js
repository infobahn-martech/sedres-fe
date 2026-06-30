import { create } from 'zustand';

export const useCTPendingCards = create((set, get) => ({
  pendingCards: [],
  addPendingCard: (card) =>
    set((state) => ({ pendingCards: [...state.pendingCards, card] })),
  consumePendingCards: () => {
    const cards = get().pendingCards;
    set({ pendingCards: [] });
    return cards;
  },
}));
