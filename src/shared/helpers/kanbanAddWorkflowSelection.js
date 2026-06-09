/**
 * Add (+) flow: which modal step to show and when to dispatch `kanban:add-card`.
 * Reused by SideNav and `useSyncKanbanSidebarWorkflows` descriptors.
 */

/**
 * @param {object | undefined | null} workflow - Normalized workflow from board state
 * @returns {number}
 */
export function getLaneCount(workflow) {
  if (!workflow || typeof workflow !== "object") return 0;
  const order = workflow.swimlaneOrder;
  if (Array.isArray(order) && order.length > 0) return order.length;
  return Object.keys(workflow.swimlanes || {}).length;
}

/**
 * Ordered swimlanes for UI selection (id + display name).
 * @param {object | null | undefined} workflow
 * @returns {{ id: string, name: string, title?: string }[]}
 */
export function getSwimlaneOptionsFromWorkflow(workflow) {
  if (!workflow || typeof workflow !== "object") return [];
  const order = Array.isArray(workflow.swimlaneOrder)
    ? workflow.swimlaneOrder
    : Object.keys(workflow.swimlanes || {});
  return order.map((id) => {
    const sl = workflow.swimlanes?.[id] || {};
    const name = sl?.title ?? sl?.name ?? String(id);
    return { ...sl, id: String(id), name, title: sl?.title ?? name };
  });
}

/**
 * Workflows valid for creating a card: must have columns and at least one swimlane.
 * @param {object | undefined | null} workflow
 * @returns {boolean}
 */
export function isWorkflowEligibleForCardCreation(workflow) {
  if (!workflow || workflow.id == null) return false;
  const hasColumns =
    (Array.isArray(workflow.columnOrder) && workflow.columnOrder.length > 0) ||
    (workflow.columns && typeof workflow.columns === "object" && Object.keys(workflow.columns).length > 0);
  if (!hasColumns) return false;
  return getLaneCount(workflow) > 0;
}

/**
 * @param {unknown} workflows
 * @returns {object[]}
 */
export function getEligibleWorkflowsForAdd(workflows) {
  if (!Array.isArray(workflows)) return [];
  return workflows.filter(
    (wf) => isWorkflowEligibleForCardCreation(wf) && wf.role_id == null
  );
}

/**
 * @param {unknown} workflows - Sidebar / board workflow descriptors
 * @returns {{
 *   kind: 'dispatch',
 *   detail: object,
 * } | {
 *   kind: 'modal',
 *   initialStep: 'workflow' | 'swimlane',
 *   workflowsForWorkflowStep: object[],
 *   swimlaneContextWorkflow: object | null,
 * }}
 */
export function resolveSidebarAddCardAction(workflows) {
  const eligible = getEligibleWorkflowsForAdd(workflows);
  const n = eligible.length;

  if (n === 0) {
    return {
      kind: "modal",
      initialStep: "workflow",
      workflowsForWorkflowStep: [],
      swimlaneContextWorkflow: null,
    };
  }

  if (n > 1) {
    return {
      kind: "modal",
      initialStep: "workflow",
      workflowsForWorkflowStep: eligible,
      swimlaneContextWorkflow: null,
    };
  }

  const w = eligible[0];
  const lanes = getSwimlaneOptionsFromWorkflow(w);
  if (lanes.length > 1) {
    return {
      kind: "modal",
      initialStep: "swimlane",
      workflowsForWorkflowStep: [],
      swimlaneContextWorkflow: w,
    };
  }
  if (lanes.length === 1) {
    return {
      kind: "dispatch",
      detail: buildKanbanAddCardEventDetail(w, lanes[0]),
    };
  }
  return {
    kind: "dispatch",
    detail: buildKanbanAddCardEventDetail(w, null),
  };
}

/**
 * Payload for `kanban:add-card` / CardForm follow-up.
 * @param {object} workflow - Descriptor with id, name/title, swimlanes, swimlaneOrder
 * @param {{ id: string, name?: string, title?: string } | null | undefined} swimlaneOption
 * @returns {object}
 */
export function buildKanbanAddCardEventDetail(workflow, swimlaneOption) {
  if (!workflow || workflow.id == null) return {};
  const id = workflow.id;
  const name = workflow.name ?? workflow.title ?? "Workflow";
  const detail = {
    workflowId: id,
    workflow_id: id,
    workflowName: name,
    workflow_name: name,
    swimlanes: workflow.swimlanes,
    swimlaneOrder: workflow.swimlaneOrder,
  };
  if (swimlaneOption != null && swimlaneOption.id != null) {
    const sid = swimlaneOption.id;
    const sname = swimlaneOption.name ?? swimlaneOption.title ?? String(sid);
    detail.swimlaneId = sid;
    detail.swimlane_id = sid;
    detail.swimlaneName = sname;
    detail.swimlane_name = sname;
    detail.laneId = sid;
  }
  return detail;
}
