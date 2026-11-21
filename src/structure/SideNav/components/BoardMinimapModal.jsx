import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import { FiChevronDown, FiFilter, FiUsers, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import { pickForegroundOnSwimlaneBackground } from '../../../pages/EditWorkflows/workflow.utils';
import { buildBoardMinimapWorkflows } from './boardMinimap.utils';
import { EMPTY_BOARD_POSITION } from './genericThenAction';
import '../../../design/scss/business-rule-board-minimap.scss';

const EMPTY_LIST = [];

// Hover hints for what a click selects (column header, swimlane label, single cell).
const COLUMN_TOOLTIP = 'Select the entire column across all swimlanes';
const STAGE_TOOLTIP = 'Select all columns of this stage across all swimlanes';
const PARENT_COLUMN_TOOLTIP = 'Select the entire column group (all its columns) across all swimlanes';
const LANE_TOOLTIP = 'Select the entire swimlane across all columns';
const cellTooltip = (column, lane) => `Select this cell in column ${column.name} and swimlane ${lane.name}`;

// Colour comes from the API as a hex value; it is drawn as an SVG fill so no inline style is needed.
function ColorFill({ color }) {
  if (!color) return null;
  return (
    <svg className="board-minimap-band-fill" width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
      <rect width="100%" height="100%" fill={color} />
    </svg>
  );
}

ColorFill.propTypes = { color: PropTypes.string };

// Board Minimap: pick a board, then click a cell (column + lane), a column header (that column in
// any lane) or a lane label (that lane in any column) to choose where a card goes. The layout
// comes from get_workflow_by_board; only ids are stored (guide 1.5). With columnOnly the map picks
// columns only: a cell, a column header or a parent header all pick the entire column, and swimlane
// labels are not selectable. With allowStagePick a stage band picks every column of that stage.
function BoardMinimapModal({ show, value, boardId, onBoardChange, onPick, onClose, columnOnly = false, allowStagePick = false }) {
  const {
    boardPickerWorkspaces: workspaces, getBoardPickerWorkspaces, boardWorkflowsByBoard, boardWorkflowsStatus, getBoardWorkflows,
  } = useBusinessRuleReducer((s) => s);

  const [isBoardPickerOpen, setIsBoardPickerOpen] = useState(false);
  const [boardFilterText, setBoardFilterText] = useState('');
  const [workspaceFilterId, setWorkspaceFilterId] = useState('');
  const [hoveredColumnIds, setHoveredColumnIds] = useState(EMPTY_LIST);
  const [hoveredLaneId, setHoveredLaneId] = useState(null);

  const boardPickerTriggerRef = useRef(null);
  const boardPickerPanelRef = useRef(null);

  const displayWorkspaces = workspaces ?? EMPTY_LIST;
  const boards = useMemo(
    () => displayWorkspaces.flatMap((w) => (w.boards ?? EMPTY_LIST).map((b) => ({ ...b, workspace_name: w.workspace_name }))),
    [displayWorkspaces]
  );
  const selectedBoard = boards.find((b) => String(b.board_id) === String(boardId));

  const boardFilterQuery = boardFilterText.trim().toLowerCase();
  const filteredWorkspaceGroups = displayWorkspaces
    .filter((w) => !workspaceFilterId || String(w.workspace_id) === String(workspaceFilterId))
    .map((w) => {
      const wsMatch = w.workspace_name.toLowerCase().includes(boardFilterQuery);
      const groupBoards = wsMatch
        ? (w.boards ?? EMPTY_LIST)
        : (w.boards ?? EMPTY_LIST).filter((b) => b.board_name.toLowerCase().includes(boardFilterQuery));
      return { workspace_id: w.workspace_id, workspace_name: w.workspace_name, boards: groupBoards };
    })
    .filter((g) => g.boards.length > 0);

  useEffect(() => {
    if (!show) return;
    setIsBoardPickerOpen(false);
    setBoardFilterText('');
    setWorkspaceFilterId('');
    getBoardPickerWorkspaces();
  }, [show]);

  // No board chosen yet: start on the first board of any workspace.
  useEffect(() => {
    if (!show || boardId || !boards[0]) return;
    onBoardChange(String(boards[0].board_id));
  }, [show, boardId, boards]);

  useEffect(() => {
    if (show && boardId) getBoardWorkflows(boardId, { force: true });
  }, [show, boardId]);

  useEffect(() => {
    if (!isBoardPickerOpen) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (boardPickerPanelRef.current?.contains(t)) return;
      if (boardPickerTriggerRef.current?.contains(t)) return;
      setIsBoardPickerOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isBoardPickerOpen]);

  const rawWorkflows = boardWorkflowsByBoard[String(boardId)] ?? EMPTY_LIST;
  const workflowsStatus = boardWorkflowsStatus[String(boardId)];
  // One block per active workflow, each with its own stage segments, leaf columns and lanes.
  const minimapWorkflows = useMemo(() => buildBoardMinimapWorkflows(rawWorkflows), [rawWorkflows]);
  const position = value ?? EMPTY_BOARD_POSITION;

  const pick = (workflow, column, lane) => onPick({
    boardId: String(boardId),
    workflowId: String(workflow.id),
    columnId: column ? String(column.id) : '',
    swimlaneId: lane ? String(lane.id) : '',
  });

  // The picked scope is marked as a whole: a single cell when both a column and a lane were
  // picked, every cell of the column when only a column header was clicked, and every cell of
  // the lane when only a lane label was clicked.
  // A picked parent column (e.g. Delivery Status) marks every leaf column under it.
  const isColumnPicked = (workflow, column) => {
    if (String(position.columnId) === String(column.id)) return true;
    const pickedHeader = workflow.columnHeaderRows.flat().find((header) => String(header.id) === String(position.columnId));
    return Boolean(pickedHeader?.leafIds.includes(String(column.id)));
  };

  const isSelected = (workflow, column, lane) => {
    if (String(position.workflowId) !== String(workflow.id)) return false;
    const hasColumn = Boolean(position.columnId);
    const hasLane = Boolean(position.swimlaneId);
    if (!hasColumn && !hasLane) return false;
    return (!hasColumn || isColumnPicked(workflow, column))
      && (!hasLane || String(position.swimlaneId) === String(lane.id));
  };

  // A stage band picks every column of that stage (several columns at once, any lane).
  const pickStage = (workflow, segment) => onPick({
    boardId: String(boardId),
    workflowId: String(workflow.id),
    columnId: '',
    columnIds: segment.columns.map((column) => String(column.id)),
    swimlaneId: '',
  });

  const handlePickBoard = (board) => {
    onBoardChange(String(board.board_id));
    setIsBoardPickerOpen(false);
    setBoardFilterText('');
  };

  const renderWorkflow = (workflow) => (
    <div key={workflow.id} className="board-minimap-grid">
      <div className="board-minimap-title-bar">{workflow.name}</div>

      <table className="board-minimap-table">
        <thead>
          <tr>
            {workflow.stageSegments.map((segment) => (
              <th
                key={segment.id}
                colSpan={segment.columns.length}
                className={`board-minimap-area-cell${allowStagePick ? ' board-minimap-area-cell--pickable' : ''}`}
                title={allowStagePick ? STAGE_TOOLTIP : segment.name}
                onClick={allowStagePick ? () => pickStage(workflow, segment) : undefined}
                onMouseEnter={() => setHoveredColumnIds(segment.columns.map((column) => column.id))}
                onMouseLeave={() => setHoveredColumnIds(EMPTY_LIST)}
              >
                <ColorFill color={segment.color} />
                <span className="board-minimap-band-label">{segment.name}</span>
              </th>
            ))}
          </tr>
          {workflow.columnHeaderRows.map((headerRow, rowIndex) => (
            <tr key={`columns-${rowIndex}`}>
              {headerRow.map((column) => (column.isLeaf ? (
                <th
                  key={column.id}
                  rowSpan={column.rowSpan}
                  className="board-minimap-header-cell"
                  title={COLUMN_TOOLTIP}
                  onMouseEnter={() => setHoveredColumnIds(column.leafIds)}
                  onMouseLeave={() => setHoveredColumnIds(EMPTY_LIST)}
                  onClick={() => pick(workflow, column, null)}
                >
                  {column.name}
                </th>
              ) : (
                <th
                  key={column.id}
                  colSpan={column.colSpan}
                  className="board-minimap-header-cell board-minimap-header-cell--parent"
                  title={PARENT_COLUMN_TOOLTIP}
                  onMouseEnter={() => setHoveredColumnIds(column.leafIds)}
                  onMouseLeave={() => setHoveredColumnIds(EMPTY_LIST)}
                  onClick={() => pick(workflow, column, null)}
                >
                  {column.name}
                </th>
              )))}
            </tr>
          ))}
        </thead>
        <tbody>
          {workflow.swimlanes.flatMap((lane) => [
            <tr key={`lane-${lane.id}`}>
              <td
                colSpan={workflow.leafColumns.length}
                className={`board-minimap-lane-label${lane.colorCode && pickForegroundOnSwimlaneBackground(lane.colorCode) !== '#ffffff' ? ' board-minimap-lane-label--dark-text' : ''}`}
                onMouseEnter={columnOnly ? undefined : () => setHoveredLaneId(lane.id)}
                onMouseLeave={columnOnly ? undefined : () => setHoveredLaneId(null)}
                onClick={columnOnly ? undefined : () => pick(workflow, null, lane)}
                title={columnOnly ? undefined : LANE_TOOLTIP}
              >
                <ColorFill color={lane.colorCode} />
                <span className="board-minimap-band-label">{lane.name}</span>
              </td>
            </tr>,
            <tr key={`cells-${lane.id}`}>
              {workflow.leafColumns.map((column) => (
                <td key={column.id} className="board-minimap-cell-wrap">
                  <button
                    type="button"
                    className={`board-minimap-cell${hoveredColumnIds.includes(column.id) ? ' board-minimap-cell--col-active' : ''}${hoveredLaneId === lane.id ? ' board-minimap-cell--row-active' : ''}${isSelected(workflow, column, lane) ? ' board-minimap-cell--selected' : ''}`}
                    onClick={() => pick(workflow, column, columnOnly ? null : lane)}
                    onMouseEnter={columnOnly ? () => setHoveredColumnIds([column.id]) : undefined}
                    onMouseLeave={columnOnly ? () => setHoveredColumnIds(EMPTY_LIST) : undefined}
                    title={columnOnly ? COLUMN_TOOLTIP : cellTooltip(column, lane)}
                    aria-label={`Move to ${workflow.name}, ${lane.name}, ${column.name}`}
                  />
                </td>
              ))}
            </tr>,
          ])}
        </tbody>
      </table>
    </div>
  );

  const renderBody = () => {
    if (!boardId) return <div className="br-property-picker-empty">Select a board to view its structure</div>;
    if (workflowsStatus === 'loading') return <div className="br-property-picker-empty">Loading board structure...</div>;
    if (workflowsStatus && workflowsStatus !== 'done') return <div className="br-property-picker-empty">{workflowsStatus}</div>;
    if (minimapWorkflows.length === 0) return <div className="br-property-picker-empty">No active workflow found for this board</div>;
    return <div className="board-minimap-workflows">{minimapWorkflows.map(renderWorkflow)}</div>;
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal board-minimap-modal"
      dialogClassName="card-property-match-modal-dialog board-minimap-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Board Minimap</h2>
          <button type="button" className="business-rule-form-modal-close" onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body board-minimap-body">
          <div className="board-minimap-picker-wrap">
            <button
              type="button"
              ref={boardPickerTriggerRef}
              className="board-minimap-board-trigger"
              onClick={() => setIsBoardPickerOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={isBoardPickerOpen}
            >
              <span>
                {selectedBoard ? `${selectedBoard.workspace_name} / ${selectedBoard.board_name}` : 'Select a board'}
              </span>
              <FiChevronDown aria-hidden />
            </button>

            {isBoardPickerOpen && (
              <div className="board-minimap-picker-panel" ref={boardPickerPanelRef}>
                <select
                  className="business-rule-form-select board-minimap-picker-workspace-select"
                  value={workspaceFilterId}
                  onChange={(e) => setWorkspaceFilterId(e.target.value)}
                >
                  <option value="">All workspaces</option>
                  {displayWorkspaces.map((w) => (
                    <option key={w.workspace_id} value={w.workspace_id}>{w.workspace_name}</option>
                  ))}
                </select>

                <div className="board-minimap-picker-search">
                  <FiFilter size={20} className="board-minimap-picker-search-icon" aria-hidden />
                  <input
                    type="text"
                    placeholder="Filter"
                    value={boardFilterText}
                    onChange={(e) => setBoardFilterText(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="board-minimap-picker-scroll">
                  {filteredWorkspaceGroups.length === 0 ? (
                    <div className="br-property-picker-empty">No matches</div>
                  ) : (
                    filteredWorkspaceGroups.map((ws) => (
                      <div key={ws.workspace_id} className="board-minimap-picker-group">
                        <div className="board-minimap-picker-group-head">
                          <FiUsers size={20} aria-hidden />
                          <span>{ws.workspace_name}</span>
                        </div>
                        <div className="board-minimap-picker-grid">
                          {ws.boards.map((board) => (
                            <button
                              type="button"
                              key={board.board_id}
                              className={`board-minimap-picker-tile${String(board.board_id) === String(boardId) ? ' board-minimap-picker-tile--selected' : ''}`}
                              onClick={() => handlePickBoard(board)}
                            >
                              <span className="board-minimap-picker-tile-name">{board.board_name}</span>
                              {board.total_cards != null && (
                                <span className="board-minimap-picker-tile-count">{Number(board.total_cards).toLocaleString()}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {renderBody()}
        </div>
      </div>
    </Modal>
  );
}

BoardMinimapModal.propTypes = {
  show: PropTypes.bool.isRequired,
  value: PropTypes.object,
  boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onBoardChange: PropTypes.func.isRequired,
  onPick: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  columnOnly: PropTypes.bool,
  allowStagePick: PropTypes.bool,
};

export default BoardMinimapModal;
