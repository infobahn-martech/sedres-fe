import { create } from 'zustand';
import userService from '../services/userService';
import useAlertReducer from './AlertReducer';

const useUserReducer = create((set) => ({
  isLoading: false,
  errorMessage: '',
  successMessage: '',
  users: null,
  userCount: null,
  addEditLoader: false,
  userPermissions: null,
  isLoadingPermissions: false,
  isUpdatingUserPermission: false,
  isArchiving: false,
  isUnarchiving: false,
  createUser: async ({ formData, cb }) => {
    try {
      set({ addEditLoader: true });
      const { data } = await userService.createUser(formData);
      set({ successMessage: data.message, addEditLoader: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ errorMessage: 'Something went wrong fetching user', addEditLoader: false });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  getUsers: async ({ params }) => {
    try {
      set({ isLoading: true });
      const { data } = await userService.getUsers({ params });
      set({
        users: data?.data || [],
        userCount: data?.pagination?.total || 0,
        isLoading: false
      });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ errorMessage: error.message, isLoading: false });
      showError(error?.response?.data?.message ?? error.message);
    }
  },
  updateUser: async ({ id, formData, cb }) => {
    try {
      set({ addEditLoader: true });
      const { data } = await userService.updateUser(id, formData);
      set({ successMessage: data.message, addEditLoader: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ errorMessage: 'Something went wrong fetching user', addEditLoader: false });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  getUserPermissions: async ({ userId }) => {
    try {
      set({ isLoadingPermissions: true });
      const { data } = await userService.getUserPermissions(userId);
      set({
        userPermissions: data?.data || [],
        isLoadingPermissions: false
      });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({
        userPermissions: [],
        isLoadingPermissions: false
      });
      showError(error?.response?.data?.message ?? error.message);
    }
  },
  updateUserPermission: async ({ user_id, permissions, cb }) => {
    try {
      set({ isUpdatingUserPermission: true });
      const { data } = await userService.updateUserPermission({ user_id, permissions });
      set({ isUpdatingUserPermission: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ isUpdatingUserPermission: false });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  activateUser: async ({ user_id, cb }) => {
    try {
      set({ isLoading: true });
      const { data } = await userService.activateUser(user_id);
      set({ successMessage: data.message, isLoading: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong activating user',
        isLoading: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  archiveUser: async ({ user_id, cb }) => {
    try {
      set({ isArchiving: true });
      const { data } = await userService.archiveUser(user_id);
      set({ successMessage: data.message, isArchiving: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong archiving user',
        isArchiving: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  unarchiveUser: async ({ user_id, cb }) => {
    try {
      set({ isUnarchiving: true });
      const { data } = await userService.unarchiveUser(user_id);
      set({ successMessage: data.message, isUnarchiving: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong unarchiving user',
        isUnarchiving: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
}));

export default useUserReducer;
