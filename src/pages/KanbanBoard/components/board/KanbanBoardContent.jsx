import WorkflowAccordion from "./WorkflowAccordion";
import WorkflowColumns from "./WorkflowColumns";
import CardScopeToggle from "./CardScopeToggle";
import { DEFAULT_CARD_SCOPE } from "../../utils/cardScopeFilter";

const EMPTY_SELECTED_IDS = [];
const EMPTY_SCOPES = {};

export default function KanbanBoardContent({
  boardId,
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
  onColumnSubmitByEmail,
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
  isDarkMode,
  layoutView,
  selectedActionCardIds = EMPTY_SELECTED_IDS,
  onToggleCardSelect,
  onCardSelectDragStart,
  onCardSelectDragEnter,
  /** { [workflowId]: "all" | "my" } — workflows are already fetched with that scope; this only drives the toggle/empty state. */
  cardScopeByWorkflow = EMPTY_SCOPES,
  /** { [workflowId]: true } while that workflow is refetching for a scope change. */
  cardScopeLoadingByWorkflow = EMPTY_SCOPES,
  onCardScopeChange,
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
    const cardScope = cardScopeByWorkflow[workflow.id] ?? DEFAULT_CARD_SCOPE;
    const scopeLoading = Boolean(cardScopeLoadingByWorkflow[workflow.id]);
    return (
    <WorkflowAccordion
      key={workflow.id}
      workflow={workflow}
      isDarkMode={isDarkMode}
      isExpanded={expandedWorkflows[workflow.id]}
      onToggle={() => onToggleWorkflow(workflow.id)}
      onMenuClick={(event) => onAccordionMenuClick(event, workflow.id)}
      headerExtra={
        onCardScopeChange ? (
          <CardScopeToggle
            value={cardScope}
            disabled={scopeLoading}
            onChange={(scope) => onCardScopeChange(workflow.id, scope)}
          />
        ) : null
      }
    >
      <WorkflowColumns
        boardId={boardId}
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
        onColumnSubmitByEmail={onColumnSubmitByEmail}
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
