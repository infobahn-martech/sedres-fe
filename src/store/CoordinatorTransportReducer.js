import { create } from 'zustand';
import transportContentService from '../services/transportContentService';
import transportCompanyService from '../services/transportCompanyService';
import vehicleService from '../services/vehicleService';

const extractListEnvelope = (response) => {
  const payload = response?.data?.data ?? response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const extractObjectEnvelope = (response) => {
  const payload = response?.data?.data ?? null;
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
};

const useCoordinatorTransportReducer = create((set) => ({
  cardDetail: null,
  loadingCardDetail: false,
  transportRequestDetail: null,
  loadingTransportRequestDetail: false,
  transportCompanies: [],
  loadingCompanies: false,
  vehicleTypes: [],
  loadingVehicleTypes: false,
  inhouseDrivers: [],
  loadingInhouseDrivers: false,
  invoiceBranches: [],
  loadingInvoiceBranches: false,
  isSavingTransport: false,

  fetchCardDetail: async (cardId) => {
    if (!cardId) {
      set({ cardDetail: null, loadingCardDetail: false });
      return;
    }
    set({ cardDetail: null, loadingCardDetail: true });
    try {
      const response = await transportContentService.getTransportRequestCardDetail(cardId);
      set({ cardDetail: extractObjectEnvelope(response), loadingCardDetail: false });
    } catch {
      set({ cardDetail: null, loadingCardDetail: false });
    }
  },

  fetchTransportRequestDetail: async (transportRequestId) => {
    if (!transportRequestId) {
      set({ transportRequestDetail: null, loadingTransportRequestDetail: false });
      return;
    }
    set({ loadingTransportRequestDetail: true });
    try {
      const response = await transportContentService.getTransportRequestDetail(transportRequestId);
      set({
        transportRequestDetail: extractObjectEnvelope(response),
        loadingTransportRequestDetail: false,
      });
    } catch {
      set({ transportRequestDetail: null, loadingTransportRequestDetail: false });
    }
  },

  fetchTransportCompanies: async () => {
    set({ loadingCompanies: true });
    try {
      const response = await transportCompanyService.getTransportCompanyData();
      set({ transportCompanies: extractListEnvelope(response), loadingCompanies: false });
    } catch {
      set({ transportCompanies: [], loadingCompanies: false });
    }
  },

  fetchVehicleTypes: async () => {
    set({ loadingVehicleTypes: true });
    try {
      const response = await vehicleService.getAllTransportVehicles();
      set({ vehicleTypes: extractListEnvelope(response), loadingVehicleTypes: false });
    } catch {
      set({ vehicleTypes: [], loadingVehicleTypes: false });
    }
  },

  fetchInhouseDrivers: async (vehicleTypeId) => {
    if (!vehicleTypeId) {
      set({ inhouseDrivers: [] });
      return;
    }
    set({ loadingInhouseDrivers: true });
    try {
      const response = await vehicleService.getDriversByVehicleType(vehicleTypeId);
      set({ inhouseDrivers: extractListEnvelope(response), loadingInhouseDrivers: false });
    } catch {
      set({ inhouseDrivers: [], loadingInhouseDrivers: false });
    }
  },

  fetchInvoiceBranches: async () => {
    set({ loadingInvoiceBranches: true });
    try {
      const response = await transportContentService.getAllInvoiceBranches();
      set({ invoiceBranches: extractListEnvelope(response), loadingInvoiceBranches: false });
    } catch {
      set({ invoiceBranches: [], loadingInvoiceBranches: false });
    }
  },

  createTransportRequest: async (formData) => {
    set({ isSavingTransport: true });
    try {
      const response = await transportContentService.createTransportRequest(formData);
      set({ isSavingTransport: false });
      return response;
    } catch (err) {
      set({ isSavingTransport: false });
      throw err;
    }
  },

  updateTransportRequestDetail: async (formData) => {
    set({ isSavingTransport: true });
    try {
      const response = await transportContentService.updateTransportRequestDetail(formData);
      set({ isSavingTransport: false });
      return response;
    } catch (err) {
      set({ isSavingTransport: false });
      throw err;
    }
  },
}));

export default useCoordinatorTransportReducer;
