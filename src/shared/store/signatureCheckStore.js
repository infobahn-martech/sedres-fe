import { create } from "zustand";
import daService from "../../services/daService";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

/**
 * Signature check of the L&T Submitted to DA cards' SCC. The card colour comes from get_full_board's
 * signature_status; the Signature Check popup runs the check for the ticked cards, lists their stored
 * results and moves the signed ones on.
 */
const useSignatureCheckStore = create((set, get) => ({
  showSignatureCheckModal: false,
  selectedSignatureCheckCards: [],
  signatureCheckRows: [],
  handSignedByCardId: {},
  isSignatureCheckLoading: false,
  isConfirmingSignatureCheck: false,

  openSignatureCheckModal: (cards) =>
    set({
      showSignatureCheckModal: true,
      selectedSignatureCheckCards: cards,
      signatureCheckRows: [],
      handSignedByCardId: {},
    }),

  closeSignatureCheckModal: () =>
    set({
      showSignatureCheckModal: false,
      selectedSignatureCheckCards: [],
      signatureCheckRows: [],
      handSignedByCardId: {},
    }),

  toggleHandSigned: (cardId) =>
    set((state) => ({
      handSignedByCardId: {
        ...state.handSignedByCardId,
        [String(cardId)]: !state.handSignedByCardId[String(cardId)],
      },
    })),

  /* Runs the check for the ticked cards, then loads their stored results. Returns an error message on failure. */
  fetchSignatureChecks: async () => {
    set({ isSignatureCheckLoading: true });
    try {
      const { data: checkData } = await daService.checkSignatures({ cards: get().selectedSignatureCheckCards });
      if (checkData?.status !== "success") return checkData?.message || "Failed to check the signatures";
      const { data } = await daService.getSignatureChecks();
      if (data?.status !== "success") return data?.message || "Failed to load the signature check";
      const tickedIds = new Set(get().selectedSignatureCheckCards.map((card) => String(card.card_id)));
      set({ signatureCheckRows: (data?.data?.cards ?? []).filter((card) => tickedIds.has(String(card.card_id))) });
      return undefined;
    } catch (error) {
      return getErrorMessage(error, "Failed to load the signature check");
    } finally {
      set({ isSignatureCheckLoading: false });
    }
  },

  /* Moves the signed cards on; a missing-signature card ticked "Signed (checked by hand)" is sent with
     signed_by_hand. Returns { errorMessage } on failure, or { result } with moved_to_da /
     returned_to_scc_received / not_moved. */
  confirmSignatureCheck: async () => {
    const { signatureCheckRows, handSignedByCardId } = get();
    const cards = signatureCheckRows.map((row) => ({
      call_id: Number(row.call_id),
      card_id: Number(row.card_id),
      ...(row.status !== "signed" && handSignedByCardId[String(row.card_id)] ? { signed_by_hand: true } : {}),
    }));
    set({ isConfirmingSignatureCheck: true });
    try {
      const { data } = await daService.confirmSignatureCheck({ cards });
      if (data?.status !== "success") return { errorMessage: data?.message || "Failed to move the signed cards" };
      return { result: data.data };
    } catch (error) {
      return { errorMessage: getErrorMessage(error, "Failed to move the signed cards") };
    } finally {
      set({ isConfirmingSignatureCheck: false });
    }
  },
}));

export default useSignatureCheckStore;
