import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import crewImmigrationService from '../services/crewImmigrationService';

const useCrewImmigrationReducer = create((set) => ({
    /** Crew rows from POST crew/get_immigration_crew_list; null = not loaded yet */
    callCrewList: null,
    callCrewListPagination: null,
    /** Batch names as returned by the API, e.g. ["Unassigned", "BATCH 1"] */
    batchOptions: [],
    /** uploaded_crew_files from the same response, for the "Uploaded Crew Lists" panel */
    uploadedCrewFiles: [],
    isCallCrewListLoading: false,
    isBeingUpdated: false,
    errorMessage: '',

    // crew/get_immigration_crew_list accepts { call_id, search, page, limit,
    // immigration_batch } — search and pagination are server-side.
    fetchCallCrewList: async ({ payload, cb } = {}) => {
        try {
            set({ isCallCrewListLoading: true });
            const { data } = await crewImmigrationService.getImmigrationCrewList(payload || {});
            const root = data?.data ?? data;
            const batches = Array.isArray(root?.batches) ? root.batches : [];
            const crew = batches.length
                ? batches.flatMap((batch) =>
                      (Array.isArray(batch?.crew) ? batch.crew : []).map((member) => ({
                          ...member,
                          batchLabel: batch?.batch || 'Unassigned',
                      }))
                  )
                : root?.crew ?? (Array.isArray(root) ? root : []);
            const list = Array.isArray(crew) ? crew : [];
            const pagination = {
                total: Number(root?.pagination?.total ?? root?.total ?? list.length ?? 0) || 0,
                page: Number(root?.pagination?.page ?? root?.page ?? payload?.page ?? 1) || 1,
                limit: Number(root?.pagination?.limit ?? root?.limit ?? payload?.limit ?? 10) || 10,
                total_pages: Number(root?.pagination?.total_pages ?? root?.total_pages ?? 1) || 1,
            };
            const batchOptions = batches.map((batch) => batch?.batch).filter(Boolean);
            const uploadedCrewFiles = Array.isArray(root?.uploaded_crew_files) ? root.uploaded_crew_files : [];
            set({
                callCrewList: list,
                callCrewListPagination: pagination,
                batchOptions,
                uploadedCrewFiles,
                isCallCrewListLoading: false,
            });
            cb && cb(list, pagination, batchOptions);
            return list;
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isCallCrewListLoading: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    // Import and replace both hit the same crew/import_crew_immigration
    // endpoint — there's no separate replace endpoint for this API, so a
    // "replace" is just re-importing.
    importCrewImmigrationFile: async ({ formData, cb } = {}) => {
        try {
            set({ isBeingUpdated: true, errorMessage: '' });
            const { data } = await crewImmigrationService.importCrewImmigration(formData);
            set({ isBeingUpdated: false });
            cb && cb(data);
            return data;
        } catch (err) {
            const { error } = useAlertReducer.getState();
            const message = err?.response?.data?.message ?? err.message;
            set({
                errorMessage: message,
                isBeingUpdated: false,
            });
            error(message);
            throw err;
        }
    },

    // crew/remove_immigration_crew_file accepts { call_id, crew_excel_upload_id }
    // to delete a single uploaded crew list file.
    removeCrewImmigrationFile: async ({ callId, crewExcelUploadId } = {}) => {
        try {
            set({ isBeingUpdated: true, errorMessage: '' });
            const { data } = await crewImmigrationService.removeImmigrationCrewFile({
                call_id: callId,
                crew_excel_upload_id: crewExcelUploadId,
            });
            set({ isBeingUpdated: false });
            return data;
        } catch (err) {
            const { error } = useAlertReducer.getState();
            const message = err?.response?.data?.message ?? err.message;
            set({
                errorMessage: message,
                isBeingUpdated: false,
            });
            error(message);
            throw err;
        }
    },
}));

export default useCrewImmigrationReducer;
