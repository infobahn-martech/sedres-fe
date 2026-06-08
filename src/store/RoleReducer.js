import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import roleService from '../services/roleService';

const useRoleReducer = create((set) => ({
    isLoading: false,
    errorMessage: '',
    successMessage: '',
    roles: null,
    totalRoleCount: null,
    isBeingUpdated: false,
    fetchRoles: async ({ params }) => {
        try {
            set({ isLoading: true });
            const { data } = await roleService.getRoles({ params });
            // Transform API response to match component expectations
            // API returns: { role_id, role, description, ... }
            // Component expects: { _id, name, description, ... }
            const transformedRoles = data?.data?.map((role) => ({
                _id: role.role_id,
                name: role.role,
                description: role.description || '',
                is_archived: role.is_archived ?? role.archived ?? false,
                created_by: role.created_by,
                created_date: role.created_date,
                updated_date: role.updated_date,
                updated_by: role.updated_by,
            })) || [];
            set({
                roles: transformedRoles,
                totalRoleCount: data.pagination?.total || 0,
                isLoading: false,
            });
        } catch (error) {
            const { error: showError } = useAlertReducer.getState();
            set({ errorMessage: error.message, isLoading: false });
            showError(error?.response?.data?.message ?? error.message);
        }
    },
    createRole: async ({ formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            // Transform form data: { roleName, description } -> { role, description }
            const payload = {
                role: formData.roleName,
                description: formData.description || '',
            };
            const { data } = await roleService.createRole(payload);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong creating the role',
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
    updateRole: async ({ id, formData, cb }) => {
        try {
            set({ isBeingUpdated: true });
            // Transform form data: { roleName, description } -> { role, description }
            const payload = {
                role: formData.roleName,
                description: formData.description || '',
            };
            const { data } = await roleService.updateRole(id, payload);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong updating the role',
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
    deleteRole: async ({ id, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data } = await roleService.deleteRole(id);
            set({ successMessage: data.message, isBeingUpdated: false });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({
                errorMessage: 'Something went wrong deleting the role',
                isBeingUpdated: false,
            });
            error(err?.response?.data?.message ?? err.message);
        }
    },
    archiveUnarchiveRole: async ({ role_id, cb }) => {
        try {
            set({ isBeingUpdated: true });
            const { data } = await roleService.archiveUnarchiveRole(role_id);
            const { success } = useAlertReducer.getState();
            success(data?.message ?? 'Role updated successfully');
            set({ isBeingUpdated: false });
            cb && cb();
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ errorMessage: 'Something went wrong', isBeingUpdated: false });
            error(err?.response?.data?.message ?? err.message);
        }
    },
}));

export default useRoleReducer;
