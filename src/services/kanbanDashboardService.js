import Gateway from '../gateway/gateway';

const createDashboard = (data) =>
  Gateway.post('/kanban_dashboard/create_dashboard', {
    dashboard_name: data.dashboard_name,
  });

const listAllDashboards = () => Gateway.get('/kanban_dashboard/list_all_dashboard');

const renameDashboard = (dashboardId, { dashboard_name }) =>
  Gateway.post(`/kanban_dashboard/rename_dashboard/${dashboardId}`, { dashboard_name });

/** JSON body for color, or FormData for wallpaper (background_type + background_image). */
const changeBackground = (dashboardId, data) =>
  Gateway.post(`/kanban_dashboard/change_background/${dashboardId}`, data);

const deleteDashboard = (dashboardId) =>
  Gateway.post(`/kanban_dashboard/delete_dashboard/${dashboardId}`);

/** Catalog of widgets available to add to dashboards (backend path assumed; adjust if API differs). */
const listAllWidgets = () => Gateway.get('/kanban_dashboard/list_all_widgets');

const addWorkspaceToDashboard = ({ dashboard_id, workspace_id, board_ids = [] }) =>
  Gateway.post('/kanban_dashboard/assign_workspace', { dashboard_id, workspace_id, board_ids });

const removeWorkspaceFromDashboard = ({ dashboard_id, workspace_id }) =>
  Gateway.post('/kanban_dashboard/unassign_workspace', { dashboard_id, workspace_id });

const addWidgetToDashboard = (dashboardId, { widget_id }) =>
  Gateway.post(`/kanban_dashboard/add_widget_to_dashboard/${dashboardId}`, { widget_id });

const removeWidgetFromDashboard = (dashboardId, { widget_id }) =>
  Gateway.post(`/kanban_dashboard/remove_widget_from_dashboard/${dashboardId}`, { widget_id });

export default {
  createDashboard,
  listAllDashboards,
  renameDashboard,
  changeBackground,
  deleteDashboard,
  listAllWidgets,
  addWorkspaceToDashboard,
  removeWorkspaceFromDashboard,
  addWidgetToDashboard,
  removeWidgetFromDashboard,
};
