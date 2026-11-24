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

// Every column of a stage, parents included: a parent column header on the Board Minimap can be
// picked as a whole, so its id has to be found too.
const flattenAllColumns = (columns = []) =>
  columns.flatMap((col) => [col, ...flattenAllColumns(Array.isArray(col.children) ? col.children : [])]);

// Shown for a position picked without a swimlane (any lane).
const ANY_LANE_LABEL = 'Any lane';
// Shown for a position picked with a swimlane only (every column of that lane).
const ANY_CELL_LABEL = 'Any cell or section';

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
// "column_id", "column_id:swimlane_id" or ":swimlane_id" (a swimlane picked without a column).
function PositionValue({ value, savedLabel = '', defaultBoardId = '', allowLaneOnly = false, onChange }) {
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapBoardId, setMinimapBoardId] = useState('');
  const { boardPickerWorkspaces: workspaces, boardWorkflowsByBoard, swimlanesByWorkflow, getBoardWorkflows } = useBusinessRuleReducer((s) => s);
  const entries = splitMultiValue(value);

  // The minimap follows the board chosen in the AND "Board is" row (not the first board of the list);
  // a board picked inside the minimap stays until that row changes.
  useEffect(() => {
    if (!defaultBoardId) return;
    setMinimapBoardId(String(defaultBoardId));
    // Column and lane names of the saved picks are read from the board's workflows, so they are
    // loaded as soon as the board is known (a reopened rule otherwise shows "Column #id").
    getBoardWorkflows(defaultBoardId);
  }, [defaultBoardId]);

  // An entry is read back as "[workspace][board] / [workflow] COLUMN | LANE", looked up from the boards
  // already loaded (ids are all that is stored); an entry whose board is not loaded shows its ids.
  const describeEntry = (entry) => {
    const [columnId, laneId] = entry.split(POSITION_SEPARATOR);
    // The label the backend saved with the rule; used when the board's workflows cannot be loaded
    // (e.g. no access to the board). A label equal to the raw id carries no name, so it is ignored.
    const nameFromSavedLabel = savedLabel && savedLabel !== entry && entries.length === 1 ? savedLabel : '';
    const found = Object.entries(boardWorkflowsByBoard).flatMap(([boardId, wfs]) => wfs.map((wf) => ({ boardId, wf })))
      .find(({ wf }) => (columnId
        ? (wf.stages ?? []).some((stage) => flattenAllColumns(stage.columns ?? [])
          .some((col) => String(col.column_id) === columnId))
        : (wf.swimlanes ?? []).some((l) => String(l.swimlane_id) === laneId)));
    const workspace = found && (workspaces ?? []).find((w) => (w.boards ?? []).some((bd) => String(bd.board_id) === found.boardId));
    const board = workspace?.boards.find((bd) => String(bd.board_id) === found.boardId);
    const column = found && (found.wf.stages ?? []).flatMap((stage) => flattenAllColumns(stage.columns ?? []))
      .find((col) => String(col.column_id) === columnId);
    const lane = laneId && found
      ? (found.wf.swimlanes ?? swimlanesByWorkflow[String(found.wf.workflow_id)] ?? []).find((l) => String(l.swimlane_id) === laneId)
      : null;
    return {
      boardId: found?.boardId ?? '',
      place: [workspace?.workspace_name, board?.board_name].filter(Boolean).map((name) => `[${name}]`).join(''),
      workflow: found ? `[${found.wf.workflow_name}]` : '',
      column: columnId ? (column?.column_name ?? (nameFromSavedLabel || `Column #${columnId}`)) : ANY_CELL_LABEL,
      lane: laneId ? (lane?.swimlane_name ?? `Lane #${laneId}`) : ANY_LANE_LABEL,
    };
  };

  const findStageOf = (columnId) => Object.values(boardWorkflowsByBoard).flat()
    .flatMap((wf) => wf.stages ?? [])
    .find((stage) => flattenLeafColumns(stage.columns ?? []).some((col) => String(col.column_id) === columnId));

  // Entries that together are every column of one stage (picked with the stage band) read as one
  // result, the stage name; any other entry reads on its own line.
  const pickedWholeColumns = new Set(entries.filter((entry) => !entry.includes(POSITION_SEPARATOR)));
  const groupedColumnIds = new Set();
  const resultLines = entries.flatMap((entry) => {
    if (groupedColumnIds.has(entry)) return [];
    const info = describeEntry(entry);
    const stage = entry.includes(POSITION_SEPARATOR) ? null : findStageOf(entry);
    const stageColumnIds = stage ? flattenLeafColumns(stage.columns ?? []).map((col) => String(col.column_id)) : [];
    if (stageColumnIds.length > 1 && stageColumnIds.every((id) => pickedWholeColumns.has(id))) {
      stageColumnIds.forEach((id) => groupedColumnIds.add(id));
      return [{ entry, info: { ...info, column: stage.stage_name } }];
    }
    return [{ entry, info }];
  });

  // Opens on the board of the entry that was clicked, else on the board chosen in the AND "Board is" row.
  const openMinimap = (entry) => {
    const target = (entry && describeEntry(entry).boardId) || defaultBoardId;
    if (target) setMinimapBoardId(String(target));
    setShowMinimap(true);
  };

  const handlePick = (next) => {
    setShowMinimap(false);
    // A stage band picks all of its columns: one entry per column, any lane.
    if (next.columnIds?.length) {
      if (next.boardId) getBoardWorkflows(next.boardId);
      onChange(joinMultiValue(next.columnIds));
      return;
    }
    if (!next.columnId && !(allowLaneOnly && next.swimlaneId)) return;
    if (next.boardId) getBoardWorkflows(next.boardId);
    const entry = next.swimlaneId ? `${next.columnId}${POSITION_SEPARATOR}${next.swimlaneId}` : String(next.columnId);
    // One pick per row: picking replaces it, picking the same cell again clears it. Another position
    // is added with the row's OR button, which opens a new empty row.
    onChange(entries.includes(entry) ? '' : entry);
  };

  return (
    <div className="d-flex flex-column gap-2 flex-fill w-100">
      {entries.length === 0 && (
        <button
          type="button"
          className="business-rule-form-condition-label-btn br-advanced-schedule-label br-board-structure-trigger text-start"
          onClick={() => openMinimap()}
        >
          {NOT_SET_LABEL}
        </button>
      )}
      {resultLines.map(({ entry, info }) => {
        return (
          <button
            key={entry}
            type="button"
            className="business-rule-form-condition-label-btn br-advanced-schedule-label br-board-structure-trigger text-start"
            onClick={() => openMinimap(entry)}
          >
            {info.place && <span>{info.place} </span>}
            <span>
              {info.workflow} <span className="text-uppercase">{info.column}</span>
              {info.lane && <span className="text-uppercase">{` | ${info.lane}`}</span>}
            </span>
          </button>
        );
      })}
      <BoardMinimapModal
        show={showMinimap}
        value={null}
        boardId={minimapBoardId}
        onBoardChange={setMinimapBoardId}
        onPick={handlePick}
        onClose={() => setShowMinimap(false)}
        allowStagePick
        allowLaneOnly={allowLaneOnly}
      />
    </div>
  );
}

