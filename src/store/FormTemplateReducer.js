import { create } from 'zustand';
import formTemplateService from '../services/formTemplateService';
import useAlertReducer from './AlertReducer';

const useFormTemplateReducer = create((set) => ({
  isLoadingFieldTypes: false,
  fieldTypes: null,
  isLoadingMasterLookups: false,
  masterLookups: null,
  isLoadingSystemBindings: false,
  systemBindings: null,
  isLoadingCallTypes: false,
  callTypes: null,
  isLoadingTemplates: false,
  templates: null,
  isLoadingAllTemplates: false,
  allTemplates: null,
  isLoadingTemplateDetail: false,
  isLoadingTemplateFirstTab: false,
  isSaving: false,
  isDeleting: false,

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

  getMasterLookups: async () => {
    try {
      set({ isLoadingMasterLookups: true });
      const { data } = await formTemplateService.getMasterLookups();
      set({ masterLookups: data?.data ?? [], isLoadingMasterLookups: false });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      // Leave masterLookups as null on failure so the next mount retries.
      set({ isLoadingMasterLookups: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch master modules');
    }
  },

  getSystemBindings: async () => {
    try {
      set({ isLoadingSystemBindings: true });
      const { data } = await formTemplateService.getSystemBindings();
      set({ systemBindings: data?.data ?? [], isLoadingSystemBindings: false });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      // Fall back to [] so the builder (which waits on this) still opens.
      set({ systemBindings: [], isLoadingSystemBindings: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch default fields');
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

  getAllTemplates: async () => {
    try {
      set({ isLoadingAllTemplates: true });
      const { data } = await formTemplateService.getAllTemplates();
      set({ allTemplates: data?.data ?? [], isLoadingAllTemplates: false });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      // Leave allTemplates as null on failure so the next open retries.
      set({ isLoadingAllTemplates: false });
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

  getTemplateFirstTab: async ({ templateId, payload, cb }) => {
    try {
      set({ isLoadingTemplateFirstTab: true });
      const { data } = await formTemplateService.getTemplateFirstTab(templateId, payload);
      set({ isLoadingTemplateFirstTab: false });
      cb?.(data?.data ?? null);
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ isLoadingTemplateFirstTab: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch template fields');
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

  deleteTemplate: async ({ templateId, cb }) => {
    try {
      set({ isDeleting: true });
      const { data } = await formTemplateService.deleteTemplate(templateId);
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Custom template deleted successfully');
      set({ isDeleting: false });
      cb?.(data);
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ isDeleting: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to delete custom template');
    }
  },
}));

export default useFormTemplateReducer;
