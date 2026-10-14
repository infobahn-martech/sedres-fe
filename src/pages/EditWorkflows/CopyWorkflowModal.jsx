import { useState, useEffect, useMemo } from 'react';
import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../../design/scss/structure/side-nav/AddDashboardModal.scss';
import '../../design/scss/EditWorkflows.scss';

const WORKFLOW_NAME_MAX_LEN = 200;

const CopyWorkflowModal = ({ show, workflow, workspaces = [], currentBoardId, onClose, onSave, isSaving = false }) => {
  const [workflowName, setWorkflowName] = useState('');
  const [boardIds, setBoardIds] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return;
    setWorkflowName(workflow?.name ? `${workflow.name} (Copy)` : '');
    setBoardIds(currentBoardId ? [String(currentBoardId)] : []);
    setError('');
  }, [show, workflow, currentBoardId]);

  const targetWorkspaces = useMemo(() => workspaces.filter((ws) => ws.boards?.length), [workspaces]);

  const clearError = () => {
    if (error) setError('');
  };

  const toggleBoard = (id, checked) => {
    setBoardIds((prev) => (checked ? [...prev, id] : prev.filter((b) => b !== id)));
    clearError();
  };

  const toggleWorkspace = (ws, checked) => {
    const ids = ws.boards.map((b) => String(b.board_id));
    setBoardIds((prev) =>
      checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id))
    );
    clearError();
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
      className="add-dashboard-modal create-workflow-modal copy-workflow-modal"
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
                clearError();
              }}
              disabled={isSaving}
              maxLength={WORKFLOW_NAME_MAX_LEN}
              autoFocus
            />
          </div>

          <div className="add-dashboard-field">
            <div className="copy-workflow-targets-head">
              <span className="add-dashboard-label">Copy to boards</span>
              <span className="copy-workflow-targets-count">{boardIds.length} selected</span>
            </div>
            <div className="copy-workflow-targets">
              {targetWorkspaces.length === 0 ? (
                <div className="add-dashboard-field-hint">No boards found.</div>
              ) : (
                targetWorkspaces.map((ws) => {
                  const wsIds = ws.boards.map((b) => String(b.board_id));
                  const selectedCount = wsIds.filter((id) => boardIds.includes(id)).length;
                  const allSelected = selectedCount === wsIds.length;
                  const wsCheckboxId = `copy-wf-ws-${ws.workspace_id}`;
                  return (
                    <div className="copy-workflow-ws" key={ws.workspace_id}>
                      <div className="copy-workflow-ws-title">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={wsCheckboxId}
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = selectedCount > 0 && !allSelected;
                          }}
                          onChange={(e) => toggleWorkspace(ws, e.target.checked)}
                          disabled={isSaving}
                        />
                        <label htmlFor={wsCheckboxId}>{ws.workspace_name ?? ws.workspace_id}</label>
                      </div>
                      {ws.boards.map((b) => {
                        const id = String(b.board_id);
                        const boardCheckboxId = `copy-wf-board-${id}`;
                        return (
                          <div className="copy-workflow-board" key={id}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={boardCheckboxId}
                              checked={boardIds.includes(id)}
                              onChange={(e) => toggleBoard(id, e.target.checked)}
                              disabled={isSaving}
                            />
                            <label htmlFor={boardCheckboxId}>
                              {b.board_name ?? id}
                              {id === String(currentBoardId) ? (
                                <span className="copy-workflow-board-current">Current</span>
                              ) : null}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
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
