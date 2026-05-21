import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import packingTypeService from '../services/packingTypeService';

const usePackingTypeReducer = create((set) => ({
    isLoadingGet: false,
    isLoadingDelete: false,
    isBeingUpdated: false,
    errorMessage: '',
    successMessage: '',
    packingTypes: [],
    totalCount: 0,
    addPackingType: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const payload = { package_type: formData.package_type };
            const { data } = await packingTypeService.addPackingType(payload);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Packing type added successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong with adding a packing type',
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
    getPackingTypes: async (params) => {
        try {
            set({ isLoadingGet: true });
            const { data } = await packingTypeService.getPackingTypes({ params });
            set({
                packingTypes: data?.data ?? [],
                totalCount: data?.pagination?.total ?? 0,
                isLoadingGet: false,
            });
        } catch (err) {
            set({ errorMessage: err.message, isLoadingGet: false, packingTypes: [], totalCount: 0 });
        }
    },
    updatePackingType: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const payload = {
                package_type_id: formData.package_type_id,
                package_type: formData.package_type,
            };
            const { data } = await packingTypeService.updatePackingType(payload);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Packing type updated successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong updating the packing type',
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
    deletePackingType: async ({ id, cb } = {}) => {
        try {
            set({ isLoadingDelete: true });
            const { data } = await packingTypeService.deletePackingType(id);
            set({ successMessage: data?.message, isLoadingDelete: false });
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Packing type deleted successfully');
            cb?.();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong deleting the packing type',
                isLoadingDelete: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
}));

export default usePackingTypeReducer;
