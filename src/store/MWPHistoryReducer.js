import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import mwpHistoryService from '../services/mwpHistoryService';

const useMWPHistoryReducer = create((set) => ({
  mwpHistory: null,
  vessel: null,
  isLoadingGet: false,
  errorMessage: '',
  totalMWPHistoryCount: 0,

  fetchAllMWPHistory: async ({ params, cb } = {}) => {
    try {
      set({ isLoadingGet: true });

      const { data } = await mwpHistoryService.getAllMWPHistory(params || {});
      // API responses in this codebase sometimes wrap payload under `data`
      const payload = data?.data ?? data;

      const rows = Array.isArray(payload)
        ? payload
        : payload?.mwp_history ?? payload?.mwpHistory ?? [];
      const historyRows = Array.isArray(rows) ? rows : [];
      const firstRow = historyRows[0] ?? {};

      set({
        vessel: {
          vessel_id: firstRow?.vessel_id ?? null,
          vessel_name: firstRow?.vessel_name ?? null,
          billing_entity: firstRow?.billing_entity ?? null,
          imo_number: firstRow?.imo_number ?? null,
        },
        mwpHistory: historyRows,
        totalMWPHistoryCount: historyRows.length,
        isLoadingGet: false,
      });

      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: err?.response?.data?.message ?? err.message,
        isLoadingGet: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
}));

export default useMWPHistoryReducer;
