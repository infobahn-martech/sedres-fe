import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import crewImmigrationTemplateService from '../services/crewImmigrationTemplateService';

const useCrewImmigrationTemplateReducer = create((set) => ({
  isLoading: false,
  isBeingUpdated: false,
  templates: [],
  totalCount: 0,
  selectedTemplate: null,

  getTemplates: async ({ params } = {}) => {
    try {
      set({ isLoading: true });
      const { data } = await crewImmigrationTemplateService.getAll(params ?? {});
      set({
        templates: data?.data ?? [],
        totalCount: data?.pagination?.total ?? data?.pagination?.count ?? data?.total ?? data?.data?.length ?? 0,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, templates: [], totalCount: 0 });
      const { error } = useAlertReducer.getState();
      error(err?.response?.data?.message ?? err?.message);
    }
  },

  getTemplateById: async ({ templateId, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await crewImmigrationTemplateService.getById(templateId);
      set({ isBeingUpdated: false, selectedTemplate: data?.data ?? null });
      cb?.(data?.data ?? null);
    } catch (err) {
      set({ isBeingUpdated: false });
      const { error } = useAlertReducer.getState();
      error(err?.response?.data?.message ?? err?.message);
    }
  },

  createTemplate: async ({ formData, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await crewImmigrationTemplateService.create(formData);
      set({ isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Template created successfully');
      cb?.();
    } catch (err) {
      set({ isBeingUpdated: false });
      const { error } = useAlertReducer.getState();
      error(err?.response?.data?.message ?? err?.message);
    }
  },

  updateTemplate: async ({ formData, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await crewImmigrationTemplateService.update(formData);
      set({ isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Template updated successfully');
      cb?.();
    } catch (err) {
      set({ isBeingUpdated: false });
      const { error } = useAlertReducer.getState();
      error(err?.response?.data?.message ?? err?.message);
    }
  },

  deleteTemplate: async ({ templateId, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await crewImmigrationTemplateService.remove(templateId);
      set({ isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Template deleted successfully');
      cb?.();
    } catch (err) {
      set({ isBeingUpdated: false });
      const { error } = useAlertReducer.getState();
      error(err?.response?.data?.message ?? err?.message);
    }
  },
}));

export default useCrewImmigrationTemplateReducer;
