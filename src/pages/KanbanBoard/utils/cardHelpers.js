export const createNewCardDraft = (color, swimlaneId) => ({
  id: `new-${Date.now()}`,
  title: "",
  color: color || "#2A00FF",
  ...(swimlaneId !== undefined && swimlaneId !== null && String(swimlaneId).trim() !== ""
    ? { swimlane_id: swimlaneId }
    : {}),
});

const getExportApprovalFlag = (card) => card?.raw?.is_export_approval_card ?? card?.is_export_approval_card;

const isExportApprovalFlagOn = (card) =>
  Boolean(card?.isExportApprovalCard) || ["true", "1"].includes(String(getExportApprovalFlag(card)));

/* Cards whose export approval state is read from the call detail: the key is missing, or true
   (a non-Export call such as Husbandry can still come with true). */
export const needsExportApprovalCheck = (card) =>
  getExportApprovalFlag(card) == null || isExportApprovalFlagOn(card);

// is_export_approval_card is true while export approval is still pending, so the card can't be
// ticked for a batch. A non-Export call (e.g. Husbandry) has no export approval and stays
// selectable. When the key is missing, the call's export_approval_status (loaded into
// statusByCallId) decides; a card not in that map (other boards) keeps it selectable.
export const isExportApprovalPendingCard = (card, statusByCallId) => {
  const status = statusByCallId?.[card?.callId];
  if (status === "not_export") return false;
  if (isExportApprovalFlagOn(card)) return true;
  if (getExportApprovalFlag(card) != null) return false;
  return status === "loading" || status === "pending";
};
