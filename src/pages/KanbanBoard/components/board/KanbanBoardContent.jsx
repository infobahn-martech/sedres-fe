import WorkflowAccordion from "./WorkflowAccordion";
import WorkflowColumns from "./WorkflowColumns";

export default function KanbanBoardContent({
  workflows,
  cardsById,
  boardLoading = false,
  suppressEmptyMessage = false,
  expandedWorkflows,
  collapsedColumns,
  maxColumnHeights,
  createDragEndHandler,
  onSelectCard,
  onColumnHeaderClick,
  onContextMenu,
  onHeightChange,
  onToggleWorkflow,
  onAccordionMenuClick,
  isDarkMode,
  layoutView,
}) {
  if (!boardLoading && workflows.length === 0 && !suppressEmptyMessage) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          fontSize: 14,
          color: "var(--text-secondary)",
        }}
      >
        No workflows to display for this board.
      </div>
    );
  }

  return workflows.map((workflow) => (
    <WorkflowAccordion
      key={workflow.id}
      workflow={workflow}
      isDarkMode={isDarkMode}
      isExpanded={expandedWorkflows[workflow.id]}
      onToggle={() => onToggleWorkflow(workflow.id)}
      onMenuClick={(event) => onAccordionMenuClick(event, workflow.id)}
    >
      <WorkflowColumns
        workflow={workflow}
        collapsedColumns={collapsedColumns}
        maxColumnHeights={maxColumnHeights}
        onDragEnd={createDragEndHandler(workflow.id)}
        onSelectCard={onSelectCard}
        cardsById={cardsById}
        onColumnHeaderClick={onColumnHeaderClick}
        onContextMenu={onContextMenu}
        onHeightChange={onHeightChange}
        isDarkMode={isDarkMode}
        layoutView={layoutView}
      />
    </WorkflowAccordion>
  ));
}
