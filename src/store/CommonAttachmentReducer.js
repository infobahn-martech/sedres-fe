import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import commonAttachmentService from '../services/commonAttachmentService';

const useCommonAttachmentReducer = create((set) => ({
  isLoading: false,
  isBeingUpdated: false,
  attachments: [],
  totalCount: 0,

  getAttachments: async ({ params } = {}) => {
    try {
      set({ isLoading: true });
      const { data } = await commonAttachmentService.getAll(params ?? {});
      set({
        attachments: Array.isArray(data?.data) ? data.data : [],
        totalCount: data?.pagination?.total ?? data?.total ?? data?.data?.length ?? 0,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, attachments: [], totalCount: 0 });
      const { error } = useAlertReducer.getState();
      error(err?.response?.data?.message ?? err?.message);
    }
  },

  createAttachment: async ({ formData, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await commonAttachmentService.create(formData);
      set({ isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Attachment added successfully');
      cb?.();
    } catch (err) {
      set({ isBeingUpdated: false });
      const { error } = useAlertReducer.getState();
      error(err?.response?.data?.message ?? err?.message);
    }
  },

  updateAttachment: async ({ formData, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await commonAttachmentService.update(formData);
      set({ isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Attachment updated successfully');
      cb?.();
    } catch (err) {
      set({ isBeingUpdated: false });
      const { error } = useAlertReducer.getState();
      error(err?.response?.data?.message ?? err?.message);
    }
  },
}));

export default useCommonAttachmentReducer;
