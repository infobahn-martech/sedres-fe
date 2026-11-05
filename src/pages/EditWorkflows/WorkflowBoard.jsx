import { Droppable, Draggable } from '@hello-pangea/dnd';
import {
  getAreaBlockWidth,
  getBoardColumnStructure,
  getGlobalRowsForSwimlane,
  getWorkflowAreaHeaderStyles,
  getZoomCorrectedDragStyle,
} from './workflow.utils';
import WorkflowSwimlane from './WorkflowSwimlane';
import WorkflowAreaGrid, { STAGE_CELL_WIDTH, STAGE_GAP } from './WorkflowAreaGrid';

/**
 * Workflow board: area headers + swimlane rows with area blocks.
 */
function WorkflowBoard({
  workflow,
  mutationTargets = {},
  stageCellWidth = STAGE_CELL_WIDTH,
  stageGap = STAGE_GAP,
  hoveredColumn,
  editingStageId,
  editingStageName,
  onStageMouseEnter,
  onStageMouseLeave,
  onAddColumnLeft,
  onAddColumnRight,
  onAddSubcolumn,
  onStartEditStage,
  onEditingStageNameChange,
  onSaveStageName,
  onStageNameKeyPress,
  onColorSelect,
  onDeleteStage,
  onStageLimitChange,
  onStageCardsPerRowChange,
  onStageDescriptionChange,
  onAddSwimlane,
  onRenameSwimlane,
  onDeleteSwimlane,
  onSwimlaneColorSelect,
  onSwimlaneDescriptionChange,
  canReorderSwimlanes,
  canAddColumns,
  canUpdateColumnColor,
  canDeleteColumn,
}) {
  const boardStructure = getBoardColumnStructure(workflow);
  const totalCols = boardStructure.reduce((sum, x) => sum + x.cols, 0);

  if (totalCols === 0) return null;

  const firstSwimlane = workflow.swimlanes[0];

  const labelSpacerWidth = 170;
  const boardMinWidth =
    labelSpacerWidth + stageGap +
    totalCols * stageCellWidth + Math.max(0, totalCols - 1) * stageGap;

  return (
    <div
      className="workflow-board-inner"
      style={{
        minWidth: boardMinWidth,
        '--stage-cell-width': `${stageCellWidth}px`,
        '--stage-gap': `${stageGap}px`,
      }}
    >
      {/* Board-level area headers - rendered once */}
      <div className="workflow-board-headers-row">
        <div className="workflow-board-label-spacer" aria-hidden="true" />
        <div className="workflow-board-headers">
          {boardStructure.map(({ area, cols }) => {
            const areaInfo = workflow.areaMeta?.[area];
            const label = areaInfo?.label ?? area;
            return (
              <div
                key={area}
                className="workflow-board-area-header"
                style={{
                  width: getAreaBlockWidth(cols, stageCellWidth, stageGap),
                  ...getWorkflowAreaHeaderStyles(areaInfo?.color),
                }}
                title={label}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
      {/* Single shared stage row (LIVE: one row of stage cards, then swimlane rows below) */}
      {workflow.swimlanes.length > 0 && (
        <div className="workflow-board-body workflow-stage-row">
          <div className="workflow-board-label-spacer" aria-hidden="true" />
          {boardStructure.map(({ area, cols }) => {
            const areaStages = firstSwimlane.stages.filter((s) => s.area === area);
            const globalRows = getGlobalRowsForSwimlane(firstSwimlane, boardStructure);
            return (
              <WorkflowAreaGrid
                key={area}
                workflowId={workflow.id}
                swimlane={firstSwimlane}
                area={area}
                cols={cols}
                globalRows={globalRows}
                areaStages={areaStages}
                stageCellWidth={stageCellWidth}
                stageGap={stageGap}
                hoveredColumn={hoveredColumn}
                editingStageId={editingStageId}
                editingStageName={editingStageName}
                onStageMouseEnter={onStageMouseEnter}
                onStageMouseLeave={onStageMouseLeave}
                onAddColumnLeft={onAddColumnLeft}
                onAddColumnRight={onAddColumnRight}
                onAddSubcolumn={onAddSubcolumn}
                onStartEditStage={onStartEditStage}
                onEditingStageNameChange={onEditingStageNameChange}
                onSaveStageName={onSaveStageName}
                onStageNameKeyPress={onStageNameKeyPress}
                onColorSelect={onColorSelect}
                onDeleteStage={onDeleteStage}
                onStageLimitChange={onStageLimitChange}
                onStageCardsPerRowChange={onStageCardsPerRowChange}
                onStageDescriptionChange={onStageDescriptionChange}
                mutationTargets={mutationTargets}
                canAddColumns={canAddColumns}
                canUpdateColumnColor={canUpdateColumnColor}
                canDeleteColumn={canDeleteColumn}
              />
            );
          })}
        </div>
      )}
      {/* Swimlane rows with add-grid bars inside each swimlane label card (visible on hover); drag the grip to reorder */}
      <Droppable droppableId={`swimlanes-${workflow.id}`} type="SWIMLANE">
        {(droppableProvided) => (
          <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
            {workflow.swimlanes.map((swimlane, index) => (
              <Draggable
                key={swimlane.id}
                draggableId={`swimlane-${workflow.id}-${swimlane.id}`}
                index={index}
                isDragDisabled={!canReorderSwimlanes || Boolean(mutationTargets[`sl:${swimlane.id}`])}
              >
                {(draggableProvided, draggableSnapshot) => (
                  <div
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    style={getZoomCorrectedDragStyle(draggableProvided.draggableProps.style)}
                    className={`workflow-swimlane-draggable${draggableSnapshot.isDragging ? ' workflow-swimlane-draggable--dragging' : ''}`}
                  >
                    <WorkflowSwimlane
                      workflowId={workflow.id}
                      swimlane={swimlane}
                      boardStructure={boardStructure}
                      stageCellWidth={stageCellWidth}
                      stageGap={stageGap}
                      contentRowOnly
                      hoveredColumn={hoveredColumn}
                      editingStageId={editingStageId}
                      editingStageName={editingStageName}
                      onStageMouseEnter={onStageMouseEnter}
                      onStageMouseLeave={onStageMouseLeave}
                      onAddColumnLeft={onAddColumnLeft}
                      onAddColumnRight={onAddColumnRight}
                      onAddSubcolumn={onAddSubcolumn}
                      onStartEditStage={onStartEditStage}
                      onEditingStageNameChange={onEditingStageNameChange}
                      onSaveStageName={onSaveStageName}
                      onStageNameKeyPress={onStageNameKeyPress}
                      onColorSelect={onColorSelect}
                      onDeleteStage={onDeleteStage}
                      onStageLimitChange={onStageLimitChange}
                      onStageCardsPerRowChange={onStageCardsPerRowChange}
                      onStageDescriptionChange={onStageDescriptionChange}
                      onAddSwimlane={onAddSwimlane}
                      onRenameSwimlane={onRenameSwimlane}
                      onDeleteSwimlane={onDeleteSwimlane}
                      onSwimlaneColorSelect={onSwimlaneColorSelect}
                      onSwimlaneDescriptionChange={onSwimlaneDescriptionChange}
                      swimlaneIndex={index}
                      dragHandleProps={canReorderSwimlanes ? draggableProvided.dragHandleProps : null}
                      mutationTargets={mutationTargets}
                      canAddColumns={canAddColumns}
                      canUpdateColumnColor={canUpdateColumnColor}
                      canDeleteColumn={canDeleteColumn}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default WorkflowBoard;
export { STAGE_CELL_WIDTH, STAGE_GAP };