PositionValue.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  savedLabel: PropTypes.string,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  allowLaneOnly: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};

// Column / Lane / Workflow: picked on the Board Minimap, which only lets the field's own level be
// clicked (column header or cell, swimlane, workflow title). The value is the picked ids joined by commas.
const MINIMAP_LEVEL_PROPS = {
  column: { columnOnly: true },
  lane: { laneOnly: true },
  workflow: { workflowOnly: true },
};

function MinimapStructureValue({ level, value, defaultBoardId = '', onChange }) {
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapBoardId, setMinimapBoardId] = useState('');
  const { boardPickerWorkspaces: workspaces, boardWorkflowsByBoard, getBoardWorkflows } = useBusinessRuleReducer((s) => s);
  const entries = splitMultiValue(value);

  useEffect(() => {
    if (!defaultBoardId) return;
    setMinimapBoardId(String(defaultBoardId));
    getBoardWorkflows(defaultBoardId);
  }, [defaultBoardId]);

  const describeEntry = (id) => {
    const located = Object.entries(boardWorkflowsByBoard).flatMap(([boardId, wfs]) => wfs.map((wf) => ({ boardId, wf })))
      .find(({ wf }) => {
        if (level === 'workflow') return String(wf.workflow_id) === id;
        if (level === 'lane') return (wf.swimlanes ?? []).some((lane) => String(lane.swimlane_id) === id);
        return (wf.stages ?? []).some((stage) => flattenAllColumns(stage.columns ?? []).some((col) => String(col.column_id) === id));
      });
    if (!located) return { workflowId: '', boardId: '', text: `#${id}` };
    const { boardId, wf } = located;
    const workspace = (workspaces ?? []).find((w) => (w.boards ?? []).some((bd) => String(bd.board_id) === boardId));
    const board = workspace?.boards.find((bd) => String(bd.board_id) === boardId);
    const place = `[${workspace?.workspace_name ?? ''}][${board?.board_name ?? ''}]`;
    let name = wf.workflow_name;
    if (level === 'lane') name = (wf.swimlanes ?? []).find((lane) => String(lane.swimlane_id) === id)?.swimlane_name;
    if (level === 'column') {
      name = (wf.stages ?? []).flatMap((stage) => flattenAllColumns(stage.columns ?? []))
        .find((col) => String(col.column_id) === id)?.column_name;
    }
    return {
      workflowId: String(wf.workflow_id),
      boardId,
      text: level === 'workflow' ? `${place} ${name}` : `${place} [${wf.workflow_name}] ${name}`,
    };
  };

  const openMinimap = (entry) => {
    const target = (entry && describeEntry(entry).boardId) || defaultBoardId;
    if (target) setMinimapBoardId(String(target));
    setShowMinimap(true);
  };

  const handlePick = (next) => {
    setShowMinimap(false);
    const id = { column: next.columnId, lane: next.swimlaneId, workflow: next.workflowId }[level];
    if (!id) return;
    if (next.boardId) getBoardWorkflows(next.boardId);
    // One pick per row: picking replaces it, picking the same one again clears it.
    onChange(entries.includes(id) ? '' : id);
  };

  const first = entries[0] ? describeEntry(entries[0]) : null;
  const minimapValue = first && {
    workflowId: first.workflowId,
    columnId: level === 'column' ? entries[0] : '',
    swimlaneId: level === 'lane' ? entries[0] : '',
  };

  return (
    <div className="d-flex flex-column gap-2 flex-fill w-100">
      {(entries.length === 0 ? [''] : entries).map((entry) => (
        <button
          key={entry || 'not-set'}
          type="button"
          className="business-rule-form-condition-label-btn br-advanced-schedule-label br-board-structure-trigger text-start"
          onClick={() => openMinimap(entry)}
        >
          {entry ? <span className="text-uppercase">{describeEntry(entry).text}</span> : NOT_SET_LABEL}
        </button>
      ))}
      <BoardMinimapModal
        show={showMinimap}
        value={minimapValue}
        boardId={minimapBoardId}
        onBoardChange={setMinimapBoardId}
        onPick={handlePick}
        onClose={() => setShowMinimap(false)}
        {...MINIMAP_LEVEL_PROPS[level]}
      />
    </div>
  );
}

MinimapStructureValue.propTypes = {
  ...valuePropTypes,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
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

function BoardStructureValue({ level, value, savedLabel, defaultBoardId, allowLaneOnlyPosition = false, onChange }) {
  if (level === 'position') return <PositionValue value={value} savedLabel={savedLabel} defaultBoardId={defaultBoardId} allowLaneOnly={allowLaneOnlyPosition} onChange={onChange} />;
  if (MINIMAP_LEVEL_PROPS[level]) return <MinimapStructureValue level={level} value={value} defaultBoardId={defaultBoardId} onChange={onChange} />;
  return <BoardStructureToggle level={level} value={value} onChange={onChange} />;
}

BoardStructureValue.propTypes = {
  ...valuePropTypes,
  savedLabel: PropTypes.string,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  allowLaneOnlyPosition: PropTypes.bool,
};

export default BoardStructureValue;
