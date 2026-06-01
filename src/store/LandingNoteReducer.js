import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import landingNoteService from '../services/landingNoteService';

const useLandingNoteReducer = create((set) => ({
    isLoadingList: false,
    isLoadingUpdate: false,
    landingNotes: [],
    landingTotal: 0,

    getAllLandingNotes: async (params) => {
        try {
            set({ isLoadingList: true });
            const { data } = await landingNoteService.getAllLandingNotes(params);
            set({ landingNotes: data?.data ?? [], landingTotal: data?.pagination?.total ?? 0, isLoadingList: false });
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingList: false, landingNotes: [], landingTotal: 0 });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    getLandingNoteById: async ({ id, cb }) => {
        try {
            const { data } = await landingNoteService.getLandingNoteById(id);
            cb?.(data?.data ?? null);
        } catch (err) {
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
            cb?.(null);
        }
    },

    updateLandingNote: async ({ landingNoteId, data, cb }) => {
        try {
            set({ isLoadingUpdate: true });
            const { data: resData } = await landingNoteService.updateLandingNote(landingNoteId, data);
            set({ isLoadingUpdate: false });
            const { success } = useAlertReducer.getState();
            success(resData?.message ?? 'Landing note updated successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingUpdate: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },
}));

export default useLandingNoteReducer;
