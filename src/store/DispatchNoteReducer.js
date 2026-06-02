import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import dispatchNoteService from '../services/dispatchNoteService';

const useDispatchNoteReducer = create((set) => ({
    isLoadingList: false,
    isLoadingDelete: false,
    dispatchNotes: [],
    dispatchTotal: 0,

    getAllDispatchNotes: async (params) => {
        try {
            set({ isLoadingList: true });
            const { data } = await dispatchNoteService.getAllDispatchNotes(params);
            set({ dispatchNotes: data?.data ?? [], dispatchTotal: data?.pagination?.total ?? 0, isLoadingList: false });
        } catch {
            set({ isLoadingList: false, dispatchNotes: [], dispatchTotal: 0 });
        }
    },

    deleteDispatchNote: async ({ dispatchNoteId, cb }) => {
        try {
            set({ isLoadingDelete: true });
            const { data } = await dispatchNoteService.deleteDispatchNote(dispatchNoteId);
            set({ isLoadingDelete: false });
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Dispatch note deleted successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingDelete: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },
}));

export default useDispatchNoteReducer;
