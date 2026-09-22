import {
  getStagesInColumn,
  getColStackKey,
  isCellOccupied,
  getColumnKey,
  isEmptyGridCellSuppressedForChildCap,
} from './workflow.utils';
import WorkflowStageCard from './WorkflowStageCard';

const STAGE_CELL_WIDTH = 180;
const STAGE_GAP = 10;

/**
 * Single area block with grid layout, col-stacks for rails, empty placeholders, and stage cards.
 */
function WorkflowAreaGrid({
  workflowId,
  swimlane,
  area,
  cols,
  globalRows,
  areaStages,
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
  mutationTargets = {},
  canAddColumns,
  canUpdateColumnColor,
  canDeleteColumn,
}) {
  const blockWidth = cols * stageCellWidth + Math.max(0, cols - 1) * stageGap;

  return (
    <div
      className="workflow-area-block workflow-area-block-grid"
      style={{
        width: blockWidth,
        minHeight: globalRows * 108 + (globalRows - 1) * stageGap,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(${stageCellWidth}px, 1fr))`,
        gridTemplateRows: `repeat(${globalRows}, minmax(108px, 1fr))`,
        gap: `var(--stage-gap, ${stageGap}px)`,
      }}
    >
      {/* Col-stacks: structural background per column, behind stages. When a column has more
          than one stage, hovering the top (parent) stage shows a rail overlay spanning the
          whole stack; hovering a child stage instead shows inline rails on that child card. */}
      {Array.from({ length: cols }, (_, colIdx) => {
        const colStackKey = getColStackKey(workflowId, swimlane.id, area, colIdx);
        const stagesInCol = getStagesInColumn(swimlane, area, colIdx);
        const hasStack = stagesInCol.length > 1;
        const sortedStagesInCol = hasStack
          ? [...stagesInCol].sort((a, b) => (a.row ?? 0) - (b.row ?? 0))
          : [];
        const topStage = hasStack ? sortedStagesInCol[0] : null;
        const topStageStableId = topStage
          ? topStage.id ?? `${topStage.stageId ?? 'stage'}-${topStage.columnId ?? 'column'}-${topStage.row ?? 0}-${topStage.col ?? 0}`
          : null;
        const topStageColumnKey = topStage
          ? getColumnKey(workflowId, swimlane.id, topStageStableId)
          : null;
        const showStackedRails = hasStack && hoveredColumn === topStageColumnKey;
        const stackedRailBusy = Boolean(topStageColumnKey && mutationTargets[topStageColumnKey]);

        return (
          <div
            key={`col-${area}-${colIdx}`}
            className={`workflow-area-col-stack${showStackedRails ? ' workflow-area-col-stack--stacked-rails' : ''}`}
            data-col-stack-key={colStackKey}
            style={{
              gridColumn: `${colIdx + 1}`,
              gridRow: `1 / span ${globalRows}`,
            }}
          >
            {showStackedRails && canAddColumns && (
              <div className="workflow-stacked-rail-overlay">
                <div
                  className="workflow-stacked-rail-cell workflow-stacked-rail-cell-left"
                  onMouseLeave={(e) => onStageMouseLeave?.(e, hoveredColumn, colStackKey)}
                >
                  <button
                    className="workflow-column-add-btn workflow-column-add-left"
                    type="button"
                    disabled={stackedRailBusy}
                    onClick={() => onAddColumnLeft(workflowId, swimlane.id, topStageStableId)}
                    title={`Add a new column before ${topStage?.name || ''}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="workflow-stacked-rail-cell-middle" aria-hidden="true" />
                <div
                  className="workflow-stacked-rail-cell workflow-stacked-rail-cell-right"
                  onMouseLeave={(e) => onStageMouseLeave?.(e, hoveredColumn, colStackKey)}
                >
                  <button
                    className="workflow-column-add-btn workflow-column-add-right"
                    type="button"
                    disabled={stackedRailBusy}
                    onClick={() => onAddColumnRight(workflowId, swimlane.id, topStageStableId)}
                    title={`Add a new column after ${topStage?.name || ''}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {/* Empty placeholder cells for unoccupied grid positions */}
      {Array.from({ length: globalRows }, (_, rowIdx) =>
        Array.from({ length: cols }, (_, colIdx) => {
          if (isCellOccupied(areaStages, rowIdx, colIdx, globalRows)) return null;
          if (isEmptyGridCellSuppressedForChildCap(areaStages, rowIdx, colIdx)) return null;
          return (
            <div
              key={`empty-${swimlane.id}-${area}-${rowIdx}-${colIdx}`}
              className="workflow-stage-grid-item workflow-stage-empty-placeholder"
              style={{
                gridColumn: `${colIdx + 1}`,
                gridRow: `${rowIdx + 1}`,
              }}
              aria-hidden="true"
            >
              <div className="workflow-stage-wrapper workflow-stage-empty-cell workflow-stage-single" />
            </div>
          );
        })
      )
        .flat()
        .filter(Boolean)}
      {/* Stages with grid positioning */}
      {areaStages.map((stage) => {
        const stageCol = stage.col ?? 0;
        const stageRow = stage.row ?? 0;
        const stageColSpan = stage.colSpan ?? 1;
        const stageStableId = stage.id ?? `${stage.stageId ?? 'stage'}-${stage.columnId ?? 'column'}-${stageRow}-${stageCol}`;
        const stagesInCol = getStagesInColumn(swimlane, area, stageCol);
        const isSingleInCol = stagesInCol.length <= 1;
        const sortedStagesInCol = [...stagesInCol].sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
        const getStableStageId = (stageItem) =>
          stageItem?.id ?? `${stageItem?.stageId ?? 'stage'}-${stageItem?.columnId ?? 'column'}-${stageItem?.row ?? 0}-${stageItem?.col ?? 0}`;
        const isTopStackedCard = !isSingleInCol && getStableStageId(sortedStagesInCol[0]) === stageStableId;
        const stageGridRow = isSingleInCol ? `1 / span ${globalRows}` : `${stageRow + 1}`;
        const stageColumnKey = getColumnKey(workflowId, swimlane.id, stageStableId);
        const colStackKey = getColStackKey(workflowId, swimlane.id, area, stageCol);
        const isStageHovered = hoveredColumn === stageColumnKey;
        const showAddSubcolumn = isSingleInCol ? true : !isTopStackedCard;
        const columnMutationState = mutationTargets[stageColumnKey];

        return (
          <div
            key={`${swimlane.id}-${stageStableId}-${stageRow}-${stageCol}`}
            className="workflow-stage-grid-item"
            data-col-stack-key={colStackKey}
            style={{
              gridColumn: `${stageCol + 1} / span ${stageColSpan}`,
              gridRow: stageGridRow,
              height: '100%',
              minHeight: 0,
            }}
          >
            <WorkflowStageCard
              stage={stage}
              swimlaneStages={swimlane.stages}
              swimlaneId={swimlane.id}
              workflowId={workflowId}
              stageColumnKey={stageColumnKey}
              colStackKey={colStackKey}
              isStageHovered={isStageHovered}
              showAddSubcolumn={showAddSubcolumn}
              isSingleInCol={isSingleInCol}
              usesParentStackRail={isTopStackedCard}
              mutationState={columnMutationState}
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
              canAddColumns={canAddColumns}
              canUpdateColumnColor={canUpdateColumnColor}
              canDeleteColumn={canDeleteColumn}
            />
          </div>
        );
      })}
    </div>
  );
}

export default WorkflowAreaGrid;
export { STAGE_CELL_WIDTH, STAGE_GAP };
