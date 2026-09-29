export const createNewCardDraft = (color, swimlaneId) => ({
  id: `new-${Date.now()}`,
  title: "",
  color: color || "#2A00FF",
  ...(swimlaneId !== undefined && swimlaneId !== null && String(swimlaneId).trim() !== ""
    ? { swimlane_id: swimlaneId }
    : {}),
});

const getExportApprovalFlag = (card) => card?.raw?.is_export_approval_card ?? card?.is_export_approval_card;

export const hasExportApprovalFlag = (card) => getExportApprovalFlag(card) != null;

// is_export_approval_card is true while export approval is still pending, so the card can't be
// ticked for a batch. When the key is missing, the call's export_approval_status (loaded into
// statusByCallId) decides; a card not in that map (other boards) keeps it selectable.
export const isExportApprovalPendingCard = (card, statusByCallId) => {
  if (card?.isExportApprovalCard) return true;
  if (hasExportApprovalFlag(card)) return ["true", "1"].includes(String(getExportApprovalFlag(card)));
  const status = statusByCallId?.[card?.callId];
  return status === "loading" || status === "pending";
};
