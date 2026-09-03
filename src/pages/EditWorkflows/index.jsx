import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import '../../design/scss/EditWorkflows.scss';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import CreateWorkflowModal from './CreateWorkflowModal';
import WorkflowBoard from './WorkflowBoard';
import {
  getColStackKey,
  getColumnKey,
  buildCreateWorkflowColumnPayload,
  removeStage,
  normalizeWorkflowData,
  isWorkflowStageChildColumn,
  rgbToHex,
  sanitizeSwimlaneColorCode,
} from './workflow.utils';

function isNodeInColumnZone(node, colStackKey) {
  if (!node || node.nodeType !== 1 || colStackKey == null) return false;
  let el = node;
  while (el) {
    if (el.getAttribute?.('data-col-stack-key') === colStackKey) return true;
    el = el.parentElement;
  }
  return false;
}
import useWorkFlowReducer from '../../store/WorkFlowReducer';
import useAlertReducer from '../../store/AlertReducer';
import usePermissions from '../../shared/hooks/usePermissions';
import { PERMISSION_MODULES, PERMISSION_ACTIONS } from '../../shared/constants/permissions';

const DEFAULT_WORKFLOWS = [
  {
    id: 1,
    name: 'Default Workflow',
    swimlanes: [
      {
        id: 1,
        name: 'Default Swimlane',
        stages: [
          // { id: 1, name: 'Backlog', area: 'BACKLOG AREA', limit: 0, cardsPerRow: 1, row: 0, col: 0, colSpan: 1 },
          { id: 1, name: 'Requested', area: 'REQUESTED AREA', limit: 0, cardsPerRow: 1, row: 0, col: 0, colSpan: 1 },
          { id: 2, name: 'In Progress', area: 'IN PROGRESS AREA', limit: 0, cardsPerRow: 1, row: 0, col: 0, colSpan: 1 },
          { id: 3, name: 'Done', area: 'DONE AREA', limit: 0, cardsPerRow: 1, row: 0, col: 0, colSpan: 1 },
          { id: 4, name: 'Ready to Archive', area: 'READY TO ARCHIVE AREA', limit: 0, cardsPerRow: 1, row: 0, col: 0, colSpan: 1 },
        ],
      },
    ],
  },
];

