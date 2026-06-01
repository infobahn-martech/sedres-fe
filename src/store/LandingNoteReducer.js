import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import landingNoteService from '../services/landingNoteService';

const useLandingNoteReducer = create((set) => ({
    isLoadingList: false,
    landingNotes: [],
    landingTotal: 0,

    getAllLandingNotes: async (params) => {
        try {
            set({ isLoadingList: true });
            const { data } = await landingNoteService.getAllLandingNotes(params);
            set({
                landingNotes: data?.data ?? [],
                landingTotal: data?.pagination?.total ?? 0,
                isLoadingList: false,
            });
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingList: false, landingNotes: [], landingTotal: 0 });
            error(err?.response?.data?.message ?? err.message);
        }
    },
}));

export default useLandingNoteReducer;
