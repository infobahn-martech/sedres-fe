import WorkflowAccordion from "./WorkflowAccordion";
import WorkflowColumns from "./WorkflowColumns";

const EMPTY_SELECTED_IDS = [];

export default function KanbanBoardContent({
  workflows,
  cardsById,
  boardLoading = false,
  suppressEmptyMessage = false,
  expandedWorkflows,
  collapsedColumns,
  maxColumnHeights,
  pinnedWorkflows,
  createDragEndHandler,
  onSelectCard,
  onColumnHeaderClick,
  onColumnBatchAction,
  onBatchSendSeRequest,
  onBatchUploadSeApproval,
  onBatchUploadInvoice,
  onBatchRequestPo,
  onColumnRequestPo,
  onColumnUploadInvoice,
  onColumnUploadPos,
  onColumnSendInvoice,
  onColumnSendSccApproval,
  onColumnMergeInvoice,
  onColumnDownloadInvoices,
  onColumnMoveCards,
  onUploadDispatchProof,
  onColumnPrepareSubmission,
  onUploadSrf,
  onUploadSccDocuments,
  onColumnSendSubmission,
  onContextMenu,
  onHeightChange,
  onToggleWorkflow,
  onAccordionMenuClick,
  onPinClick,
  isDarkMode,
  layoutView,
  selectedActionCardIds = EMPTY_SELECTED_IDS,
  onToggleCardSelect,
  onCardSelectDragStart,
  onCardSelectDragEnter,
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

  return workflows.map((workflow) => {
    return (
    <WorkflowAccordion
      key={workflow.id}
      workflow={workflow}
      isDarkMode={isDarkMode}
      isExpanded={expandedWorkflows[workflow.id]}
      isPinned={Boolean(pinnedWorkflows?.[workflow.id])}
      onToggle={() => onToggleWorkflow(workflow.id)}
      onMenuClick={(event) => onAccordionMenuClick(event, workflow.id)}
      onPinClick={() => onPinClick(workflow.id)}
    >
      <WorkflowColumns
        workflow={workflow}
        collapsedColumns={collapsedColumns}
        maxColumnHeights={maxColumnHeights}
        onDragEnd={createDragEndHandler(workflow.id)}
        onSelectCard={onSelectCard}
        cardsById={cardsById}
        onColumnHeaderClick={onColumnHeaderClick}
        onColumnBatchAction={onColumnBatchAction}
        onBatchSendSeRequest={onBatchSendSeRequest}
        onBatchUploadSeApproval={onBatchUploadSeApproval}
        onBatchUploadInvoice={onBatchUploadInvoice}
        onBatchRequestPo={onBatchRequestPo}
        onColumnRequestPo={onColumnRequestPo}
        onColumnUploadInvoice={onColumnUploadInvoice}
        onColumnUploadPos={onColumnUploadPos}
        onUploadSrf={onUploadSrf}
        onUploadSccDocuments={onUploadSccDocuments}
        onColumnSendInvoice={onColumnSendInvoice}
        onColumnSendSccApproval={onColumnSendSccApproval}
        onColumnMergeInvoice={onColumnMergeInvoice}
        onColumnDownloadInvoices={onColumnDownloadInvoices}
        onColumnMoveCards={onColumnMoveCards}
        onUploadDispatchProof={onUploadDispatchProof}
        onColumnPrepareSubmission={onColumnPrepareSubmission}
        onColumnSendSubmission={onColumnSendSubmission}
        onContextMenu={onContextMenu}
        onHeightChange={onHeightChange}
        isDarkMode={isDarkMode}
        layoutView={layoutView}
        selectedActionCardIds={selectedActionCardIds}
        onToggleCardSelect={onToggleCardSelect}
        onCardSelectDragStart={onCardSelectDragStart}
        onCardSelectDragEnter={onCardSelectDragEnter}
      />
    </WorkflowAccordion>
    );
  });
}
