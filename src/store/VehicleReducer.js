import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import vehicleService from '../services/vehicleService';

const useVehicleReducer = create((set) => ({
  isLoading: false,
  errorMessage: '',
  successMessage: '',
  vehicles: [],
  isBeingUpdated: false,
  isDeleteLoading: false,
  totalCount: 0,
  // `type` is "transport" (default) or "material".
  addVehicle: async ({ formData, cb, type }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await vehicleService.addVehicle(formData, type);
      set({ successMessage: data.message, isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong with adding a vehicle',
        isBeingUpdated: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  getVehicles: async ({ params, type }) => {
    try {
      set({ isLoading: true });
      const { data } = await vehicleService.fetchVehicles({ params, type });
      set({
        vehicles: data?.data ?? [],
        totalCount: data?.pagination?.total ?? 0,
        isLoading: false,
      });
    } catch (error) {
      set({ errorMessage: error.message, isLoading: false, vehicles: [], totalCount: 0 });
    }
  },
  // Dropdown source: `/transport/all_vehicle_types?vehicle_purpose=...`.
  getVehicleTypes: async ({ type }) => {
    try {
      set({ isLoading: true });
      const { data } = await vehicleService.fetchVehicleTypes({ type });
      set({ vehicles: data?.data ?? [], isLoading: false });
    } catch (error) {
      set({ errorMessage: error.message, isLoading: false, vehicles: [] });
    }
  },
  updateVehicle: async ({ formData, cb, type }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await vehicleService.updateVehicle(formData, type);
      set({ successMessage: data.message, isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong updating the vehicle',
        isBeingUpdated: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  deleteVehicle: async ({ id, cb }) => {
    try {
      set({ isDeleteLoading: true });
      const { data } = await vehicleService.deleteVehicle(id);
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Vehicle type deleted successfully');
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

export default useVehicleReducer;
