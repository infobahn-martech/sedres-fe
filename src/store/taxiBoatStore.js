import { create } from 'zustand';

const MAX_RECENT_OPS = 5;

export const useTaxiBoatStore = create((set) => ({
  recentOperators: [],
  addRecentOperator: (name) => {
    if (!name?.trim()) return;
    const trimmed = name.trim();
    set((state) => ({
      recentOperators: [
        trimmed,
        ...state.recentOperators.filter((op) => op !== trimmed),
      ].slice(0, MAX_RECENT_OPS),
    }));
  },
}));
