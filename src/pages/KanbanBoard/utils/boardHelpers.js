export const findWorkflowByCardId = (workflows, cardId) =>
  workflows.find((workflow) =>
    Object.values(workflow.cards).some((card) => card.id === cardId)
  ) || null;

