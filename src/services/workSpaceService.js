import Gateway from '../gateway/gateway';

const createWorkspace = (data) =>
  Gateway.post('/kanban_workspace/create_workspace', {
    workspace_name: data.workspace_name,
    board_name: data.board_name,
  });

const listAllWorkspaces = () =>
  Gateway.get('/kanban_workspace/list_all_workspace');

const renameWorkspace = (workspaceId, data) =>
  Gateway.post(`/kanban_workspace/rename_workspace/${workspaceId}`, {
    workspace_id: data.workspace_id,
    workspace_name: data.workspace_name,
  });

const archiveWorkspace = (workspaceId) =>
  Gateway.post(`/kanban_workspace/archive_workspace/${workspaceId}`, {
    workspace_id: workspaceId,
  });

const getWorkspaceArchiveLog = () =>
  Gateway.get('/kanban_workspace/workspace_archive_log');

const unarchiveWorkspace = (board_id) =>
  Gateway.post(`/kanban_board/unarchive_board/${board_id}`, {
    board_id: board_id,
  });

const createBoard = (data) =>
  Gateway.post('/kanban_board/create_board', {
    workspace_id: data.workspace_id,
    board_name: data.board_name,
  });

const renameBoard = (boardId, data) =>
  Gateway.post(`/kanban_board/rename_board/${boardId}`, {
    board_id: data.board_id,
    board_name: data.board_name,
  });

const archiveBoard = (boardId) =>
  Gateway.post(`/kanban_board/archive_board/${boardId}`, {
    board_id: boardId,
  });

/** JSON body for color, or FormData for wallpaper (background_type + background_image). */
const changeBoardBackground = (boardId, data) =>
  Gateway.post(`/kanban_board/change_background/${boardId}`, data);

const removeBoardBackground = (boardId) =>
  Gateway.post(`/kanban_board/remove_background/${boardId}`);

const reorderWorkspace = (data) =>
  Gateway.post('/kanban_workspace/reorder_workspace', data);

export default {
  createWorkspace,
  listAllWorkspaces,
  renameWorkspace,
  archiveWorkspace,
  getWorkspaceArchiveLog,
  unarchiveWorkspace,
  createBoard,
  renameBoard,
  archiveBoard,
  changeBoardBackground,
  removeBoardBackground,
  reorderWorkspace,
};
