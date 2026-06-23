import { create } from "zustand";
import useAlertReducer from "./AlertReducer";
import taskManagementService from "../services/taskManagementService";

const normalizeTaskList = (data) =>
  Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.task_list)
      ? data.task_list
      : Array.isArray(data?.tasks)
        ? data.tasks
        : Array.isArray(data)
          ? data
          : [];

const useTaskManagementReducer = create((set) => ({
  isLoadingGet: false,
  isBeingUpdated: false,
  isLoadingDelete: false,
  taskManagement: [],
  totalCount: 0,
  errorMessage: "",

  getTaskManagement: async () => {
    try {
      set({ isLoadingGet: true });
      const { data } = await taskManagementService.getAllTaskLists();
      const list = normalizeTaskList(data);
      set({
        taskManagement: list,
        totalCount:
          data?.total ??
          data?.pagination?.total ??
          data?.meta?.total ??
          list.length,
        isLoadingGet: false,
      });
    } catch (err) {
      set({
        isLoadingGet: false,
        errorMessage: err?.message ?? "Failed to fetch tasks",
        taskManagement: [],
        totalCount: 0,
      });
    }
  },

  addTaskManagement: async ({ formData, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const { data } = await taskManagementService.createTaskList({
        task_name: formData?.task_name,
        call_type_id: formData?.call_type_id,
        port_id: formData?.port_id,
      });
      set({ isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? "Task saved successfully");
      cb?.();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ isBeingUpdated: false });
      error(err?.response?.data?.message ?? err.message);
    }
  },

  updateTaskManagement: async ({ formData, cb }) => {
    try {
      set({ isBeingUpdated: true });
      const taskId = formData?.task_id ?? formData?._id;
      const { data } = await taskManagementService.updateTaskList(taskId, {
        task_name: formData?.task_name,
        call_type_id: formData?.call_type_id,
        port_id: formData?.port_id,
      });
      set({ isBeingUpdated: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? "Task updated successfully");
      cb?.();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ isBeingUpdated: false });
      error(err?.response?.data?.message ?? err.message);
    }
  },

  deleteTaskManagement: async ({ taskId, cb }) => {
    try {
      set({ isLoadingDelete: true });
      const { data } = await taskManagementService.deleteTaskList(taskId);
      set({ isLoadingDelete: false });
      const { success } = useAlertReducer.getState();
      success(data?.message ?? "Task deleted successfully");
      cb?.();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({ isLoadingDelete: false });
      error(err?.response?.data?.message ?? err.message);
    }
  },
}));

export default useTaskManagementReducer;
