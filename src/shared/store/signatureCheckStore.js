import { create } from "zustand";
import daService from "../../services/daService";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

/**
 * Signature check of the L&T Backlog cards' SCC. statusByCardId holds the latest result per card
 * ({ status: "signed" | "missing" | null, checkedDate }), drawn on the cards; the Signature Check popup
 * lists the ticked cards' stored results and moves the signed ones on.
 */
const useSignatureCheckStore = create((set, get) => ({
  statusByCardId: {},

  showSignatureCheckModal: false,
  selectedSignatureCheckCards: [],
  signatureCheckRows: [],
  handSignedByCardId: {},
  isSignatureCheckLoading: false,
  isConfirmingSignatureCheck: false,

  /* Runs the check for the given Backlog cards ({ call_id, card_id }) and keeps each card's result. */
  loadStatuses: async (cards) => {
    if (!cards.length) return;
    try {
      const { data } = await daService.checkSignatures({ cards });
      const checkedCards = data?.data?.cards ?? [];
      set((state) => {
        const statusByCardId = { ...state.statusByCardId };
        checkedCards.forEach((card) => {
          statusByCardId[String(card.card_id)] = {
            status: card.status ?? null,
            checkedDate: card.checked_date ?? null,
          };
        });
        return { statusByCardId };
      });
    } catch {
      /* The cards simply keep their last colour when the check cannot be read. */
    }
  },

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

  /* Stored results of the ticked cards. Returns an error message on failure. */
  fetchSignatureChecks: async () => {
    set({ isSignatureCheckLoading: true });
    try {
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
     signed_by_hand. Returns { errorMessage } on failure, or { result } with moved_to_convert_ar_invoice /
     not_moved. */
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
