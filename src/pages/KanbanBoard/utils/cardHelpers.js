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
