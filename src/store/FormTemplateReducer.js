import { create } from 'zustand';
import formTemplateService from '../services/formTemplateService';
import useAlertReducer from './AlertReducer';

const useFormTemplateReducer = create((set) => ({
  isLoadingFieldTypes: false,
  fieldTypes: null,
  isSaving: false,

  getFieldTypes: async () => {
    try {
      set({ isLoadingFieldTypes: true });
      const { data } = await formTemplateService.getFieldTypes();
      set({ fieldTypes: data?.data ?? [], isLoadingFieldTypes: false });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ fieldTypes: [], isLoadingFieldTypes: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch field types');
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
