import Gateway from "../gateway/gateway";

const createTaskList = (payload) =>
  Gateway.post("/task_list/create_task_list", payload);

const getAllTaskLists = () => Gateway.get("/task_list");

const getTaskListById = (taskId) =>
  Gateway.get(`/task_list/${encodeURIComponent(String(taskId))}`);

const updateTaskList = (taskId, payload) =>
  Gateway.post(
    `/task_list/update_task_list/${encodeURIComponent(String(taskId))}`,
    payload
  );

const deleteTaskList = (taskId) =>
  Gateway.delete(`/task_list/delete_task_list/${encodeURIComponent(String(taskId))}`);

export default {
  createTaskList,
  getAllTaskLists,
  getTaskListById,
  updateTaskList,
  deleteTaskList,
};
