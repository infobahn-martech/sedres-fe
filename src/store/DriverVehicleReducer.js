import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import driverVehicleMappingService from '../services/driverVehicleService';

const useDriverVehicleMappingReducer = create((set) => ({
  isLoading: false,
  errorMessage: '',
  successMessage: '',
  driverVehicleMappingData: [],
  isBeingUpdated: false,
  totalDriverVehicleMappingCount: 0,
  addDriverVehicleMapping: async ({ formData, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await driverVehicleMappingService.addDriverVehicleMappingData(formData);
      set({ successMessage: data.message, isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong with adding a driver vehicle mapping',
        isBeingUpdated: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  getDriverVehicleMappingData: async ({ params, type }) => {
    try {
      set({ isLoading: true });
      const { data } = await driverVehicleMappingService.getDriverVehicleMappingData({ params, type });
      set({
        driverVehicleMappingData: data?.data ?? [],
        totalDriverVehicleMappingCount: data?.pagination?.total ?? 0,
        isLoading: false,
      });
    } catch (error) {
      set({ errorMessage: error.message, isLoading: false, driverVehicleMappingData: [], totalDriverVehicleMappingCount: 0 });
    }
  },
  updateDriverVehicleMapping: async ({ formData, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await driverVehicleMappingService.updateDriverVehicleMappingData(formData);
      set({ successMessage: data.message, isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong updating the driver vehicle mapping ',
        isBeingUpdated: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  deleteDriverVehicleMapping: async (payload) => {
    const { driverVehicleMapping_id, cb } = payload || {};
    try {
      set({ isBeingUpdated: true });
      const { data } = await driverVehicleMappingService.deleteDriverVehicleMappingData(driverVehicleMapping_id);
      set({ successMessage: data?.message, isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Driver vehicle mapping deleted successfully');
      cb?.();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong deleting the driver vehicle mapping',
        isBeingUpdated: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
}));

export default useDriverVehicleMappingReducer;
