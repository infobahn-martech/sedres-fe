import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { FiLayers } from 'react-icons/fi';
import '../../design/scss/Workspaces.scss';
import GroupIcon from '../../assets/images/Group.svg';
import AnalyticsIcon from '../../assets/images/analytics 1.svg';
import ClockIcon from '../../assets/images/ClockIcon.svg';
import filterIcon from '../../assets/images/filter.svg';
import NewWorkspaceModal from './NewWorkspaceModal';
import useWorkSpaceReducer from '../../store/WorkSpaceReducer';
import kanbanDashboardService from '../../services/kanbanDashboardService';
import AddBoardModal from './AddBoardModal';
import DashboardAddItemsModal from './DashboardAddItemsModal';
import ArchivedWorkspacesModal from './ArchivedWorkspacesModal';
import RenameBoardModal from './RenameBoardModal';
import RenameWorkspaceModal from './RenameWorkspaceModal';
import { getDashboardCanvasStyle } from '../../shared/utils/dashboardBackground';
import useAuthReducer from '../../store/AuthReducer';
import { isRestrictedBoardUser, RESTRICTED_BOARD_HOME_PATH } from '../../shared/helpers/restrictedBoardUser';

// Workspace Icon Component - Bar Chart Icon (like in first image)
const WorkspaceBarChartIcon = ({ className }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="3" y="17" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="8" y="12" width="4" height="9" rx="1" fill="currentColor" />
    <rect x="13" y="8" width="4" height="13" rx="1" fill="currentColor" />
    <rect x="18" y="4" width="4" height="17" rx="1" fill="currentColor" />
  </svg>
);

// Transform API response to UI format
const transformWorkspaces = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map((ws) => ({
    id: ws.workspace_id,
    name: ws.workspace_name,
    status: ws.workspace_status,
    boardCount: Number(ws.board_count) || (Array.isArray(ws.boards) ? ws.boards.length : 0),
    boards: Array.isArray(ws.boards)
      ? ws.boards.map((b) => ({
        id: b.board_id,
        name: b.board_name,
        status: b.board_status,
        count: b.total_cards ?? 0,
      }))
      : [],
  }));
};

