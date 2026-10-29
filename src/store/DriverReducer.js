import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import driverService from '../services/driverService';

const useDriverReducer = create((set) => ({
    drivers: null,
    countries: null,
    isLoading: false,
    isLoadingCountries: false,
    isLoadingDetail: false,
    isBeingUpdated: false,
    isDeleteLoading: false,
    errorMessage: '',
    totalCount: null,

    fetchAllDrivers: async ({ params, cb } = {}) => {
        try {
            set({ isLoading: true });
            const { data } = await driverService.getAllDrivers(params || {});
            set({
                drivers: data?.data ?? [],
                totalCount: data?.pagination?.total ?? (Array.isArray(data?.data) ? data.data.length : (Array.isArray(data) ? data.length : 0)),
                isLoading: false,
            });
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isLoading: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    fetchDriverDetail: async (id) => {
        try {
            set({ isLoadingDetail: true });
            const { data } = await driverService.getDriverDetail(id);
            set({ isLoadingDetail: false });
            return data?.data ?? null;
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isLoadingDetail: false,
            });
            error(err?.response?.data?.message ?? err.message);
            return null;
        }
    },

    fetchAllCountries: async () => {
        try {
            set({ isLoadingCountries: true, countries: null });
            const { data } = await driverService.getAllCountries();
            set({
                countries: data?.data ?? data ?? [],
                isLoadingCountries: false,
            });
            return data?.data ?? data ?? [];
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isLoadingCountries: false,
            });
            error(err?.response?.data?.message ?? err.message);
            return [];
        }
    },

    addDriver: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data } = await driverService.addDriver(formData);
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Driver added successfully');
            set({ isBeingUpdated: false });
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    updateDriver: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data } = await driverService.updateDriver(formData);
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Driver updated successfully');
            set({ isBeingUpdated: false });
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },

    deleteDriver: async ({ id, cb }) => {
        try {
            set({ isDeleteLoading: true });
            const { data } = await driverService.deleteDriver(id);
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Driver deleted successfully');
            set({ isDeleteLoading: false });
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isDeleteLoading: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
}));

export default useDriverReducer;
