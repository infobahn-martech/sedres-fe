import Gateway from "../../gateway/gateway";

const assignTask = (payload) => Gateway.post("task_card/assign_task", payload);

const taskCardService = {
  assignTask,
};

export default taskCardService;
