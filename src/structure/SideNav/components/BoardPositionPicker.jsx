import { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';
import BoardFilterPicker from './BoardFilterPicker';
import '../../../design/scss/business-rule-board-position.scss';
import { EMPTY_BOARD_POSITION } from './genericThenAction';

// Board -> workflow -> column -> lane picker (guide 1.5). Every list comes from the existing
// Kanban APIs; only ids are stored, never names.
function BoardPositionPicker({ value, onChange }) {
  const {
    boardPickerWorkspaces: workspaces, getBoardPickerWorkspaces, boardWorkflowsByBoard, getBoardWorkflows, swimlanesByWorkflow, getWorkflowSwimlanes,
  } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    getBoardPickerWorkspaces();
  }, []);

  useEffect(() => {
    if (value.boardId) getBoardWorkflows(value.boardId);
  }, [value.boardId]);

  useEffect(() => {
    if (value.workflowId) getWorkflowSwimlanes(value.workflowId);
  }, [value.workflowId]);

  const workflows = boardWorkflowsByBoard[String(value.boardId)] ?? [];
  const selectedWorkflow = workflows.find((w) => String(w.workflow_id) === String(value.workflowId));
  const stages = useMemo(() => selectedWorkflow?.stages ?? [], [selectedWorkflow]);
  const swimlanes = swimlanesByWorkflow[String(value.workflowId)] ?? [];

  const workflowOptions = workflows.map((wf) => ({ value: String(wf.workflow_id), label: wf.workflow_name }));
  const columnOptions = stages.flatMap((stage) =>
    (stage.columns ?? []).map((col) => ({ value: String(col.column_id), label: `${stage.stage_name} / ${col.column_name}` }))
  );
  const laneOptions = swimlanes.map((lane) => ({ value: String(lane.swimlane_id), label: lane.swimlane_name }));

  return (
    <div className="d-flex flex-column gap-2">
      <BoardFilterPicker
        workspaces={workspaces ?? []}
        value={value.boardId}
        onChange={(boardId) => onChange({ ...EMPTY_BOARD_POSITION, boardId: String(boardId) })}
        wrapClassName="br-board-position-wrap"
        triggerClassName="business-rule-form-condition-value"
        triggerIconSize={16}
        panelClassName="br-board-position-panel"
        placeholder="Select board"
      />

      {value.boardId && (
        <SearchableSelect
          value={value.workflowId}
          onChange={(e) => onChange({ ...value, workflowId: e.target.value, columnId: '', swimlaneId: '' })}
          options={workflowOptions}
          placeholder="Select workflow"
          menuPortalTarget={document.body}
          menuPlacement="auto"
        />
      )}

      {value.workflowId && (
        <>
          <SearchableSelect
            value={value.columnId}
            onChange={(e) => onChange({ ...value, columnId: e.target.value })}
            options={columnOptions}
            placeholder="Select column"
            menuPortalTarget={document.body}
            menuPlacement="auto"
          />

          <SearchableSelect
            value={value.swimlaneId}
            onChange={(e) => onChange({ ...value, swimlaneId: e.target.value })}
            options={laneOptions}
            placeholder="Select lane"
            menuPortalTarget={document.body}
            menuPlacement="auto"
          />
        </>
      )}
    </div>
  );
}

BoardPositionPicker.propTypes = {
  value: PropTypes.shape({
    boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    workflowId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    columnId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    swimlaneId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default BoardPositionPicker;
