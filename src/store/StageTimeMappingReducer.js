import { create } from "zustand";
import useAlertReducer from "./AlertReducer";
import stageTimeMappingService from "../services/stageTimeMappingService";

const useStageTimeMappingReducer = create((set) => ({
  isLoadingGet: false,
  isBeingUpdated: false,
  stageTimeMappings: [],
  totalCount: 0,

  mapTimeObjectsToStage: async ({ payload, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await stageTimeMappingService.mapTimeObjectsToStage(payload);
      set({ isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? "Saved successfully");
      cb?.();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ isBeingUpdated: false });
      error(err?.response?.data?.message ?? err.message);
    }
  },

  getStageTimeMappings: async (params) => {
    try {
      set({ isLoadingGet: true });
      const apiParams = {};
      if (params?.searchTerm !== undefined && params?.searchTerm !== "") apiParams.search = params.searchTerm;
      if (params?.sortBy) apiParams.sort_by = params.sortBy;
      if (params?.page) apiParams.page = params.page;
      if (params?.limit) apiParams.limit = params.limit;
      const { data } = await stageTimeMappingService.getTimeObjectsWithStage({ params: apiParams });

      const rawList = data?.data ?? [];
      const list = Array.isArray(rawList)
        ? rawList.map((row) => ({
            ...row,
            time_objects: Array.isArray(row.time_objects) ? row.time_objects : [],
          }))
        : [];

      const totalCount =
        Number(
          data?.pagination?.total ??
            data?.total ??
            data?.meta?.total ??
            data?.count ??
            0
        ) || 0;

      set({
        stageTimeMappings: list,
        totalCount,
        isLoadingGet: false,
      });
    } catch (err) {
      set({
        errorMessage: err?.message ?? "Failed to fetch stage time mappings",
        isLoadingGet: false,
        stageTimeMappings: [],
        totalCount: 0,
      });
    }
  },
}));

export default useStageTimeMappingReducer;
