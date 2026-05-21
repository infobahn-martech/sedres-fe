import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import materialTypeService from '../services/materialTypeService';

const useMaterialTypeReducer = create((set) => ({
    isLoadingGet: false,
    isLoadingDelete: false,
    isBeingUpdated: false,
    errorMessage: '',
    successMessage: '',
    materialTypes: [],
    totalCount: 0,
    addMaterialType: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data } = await materialTypeService.addMaterialType(formData);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong with adding a material type',
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
    getMaterialTypes: async (params) => {
        try {
            set({ isLoadingGet: true });
            const { data } = await materialTypeService.getMaterialTypes({ params });
            set({
                materialTypes: data?.data ?? [],
                totalCount: data?.pagination?.total ?? data?.total ?? 0,
                isLoadingGet: false,
            });
        } catch (err) {
            set({ errorMessage: err.message, isLoadingGet: false, materialTypes: [], totalCount: 0 });
        }
    },
    updateMaterialType: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data } = await materialTypeService.updateMaterialType(formData);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong updating the material type',
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
    deleteData: async (material_type_id) => {
        try {
            set({ isLoadingDelete: true });
            const { data } = await materialTypeService.deleteMaterialType(material_type_id);
            set({ successMessage: data?.message, isLoadingDelete: false });
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Material type deleted successfully');
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong deleting the material type',
                isLoadingDelete: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
}));

export default useMaterialTypeReducer;
