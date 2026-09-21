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
  stackedRailMetrics,
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
      {/* Col-stacks for rail positioning (behind stages) */}
      {Array.from({ length: cols }, (_, colIdx) => {
        const stagesInCol = getStagesInColumn(swimlane, area, colIdx);
        const isSingle = stagesInCol.length <= 1;
        const colStackKey = getColStackKey(workflowId, swimlane.id, area, colIdx);
        const showStackedRails = !isSingle && stackedRailMetrics?.colStackKey === colStackKey;
        const stackedStageKey =
          showStackedRails && stackedRailMetrics
            ? getColumnKey(
                stackedRailMetrics.workflowId,
                stackedRailMetrics.swimlaneId,
                stackedRailMetrics.stageId
              )
            : null;
        const stackedRailBusy = Boolean(stackedStageKey && mutationTargets[stackedStageKey]);
        const stackedColSpan =
          showStackedRails && stackedRailMetrics?.colSpan ? stackedRailMetrics.colSpan : 1;
        const colStackGridColumn =
          stackedColSpan > 1 ? `${colIdx + 1} / span ${stackedColSpan}` : `${colIdx + 1}`;
        return (
          <div
            key={`col-${area}-${colIdx}`}
            className={`workflow-area-col-stack${showStackedRails ? ' workflow-area-col-stack--stacked-rails' : ''}`}
            data-col-stack-key={colStackKey}
            style={{
              gridColumn: colStackGridColumn,
              gridRow: `1 / span ${globalRows}`,
            }}
          >
            {showStackedRails && stackedRailMetrics && canAddColumns && (
              <div
                className="workflow-stacked-rail-overlay"
                style={{ top: stackedRailMetrics.top }}
              >
                <div
                  className="workflow-stacked-rail-cell workflow-stacked-rail-cell-left"
                  onMouseLeave={(e) =>
                    onStageMouseLeave?.(e, hoveredColumn, colStackKey)
                  }
                >
                  <button
                    className="workflow-column-add-btn workflow-column-add-left"
                    type="button"
                    disabled={stackedRailBusy}
                    onClick={() =>
                      onAddColumnLeft(
                        stackedRailMetrics.workflowId,
                        stackedRailMetrics.swimlaneId,
                        stackedRailMetrics.stageId
                      )
                    }
                    title={`Add a new column before ${stackedRailMetrics.stageName || ''}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 3V13M3 8H13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                <div className="workflow-stacked-rail-cell-middle" aria-hidden="true" />
                <div
                  className="workflow-stacked-rail-cell workflow-stacked-rail-cell-right"
                  onMouseLeave={(e) =>
                    onStageMouseLeave?.(e, hoveredColumn, colStackKey)
                  }
                >
                  <button
                    className="workflow-column-add-btn workflow-column-add-right"
                    type="button"
                    disabled={stackedRailBusy}
                    onClick={() =>
                      onAddColumnRight(
                        stackedRailMetrics.workflowId,
                        stackedRailMetrics.swimlaneId,
                        stackedRailMetrics.stageId
                      )
                    }
                    title={`Add a new column after ${stackedRailMetrics.stageName || ''}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 3V13M3 8H13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
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
