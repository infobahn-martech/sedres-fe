import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import inboundOrderService from '../services/inboundOrderService';

const useInboundOrderReducer = create((set) => ({
    isLoadingSave: false,
    isLoadingList: false,
    isLoadingView: false,
    isBeingUpdated: false,
    isLoadingDelete: false,
    isBeingConverted: false,
    inboundOrders: [],
    inboundTotal: 0,
    inboundDetail: null,

    saveInboundOrder: async ({ data, cb }) => {
        try {
            set({ isLoadingSave: true });
            const { data: resData } = await inboundOrderService.saveInboundOrder(data);
            set({ isLoadingSave: false });
            const { success } = useAlertReducer.getState();
            success(resData?.message ?? 'Inbound order saved successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingSave: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    getAllInbound: async (params) => {
        try {
            set({ isLoadingList: true });
            const { data } = await inboundOrderService.getAllInbound(params);
            set({
                inboundOrders: data?.data ?? [],
                inboundTotal: data?.pagination?.total ?? 0,
                isLoadingList: false,
            });
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingList: false, inboundOrders: [], inboundTotal: 0 });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    getInboundById: async ({ inboundId }) => {
        try {
            set({ isLoadingView: true, inboundDetail: null });
            const { data } = await inboundOrderService.getInboundById(inboundId);
            set({ inboundDetail: data?.data ?? null, isLoadingView: false });
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingView: false, inboundDetail: null });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    updateInboundOrder: async ({ inboundId, data, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data: resData } = await inboundOrderService.updateInboundOrder(inboundId, data);
            set({ isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(resData?.message ?? 'Inbound order updated successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isBeingUpdated: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    deleteInboundOrder: async ({ inboundId, cb }) => {
        try {
            set({ isLoadingDelete: true });
            const { data: resData } = await inboundOrderService.deleteInboundOrder(inboundId);
            set({ isLoadingDelete: false });
            const { success } = useAlertReducer.getState();
            success(resData?.message ?? 'Inbound order deleted successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingDelete: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    convertInboundToLandingNote: async ({ data, cb }) => {
        try {
            set({ isBeingConverted: true });
            const { data: resData } = await inboundOrderService.convertInboundToLandingNote(data);
            set({ isBeingConverted: false });
            const { success } = useAlertReducer.getState();
            success(resData?.message ?? 'Inbound converted to landing note successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isBeingConverted: false });
            error(err?.response?.data?.message ?? 'Failed to convert inbound to landing note');
        }
    },

    clearInboundDetail: () => set({ inboundDetail: null }),
}));

export default useInboundOrderReducer;
