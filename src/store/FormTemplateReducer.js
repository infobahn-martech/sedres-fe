import { create } from 'zustand';
import formTemplateService from '../services/formTemplateService';
import useAlertReducer from './AlertReducer';

const useFormTemplateReducer = create((set) => ({
  isLoadingFieldTypes: false,
  fieldTypes: null,
  isLoadingCallTypes: false,
  callTypes: null,
  isLoadingTemplates: false,
  templates: null,
  isLoadingTemplateDetail: false,
  isSaving: false,

  getFieldTypes: async () => {
    try {
      set({ isLoadingFieldTypes: true });
      const { data } = await formTemplateService.getFieldTypes();
      set({ fieldTypes: data?.data ?? [], isLoadingFieldTypes: false });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      // Leave fieldTypes as null (rather than []) on failure so the next mount
      // retries instead of getting stuck with a permanently empty type list.
      set({ isLoadingFieldTypes: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch field types');
    }
  },

  getCallTypes: async () => {
    try {
      set({ isLoadingCallTypes: true });
      const { data } = await formTemplateService.getCallTypes();
      set({ callTypes: data?.data ?? [], isLoadingCallTypes: false });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ callTypes: [], isLoadingCallTypes: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch call types');
    }
  },

  getTemplateList: async (params) => {
    try {
      set({ isLoadingTemplates: true });
      const { data } = await formTemplateService.getTemplateList(params);
      set({ templates: data?.data ?? [], isLoadingTemplates: false });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      // Leave templates as null (rather than []) on failure so the next mount retries.
      set({ isLoadingTemplates: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch templates');
    }
  },

  getTemplateById: async ({ templateId, cb }) => {
    try {
      set({ isLoadingTemplateDetail: true });
      const { data } = await formTemplateService.getTemplateById(templateId);
      set({ isLoadingTemplateDetail: false });
      cb?.(data?.data ?? null);
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ isLoadingTemplateDetail: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch template');
    }
  },

  saveCardTemplate: async ({ payload, cb }) => {
    try {
      set({ isSaving: true });
      const { data } = await formTemplateService.saveCardTemplate(payload);
      const { success } = useAlertReducer.getState();
      success(data?.message ?? (payload.template_id ? 'Custom template updated successfully' : 'Custom template saved successfully'));
      set({ isSaving: false });
      cb?.(data);
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ isSaving: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to save custom template');
    }
  },
}));

export default useFormTemplateReducer;
