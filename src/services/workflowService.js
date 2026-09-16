import Gateway from '../gateway/gateway';

const getWorkflowByBoard = (boardId) =>
    Gateway.get(`/kanban_workflow/get_workflow_by_board/${boardId}`);

const renameWorkflow = (workflowId, data) =>
    Gateway.post(`/kanban_workflow/rename_workflow/${workflowId}`, data);

const deleteWorkflow = (workflowId) =>
    Gateway.post(`/kanban_workflow/delete_workflow/${workflowId}`, { workflow_id: workflowId });

const disableWorkflow = (workflowId) =>
    Gateway.post(`/kanban_workflow/enable_disable_workflow/${workflowId}`, { workflow_id: workflowId });

const togglePinWorkflow = (workflowId) =>
    Gateway.post(`/kanban_workflow/toggle_pin_workflow/${workflowId}`, { workflow_id: workflowId });

const toggleCollapseWorkflow = (workflowId) =>
    Gateway.post(`/kanban_workflow/toggle_collapse_workflow/${workflowId}`, { workflow_id: workflowId });

const createWorkflow = (data) =>
    Gateway.post('/kanban_workflow/create_workflow', data);

const getUserRoles = () =>
    Gateway.get('/kanban_workflow/user_role');

const createSwimlane = (data) =>
    Gateway.post('/kanban_workflow/create_swimlane', data);

const getSwimlaneByWorkflow = (workflowId) =>
    Gateway.get(`/kanban_workflow/get_swimlane_by_workflow/${workflowId}`);

const renameSwimlane = (data) =>
    Gateway.post('/kanban_workflow/rename_swimlane', data);

const deleteSwimlane = ({ swimlane_id }) =>
    Gateway.post(`/kanban_workflow/delete_swimlane/${swimlane_id}`, { swimlane_id });

const updateSwimlaneColor = (swimlaneId, data) =>
    Gateway.post(`/kanban_workflow/update_swimlane_color/${swimlaneId}`, data);

const createWorkflowColumn = (data) =>
    Gateway.post('/kanban_workflow/create_workflow_column', data);

const renameWorkflowColumn = (columnId, data) =>
    Gateway.post(`/kanban_workflow/rename_workflow_column/${columnId}`, data);

const updateWorkflowColumn = (columnId, data) =>
    Gateway.post(`/kanban_workflow/update_workflow_column/${columnId}`, data);

const removeWorkflowColumn = (columnId) =>
    Gateway.post(`/kanban_workflow/remove_workflow_column/${columnId}`, { column_id: columnId });

const reorderWorkflows = (data) =>
    Gateway.post('/kanban_workflow/reorder_workflows', data);

export default {
    getWorkflowByBoard,
    renameWorkflow,
    deleteWorkflow,
    disableWorkflow,
    createWorkflow,
    togglePinWorkflow,
    toggleCollapseWorkflow,
    getUserRoles,
    createSwimlane,
    getSwimlaneByWorkflow,
    renameSwimlane,
    deleteSwimlane,
    updateSwimlaneColor,
    createWorkflowColumn,
    renameWorkflowColumn,
    updateWorkflowColumn,
    removeWorkflowColumn,
    reorderWorkflows,
};
