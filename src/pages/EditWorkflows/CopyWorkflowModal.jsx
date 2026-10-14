import { useState, useEffect, useMemo } from 'react';
import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../../design/scss/structure/side-nav/AddDashboardModal.scss';
import '../../design/scss/EditWorkflows.scss';
import PremiumSelect from '../../components/form/PremiumSelect';

const WORKFLOW_NAME_MAX_LEN = 200;

const findWorkspaceIdByBoard = (workspaces, boardId) => {
  const ws = workspaces.find((w) => w.boards?.some((b) => String(b.board_id) === String(boardId)));
  return ws ? String(ws.workspace_id) : '';
};

const CopyWorkflowModal = ({ show, workflow, workspaces = [], currentBoardId, onClose, onSave, isSaving = false }) => {
  const [workflowName, setWorkflowName] = useState('');
  const [workspaceIds, setWorkspaceIds] = useState([]);
  const [boardIds, setBoardIds] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return;
    const currentWorkspaceId = findWorkspaceIdByBoard(workspaces, currentBoardId);
    setWorkflowName(workflow?.name ? `${workflow.name} (Copy)` : '');
    setWorkspaceIds(currentWorkspaceId ? [currentWorkspaceId] : []);
    setBoardIds(currentBoardId ? [String(currentBoardId)] : []);
    setError('');
  }, [show, workflow, workspaces, currentBoardId]);

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((ws) => ({
        value: String(ws.workspace_id),
        label: String(ws.workspace_name ?? ws.workspace_id),
      })),
    [workspaces]
  );

  const selectedWorkspaces = useMemo(
    () => workspaces.filter((ws) => workspaceIds.includes(String(ws.workspace_id))),
    [workspaces, workspaceIds]
  );

  const boardOptions = useMemo(() => {
    const showWorkspacePrefix = selectedWorkspaces.length > 1;
    return selectedWorkspaces.flatMap((ws) =>
      (ws.boards ?? []).map((b) => {
        const boardLabel = String(b.board_name ?? b.board_id);
        return {
          value: String(b.board_id),
          label: showWorkspacePrefix ? `${ws.workspace_name ?? ws.workspace_id} / ${boardLabel}` : boardLabel,
        };
      })
    );
  }, [selectedWorkspaces]);

  const handleWorkspacesChange = (e) => {
    const nextWorkspaceIds = Array.isArray(e.target?.value) ? e.target.value.map(String) : [];
    const allowedBoardIds = new Set(
      workspaces
        .filter((ws) => nextWorkspaceIds.includes(String(ws.workspace_id)))
        .flatMap((ws) => (ws.boards ?? []).map((b) => String(b.board_id)))
    );
    setWorkspaceIds(nextWorkspaceIds);
    setBoardIds((prev) => prev.filter((id) => allowedBoardIds.has(id)));
    if (error) setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = workflowName.trim();
    if (!trimmed) return setError('Name is required.');
    if (boardIds.length === 0) return setError('Select at least one target board.');
    setError('');
    if (isSaving) return;
    onSave({ workflow_name: trimmed, board_ids: boardIds });
  };

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      className="add-dashboard-modal create-workflow-modal"
      centered
      backdrop="static"
      backdropClassName="add-dashboard-modal-backdrop"
      dialogClassName="add-dashboard-modal-dialog"
      contentClassName="add-dashboard-modal-content"
    >
      <form onSubmit={handleSubmit} className="add-dashboard-form">
        <div className="add-dashboard-modal-header">
          <h2 className="add-dashboard-modal-title">Copy workflow</h2>
          <button
            type="button"
            className="add-dashboard-modal-close"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close"
          >
            <FiX size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="add-dashboard-modal-body">
          <div className="add-dashboard-field">
            <label htmlFor="copyWorkflowName" className="add-dashboard-label">
              Name
            </label>
            <input
              type="text"
              id="copyWorkflowName"
              className="add-dashboard-input"
              placeholder="Enter workflow name"
              value={workflowName}
              onChange={(e) => {
                setWorkflowName(e.target.value);
                if (error) setError('');
              }}
              disabled={isSaving}
              maxLength={WORKFLOW_NAME_MAX_LEN}
              autoFocus
            />
          </div>

          <div className="add-dashboard-field">
            <label className="add-dashboard-label">Workspaces</label>
            <PremiumSelect
              isMulti
              value={workspaceIds}
              onChange={handleWorkspacesChange}
              options={workspaceOptions}
              placeholder="Select workspaces"
              searchPlaceholder="Search workspace..."
              disabled={isSaving}
              className="add-dashboard-premium-select"
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              menuClassName="user-modal-premium-select-menu"
            />
          </div>

          <div className="add-dashboard-field">
            <label className="add-dashboard-label">Boards</label>
            <PremiumSelect
              isMulti
              value={boardIds}
              onChange={(e) => {
                setBoardIds(Array.isArray(e.target?.value) ? e.target.value.map(String) : []);
                if (error) setError('');
              }}
              options={boardOptions}
              placeholder={workspaceIds.length ? 'Select boards' : 'Select a workspace first'}
              searchPlaceholder="Search board..."
              disabled={isSaving || workspaceIds.length === 0}
              className="add-dashboard-premium-select"
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              menuClassName="user-modal-premium-select-menu"
            />
            {workspaceIds.length > 0 && boardOptions.length === 0 ? (
              <div className="add-dashboard-field-hint">No boards in the selected workspaces.</div>
            ) : null}
          </div>

          {error ? (
            <div className="add-dashboard-field-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="add-dashboard-modal-footer">
          <button
            type="button"
            onClick={handleClose}
            className="add-dashboard-btn add-dashboard-btn--text"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="add-dashboard-btn add-dashboard-btn--text" disabled={isSaving}>
            {isSaving ? 'Copying…' : boardIds.length > 1 ? `Copy to ${boardIds.length} boards` : 'Copy'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CopyWorkflowModal;
