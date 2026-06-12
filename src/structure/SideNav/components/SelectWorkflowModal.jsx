import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import '../../../design/scss/structure/side-nav/SelectWorkflowModal.scss';

function WorkflowCardIllustrationKanban({ uid = 'k' }) {
  const a = `swm-k1-${uid}`;
  const b = `swm-k2-${uid}`;
  const c = `swm-k3-${uid}`;
  return (
    <svg className="select-workflow-card-illustration" viewBox="0 0 160 120" aria-hidden>
      <defs>
        <linearGradient id={a} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={b} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id={c} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect x="8" y="12" width="44" height="96" rx="8" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" />
      <rect x="12" y="16" width="36" height="10" rx="3" fill={`url(#${a})`} />
      <rect x="14" y="32" width="32" height="8" rx="2" fill="#dbeafe" />
      <rect x="14" y="44" width="32" height="8" rx="2" fill="#eff6ff" />
      <rect x="58" y="12" width="44" height="96" rx="8" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" />
      <rect x="62" y="16" width="36" height="10" rx="3" fill={`url(#${b})`} />
      <rect x="64" y="32" width="32" height="8" rx="2" fill="#ffedd5" />
      <rect x="108" y="12" width="44" height="96" rx="8" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" />
      <rect x="112" y="16" width="36" height="10" rx="3" fill={`url(#${c})`} />
      <rect x="114" y="32" width="32" height="8" rx="2" fill="#dcfce7" />
      <circle cx="24" cy="104" r="3" fill="#94a3b8" opacity="0.5" />
      <path d="M24 104 Q 50 80 90 95 T 140 88" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="3 4" />
    </svg>
  );
}

