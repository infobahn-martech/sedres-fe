import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import callTypeService from '../services/callTypeService';

const useCallTypeReducer = create((set) => ({
    isLoadingGet: false,
    isLoadingDelete: false,
    isBeingUpdated: false,
    errorMessage: '',
    successMessage: '',
    callTypes: [],
    totalCount: 0,

    getCallTypes: async (params) => {
        try {
            set({ isLoadingGet: true });
            const { data } = await callTypeService.getCallTypes({ params });
            set({
                callTypes: data?.data ?? [],
                totalCount: data?.pagination?.total ?? data?.total ?? 0,
                isLoadingGet: false,
            });
        } catch (err) {
            set({ errorMessage: err.message, isLoadingGet: false, callTypes: [], totalCount: 0 });
        }
    },

    addCallType: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data } = await callTypeService.addCallType(formData);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Call type added successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ errorMessage: 'Something went wrong adding the call type', isBeingUpdated: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    updateCallType: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data } = await callTypeService.updateCallType(formData);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Call type updated successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ errorMessage: 'Something went wrong updating the call type', isBeingUpdated: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    deleteCallType: async (id) => {
        try {
            set({ isLoadingDelete: true });
            const { data } = await callTypeService.deleteCallType(id);
            set({ successMessage: data?.message, isLoadingDelete: false });
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Call type deleted successfully');
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ errorMessage: 'Something went wrong deleting the call type', isLoadingDelete: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },
}));

export default useCallTypeReducer;
