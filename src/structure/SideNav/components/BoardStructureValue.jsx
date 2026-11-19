import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { FiTrash2 } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';
import BoardFilterPicker from './BoardFilterPicker';
import BoardMinimapModal from './BoardMinimapModal';
import { NOT_SET_LABEL, joinMultiValue, splitMultiValue } from './businessRuleFieldUtils';
import '../../../design/scss/business-rule-board-position.scss';

const POSITION_SEPARATOR = ':';

// get_workflow_by_board nests sub-columns under their parent, so only the leaf columns are listed.
const flattenLeafColumns = (columns = []) =>
  columns.flatMap((col) => (Array.isArray(col.children) && col.children.length > 0 ? flattenLeafColumns(col.children) : [col]));

// Keeps the ids picked from other boards/workflows when the visible option list is re-picked.
const mergeSelection = (currentIds, optionValues, nextSelected) => [
  ...currentIds.filter((id) => !optionValues.includes(id)),
  ...nextSelected,
];

/**
 * Value control for a board_structure field (guide 1.5). `level` is the field's structure_level
 * and decides what can be picked; the board / workflow chosen while drilling down only reach
 * the right list and are never stored. The value is the ids of that level joined by commas
 * (position: "column_id" or "column_id:swimlane_id").
 */
function BoardStructureControls({ level, value, onChange }) {
  const {
    boardPickerWorkspaces: workspaces, getBoardPickerWorkspaces, boardWorkflowsByBoard, getBoardWorkflows,
    swimlanesByWorkflow, getWorkflowSwimlanes,
  } = useBusinessRuleReducer((s) => s);

  const [boardId, setBoardId] = useState('');
  const [workflowId, setWorkflowId] = useState('');

  useEffect(() => {
    getBoardPickerWorkspaces();
  }, []);

  useEffect(() => {
    if (boardId) getBoardWorkflows(boardId);
  }, [boardId]);

  useEffect(() => {
    if (workflowId && level === 'lane') getWorkflowSwimlanes(workflowId);
  }, [workflowId, level]);

  const ids = splitMultiValue(value);
  const workflows = boardWorkflowsByBoard[String(boardId)] ?? [];
  const selectedWorkflow = workflows.find((w) => String(w.workflow_id) === String(workflowId));

  const boardOptions = useMemo(
    () => (workspaces ?? []).flatMap((w) => (w.boards ?? []).map((b) => ({ value: String(b.board_id), label: b.board_name }))),
    [workspaces]
  );
  const workflowOptions = workflows.map((wf) => ({ value: String(wf.workflow_id), label: wf.workflow_name }));
  const columnOptions = (selectedWorkflow?.stages ?? []).flatMap((stage) =>
    flattenLeafColumns(stage.columns ?? []).map((col) => ({ value: String(col.column_id), label: `${stage.stage_name} / ${col.column_name}` }))
  );
  const laneOptions = (swimlanesByWorkflow[String(workflowId)] ?? []).map((lane) => ({ value: String(lane.swimlane_id), label: lane.swimlane_name }));

  const renderMulti = (options, placeholder) => (
    <SearchableSelect
      isMulti
      showSelectAll
      value={ids.filter((id) => options.some((o) => o.value === id))}
      onChange={(e) => onChange(joinMultiValue(mergeSelection(ids, options.map((o) => o.value), e.target.value)))}
      options={options}
      placeholder={placeholder}
      className="br-value-select"
      menuPortalTarget={document.body}
      menuPlacement="auto"
    />
  );

  if (level === 'board') return renderMulti(boardOptions, 'Select boards');

  const boardPicker = (
    <BoardFilterPicker
      workspaces={workspaces ?? []}
      value={boardId}
      onChange={(next) => {
        setBoardId(String(next));
        setWorkflowId('');
      }}
      wrapClassName="br-board-position-wrap"
      triggerClassName="business-rule-form-condition-value"
      triggerIconSize={16}
      panelClassName="br-board-position-panel"
      placeholder="Select board"
    />
  );

  const workflowPicker = boardId && (
    <SearchableSelect
      value={workflowId}
      onChange={(e) => {
        setWorkflowId(e.target.value);
      }}
      options={workflowOptions}
      placeholder="Select workflow"
      className="br-value-select"
      menuPortalTarget={document.body}
      menuPlacement="auto"
    />
  );

  if (level === 'workflow') {
    return (
      <div className="d-flex flex-column gap-2 flex-fill w-100">
        {boardPicker}
        {boardId && renderMulti(workflowOptions, 'Select workflows')}
      </div>
    );
  }

  if (level === 'column') {
    return (
      <div className="d-flex flex-column gap-2 flex-fill w-100">
        {boardPicker}
        {workflowPicker}
        {workflowId && renderMulti(columnOptions, 'Select columns')}
      </div>
    );
  }

  if (level === 'lane') {
    return (
      <div className="d-flex flex-column gap-2 flex-fill w-100">
        {boardPicker}
        {workflowPicker}
        {workflowId && renderMulti(laneOptions, 'Select lanes')}
      </div>
    );
  }

  return null;
}