function WorkflowCardIllustrationFlow({ uid = 'f' }) {
  return (
    <svg className="select-workflow-card-illustration" viewBox="0 0 160 120" aria-hidden>
      <rect x="18" y="22" width="124" height="76" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x="28" y="34" width="36" height="14" rx="6" fill="#e0e7ff" />
      <rect x="36" y="38" width="14" height="3" rx="1" fill="#4f46e5" opacity="0.85" />
      <rect x="36" y="43" width="10" height="3" rx="1" fill="#4f46e5" opacity="0.85" />
      <circle cx="52" cy="72" r="8" fill="#3b82f6" opacity="0.9" />
      <circle cx="96" cy="58" r="8" fill="#22c55e" opacity="0.9" />
      <circle cx="118" cy="82" r="6" fill="#a855f7" opacity="0.85" />
      <path d="M60 72 Q78 52 88 58" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M104 58 Q110 68 112 76" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="102" y="28" width="28" height="10" rx="4" fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}


const DEFAULT_WORKFLOW_DESCRIPTION =
  "New cards open in this workflow's columns so you can track work in the right swimlanes.";

const DEFAULT_SWIMLANE_HELPER =
  'New cards in this workflow can be created in the selected swimlane.';

/**
 * Kanban Add (+) selection: workflow list and/or swimlane list (same chrome & card styling).
 * @param {'workflow' | 'swimlane'} props.selectionMode
 */
function SelectWorkflowModal({
  show,
  selectionMode,
  workflows,
  swimlanes,
  workflowContextName,
  swimlaneHelperText,
  selectedWorkflowId,
  selectedSwimlaneId,
  onSelectWorkflowId,
  onSelectSwimlaneId,
  onClose,
  onContinue,
  onExited,
}) {
  const handleClose = () => {
    onClose();
  };

  const isWorkflowMode = selectionMode === 'workflow';
  const list = isWorkflowMode ? workflows || [] : swimlanes || [];
  const empty = !list || list.length === 0;

  const isSelectedWorkflow = (id) =>
    selectedWorkflowId != null && (selectedWorkflowId === id || String(selectedWorkflowId) === String(id));

  const isSelectedSwimlane = (id) =>
    selectedSwimlaneId != null && (selectedSwimlaneId === id || String(selectedSwimlaneId) === String(id));

  const handleContinue = () => {
    if (empty) return;
    if (isWorkflowMode) {
      if (selectedWorkflowId == null) return;
    } else if (selectedSwimlaneId == null) {
      return;
    }
    onContinue();
  };

  const modalTitle = isWorkflowMode ? 'Select Workflow' : 'Select Swimlane';
  const titleId = 'select-workflow-modal-title';
  const helperText = !isWorkflowMode ? swimlaneHelperText ?? DEFAULT_SWIMLANE_HELPER : null;

  return (
    <Modal
      show={show}
      onHide={handleClose}
      onExited={onExited}
      className="select-workflow-modal"
      centered
      backdrop="static"
      backdropClassName="select-workflow-modal-backdrop"
      dialogClassName="select-workflow-modal-dialog"
      contentClassName="select-workflow-modal-content"
    >
      <div className="select-workflow-modal-inner">
        <div className="select-workflow-modal-header">
          <div className="select-workflow-modal-header-text">
            <h2 className="select-workflow-modal-title" id={titleId}>
              {modalTitle}
            </h2>
            {!isWorkflowMode && workflowContextName ? (
              <p className="select-workflow-modal-context" id="select-workflow-modal-context">
                {workflowContextName}
              </p>
            ) : null}
          </div>
          <button type="button" className="select-workflow-modal-close" onClick={handleClose} aria-label="Close">
            <FiX size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="select-workflow-modal-body">
          {empty ? (
            <div className="select-workflow-modal-empty" role="status">
              {isWorkflowMode
                ? 'No workflows are available on this board yet. Add or configure workflows before creating a card.'
                : 'No swimlanes are available for this workflow.'}
            </div>
          ) : (
            <>
              {helperText ? (
                <p className="select-workflow-modal-helper" id="select-workflow-modal-helper">
                  {helperText}
                </p>
              ) : null}
              <ul
                className="select-workflow-modal-cards"
                role="radiogroup"
                aria-labelledby={titleId}
                aria-describedby={
                  !isWorkflowMode && workflowContextName ? 'select-workflow-modal-context' : undefined
                }
              >
                {isWorkflowMode
                  ? list.map((w, index) => (
                      <li key={String(w.id)}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSelectedWorkflow(w.id)}
                          className={`select-workflow-card ${isSelectedWorkflow(w.id) ? 'is-selected' : ''}`}
                          onClick={() => onSelectWorkflowId(w.id)}
                        >
                          <div className="select-workflow-card-copy">
                            <h3 className="select-workflow-card-title">{w.name}</h3>
                            <p className="select-workflow-card-desc">{w.description ?? DEFAULT_WORKFLOW_DESCRIPTION}</p>
                          </div>
                          <div className="select-workflow-card-art" aria-hidden>
                            {index % 2 === 0 ? (
                              <WorkflowCardIllustrationKanban uid={`w-${String(w.id)}`} />
                            ) : (
                              <WorkflowCardIllustrationFlow uid={`w-${String(w.id)}`} />
                            )}
                          </div>
                        </button>
                      </li>
                    ))
                  : list.map((sl, index) => (
                      <li key={String(sl.id)}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSelectedSwimlane(sl.id)}
                          className={`select-workflow-card ${isSelectedSwimlane(sl.id) ? 'is-selected' : ''}`}
                          onClick={() => onSelectSwimlaneId(sl.id)}
                        >
                          <div className="select-workflow-card-copy">
                            <h3 className="select-workflow-card-title">{sl.name}</h3>
                            <p className="select-workflow-card-desc select-workflow-card-desc--muted">
                              Swimlane
                            </p>
                          </div>
                          <div className="select-workflow-card-art" aria-hidden>
                            {index % 2 === 0 ? (
                              <WorkflowCardIllustrationKanban uid={`s-${String(sl.id)}`} />
                            ) : (
                              <WorkflowCardIllustrationFlow uid={`s-${String(sl.id)}`} />
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
              </ul>
            </>
          )}
        </div>

        <div className="select-workflow-modal-footer">
          <button type="button" onClick={handleClose} className="select-workflow-btn select-workflow-btn--text">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="select-workflow-btn select-workflow-btn--primary"
            disabled={
              empty || (isWorkflowMode ? selectedWorkflowId == null : selectedSwimlaneId == null)
            }
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}

SelectWorkflowModal.propTypes = {
  show: PropTypes.bool.isRequired,
  selectionMode: PropTypes.oneOf(['workflow', 'swimlane']).isRequired,
  workflows: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      description: PropTypes.string,
    })
  ),
  swimlanes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
    })
  ),
  workflowContextName: PropTypes.string,
  swimlaneHelperText: PropTypes.string,
  selectedWorkflowId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedSwimlaneId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectWorkflowId: PropTypes.func.isRequired,
  onSelectSwimlaneId: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  onExited: PropTypes.func,
};

SelectWorkflowModal.defaultProps = {
  workflows: [],
  swimlanes: [],
  workflowContextName: undefined,
  swimlaneHelperText: undefined,
  selectedWorkflowId: null,
  selectedSwimlaneId: null,
  onExited: undefined,
};

export default SelectWorkflowModal;
