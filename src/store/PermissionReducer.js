import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import permissionService from '../services/permissionService';

const usePermissionReducer = create((set) => ({
  isLoading: false,
  errorMessage: '',
  successMessage: '',
  designations: null,
  isBeingUpdated: false,
  totalDesignationCount: null,
  permissionsList: null,
  isLoadingPermissions: false,
  rolePermissionData: null,
  isLoadingRolePermission: false,
  fetchPermission: async ({ params }) => {
    try {
      set({ isLoading: true });
      const { data } = await permissionService.fetchPermission({ params });
      set({
        designations: data?.data,
        totalDesignationCount: data?.pagination?.total,
        isLoading: false,
      });
    } catch (error) {
      set({ errorMessage: error.message, isLoading: false });
    }
  },
  assignRolePermission: async ({ role, description, permission_id, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await permissionService.assignRolePermission({
        role,
        description,
        permission_id,
      });
      set({ successMessage: data.message, isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
      return data;
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong assigning role permissions',
        isBeingUpdated: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  updateRolePermission: async ({
    role_id,
    role,
    description,
    permission_id,
    cb,
  }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await permissionService.updateRolePermission({
        role_id,
        role,
        description,
        permission_id,
      });
      set({ successMessage: data.message, isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
      return data;
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong updating role permissions',
        isBeingUpdated: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  deletePermission: async ({ id, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await permissionService.deletePermission(id);
      set({ successMessage: data.message, isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong deleting the permission',
        isBeingUpdated: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  archiveUnarchiveRole: async ({ roleId, isArchiving, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await permissionService.archiveUnarchiveRole(roleId);
      const newStatus = isArchiving ? '2' : '1';
      set((state) => ({
        isBeingUpdated: false,
        designations: (state.designations || []).map((r) =>
          String(r.role_id) === String(roleId) ? { ...r, status: newStatus } : r
        ),
      }));
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Role updated successfully');
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ isBeingUpdated: false });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  fetchPermissionsList: async () => {
    try {
      set({ isLoadingPermissions: true });
      const { data } = await permissionService.getPermissions();
      set({
        permissionsList: data?.data || [],
        isLoadingPermissions: false,
      });
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong fetching permissions',
        isLoadingPermissions: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  fetchRolePermission: async ({ role_id }) => {
    try {
      set({ isLoadingRolePermission: true });
      const { data } = await permissionService.getRolePermission({ role_id });
      set({
        rolePermissionData: data || null,
        isLoadingRolePermission: false,
      });
      return { data: data || null };
    } catch (err) {
      console.log(err);
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong fetching role permissions',
        isLoadingRolePermission: false,
      });
      error(err?.response?.data?.message ?? err.message);
      return { data: null };
    }
  },
}));

export default usePermissionReducer;
