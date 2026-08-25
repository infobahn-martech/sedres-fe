import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import PreArrivalInfoService from '../services/preArrivalInfoService';

const usePreArrivalInfoReducer = create((set) => ({
  isLoading: false,
  addEditLoader: false,
  errorMessage: '',
  preArrivalTemplates: [],
  templateCount: 0,
  templateUserTypes: [],

  getTemplates: async ({ params } = {}) => {
    try {
      set({ isLoading: true });
      const { data } = await PreArrivalInfoService.getAllTemplates(params || {});
      const list = data?.data ?? data ?? [];
      const items = Array.isArray(list) ? list : [];
      set({
        preArrivalTemplates: items,
        templateCount: data?.totalCount ?? items.length,
        isLoading: false,
      });
    } catch (error) {
      set({
        errorMessage: error?.response?.data?.message ?? error?.message ?? 'Failed to fetch templates',
        preArrivalTemplates: [],
        templateCount: 0,
        isLoading: false,
      });
    }
  },

  getTemplateUserTypes: async () => {
    try {
      const { data } = await PreArrivalInfoService.getTemplateUserTypes();
      const list = data?.data ?? data ?? [];
      set({ templateUserTypes: Array.isArray(list) ? list : [] });
    } catch {
      set({ templateUserTypes: [] });
    }
  },

  addTemplate: async ({ payload, cb }) => {
    try {
      set({ addEditLoader: true });
      const { data } = await PreArrivalInfoService.addTemplate(payload);
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Template added successfully');
      set({ addEditLoader: false });
      cb?.();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ addEditLoader: false });
      error(err?.response?.data?.message ?? err?.message ?? 'Failed to add template');
    }
  },

  updateTemplate: async ({ templateId, payload, cb }) => {
    try {
      set({ addEditLoader: true });
      const { data } = await PreArrivalInfoService.updateTemplate(templateId, payload);
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Template updated successfully');
      set({ addEditLoader: false });
      cb?.();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ addEditLoader: false });
      error(err?.response?.data?.message ?? err?.message ?? 'Failed to update template');
    }
  },
}));

export default usePreArrivalInfoReducer;