function Workspaces() {
  const navigate = useNavigate();
  const { dashboardId } = useParams();
  const isDashboardView = Boolean(dashboardId);
  const {
    workspaces: apiWorkspaces,
    isLoading: workspacesLoading,
    errorMessage: workspacesErrorMessage,
    dashboards: apiDashboards,
    dashboardsLoading,
    listAllWorkspaces,
    listAllDashboards,
    addWorkspaceToDashboard,
    removeWorkspaceFromDashboard,
    addWidgetToDashboard,
    removeWidgetFromDashboard,
    createWorkspace,
    createBoard,
    renameWorkspace,
    renameBoard,
    archiveWorkspace,
    archiveBoard,
    addEditLoader,
    updateBoardName,
  } = useWorkSpaceReducer();

  const userProfile = useAuthReducer((state) => state.userProfile);
  const restrictedUser = isRestrictedBoardUser(userProfile);

  const currentDashboard = useMemo(() => {
    if (!isDashboardView || !Array.isArray(apiDashboards)) return null;
    return apiDashboards.find((d) => String(d.dashboard_id) === String(dashboardId)) ?? null;
  }, [isDashboardView, apiDashboards, dashboardId]);

  const workspacesData = useMemo(() => {
    if (isDashboardView) {
      return transformWorkspaces(currentDashboard?.workspaces ?? []);
    }
    return transformWorkspaces(apiWorkspaces);
  }, [isDashboardView, currentDashboard, apiWorkspaces]);

  const dashboardWorkspaceModalRows = useMemo(() => {
    if (!Array.isArray(apiWorkspaces)) return [];
    const onDashboard = new Set(
      (currentDashboard?.workspaces ?? []).map((w) => String(w.workspace_id ?? w.id))
    );
    return apiWorkspaces.map((w) => ({
      id: w.workspace_id,
      name: w.workspace_name ?? 'Workspace',
      addedToDashboard: onDashboard.has(String(w.workspace_id)),
    }));
  }, [apiWorkspaces, currentDashboard]);

  const dashboardWidgetIdSet = useMemo(() => {
    const raw = currentDashboard?.widgets ?? currentDashboard?.dashboard_widgets ?? [];
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.map((w) => String(w.widget_id ?? w.id ?? w.widgetId)));
  }, [currentDashboard]);

  const workspaceIdsOnCurrentDashboard = useMemo(() => {
    const raw = currentDashboard?.workspaces ?? [];
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.map((w) => String(w.workspace_id ?? w.id)));
  }, [currentDashboard]);

  // Find the first workspace with boards to set as initially expanded
  const firstWorkspaceWithBoards = workspacesData.find((workspace) => workspace.boards?.length > 0);
  const initialSelectedWorkspace = firstWorkspaceWithBoards ? firstWorkspaceWithBoards.id : null;
  const [filterValue, setFilterValue] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  const listLoading = isDashboardView ? dashboardsLoading : workspacesLoading;

  useEffect(() => {
    if (isDashboardView) {
      listAllDashboards();
    } else {
      listAllWorkspaces();
    }
  }, [isDashboardView]);

  useEffect(() => {
    if (selectedWorkspace == null && workspacesData.length > 0 && firstWorkspaceWithBoards) {
      setSelectedWorkspace(firstWorkspaceWithBoards.id);
    }
  }, [workspacesData, firstWorkspaceWithBoards, selectedWorkspace]);

  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [showAddBoardModal, setShowAddBoardModal] = useState(false);
  const [selectedWorkspaceForBoard, setSelectedWorkspaceForBoard] = useState(null);
  const [showArchivedWorkspacesModal, setShowArchivedWorkspacesModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openWorkspaceMenuId, setOpenWorkspaceMenuId] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showRenameWorkspaceModal, setShowRenameWorkspaceModal] = useState(false);
  const [selectedBoardForRename, setSelectedBoardForRename] = useState(null);
  const [selectedWorkspaceForRename, setSelectedWorkspaceForRename] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showDashboardItemsModal, setShowDashboardItemsModal] = useState(false);
  const [dashboardItemsModalType, setDashboardItemsModalType] = useState('workspace');
  const [dashboardModalSearch, setDashboardModalSearch] = useState('');
  const [dashboardModalFilterChip, setDashboardModalFilterChip] = useState(true);
  const [pendingDashboardToggleId, setPendingDashboardToggleId] = useState(null);
  const [widgetCatalog, setWidgetCatalog] = useState([]);
  const [widgetCatalogLoading, setWidgetCatalogLoading] = useState(false);
  const [widgetCatalogError, setWidgetCatalogError] = useState(null);
  const [widgetCatalogRetryKey, setWidgetCatalogRetryKey] = useState(0);
  const menuRef = useRef(null);
  const workspaceMenuRef = useRef(null);

  const dashboardWidgetModalRows = useMemo(
    () =>
      widgetCatalog.map((w) => ({
        id: w.id,
        name: w.name,
        addedToDashboard: dashboardWidgetIdSet.has(String(w.id)),
      })),
    [widgetCatalog, dashboardWidgetIdSet]
  );

  const filteredWorkspaces = workspacesData.filter((workspace) =>
    workspace.name.toLowerCase().includes(filterValue.toLowerCase())
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target)) {
        setOpenWorkspaceMenuId(null);
      }
    };

    if (openMenuId || openWorkspaceMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuId, openWorkspaceMenuId]);

  const handleWorkspaceClick = (workspace) => {
    if (workspace.boards?.length > 0) {
      setSelectedWorkspace(selectedWorkspace === workspace.id ? null : workspace.id);
    }
  };

  const handleAddWorkspace = () => {
    setShowNewWorkspaceModal(true);
  };

  const handleSaveWorkspace = (workspaceData) => {
    createWorkspace({
      workspace_name: workspaceData.workspaceName,
      board_name: workspaceData.boardName,
      cb: () => setShowNewWorkspaceModal(false),
    });
  };

  const handleDeleteWorkspace = () => {
    setShowArchivedWorkspacesModal(true);
  };

  const handleAddBoard = (workspaceId) => {
    setSelectedWorkspaceForBoard(workspaceId);
    setShowAddBoardModal(true);
  };

  const handleSaveBoard = (boardData) => {
    createBoard({
      workspace_id: boardData.workspaceId,
      board_name: boardData.boardName,
      cb: () => {
        setShowAddBoardModal(false);
        setSelectedWorkspaceForBoard(null);
      },
    });
  };

  const handleWorkspaceMenu = (workspaceId, e) => {
    e.stopPropagation();
    setOpenWorkspaceMenuId(openWorkspaceMenuId === workspaceId ? null : workspaceId);
  };

  const handleRenameWorkspace = (workspaceId) => {
    const workspace = workspacesData.find((w) => w.id === workspaceId);
    if (workspace) {
      setSelectedWorkspaceForRename(workspace);
      setShowRenameWorkspaceModal(true);
      setOpenWorkspaceMenuId(null);
    }
  };

  const handleSaveRenameWorkspace = (workspaceId, newName) => {
    renameWorkspace({
      workspace_id: workspaceId,
      workspace_name: newName,
      cb: () => {
        setShowRenameWorkspaceModal(false);
        setSelectedWorkspaceForRename(null);
      },
    });
  };

  const handleAddToDashboard = (workspaceId) => {
    setOpenWorkspaceMenuId(null);
    if (!isDashboardView || !currentDashboard) return;
    addWorkspaceToDashboard({
      dashboard_id: currentDashboard.dashboard_id,
      workspace_id: workspaceId,
    });
  };

  const handleRemoveFromDashboard = (workspaceId) => {
    setOpenWorkspaceMenuId(null);
    if (!isDashboardView || !currentDashboard) return;
    removeWorkspaceFromDashboard({
      dashboard_id: currentDashboard.dashboard_id,
      workspace_id: workspaceId,
    });
  };

  const handleArchiveWorkspace = (workspaceId) => {
    setOpenWorkspaceMenuId(null);
    archiveWorkspace({
      workspace_id: workspaceId,
      cb: () => setSelectedWorkspace(null),
    });
  };

  const handleBoardMenu = (boardId, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === boardId ? null : boardId);
  };

  const handleRenameBoard = (boardId) => {
    // Find the board to rename
    let foundBoard = null;
    for (const workspace of workspacesData) {
      const board = workspace.boards.find((b) => b.id === boardId);
      if (board) {
        foundBoard = { ...board, workspaceId: workspace.id };
        break;
      }
    }

    if (foundBoard) {
      setSelectedBoardForRename(foundBoard);
      setShowRenameModal(true);
      setOpenMenuId(null);
    }
  };

  const handleSaveRename = (boardId, newName) => {
    renameBoard({
      board_id: boardId,
      board_name: newName,
      cb: () => {
        setShowRenameModal(false);
        setSelectedBoardForRename(null);
      },
    });
  };

  const handleEditWorkflows = (boardId) => {
    setOpenMenuId(null);
    navigate(`/edit-workflow?boardId=${boardId}`);
  };

  const handleArchiveBoard = (boardId) => {
    setOpenMenuId(null);
    archiveBoard({ board_id: boardId });
  };

  const openDashboardWorkspaceModal = () => {
    setDashboardItemsModalType('workspace');
    setDashboardModalSearch('');
    setDashboardModalFilterChip(true);
    setShowDashboardItemsModal(true);
  };

  const openDashboardWidgetModal = () => {
    setDashboardItemsModalType('widget');
    setDashboardModalSearch('');
    setDashboardModalFilterChip(true);
    setShowDashboardItemsModal(true);
  };

  const handleDashboardModalToggle = async (itemId, nextOn) => {
    if (!currentDashboard) return;
    const dashboard_id = currentDashboard.dashboard_id;
    const idKey = String(itemId);
    setPendingDashboardToggleId(idKey);
    try {
      if (dashboardItemsModalType === 'workspace') {
        if (nextOn) {
          await addWorkspaceToDashboard({ dashboard_id, workspace_id: itemId });
        } else {
          await removeWorkspaceFromDashboard({ dashboard_id, workspace_id: itemId });
        }
      } else if (nextOn) {
        await addWidgetToDashboard({ dashboard_id, widget_id: itemId });
      } else {
        await removeWidgetFromDashboard({ dashboard_id, widget_id: itemId });
      }
    } finally {
      setPendingDashboardToggleId(null);
    }
  };

  const handleDashboardModalAddClick = () => {
    if (dashboardItemsModalType === 'workspace') {
      setShowDashboardItemsModal(false);
      setShowNewWorkspaceModal(true);
      return;
    }
    // TODO: open create widget flow when available
  };

  const dashboardNotFound = isDashboardView && !dashboardsLoading && !currentDashboard;

  const dashboardCanvasStyle = useMemo(
    () => getDashboardCanvasStyle(currentDashboard?.background),
    [currentDashboard]
  );

  const headerActions = !restrictedUser ? (
    <div className="workspaces-header-actions">
      <button
        type="button"
        className="workspaces-btn workspaces-btn-add"
        onClick={handleAddWorkspace}
        aria-label="Add workspace"
        title="Add new workspace"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        className="workspaces-btn workspaces-btn-delete"
        onClick={handleDeleteWorkspace}
        aria-label="Delete workspace"
        title="Delete workspace"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M2 4H14M6 4V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4M13 4V13C13 13.5523 12.5523 14 12 14H4C3.44772 14 3 13.5523 3 13V4H13Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  ) : null;

  const workspacesListSection = (
    <div
      className={isDashboardView ? 'workspaces-list workspaces-list--in-dashboard' : 'workspaces-list'}
    >
      {dashboardNotFound ? (
        <div className="workspaces-empty-state">
          <h3 className="workspaces-empty-title">Dashboard not found</h3>
          <p className="workspaces-empty-message">This dashboard may have been removed or you may not have access.</p>
        </div>
      ) : listLoading ? (
        <div className="workspaces-empty-state">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading workspaces...</span>
          </div>
          <p className="mt-3">Loading workspaces...</p>
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="workspaces-empty-state">
          <div className="workspaces-empty-icon">
            <img src={GroupIcon} alt="No workspaces" />
          </div>
          <h3 className="workspaces-empty-title">No workspaces found</h3>
          <p className="workspaces-empty-message">
            {filterValue
              ? 'Try adjusting your filter to see more results.'
              : isDashboardView
                ? 'No workspaces have been added to this dashboard yet.'
                : 'Get started by creating your first workspace.'}
          </p>
          {!filterValue && !restrictedUser && (
            <button type="button" className="workspaces-empty-btn" onClick={handleAddWorkspace}>
              Create Workspace
            </button>
          )}
        </div>
      ) : (
        filteredWorkspaces.map((workspace) => (
          <div
            key={workspace.id}
            id={`workspace-row-${workspace.id}`}
            className={`workspace-card ${selectedWorkspace === workspace.id ? 'expanded' : ''} ${workspace.boards?.length === 0 ? 'no-boards' : ''} ${openWorkspaceMenuId === workspace.id ? 'menu-open' : ''}`}
            onClick={() => handleWorkspaceClick(workspace)}
          >
            <div className="workspace-card-header">
              <div className="workspace-card-title">
                <div className="workspace-icon-wrapper">
                  <WorkspaceBarChartIcon className="workspace-icon" />
                </div>
                <h2 className="workspace-name">{workspace.name}</h2>
                {workspace.boardCount > 0 && (
                  <span className="workspace-board-count-badge">
                    {workspace.boardCount} {workspace.boardCount === 1 ? 'board' : 'boards'}
                  </span>
                )}
              </div>
              {workspace.boards?.length > 0 && !restrictedUser && (
                <div className="workspace-card-actions">
                  <button
                    type="button"
                    className="workspace-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddBoard(workspace.id);
                    }}
                    aria-label="Add board"
                    title="Add board"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M8 3V13M3 8H13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <div className="workspace-menu-wrapper" ref={openWorkspaceMenuId === workspace.id ? workspaceMenuRef : null}>
                    <button
                      type="button"
                      className="workspace-action-btn"
                      onClick={(e) => handleWorkspaceMenu(workspace.id, e)}
                      aria-label="More options"
                      title="More options"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="4" r="1.5" fill="currentColor" />
                        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                        <circle cx="8" cy="12" r="1.5" fill="currentColor" />
                      </svg>
                    </button>
                    {openWorkspaceMenuId === workspace.id && (
                      <div className="workspace-context-menu">
                        <button
                          type="button"
                          className="workspace-context-menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameWorkspace(workspace.id);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M11.3333 2.00001C11.5084 1.82497 11.7163 1.68606 11.9455 1.59127C12.1748 1.49648 12.4209 1.44775 12.6667 1.44775C12.9124 1.44775 13.1585 1.49648 13.3878 1.59127C13.617 1.68606 13.8249 1.82497 14 2.00001C14.175 2.17505 14.3139 2.38297 14.4087 2.61224C14.5035 2.8415 14.5522 3.08755 14.5522 3.33334C14.5522 3.57913 14.5035 3.82518 14.4087 4.05445C14.3139 4.28371 14.175 4.49164 14 4.66667L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00001Z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>Rename</span>
                        </button>
                        {isDashboardView && currentDashboard && (
                          <>
                            {!workspaceIdsOnCurrentDashboard.has(String(workspace.id)) ? (
                              <button
                                type="button"
                                className="workspace-context-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToDashboard(workspace.id);
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path
                                    d="M2 2H6V6H2V2Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M10 2H14V6H10V2Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M2 10H6V14H2V10Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M10 10H14V14H10V10Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span>Add to Dashboard</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="workspace-context-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromDashboard(workspace.id);
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path
                                    d="M2 4H14M6 4V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4M12.6667 4L12 13.3333C12 13.687 11.8595 14.0261 11.6095 14.2762C11.3594 14.5262 11.0203 14.6667 10.6667 14.6667H5.33334C4.97971 14.6667 4.64057 14.5262 4.39052 14.2762C4.14048 14.0261 4 13.687 4 13.3333L3.33334 4"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M6.66667 7.33334V11.3333M9.33333 7.33334V11.3333"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span>Remove</span>
                              </button>
                            )}
                          </>
                        )}
                        {!isDashboardView && (
                          <button
                            type="button"
                            className="workspace-context-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToDashboard(workspace.id);
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path
                                d="M2 2H6V6H2V2Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M10 2H14V6H10V2Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M2 10H6V14H2V10Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M10 10H14V14H10V10Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span>Add to Dashboard</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="workspace-context-menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveWorkspace(workspace.id);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M2 4H14M6 4V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4M13 4V13C13 13.5523 12.5523 14 12 14H4C3.44772 14 3 13.5523 3 13V4H13Z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M8 8V12M8 8L6 10M8 8L10 10"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>Archive</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedWorkspace === workspace.id && workspace.boards?.length > 0 && (
              <div className="workspace-boards">
                {workspace.boards.map((board) => (
                  <div
                    key={board.id}
                    className={`board-card ${!restrictedUser && openMenuId === board.id ? 'menu-open' : ''}`}
                    onClick={() => {
                      setIsNavigating(true);
                      navigate(restrictedUser ? RESTRICTED_BOARD_HOME_PATH : `/kanban-board/${board.id}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {!restrictedUser ? (
                      <div className="board-card-header">
                        <div className="board-menu-wrapper" ref={openMenuId === board.id ? menuRef : null}>
                          <button
                            type="button"
                            className="board-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBoardMenu(board.id, e);
                            }}
                            aria-label="Board options"
                            title="Board options"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="8" cy="4" r="1.5" fill="currentColor" />
                              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                              <circle cx="8" cy="12" r="1.5" fill="currentColor" />
                            </svg>
                          </button>
                          {openMenuId === board.id && (
                            <div className="board-context-menu">
                              <button
                                type="button"
                                className="board-context-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameBoard(board.id);
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path
                                    d="M11.3333 2.00001C11.5084 1.82497 11.7163 1.68606 11.9455 1.59127C12.1748 1.49648 12.4209 1.44775 12.6667 1.44775C12.9124 1.44775 13.1585 1.49648 13.3878 1.59127C13.617 1.68606 13.8249 1.82497 14 2.00001C14.175 2.17505 14.3139 2.38297 14.4087 2.61224C14.5035 2.8415 14.5522 3.08755 14.5522 3.33334C14.5522 3.57913 14.5035 3.82518 14.4087 4.05445C14.3139 4.28371 14.175 4.49164 14 4.66667L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00001Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span>Rename</span>
                              </button>
                              <button
                                type="button"
                                className="board-context-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditWorkflows(board.id);
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path
                                    d="M2 2H6V6H2V2Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M10 2H14V6H10V2Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M2 10H6V14H2V10Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M10 10H14V14H10V10Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span>Edit Workflows</span>
                              </button>
                              <button
                                type="button"
                                className="board-context-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleArchiveBoard(board.id);
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path
                                    d="M2.66667 4H13.3333M6.66667 7.33334V11.3333M9.33333 7.33334V11.3333M3.33334 4L4 13.3333C4 13.687 4.14048 14.0261 4.39052 14.2762C4.64057 14.5262 4.97971 14.6667 5.33334 14.6667H10.6667C11.0203 14.6667 11.3594 14.5262 11.6095 14.2762C11.8595 14.0261 12 13.687 12 13.3333L12.6667 4M6.66667 4V2.66667C6.66667 2.48986 6.73691 2.32029 6.86193 2.19526C6.98696 2.07024 7.15653 2 7.33334 2H8.66667C8.84348 2 9.01305 2.07024 9.13807 2.19526C9.2631 2.32029 9.33334 2.48986 9.33334 2.66667V4"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span>Archive</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div className="board-card-content">
                      <h3
                        className="board-name"
                        data-tooltip-id={`board-name-${board.id}`}
                        data-tooltip-content={board.name}
                      >
                        {board.name}
                      </h3>
                      <Tooltip id={`board-name-${board.id}`} place="top" />

                      <div className="board-counts-row">
                        {/* <div
                          className="board-count"
                          data-tooltip-id={`board-count-${board.id}`}
                          data-tooltip-content={`Card Count: ${board.count.toLocaleString()} cards`}
                        >
                          <img src={ClockIcon} alt="Clock" className="board-clock-icon" />
                          <span className="board-count-number">{(board.count ?? 0).toLocaleString()}</span>
                        </div>
                        <Tooltip id={`board-count-${board.id}`} place="top" /> */}

                        <div
                          className="board-id-count"
                          data-tooltip-id={`board-id-${board.id}`}
                          data-tooltip-content={`Board ID: ${board.id}`}
                        >
                          <FiLayers className="board-id-icon" />
                          <span className="board-id-number">{board.id}</span>
                        </div>
                        <Tooltip id={`board-id-${board.id}`} place="top" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className={`workspaces-container ${isDashboardView ? 'workspaces-container--dashboard' : ''}`}>
      {/* Loading Overlay */}
      {isNavigating && (
        <div className="page-loader-overlay">
          <div className="page-loader-content">
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading board...</p>
          </div>
        </div>
      )}
      {!isDashboardView ? (
        <>
          {/* Header Section */}
          <div className="workspaces-header">
            <div className="workspaces-header-left">
              <h1 className="workspaces-title">My workspaces</h1>
              {headerActions}
            </div>
            <div className="workspaces-header-right">
              <div className="workspaces-filter">
                <img src={filterIcon} alt="Filter" className="workspaces-filter-icon" />
                <input
                  type="text"
                  placeholder="Filter workspaces..."
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="workspaces-filter-input"
                />
                {filterValue && (
                  <button
                    type="button"
                    className="workspaces-filter-clear-btn"
                    onClick={() => setFilterValue('')}
                    aria-label="Clear filter"
                    title="Clear filter"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
                <button type="button" className="workspaces-filter-list-btn" aria-label="List view" title="List view">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M2 4H14M2 8H14M2 12H14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          {workspacesListSection}
        </>
      ) : (
        <>
          <div className="workspaces-dashboard-toolbar">
            {!restrictedUser ? (
              <button type="button" className="workspaces-dashboard-toolbar-link" onClick={openDashboardWorkspaceModal}>
                Add Workspace
              </button>
            ) : null}
            {/* <span className="workspaces-dashboard-toolbar-sep">/</span>
            <button type="button" className="workspaces-dashboard-toolbar-link" onClick={openDashboardWidgetModal}>
              Add Widget
            </button> */}
          </div>
          <div className="workspaces-dashboard-canvas" style={dashboardCanvasStyle}>
            <div className="workspaces-dashboard-inner">
              {workspacesListSection}
            </div>
          </div>
        </>
      )}

      {/* New Workspace Modal */}
      <NewWorkspaceModal
        show={showNewWorkspaceModal}
        onClose={() => setShowNewWorkspaceModal(false)}
        onSave={handleSaveWorkspace}
        isSaving={addEditLoader}
      />

      {/* Add Board Modal */}
      <AddBoardModal
        show={showAddBoardModal}
        onClose={() => {
          setShowAddBoardModal(false);
          setSelectedWorkspaceForBoard(null);
        }}
        onSave={handleSaveBoard}
        workspaceId={selectedWorkspaceForBoard}
        isSaving={addEditLoader}
      />

      {/* Archived Workspaces Modal */}
      <ArchivedWorkspacesModal
        show={showArchivedWorkspacesModal}
        onClose={() => setShowArchivedWorkspacesModal(false)}
      />

      {/* Rename Board Modal */}
      {selectedBoardForRename && (
        <RenameBoardModal
          show={showRenameModal}
          onClose={() => {
            setShowRenameModal(false);
            setSelectedBoardForRename(null);
          }}
          onSave={(newName) => handleSaveRename(selectedBoardForRename.id, newName)}
          currentName={selectedBoardForRename.name}
          isSaving={addEditLoader}
        />
      )}

      {/* Rename Workspace Modal */}
      {selectedWorkspaceForRename && (
        <RenameWorkspaceModal
          show={showRenameWorkspaceModal}
          onClose={() => {
            setShowRenameWorkspaceModal(false);
            setSelectedWorkspaceForRename(null);
          }}
          onSave={(newName) => handleSaveRenameWorkspace(selectedWorkspaceForRename.id, newName)}
          currentName={selectedWorkspaceForRename.name}
          isSaving={addEditLoader}
        />
      )}

      {isDashboardView && (
        <DashboardAddItemsModal
          show={showDashboardItemsModal}
          onClose={() => setShowDashboardItemsModal(false)}
          title={
            dashboardItemsModalType === 'workspace'
              ? `Dashboard workspaces (${currentDashboard?.dashboard_name ?? 'Dashboard'})`
              : `Dashboard widgets (${currentDashboard?.dashboard_name ?? 'Dashboard'})`
          }
          columnLabel={dashboardItemsModalType === 'workspace' ? 'Workspace' : 'Widget'}
          rows={dashboardItemsModalType === 'workspace' ? dashboardWorkspaceModalRows : dashboardWidgetModalRows}
          loading={dashboardItemsModalType === 'workspace' ? workspacesLoading : widgetCatalogLoading}
          fetchError={
            dashboardItemsModalType === 'workspace'
              ? !workspacesLoading && workspacesErrorMessage
                ? workspacesErrorMessage
                : null
              : widgetCatalogError
          }
          onRetry={
            dashboardItemsModalType === 'workspace'
              ? () => listAllWorkspaces()
              : () => setWidgetCatalogRetryKey((k) => k + 1)
          }
          searchText={dashboardModalSearch}
          onSearchChange={setDashboardModalSearch}
          filterChipActive={dashboardModalFilterChip}
          onFilterChipRemove={() => setDashboardModalFilterChip(false)}
          onFilterToolbarClick={() => {
            if (!dashboardModalFilterChip) setDashboardModalFilterChip(true);
          }}
          pendingToggleId={pendingDashboardToggleId}
          onToggle={handleDashboardModalToggle}
          onAddClick={handleDashboardModalAddClick}
          addButtonLabel={dashboardItemsModalType === 'workspace' ? 'Create workspace' : 'Add widget'}
        />
      )}
    </div>
  );
}

export default Workspaces;

