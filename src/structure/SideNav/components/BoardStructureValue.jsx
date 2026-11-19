import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';
import BoardFilterPicker from './BoardFilterPicker';
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
  const [columnId, setColumnId] = useState('');
  const [laneId, setLaneId] = useState('');

  useEffect(() => {
    getBoardPickerWorkspaces();
  }, []);

  useEffect(() => {
    if (boardId) getBoardWorkflows(boardId);
  }, [boardId]);

  const needsLanes = level === 'lane' || level === 'position';
  useEffect(() => {
    if (workflowId && needsLanes) getWorkflowSwimlanes(workflowId);
  }, [workflowId, needsLanes]);

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
        setColumnId('');
        setLaneId('');
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
        setColumnId('');
        setLaneId('');
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

  if (level === 'position') {
    const handleAddPosition = () => {
      if (!columnId) return;
      const entry = laneId ? `${columnId}${POSITION_SEPARATOR}${laneId}` : columnId;
      if (!ids.includes(entry)) onChange(joinMultiValue([...ids, entry]));
      setColumnId('');
      setLaneId('');
    };

    const labelOf = (entry) => {
      const [col, lane] = entry.split(POSITION_SEPARATOR);
      const colLabel = columnOptions.find((o) => o.value === col)?.label ?? `Column #${col}`;
      const laneLabel = lane ? (laneOptions.find((o) => o.value === lane)?.label ?? `Lane #${lane}`) : '';
      return laneLabel ? `${colLabel} / ${laneLabel}` : colLabel;
    };

    return (
      <div className="d-flex flex-column gap-2 flex-fill w-100">
        {ids.map((entry) => (
          <div key={entry} className="business-rule-form-when-fields-pill business-rule-form-when-field-chip">
            <span className="business-rule-form-when-fields-chip-label">{labelOf(entry)}</span>
            <button
              type="button"
              className="business-rule-form-condition-remove"
              onClick={() => onChange(joinMultiValue(ids.filter((id) => id !== entry)))}
              aria-label="Remove position"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
        ))}
        {boardPicker}
        {workflowPicker}
        {workflowId && (
          <>
            <SearchableSelect
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              options={columnOptions}
              placeholder="Select column"
              className="br-value-select"
              menuPortalTarget={document.body}
              menuPlacement="auto"
            />
            <SearchableSelect
              value={laneId}
              onChange={(e) => setLaneId(e.target.value)}
              options={[{ value: '', label: 'Any lane' }, ...laneOptions]}
              placeholder="Select lane (optional)"
              className="br-value-select"
              menuPortalTarget={document.body}
              menuPlacement="auto"
            />
            <button type="button" className="business-rule-form-when-fields-pill" onClick={handleAddPosition} disabled={!columnId}>
              <FiPlus size={14} aria-hidden /> Add position
            </button>
          </>
        )}
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

// Reads as blue "Not Set" text (or "N selected"); clicking it opens the pickers below it.
function BoardStructureValue({ level, value, onChange }) {
  const [open, setOpen] = useState(false);
  const count = splitMultiValue(value).length;

  return (
    <div className="d-flex flex-column gap-2 flex-fill w-100">
      <button
        type="button"
        className="business-rule-form-condition-label-btn br-advanced-schedule-label"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {count > 0 ? `${count} selected` : NOT_SET_LABEL}
      </button>
      {open && <BoardStructureControls level={level} value={value} onChange={onChange} />}
    </div>
  );
}

BoardStructureValue.propTypes = valuePropTypes;

export default BoardStructureValue;
