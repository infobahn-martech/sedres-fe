import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import BoardMinimapModal from './BoardMinimapModal';
import { EMPTY_BOARD_POSITION } from './genericThenAction';

const EMPTY_LIST = [];

const hasPosition = (position) => Boolean(position.boardId || position.workflowId || position.columnId || position.swimlaneId);

// "Move card to / Choose where to move" card of the Move the card THEN action. The target is
// picked on the Board Minimap; only ids are kept, the names shown here are looked up.
function MoveTargetAction({ position, title = 'Move card to', defaultBoardId = '', embedded = false, startOpen = false, emptyLabel = 'Choose where to move', onChange }) {
  const [isOpen, setIsOpen] = useState(startOpen);
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapBoardId, setMinimapBoardId] = useState(position.boardId);

  const {
    boardPickerWorkspaces: workspaces, boardWorkflowsByBoard, getBoardWorkflows, swimlanesByWorkflow, getWorkflowSwimlanes,
  } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    if (position.boardId) getBoardWorkflows(position.boardId);
  }, [position.boardId]);

  const board = (workspaces ?? EMPTY_LIST).flatMap((w) => w.boards ?? EMPTY_LIST)
    .find((b) => String(b.board_id) === String(position.boardId));
  const workflow = (boardWorkflowsByBoard[String(position.boardId)] ?? EMPTY_LIST)
    .find((wf) => String(wf.workflow_id) === String(position.workflowId));
  useEffect(() => {
    if (position.workflowId && !workflow?.swimlanes) getWorkflowSwimlanes(position.workflowId);
  }, [position.workflowId, workflow]);

  const column = (workflow?.stages ?? EMPTY_LIST).flatMap((stage) => stage.columns ?? EMPTY_LIST)
    .flatMap((c) => [c, ...(c.children ?? EMPTY_LIST)])
    .find((c) => String(c.column_id) === String(position.columnId));
  const lane = (workflow?.swimlanes ?? swimlanesByWorkflow[String(position.workflowId)] ?? EMPTY_LIST)
    .find((l) => String(l.swimlane_id) === String(position.swimlaneId));

  const workspace = (workspaces ?? EMPTY_LIST).find((w) => (w.boards ?? EMPTY_LIST).some((b) => String(b.board_id) === String(position.boardId)));

  // Read as "[workspace][board][workflow] COLUMN | LANE", the same way a picked Position is shown in AND.
  const placeLabel = [workspace?.workspace_name, board?.board_name, workflow?.workflow_name].filter(Boolean).map((name) => `[${name}]`).join('');
  const label = [placeLabel, column?.column_name, lane?.swimlane_name && `| ${lane.swimlane_name}`].filter(Boolean).join(' ');

  const handleRemove = () => {
    onChange({ ...EMPTY_BOARD_POSITION });
    setIsOpen(false);
  };

  const minimap = (
    <BoardMinimapModal
      show={showMinimap}
      value={position}
      boardId={minimapBoardId}
      onBoardChange={setMinimapBoardId}
      onPick={(next) => { onChange(next); setShowMinimap(false); }}
      onClose={() => setShowMinimap(false)}
    />
  );

  const handleOpenMinimap = () => { setMinimapBoardId(position.boardId || String(defaultBoardId)); setShowMinimap(true); };

  // Embedded: just the "choose where" link + minimap, inside another action's card.
  if (embedded) {
    return (
      <>
        <button type="button" className="br-create-action-link br-create-action-link--btn" onClick={handleOpenMinimap}>
          {hasPosition(position) ? (label || 'Selected') : emptyLabel}
        </button>
        {minimap}
      </>
    );
  }

  if (!isOpen && !hasPosition(position)) {
    return (
      <button type="button" className="business-rule-form-add-link" onClick={() => setIsOpen(true)}>
        <FiPlus size={14} aria-hidden />
        Add new action
      </button>
    );
  }

  return (
    <div className="br-create-action-list">
      <div className="br-create-action-card">
        <button type="button" className="business-rule-form-action-detail-close" onClick={handleRemove} aria-label="Remove action">
          <FiX size={14} />
        </button>
        <h5 className="br-create-action-title">{title}</h5>
        <button
          type="button"
          className="br-create-action-link br-create-action-link--btn"
          onClick={handleOpenMinimap}
        >
          {hasPosition(position) ? (label || 'Selected') : emptyLabel}
        </button>
      </div>

      {minimap}
    </div>
  );
}

MoveTargetAction.propTypes = {
  position: PropTypes.shape({
    boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    workflowId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    columnId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    swimlaneId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
  embedded: PropTypes.bool,
  startOpen: PropTypes.bool,
  emptyLabel: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

export default MoveTargetAction;
