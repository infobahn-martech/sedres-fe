import { create } from "zustand";

/**
 * Bumped after a Sales Order line item is verified or un-verified, so board-level checks that read the
 * items' verification (e.g. the "Send SCC for approval" gate) re-fetch them.
 */
const useSoVerifyRefreshStore = create((set) => ({
  verifyRefreshToken: 0,
  bumpVerifyRefreshToken: () => set((state) => ({ verifyRefreshToken: state.verifyRefreshToken + 1 })),
}));

export default useSoVerifyRefreshStore;
