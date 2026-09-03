import { create } from 'zustand';
import useAlertReducer from './AlertReducer';
import workflowService from '../services/workflowService';
import { normalizeWorkflowData } from '../pages/EditWorkflows/workflow.utils';

const useWorkFlowReducer = create((set, get) => ({
    isLoading: false,
    errorMessage: '',
    workflows: null,

    boardStructure: [],
    isLoadingBoardStructure: false,

    // Raw (un-normalized) workflows for a board — used by the Board Minimap picker,
    // which needs each workflow's actual stage/column layout rather than the Edit
    // Workflows editor's 4-area bucket model that `getWorkflowByBoard` normalizes into.
    getBoardStructure: async ({ boardId, silent = false }) => {
        try {
            if (!silent) {
                set({ isLoadingBoardStructure: true });
            }
            const { data } = await workflowService.getWorkflowByBoard(boardId);
            const source = data?.status === 'success' ? data?.data : data;
            const list = Array.isArray(source) ? source : source ? [source] : [];
            set({
                boardStructure: list,
                isLoadingBoardStructure: false,
            });
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isLoadingBoardStructure: false,
                boardStructure: silent ? get().boardStructure : [],
            });
        }
    },

    getWorkflowByBoard: async ({ boardId, silent = false }) => {
        try {
            if (!silent) {
                set({ isLoading: true });
            }
            const { data } = await workflowService.getWorkflowByBoard(boardId);
            const transformed = normalizeWorkflowData(data);
            set({
                workflows: transformed,
                isLoading: false,
            });
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
                isLoading: false,
                workflows: silent ? get().workflows : [],
            });
            if (!silent) {
                // List load failures are surfaced on Edit Workflows (empty state), not as a toast.
            }
        }
    },

    renameWorkflow: async ({ workflow_id, workflow_name, cb, onSettled }) => {
        try {
            const payload = {
                workflow_id,
                workflow_name,
            };
            const { data } = await workflowService.renameWorkflow(workflow_id, payload);
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    deleteWorkflow: async ({ workflow_id, cb, onSettled }) => {
        try {
            const { data } = await workflowService.deleteWorkflow(workflow_id);
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    disableWorkflow: async ({ workflow_id, cb, onSettled }) => {
        try {
            const { data } = await workflowService.disableWorkflow(workflow_id);
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb(data);
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    createWorkflow: async ({ board_id, workflow_name, role_id, port_id, call_type_id, entity_id, cb, onSettled }) => {
        try {
            const { data } = await workflowService.createWorkflow({
                board_id,
                workflow_name,
                role_id: role_id ?? '',
                port_id,
                call_type_id,
                entity_id,
            });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    createSwimlane: async ({ workflow_id, swimlane_name, cb, onSettled }) => {
        try {
            const { data } = await workflowService.createSwimlane({ workflow_id, swimlane_name });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    getSwimlaneByWorkflow: async ({ workflow_id }) => {
        try {
            const { data } = await workflowService.getSwimlaneByWorkflow(workflow_id);
            return data;
        } catch (err) {
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
            throw err;
        }
    },

    renameSwimlane: async ({ swimlane_id, swimlane_name, cb, onSettled }) => {
        try {
            const { data } = await workflowService.renameSwimlane({ swimlane_id, swimlane_name });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    deleteSwimlane: async ({ swimlane_id, cb, onSettled }) => {
        try {
            const { data } = await workflowService.deleteSwimlane({ swimlane_id });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    updateSwimlaneColor: async ({ swimlane_id, color_code, cb, onSettled }) => {
        try {
            const { data } = await workflowService.updateSwimlaneColor(swimlane_id, { color_code });
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    createWorkflowColumn: async ({ body, cb, onSettled }) => {
        try {
            const { data } = await workflowService.createWorkflowColumn(body);
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    renameWorkflowColumn: async ({ column_id, column_name, cb, onSettled }) => {
        try {
            const payload = { column_id, column_name };
            const { data } = await workflowService.renameWorkflowColumn(column_id, payload);
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    updateWorkflowColumn: async ({ column_id, cards_per_row, background_color, cb, onSettled }) => {
        try {
            const payload = {};
            if (cards_per_row !== undefined && cards_per_row !== null) {
                payload.cards_per_row = cards_per_row;
            }
            if (background_color !== undefined && background_color !== null && background_color !== '') {
                payload.background_color = background_color;
            }
            const { data } = await workflowService.updateWorkflowColumn(column_id, payload);
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    removeWorkflowColumn: async ({ column_id, cb, onSettled }) => {
        try {
            const { data } = await workflowService.removeWorkflowColumn(column_id);
            const { success } = useAlertReducer.getState();
            success(data && data.message);
            cb && cb();
        } catch (err) {
            set({
                errorMessage: err?.response?.data?.message ?? err.message,
            });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },
}));

export default useWorkFlowReducer;