function EditWorkflows() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    getWorkflowByBoard,
    renameWorkflow,
    deleteWorkflow,
    disableWorkflow,
    createWorkflow,
    createSwimlane,
    renameSwimlane,
    deleteSwimlane,
    updateSwimlaneColor,
    createWorkflowColumn,
    renameWorkflowColumn,
    updateWorkflowColumn,
    removeWorkflowColumn,
    workflows: apiWorkflows,
    isLoading,
  } = useWorkFlowReducer();

  const { error: showError } = useAlertReducer();

  const { hasPermission } = usePermissions();
  const canCreateWorkflow = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.CREATE_WORKFLOW });
  const canRenameWorkflow = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.RENAME_WORKFLOW });
  const canDeleteWorkflow = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.DELETE_WORKFLOW });
  const canDisableWorkflow = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.DISABLE_WORKFLOW });
  const canCreateSwimlane = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.CREATE_SWIMLANE });
  const canRenameSwimlane = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.RENAME_SWIMLANE });
  const canDeleteSwimlane = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.DELETE_SWIMLANE });
  const canUpdateSwimlaneColor = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.UPDATE_SWIMLANE_COLOR });
  const canAddColumns = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.ADD_COLUMNS });
  const canUpdateColumnColor = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.UPDATE_COLUMN_COLOR });
  const canDeleteColumn = hasPermission({ moduleKey: PERMISSION_MODULES.KANBAN_WORKFLOW, actionKey: PERMISSION_ACTIONS.DELETE_COLUMN });

  const [showCreateWorkflowModal, setShowCreateWorkflowModal] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [stackedRailMetrics, setStackedRailMetrics] = useState(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState(null);
  const [editingWorkflowName, setEditingWorkflowName] = useState('');
  const [editingStageId, setEditingStageId] = useState(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [workflows, setWorkflows] = useState(DEFAULT_WORKFLOWS);
  const [mutationTargets, setMutationTargets] = useState({});
  const [createWorkflowSaving, setCreateWorkflowSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const mutationInflightRef = useRef(new Set());
  const boardId = searchParams.get('boardId');

  const clearMutationKey = useCallback((key) => {
    mutationInflightRef.current.delete(key);
    setMutationTargets((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const startMutation = useCallback((key, label = true) => {
    if (mutationInflightRef.current.has(key)) return false;
    mutationInflightRef.current.add(key);
    setMutationTargets((prev) => ({ ...prev, [key]: label }));
    return true;
  }, []);

  useEffect(() => {
    if (boardId) {
      getWorkflowByBoard({ boardId });
    }
  }, [searchParams, getWorkflowByBoard, boardId]);

  useEffect(() => {
    if (apiWorkflows === null) {
      return;
    }

    const normalizedWorkflows = normalizeWorkflowData(apiWorkflows);
    setWorkflows(normalizedWorkflows);
    setHoveredColumn(null);
    setStackedRailMetrics(null);
  }, [apiWorkflows]);

  useEffect(() => {
    const clearHover = () => {
      setHoveredColumn(null);
      setStackedRailMetrics(null);
    };
    window.addEventListener('scroll', clearHover, true);
    return () => window.removeEventListener('scroll', clearHover, true);
  }, []);

  const handleStageBoxMouseEnter = (
    e,
    stageColumnKey,
    workflowId,
    swimlaneId,
    stageId,
    stageName,
    isStacked,
    area,
    stageCol,
    stageColSpan
  ) => {
    setHoveredColumn(stageColumnKey);
    if (isStacked && area != null && stageCol != null) {
      const areaBlock = e.currentTarget.closest('.workflow-area-block');
      const stageWrapper = e.currentTarget.closest('.workflow-stage-wrapper');
      const colStackKey = getColStackKey(workflowId, swimlaneId, area, stageCol);
      const colStack = areaBlock?.querySelector(`[data-col-stack-key="${colStackKey}"]`);
      if (colStack && stageWrapper) {
        const colRect = colStack.getBoundingClientRect();
        const stageRect = stageWrapper.getBoundingClientRect();
        setStackedRailMetrics({
          colStackKey,
          stageId,
          stageName,
          workflowId,
          swimlaneId,
          top: stageRect.top - colRect.top,
          height: colRect.bottom - stageRect.top,
          colSpan: stageColSpan ?? 1,
        });
      } else {
        setStackedRailMetrics(null);
      }
    } else if (!isStacked) {
      setStackedRailMetrics(null);
    }
  };

  const handleStageBoxMouseLeave = (e, stageColumnKey, colStackKey) => {
    const rt = e.relatedTarget;
    if (isNodeInColumnZone(rt, colStackKey)) return;
    setHoveredColumn((prev) => (prev === stageColumnKey ? null : prev));
    setStackedRailMetrics((prev) => {
      if (!prev || prev.colStackKey !== colStackKey) return prev;
      return null;
    });
  };

  const runCreateWorkflowColumn = (workflowId, swimlaneId, stageId, action) => {
    const stageKey = getColumnKey(workflowId, swimlaneId, stageId);
    if (!startMutation(stageKey, 'adding-column')) return;
    setHoveredColumn(null);
    setStackedRailMetrics(null);
    if (!boardId) {
      clearMutationKey(stageKey);
      showError('Open a board (boardId in URL) to add columns.');
      return;
    }
    const workflow = workflows.find((w) => w.id === workflowId || String(w.id) === String(workflowId));
    if (!workflow) {
      clearMutationKey(stageKey);
      return;
    }
    const swimlane = workflow.swimlanes.find(
      (sl) => sl.id === swimlaneId || String(sl.id) === String(swimlaneId)
    );
    if (!swimlane) {
      clearMutationKey(stageKey);
      return;
    }
    const built = buildCreateWorkflowColumnPayload(swimlane.stages, stageId, action);
    if (!built.ok) {
      clearMutationKey(stageKey);
      showError(built.message);
      return;
    }
    createWorkflowColumn({
      body: built.payload,
      cb: () => boardId && getWorkflowByBoard({ boardId, silent: true }),
      onSettled: () => clearMutationKey(stageKey),
    });
  };

  const handleAddColumnLeft = (workflowId, swimlaneId, stageId) =>
    runCreateWorkflowColumn(workflowId, swimlaneId, stageId, 'left');

  const handleAddColumnRight = (workflowId, swimlaneId, stageId) =>
    runCreateWorkflowColumn(workflowId, swimlaneId, stageId, 'right');

  const handleAddSubcolumn = (workflowId, swimlaneId, stageId) => {
    const workflow = workflows.find((w) => w.id === workflowId || String(w.id) === String(workflowId));
    const swimlane = workflow?.swimlanes.find(
      (sl) => sl.id === swimlaneId || String(sl.id) === String(swimlaneId)
    );
    const stage = swimlane?.stages.find((s) => s.id === stageId || String(s.id) === String(stageId));
    if (isWorkflowStageChildColumn(stage)) return;
    runCreateWorkflowColumn(workflowId, swimlaneId, stageId, 'subcolumn');
  };

  const handleStartEditWorkflow = (workflowId, currentName) => {
    setEditingWorkflowId(workflowId);
    setEditingWorkflowName(currentName);
  };

  const handleSaveWorkflowName = (workflowId) => {
    const trimmedName = editingWorkflowName.trim();
    if (trimmedName) {
      const wfKey = `wf:${workflowId}`;
      if (!startMutation(wfKey, 'rename')) {
        setEditingWorkflowId(null);
        setEditingWorkflowName('');
        return;
      }
      setWorkflows((prevWorkflows) =>
        prevWorkflows.map((workflow) =>
          workflow.id === workflowId ? { ...workflow, name: trimmedName } : workflow
        )
      );
      renameWorkflow({
        workflow_id: workflowId,
        workflow_name: trimmedName,
        cb: () => boardId && getWorkflowByBoard({ boardId, silent: true }),
        onSettled: () => clearMutationKey(wfKey),
      });
    }
    setEditingWorkflowId(null);
    setEditingWorkflowName('');
  };

  const handleCancelEditWorkflow = () => {
    setEditingWorkflowId(null);
    setEditingWorkflowName('');
  };

  const handleWorkflowNameKeyPress = (e, workflowId) => {
    if (e.key === 'Enter') {
      handleSaveWorkflowName(workflowId);
    } else if (e.key === 'Escape') {
      handleCancelEditWorkflow();
    }
  };

  const handleStartEditStage = (stageId, currentName) => {
    setEditingStageId(stageId);
    setEditingStageName(currentName);
  };

  const handleSaveStageNameChange = (workflowId, swimlaneId, stageId) => {
    const trimmed = editingStageName.trim();
    if (!trimmed) {
      setEditingStageId(null);
      setEditingStageName('');
      return;
    }

    const workflow = workflows.find((w) => w.id === workflowId || String(w.id) === String(workflowId));
    const swimlane = workflow?.swimlanes.find(
      (sl) => sl.id === swimlaneId || String(sl.id) === String(swimlaneId)
    );
    const stage = swimlane?.stages.find((s) => s.id === stageId || String(s.id) === String(stageId));
    const columnId = stage?.columnId;

    if (boardId && columnId != null && String(columnId) !== '') {
      const colKey = getColumnKey(workflowId, swimlaneId, stageId);
      if (startMutation(colKey, 'rename')) {
        renameWorkflowColumn({
          column_id: columnId,
          column_name: trimmed,
          cb: () => getWorkflowByBoard({ boardId, silent: true }),
          onSettled: () => clearMutationKey(colKey),
        });
      }
    } else {
      setWorkflows((prevWorkflows) =>
        prevWorkflows.map((w) => {
          if (w.id !== workflowId) return w;
          return {
            ...w,
            swimlanes: w.swimlanes.map((sl) => {
              if (sl.id !== swimlaneId) return sl;
              return {
                ...sl,
                stages: sl.stages.map((st) =>
                  st.id === stageId ? { ...st, name: trimmed } : st
                ),
              };
            }),
          };
        })
      );
    }

    setEditingStageId(null);
    setEditingStageName('');
  };

  const handleCancelEditStage = () => {
    setEditingStageId(null);
    setEditingStageName('');
  };

  const handleStageNameKeyPress = (e, workflowId, swimlaneId, stageId) => {
    if (e.key === 'Enter') {
      handleSaveStageNameChange(workflowId, swimlaneId, stageId);
    } else if (e.key === 'Escape') {
      handleCancelEditStage();
    }
  };

  const handleDeleteStage = (workflowId, swimlaneId, stageId) => {
    setDeleteModal({ type: 'stage', workflowId, swimlaneId, stageId });
  };

  const confirmDeleteStage = (workflowId, swimlaneId, stageId) => {
    const workflow = workflows.find((w) => w.id === workflowId || String(w.id) === String(workflowId));
    const swimlane = workflow?.swimlanes.find(
      (sl) => sl.id === swimlaneId || String(sl.id) === String(swimlaneId)
    );
    const stage = swimlane?.stages.find((s) => s.id === stageId || String(s.id) === String(stageId));
    const columnId = stage?.columnId;

    if (boardId && columnId != null && String(columnId) !== '') {
      const colKey = getColumnKey(workflowId, swimlaneId, stageId);
      if (!startMutation(colKey, 'deleting')) return;
      removeWorkflowColumn({
        column_id: columnId,
        cb: () => getWorkflowByBoard({ boardId, silent: true }),
        onSettled: () => clearMutationKey(colKey),
      });
      return;
    }

    setWorkflows((prevWorkflows) =>
      prevWorkflows.map((w) => {
        if (w.id !== workflowId) return w;
        return {
          ...w,
          swimlanes: w.swimlanes.map((sl) => {
            if (sl.id !== swimlaneId) return sl;
            return {
              ...sl,
              stages: removeStage(sl.stages, stageId),
            };
          }),
        };
      })
    );
  };

  const handleStageLimitChange = (workflowId, swimlaneId, stageId, value) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setWorkflows((prevWorkflows) =>
      prevWorkflows.map((workflow) => {
        if (workflow.id !== workflowId) return workflow;
        return {
          ...workflow,
          swimlanes: workflow.swimlanes.map((swimlane) => {
            if (swimlane.id !== swimlaneId) return swimlane;
            return {
              ...swimlane,
              stages: swimlane.stages.map((stage) =>
                stage.id === stageId ? { ...stage, limit: num } : stage
              ),
            };
          }),
        };
      })
    );
  };

  const handleStageCardsPerRowChange = (workflowId, swimlaneId, stageId, value) => {
    const num = Math.max(1, parseInt(value, 10) || 1);
    const workflow = workflows.find((w) => w.id === workflowId || String(w.id) === String(workflowId));
    const swimlane = workflow?.swimlanes.find(
      (sl) => sl.id === swimlaneId || String(sl.id) === String(swimlaneId)
    );
    const stage = swimlane?.stages.find((s) => s.id === stageId || String(s.id) === String(stageId));
    const columnId = stage?.columnId;

    const applyLocal = () =>
      setWorkflows((prevWorkflows) =>
        prevWorkflows.map((wf) => {
          if (wf.id !== workflowId) return wf;
          return {
            ...wf,
            swimlanes: wf.swimlanes.map((sl) => {
              if (sl.id !== swimlaneId) return sl;
              return {
                ...sl,
                stages: sl.stages.map((st) =>
                  st.id === stageId ? { ...st, cardsPerRow: num } : st
                ),
              };
            }),
          };
        })
      );

    if (boardId && columnId != null && String(columnId) !== '') {
      const colKey = getColumnKey(workflowId, swimlaneId, stageId);
      if (!startMutation(colKey, 'cards-per-row')) return;
      applyLocal();
      updateWorkflowColumn({
        column_id: columnId,
        cards_per_row: num,
        cb: () => getWorkflowByBoard({ boardId, silent: true }),
        onSettled: () => clearMutationKey(colKey),
      });
      return;
    }

    applyLocal();
  };

  const handleStageColorChange = (workflowId, swimlaneId, stageId, rgbColor) => {
    const workflow = workflows.find((w) => w.id === workflowId || String(w.id) === String(workflowId));
    const swimlane = workflow?.swimlanes.find(
      (sl) => sl.id === swimlaneId || String(sl.id) === String(swimlaneId)
    );
    const stage = swimlane?.stages.find((s) => s.id === stageId || String(s.id) === String(stageId));
    const columnId = stage?.columnId;

    const applyLocal = () =>
      setWorkflows((prevWorkflows) =>
        prevWorkflows.map((w) => {
          if (w.id !== workflowId) return w;
          return {
            ...w,
            swimlanes: w.swimlanes.map((sl) => {
              if (sl.id !== swimlaneId) return sl;
              return {
                ...sl,
                stages: sl.stages.map((st) =>
                  st.id === stageId ? { ...st, color: rgbColor, bgColor: rgbColor } : st
                ),
              };
            }),
          };
        })
      );

    if (boardId && columnId != null && String(columnId) !== '') {
      const colKey = getColumnKey(workflowId, swimlaneId, stageId);
      if (!startMutation(colKey, 'color')) return;
      applyLocal();
      const background_color = rgbToHex(rgbColor);
      updateWorkflowColumn({
        column_id: columnId,
        background_color,
        cb: () => getWorkflowByBoard({ boardId, silent: true }),
        onSettled: () => clearMutationKey(colKey),
      });
      return;
    }

    applyLocal();
  };

  const refetchBoardWorkflows = () => {
    if (boardId) {
      getWorkflowByBoard({ boardId, silent: true });
    }
  };

  const handleCreateWorkflow = ({ workflow_name, role_id, port_id, entity_id }) => {
    if (!boardId || !workflow_name?.trim()) return;
    setCreateWorkflowSaving(true);
    createWorkflow({
      board_id: boardId,
      workflow_name: workflow_name.trim(),
      role_id: role_id ?? '',
      port_id: port_id ?? null,
      call_type_id: null,
      entity_id: entity_id ?? null,
      cb: () => {
        getWorkflowByBoard({ boardId, silent: true });
        setShowCreateWorkflowModal(false);
      },
      onSettled: () => setCreateWorkflowSaving(false),
    });
  };

  const handleDeleteWorkflow = (workflowId) => {
    setDeleteModal({ type: 'workflow', workflowId });
  };

  const confirmDeleteWorkflow = (workflowId) => {
    const wfKey = `wf:${workflowId}`;
    if (!startMutation(wfKey, 'delete')) return;
    deleteWorkflow({
      workflow_id: workflowId,
      cb: () => refetchBoardWorkflows(),
      onSettled: () => clearMutationKey(wfKey),
    });
  };

  const handleDisableWorkflow = (workflowId) => {
    const wfKey = `wf:${workflowId}`;
    if (!startMutation(wfKey, 'disable')) return;
    disableWorkflow({
      workflow_id: workflowId,
      cb: (data) => {
        if (data && typeof data.is_active !== 'undefined') {
          const nextActive = data.is_active == 0 ? 0 : 1;
          setWorkflows((prev) =>
            prev.map((w) =>
              String(w.id) === String(workflowId) ? { ...w, is_active: nextActive } : w
            )
          );
        }
        refetchBoardWorkflows();
      },
      onSettled: () => clearMutationKey(wfKey),
    });
  };

  const handleAddSwimlane = (workflowId, insertAtIndex, swimlaneName = 'New Swimlane') => {
    const k = `swimlane-add:${workflowId}:${insertAtIndex}`;
    if (!startMutation(k, true)) return;
    createSwimlane({
      workflow_id: workflowId,
      swimlane_name: swimlaneName,
      cb: refetchBoardWorkflows,
      onSettled: () => clearMutationKey(k),
    });
  };

  const handleRenameSwimlane = (workflowId, swimlaneId, newName) => {
    const trimmed = newName?.trim();
    if (!trimmed) return;
    const slKey = `sl:${swimlaneId}`;
    if (!startMutation(slKey, 'rename')) return;
    setWorkflows((prevWorkflows) =>
      prevWorkflows.map((w) => {
        if (w.id !== workflowId) return w;
        return {
          ...w,
          swimlanes: w.swimlanes.map((sl) =>
            sl.id === swimlaneId ? { ...sl, name: trimmed } : sl
          ),
        };
      })
    );
    renameSwimlane({
      swimlane_id: swimlaneId,
      swimlane_name: trimmed,
      cb: refetchBoardWorkflows,
      onSettled: () => clearMutationKey(slKey),
    });
  };

  const handleDeleteSwimlane = (workflowId, swimlaneId) => {
    setDeleteModal({ type: 'swimlane', workflowId, swimlaneId });
  };

  const confirmDeleteSwimlane = (swimlaneId) => {
    const slKey = `sl:${swimlaneId}`;
    if (!startMutation(slKey, 'deleting')) return;
    deleteSwimlane({
      swimlane_id: swimlaneId,
      cb: refetchBoardWorkflows,
      onSettled: () => clearMutationKey(slKey),
    });
  };

  const handleConfirmDeleteModal = () => {
    if (!deleteModal) return;
    if (deleteModal.type === 'workflow') {
      confirmDeleteWorkflow(deleteModal.workflowId);
    } else if (deleteModal.type === 'swimlane') {
      confirmDeleteSwimlane(deleteModal.swimlaneId);
    } else if (deleteModal.type === 'stage') {
      confirmDeleteStage(deleteModal.workflowId, deleteModal.swimlaneId, deleteModal.stageId);
    }
    setDeleteModal(null);
  };

  const handleSwimlaneColorChange = (workflowId, swimlaneId, colorHex) => {
    const color_code = sanitizeSwimlaneColorCode(colorHex);
    if (!color_code) return;
    if (!boardId) {
      showError('Open a board (boardId in URL) to update swimlane color.');
      return;
    }
    const key = `sl-color:${swimlaneId}`;
    if (!startMutation(key, 'color')) return;
    setWorkflows((prevWorkflows) =>
      prevWorkflows.map((w) => {
        if (w.id !== workflowId) return w;
        return {
          ...w,
          swimlanes: w.swimlanes.map((sl) =>
            sl.id === swimlaneId ? { ...sl, colorCode: color_code } : sl
          ),
        };
      })
    );
    updateSwimlaneColor({
      swimlane_id: swimlaneId,
      color_code,
      cb: () => getWorkflowByBoard({ boardId, silent: true }),
      onSettled: () => clearMutationKey(key),
    });
  };

  const showNoWorkflowEmptyState = Boolean(boardId) && !isLoading && workflows.length === 0;

  return (
    <div className="edit-workflows-container">
      <div
        className={`workflows-content${showNoWorkflowEmptyState ? ' workflows-content--empty-workflow' : ''}`}
      >
        <div className="workflows-page-toolbar">
          {/* <div className="workflows-board-config-card">
            <h3 className="workflows-config-title">Board Configurations</h3>
            <div className="workflows-board-config-fields">
              <div className="workflows-config-field">
                <label className="workflows-config-label">Board name</label>
                <input
                  type="text"
                  className="workflows-config-input"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                />
              </div>
              <div className="workflows-config-field">
                <label className="workflows-config-label">
                  Description
                  <button className="workflows-edit-icon" type="button">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M11.3333 2.00004C11.5084 1.82488 11.7163 1.68601 11.9444 1.59128C12.1726 1.49655 12.4163 1.44775 12.6622 1.44775C12.9081 1.44775 13.1518 1.49655 13.38 1.59128C13.6081 1.68601 13.816 1.82488 13.9911 2.00004C14.1663 2.17519 14.3052 2.38313 14.3999 2.61126C14.4946 2.83939 14.5434 3.08309 14.5434 3.32904C14.5434 3.57499 14.4946 3.81869 14.3999 4.04682C14.3052 4.27495 14.1663 4.48289 13.9911 4.65804L5.32444 13.3247L1.33331 14.6667L2.67531 10.6756L11.3333 2.00004Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </label>
                <input
                  type="text"
                  className="workflows-config-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </div> */}
          {boardId ? (
            <div className="workflows-toolbar-actions">
              <button
                type="button"
                className="workflows-btn workflows-btn-discard workflows-btn-back--toolbar"
                onClick={() => navigate(`/kanban-board/${boardId}`)}
              >
                <FiArrowLeft aria-hidden="true" />
                Back To Board
              </button>
              {!showNoWorkflowEmptyState && canCreateWorkflow ? (
                <button
                  type="button"
                  className="workflows-btn workflows-btn-create workflows-btn-create--toolbar"
                  onClick={() => setShowCreateWorkflowModal(true)}
                >
                  Create new workflow
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="workflows-loading">Loading workflow…</div>
        ) : showNoWorkflowEmptyState ? (
          <div className="workflows-not-found">
            <div className="workflows-not-found-card">
              <div className="workflows-not-found-icon" aria-hidden>
                <svg width="48" height="48" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="10" width="12" height="36" rx="2" stroke="currentColor" strokeWidth="1.75" />
                  <rect x="22" y="10" width="12" height="36" rx="2" stroke="currentColor" strokeWidth="1.75" />
                  <rect x="36" y="10" width="12" height="36" rx="2" stroke="currentColor" strokeWidth="1.75" />
                  <path d="M11 18h6M29 18h6M43 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="workflows-not-found-copy">
                <h2 className="workflows-not-found-title">Create your first workflow</h2>
                <p className="workflows-not-found-text">
                  Add a workflow to define stages and swimlanes—then you can fine-tune columns and limits here.
                </p>
              </div>
              {canCreateWorkflow ? (
                <div className="workflows-not-found-actions">
                  <button
                    type="button"
                    className="workflows-btn workflows-btn-create workflows-not-found-cta"
                    onClick={() => setShowCreateWorkflowModal(true)}
                  >
                    Create workflow
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="workflows-empty">No workflow found. Add boardId to the URL to load a workflow.</div>
        ) : (
          workflows.map((workflow) => {
            const workflowIsDisabled = workflow.is_active == 0;
            const wfMutationPending = Boolean(mutationTargets[`wf:${workflow.id}`]);
            return (
              <div
                key={workflow.id}
                className={`workflow-card${workflowIsDisabled ? ' workflow-card--disabled' : ''}`}
              >
                <div className="workflow-header workflow-header--mutation-host">
                  <div className="workflow-header-left">
                    {workflowIsDisabled ? (
                      <h3 className="workflow-title">{workflow.name}</h3>
                    ) : (
                      <>
                        <button className="workflow-move-btn" type="button" disabled={wfMutationPending}>
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 5L10 2L13 5M13 15L10 18L7 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {editingWorkflowId === workflow.id ? (
                          <input
                            type="text"
                            className="workflow-title-input"
                            value={editingWorkflowName}
                            onChange={(e) => setEditingWorkflowName(e.target.value)}
                            onBlur={() => handleSaveWorkflowName(workflow.id)}
                            onKeyDown={(e) => handleWorkflowNameKeyPress(e, workflow.id)}
                            autoFocus
                          />
                        ) : (
                          <h3 className="workflow-title">{workflow.name}</h3>
                        )}
                        {canRenameWorkflow ? (
                          <button
                            className="workflow-edit-btn"
                            type="button"
                            disabled={wfMutationPending}
                            onClick={() => handleStartEditWorkflow(workflow.id, workflow.name)}
                          >
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path
                                d="M12.75 2.25C12.9468 2.05322 13.1794 1.89585 13.4349 1.78609C13.6904 1.67633 13.9642 1.61621 14.2417 1.60879C14.5192 1.60137 14.7958 1.64677 15.0571 1.74253C15.3184 1.83829 15.5596 1.98259 15.7685 2.16831C15.9774 2.35403 16.1501 2.57764 16.2784 2.82806C16.4067 3.07848 16.4882 3.35112 16.5188 3.63191C16.5494 3.9127 16.5285 4.19687 16.4573 4.46985C16.3861 4.74283 16.2659 5.00005 16.1025 5.22831L15.0825 6.75L11.25 2.9175L12.7717 1.8975C13 1.73412 13.2572 1.61393 13.5302 1.54272C13.8032 1.47152 14.0874 1.45062 14.3682 1.48122C14.649 1.51182 14.9216 1.59334 15.172 1.72162C15.4225 1.8499 15.6461 2.02264 15.8318 2.23153C16.0175 2.44042 16.1618 2.68164 16.2576 2.94294C16.3534 3.20424 16.3988 3.48079 16.3913 3.75831C16.3839 4.03583 16.3238 4.30964 16.214 4.56512C16.1043 4.8206 15.9469 5.05322 15.75 5.25L6.375 14.625L2.25 15.75L3.375 11.625L12.75 2.25Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        ) : null}
                        <Tooltip
                          id={`workflow-info-${workflow.id}`}
                          place="bottom"
                          className="workflow-info-tooltip"
                          positionStrategy="fixed"
                        >
                          <div>
                            <div>Workflow: {workflow.name}</div>
                            <div>This workflow contains {workflow.swimlanes.length} swimlane(s) with multiple stages for organizing your work.</div>
                          </div>
                        </Tooltip>
                        <button
                          className="workflow-info-btn"
                          type="button"
                          disabled={wfMutationPending}
                          data-tooltip-id={`workflow-info-${workflow.id}`}
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <path d="M9 6V9M9 12H9.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="workflow-header-right">
                    {canDeleteWorkflow ? (
                      <button
                        type="button"
                        className="workflow-action-link workflow-action-link-delete"
                        disabled={wfMutationPending}
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {canDisableWorkflow ? (
                      <button
                        type="button"
                        className="workflow-action-link"
                        disabled={wfMutationPending}
                        onClick={() => handleDisableWorkflow(workflow.id)}
                      >
                        {workflowIsDisabled ? 'Enable' : 'Disable'}
                      </button>
                    ) : null}
                  </div>
                  {wfMutationPending ? (
                    <div className="workflow-header-mutation-overlay" aria-busy="true">
                      <span className="workflow-item-mutation-skeleton workflow-item-mutation-skeleton--pill" />
                    </div>
                  ) : null}
                </div>

                {!workflowIsDisabled ? (
                  <div className="workflow-board">
                    <WorkflowBoard
                      workflow={workflow}
                      mutationTargets={mutationTargets}
                      hoveredColumn={hoveredColumn}
                      stackedRailMetrics={stackedRailMetrics}
                      editingStageId={editingStageId}
                      editingStageName={editingStageName}
                      onStageMouseEnter={handleStageBoxMouseEnter}
                      onStageMouseLeave={handleStageBoxMouseLeave}
                      onAddColumnLeft={handleAddColumnLeft}
                      onAddColumnRight={handleAddColumnRight}
                      onAddSubcolumn={handleAddSubcolumn}
                      onStartEditStage={handleStartEditStage}
                      onEditingStageNameChange={setEditingStageName}
                      onSaveStageName={handleSaveStageNameChange}
                      onStageNameKeyPress={handleStageNameKeyPress}
                      onColorSelect={handleStageColorChange}
                      onDeleteStage={handleDeleteStage}
                      onStageLimitChange={handleStageLimitChange}
                      onStageCardsPerRowChange={handleStageCardsPerRowChange}
                      onAddSwimlane={canCreateSwimlane ? handleAddSwimlane : undefined}
                      onRenameSwimlane={canRenameSwimlane ? handleRenameSwimlane : undefined}
                      onDeleteSwimlane={canDeleteSwimlane ? handleDeleteSwimlane : undefined}
                      onSwimlaneColorSelect={canUpdateSwimlaneColor ? handleSwimlaneColorChange : undefined}
                      canAddColumns={canAddColumns}
                      canUpdateColumnColor={canUpdateColumnColor}
                      canDeleteColumn={canDeleteColumn}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <CreateWorkflowModal
        show={showCreateWorkflowModal}
        onClose={() => setShowCreateWorkflowModal(false)}
        onSave={handleCreateWorkflow}
        isSaving={createWorkflowSaving}
      />

      <DeleteConfirmationModal
        show={!!deleteModal}
        onCancel={() => setDeleteModal(null)}
        onConfirm={handleConfirmDeleteModal}
        deleteText={
          deleteModal?.type === 'workflow'
            ? 'Delete this workflow? This cannot be undone.'
            : deleteModal?.type === 'swimlane'
              ? 'Delete this swimlane? This cannot be undone.'
              : 'Delete this stage? This cannot be undone.'
        }
      />
    </div>
  );
}

export default EditWorkflows;
