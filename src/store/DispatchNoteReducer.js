import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import dispatchNoteService from '../services/dispatchNoteService';

const useDispatchNoteReducer = create((set) => ({
    isLoadingList: false,
    isLoadingDetail: false,
    isLoadingUpdate: false,
    isLoadingDelete: false,
    isLoadingPrint: false,
    dispatchNotes: [],
    dispatchTotal: 0,

    getAllDispatchNotes: async ({ call_id, ...params }) => {
        try {
            set({ isLoadingList: true });
            const { data } = await dispatchNoteService.getAllDispatchNotes(call_id, params);
            set({ dispatchNotes: data?.data ?? [], dispatchTotal: data?.pagination?.total ?? 0, isLoadingList: false });
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingList: false, dispatchNotes: [], dispatchTotal: 0 });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    getDispatchNoteById: async ({ id, cb }) => {
        try {
            set({ isLoadingDetail: true });
            const { data } = await dispatchNoteService.getDispatchNoteById(id);
            set({ isLoadingDetail: false });
            cb?.(data?.data ?? null);
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingDetail: false });
            error(err?.response?.data?.message ?? err.message);
            cb?.(null);
        }
    },

    updateDispatchNote: async ({ dispatchNoteId, data, cb }) => {
        try {
            set({ isLoadingUpdate: true });
            const { data: resData } = await dispatchNoteService.updateDispatchNote(dispatchNoteId, data);
            set({ isLoadingUpdate: false });
            const { success } = useAlertReducer.getState();
            success(resData?.message ?? 'Dispatch note updated successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingUpdate: false });
            error(err?.response?.data?.message ?? err.message);
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

    printDispatchNote: async ({ dispatchNoteId, landingNoteId, cb }) => {
        try {
            set({ isLoadingPrint: true });
            const params = landingNoteId ? { landing_note_id: landingNoteId } : {};
            const response = await dispatchNoteService.printDispatchNote(dispatchNoteId, params);
            set({ isLoadingPrint: false });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            cb?.(url);
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingPrint: false });
            if (err?.response?.data instanceof Blob) {
                const text = await err.response.data.text();
                try { error(JSON.parse(text)?.message ?? 'Failed to print dispatch note'); }
                catch { error('Failed to print dispatch note'); }
            } else {
                error(err?.response?.data?.message ?? err.message);
            }
            cb?.(null);
        }
    },
}));

export default useDispatchNoteReducer;
