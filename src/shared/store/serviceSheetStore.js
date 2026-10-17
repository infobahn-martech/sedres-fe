import { create } from "zustand";
import daService from "../../services/daService";

/**
 * Enter Service Sheet No popup, opened from the "AR Invoice Issued" column header for the ticked cards.
 * The rows come from the cards' own sales_orders (with their invoice no); Save sends the typed service
 * sheet numbers to da/save_service_sheets.
 */
const useServiceSheetStore = create((set) => ({
  showServiceSheetModal: false,
  /** [{ call_id, card_id, sales_orders: [{ sales_order_no, invoice_no }] }] - the ticked cards. */
  selectedServiceSheetCards: [],
  isSavingServiceSheets: false,

  openServiceSheetModal: (cards) =>
    set({
      showServiceSheetModal: true,
      selectedServiceSheetCards: Array.isArray(cards) ? cards : [],
    }),

  closeServiceSheetModal: () =>
    set({
      showServiceSheetModal: false,
      selectedServiceSheetCards: [],
    }),

  /** Resolves to { errorMessage } on failure, or { result } with da/save_service_sheets' data. */
  saveServiceSheets: async (cards) => {
    set({ isSavingServiceSheets: true });
    try {
      let data;
      try {
        ({ data } = await daService.saveServiceSheets({ cards }));
      } catch (error) {
        data = error?.response?.data;
      }
      return data?.status === "success"
        ? { result: data.data }
        : { errorMessage: data?.message || "Failed to save the service sheet numbers" };
    } finally {
      set({ isSavingServiceSheets: false });
    }
  },
}));

export default useServiceSheetStore;
