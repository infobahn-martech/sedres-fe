import { create } from "zustand";

/**
 * Whether a kanban card modal (CardForm) is open. The modal covers the navbar, so the
 * Header reads this to offer its actions from a floating quick-actions button instead.
 */
const useCardModalStore = create((set) => ({
  isCardModalOpen: false,
  setCardModalOpen: (isOpen) => set({ isCardModalOpen: Boolean(isOpen) }),
}));

export default useCardModalStore;
