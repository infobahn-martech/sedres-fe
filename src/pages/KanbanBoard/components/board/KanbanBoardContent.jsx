import WorkflowAccordion from "./WorkflowAccordion";
import { FiUploadCloud } from "react-icons/fi";
import WorkflowColumns from "./WorkflowColumns";
import { isMcDermottWorkflow } from "../../utils/columnTitles";
import { getSwimlaneColumnCards } from "../../utils/columnHelpers";

const SUBMITTED_TO_DA_COLUMN_PATTERN = /^submitted to da$/i;
const EMPTY_SELECTED_IDS = [];

/* The ticked cards sitting in a McDermott workflow's "Submitted to DA" column. */
const getSubmittedToDaTickedCards = (workflow, selectedActionCardIds) => {
  if (!isMcDermottWorkflow(workflow) || !selectedActionCardIds.length) return [];
  const laneIds = workflow.swimlaneOrder?.length ? workflow.swimlaneOrder : ["lane-default"];
  return workflow.columnOrder
    .filter((colKey) => SUBMITTED_TO_DA_COLUMN_PATTERN.test(String(workflow.columns[colKey]?.title ?? "").trim()))
    .flatMap((colKey) => laneIds.flatMap((laneId) => getSwimlaneColumnCards(workflow, laneId, colKey)))
    .filter((card) => selectedActionCardIds.includes(card.id));
};

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
  onColumnUploadInvoice,
  onColumnUploadPos,
  onColumnSendInvoice,
  onColumnMergeInvoice,
  onColumnPrepareSubmission,
  onUploadSrf,
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
    const srfCards = getSubmittedToDaTickedCards(workflow, selectedActionCardIds);
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
      headerAction={
        srfCards.length
          ? {
              label: "Upload SRF",
              icon: <FiUploadCloud size={18} aria-hidden />,
              onClick: () => onUploadSrf?.(srfCards, { workflowId: workflow.workflow_id ?? workflow.id }),
            }
          : undefined
      }
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
        onColumnUploadInvoice={onColumnUploadInvoice}
        onColumnUploadPos={onColumnUploadPos}
        onColumnSendInvoice={onColumnSendInvoice}
        onColumnMergeInvoice={onColumnMergeInvoice}
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