const valuePropTypes = {
  level: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
};

BoardStructureControls.propTypes = valuePropTypes;

// Position: chosen on the Board Minimap (column, or column + swimlane). Each pick is one entry
// "column_id" or "column_id:swimlane_id"; a pick of only a swimlane carries no column and is not added.
function PositionValue({ value, defaultBoardId = '', onChange }) {
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapBoardId, setMinimapBoardId] = useState('');
  const { boardWorkflowsByBoard, swimlanesByWorkflow, getBoardWorkflows } = useBusinessRuleReducer((s) => s);
  const entries = splitMultiValue(value);

  // The minimap follows the board chosen in the AND "Board is" row (not the first board of the list);
  // a board picked inside the minimap stays until that row changes.
  useEffect(() => {
    if (defaultBoardId) setMinimapBoardId(String(defaultBoardId));
  }, [defaultBoardId]);

  const workflows = Object.values(boardWorkflowsByBoard).flat();
  const findColumn = (id) => workflows.flatMap((wf) => (wf.stages ?? []).flatMap((stage) => flattenLeafColumns(stage.columns ?? [])))
    .find((col) => String(col.column_id) === id);
  const findLane = (id) => workflows.flatMap((wf) => wf.swimlanes ?? swimlanesByWorkflow[String(wf.workflow_id)] ?? [])
    .find((lane) => String(lane.swimlane_id) === id);

  const labelOf = (entry) => {
    const [col, lane] = entry.split(POSITION_SEPARATOR);
    const colLabel = findColumn(col)?.column_name ?? `Column #${col}`;
    if (!lane) return colLabel;
    return `${colLabel} / ${findLane(lane)?.swimlane_name ?? `Lane #${lane}`}`;
  };

  const handlePick = (next) => {
    setShowMinimap(false);
    if (!next.columnId) return;
    if (next.boardId) getBoardWorkflows(next.boardId);
    const entry = next.swimlaneId ? `${next.columnId}${POSITION_SEPARATOR}${next.swimlaneId}` : String(next.columnId);
    if (!entries.includes(entry)) onChange(joinMultiValue([...entries, entry]));
  };

  return (
    <div className="d-flex flex-column gap-2 flex-fill w-100">
      {entries.map((entry) => (
        <div key={entry} className="business-rule-form-when-fields-pill business-rule-form-when-field-chip">
          <span className="business-rule-form-when-fields-chip-label">{labelOf(entry)}</span>
          <button
            type="button"
            className="business-rule-form-condition-remove"
            onClick={() => onChange(joinMultiValue(entries.filter((e) => e !== entry)))}
            aria-label="Remove position"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="business-rule-form-condition-label-btn br-advanced-schedule-label br-board-structure-trigger text-start"
        onClick={() => setShowMinimap(true)}
      >
        {entries.length > 0 ? 'Add position' : NOT_SET_LABEL}
      </button>
      <BoardMinimapModal
        show={showMinimap}
        value={null}
        boardId={minimapBoardId}
        onBoardChange={setMinimapBoardId}
        onPick={handlePick}
        onClose={() => setShowMinimap(false)}
      />
    </div>
  );
}

PositionValue.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
};

// Reads as blue "Not Set" text (or "N selected"); clicking it opens the pickers below it.
function BoardStructureToggle({ level, value, onChange }) {
  const [open, setOpen] = useState(false);
  const count = splitMultiValue(value).length;

  return (
    <div className="d-flex flex-column gap-2 flex-fill w-100">
      <button
        type="button"
        className="business-rule-form-condition-label-btn br-advanced-schedule-label br-board-structure-trigger text-start"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {count > 0 ? `${count} selected` : NOT_SET_LABEL}
      </button>
      {open && <BoardStructureControls level={level} value={value} onChange={onChange} />}
    </div>
  );
}

BoardStructureToggle.propTypes = valuePropTypes;

function BoardStructureValue({ level, value, defaultBoardId, onChange }) {
  if (level === 'position') return <PositionValue value={value} defaultBoardId={defaultBoardId} onChange={onChange} />;
  return <BoardStructureToggle level={level} value={value} onChange={onChange} />;
}

BoardStructureValue.propTypes = {
  ...valuePropTypes,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default BoardStructureValue;
