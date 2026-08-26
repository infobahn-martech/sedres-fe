// ============================================
// Kanban board normalization (API → FE workflow shape)
// ============================================
// Normalized workflow:
// { id, title, columnOrder, columns, swimlaneOrder, swimlanes, cards, boardId? }
// columns[colKey]: { id, title, color, wipLimit, cardsPerRow, stageId, stageTitle, backgroundColor }
// swimlanes[laneId]: { id, title, color?, cardMap: { [colKey]: cardId[] } }
// cards[cardId]: { id, laneId, columnId, ... }

const DEFAULT_CARDS_PER_ROW = 2;

/**
 * Accepts valid 3/6/8 digit hex (with #); otherwise returns fallback.
 * @param {unknown} value
 * @param {string} [fallback='#ffffff']
 * @returns {string}
 */
export function normalizeHexColor(value, fallback = "#ffffff") {
  if (value == null || typeof value !== "string") return fallback;
  const s = value.trim();
  if (!s.startsWith("#")) return fallback;
  const hex = s.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(hex) || /^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{8}$/.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }
  return fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Flattens a stage's column tree into leaf columns (rendered as real board tracks).
 * A column with a non-empty `children` array is a pure header group: it is not rendered
 * itself, its children become the tracks, tagged with the parent's id/name for header grouping.
 * @param {object[]} cols - `stage.columns` or a column's `children`
 * @param {string|null} [parentColumnId]
 * @param {string|null} [parentTitle]
 * @returns {object[]} flat list of column nodes with `_parentColumnId` / `_parentTitle`
 */
function flattenStageColumns(cols, parentColumnId = null, parentTitle = null) {
  const result = [];
  for (const col of safeArray(cols)) {
    const children = safeArray(col?.children);
    if (children.length > 0) {
      const colId = col?.column_id != null ? String(col.column_id) : parentColumnId;
      result.push(...flattenStageColumns(children, colId, col?.column_name || parentTitle));
    } else {
      result.push({ ...col, _parentColumnId: parentColumnId, _parentTitle: parentTitle });
    }
  }
  return result;
}

/**
 * Maps one workflow object from GET kanban_board/get_full_board/{board_id} into the FE board shape.
 * @param {object} workflow - single element of response.data
 * @returns {object|null}
 */
export function mapBoardWorkflowFromApi(workflow) {
  if (!workflow || typeof workflow !== "object") return null;

  const wfId = workflow.workflow_id != null ? String(workflow.workflow_id) : null;
  if (wfId == null) return null;

  const title = workflow.workflow_name || "Untitled Workflow";
  const isTaskWorkflow = title === "Task Workflow";
  const workflowRoleId = workflow.role_id ?? null;
  const boardId =
    workflow.board_id != null && workflow.board_id !== "" ? String(workflow.board_id) : undefined;

  const columnOrder = [];
  const columns = {};
  const stages = safeArray(workflow.stages);

  for (const stage of stages) {
    const stageId = stage?.stage_id != null ? String(stage.stage_id) : "";
    const stageTitle = stage?.stage_name || "";
    const stageColor = normalizeHexColor(stage?.color_code, "#cccccc");

    for (const col of flattenStageColumns(stage?.columns)) {
      const colId = col?.column_id;
      if (colId == null) continue;
      const colKey = String(colId);
      if (!columns[colKey]) {
        columnOrder.push(colKey);
      }
      columns[colKey] = {
        id: colKey,
        title: col?.column_name || "Column",
        color: stageColor,
        stageId,
        stageTitle,
        wipLimit: null,
        cardsPerRow: Number(col?.cards_per_row) || 1,
        backgroundColor: normalizeHexColor(col?.background_color, "#ffffff"),
        parentColumnId: col._parentColumnId ?? null,
        parentTitle: col._parentTitle ?? null,
      };
    }
  }

  const swimlaneList = safeArray(workflow.swimlanes);
  const swimlaneOrder = [...swimlaneList]
    .sort((a, b) => {
      const oa = Number(a?.swimlane_order);
      const ob = Number(b?.swimlane_order);
      const sa = Number.isFinite(oa) ? oa : 0;
      const sb = Number.isFinite(ob) ? ob : 0;
      if (sa !== sb) return sa - sb;
      return String(a?.swimlane_id ?? "").localeCompare(String(b?.swimlane_id ?? ""));
    })
    .map((sl) => (sl?.swimlane_id != null ? String(sl.swimlane_id) : ""))
    .filter((id) => id !== "");

  /** @type {Record<string, { id: string, title: string, color: string, cardMap: Record<string, string[]> }>} */
  const swimlanes = {};

  for (const swimlaneId of swimlaneOrder) {
    const sl = swimlaneList.find((s) => String(s?.swimlane_id) === swimlaneId);
    swimlanes[swimlaneId] = {
      id: swimlaneId,
      title: sl?.swimlane_name || `Swimlane ${swimlaneId}`,
      color: normalizeHexColor(sl?.color_code, "#ffffff"),
      cardMap: {},
    };
  }

  const emptyCardMap = () =>
    Object.fromEntries(columnOrder.map((k) => [k, []]));

  for (const id of swimlaneOrder) {
    swimlanes[id].cardMap = emptyCardMap();
  }

  if (swimlaneOrder.length === 0 && columnOrder.length > 0) {
    swimlaneOrder.push("default");
    swimlanes.default = {
      id: "default",
      title: "Default",
      color: normalizeHexColor(undefined, "#ffffff"),
      cardMap: emptyCardMap(),
    };
  }

  const cards = {};

  const ensureLane = (laneKey) => {
    if (swimlanes[laneKey]) return;
    swimlaneOrder.push(laneKey);
    swimlanes[laneKey] = {
      id: laneKey,
      title: `Swimlane ${laneKey}`,
      color: normalizeHexColor(undefined, "#ffffff"),
      cardMap: emptyCardMap(),
    };
  };

  for (const stage of stages) {
    const stageColor = normalizeHexColor(stage?.color_code, "#cccccc");

    for (const col of flattenStageColumns(stage?.columns)) {
      const colId = col?.column_id;
      if (colId == null) continue;
      const colKey = String(colId);
      if (!columns[colKey]) continue;

      const rawMap = col?.cards_by_swimlane;
      const byLane =
        rawMap && typeof rawMap === "object" && !Array.isArray(rawMap) ? rawMap : {};

      for (const swimlaneId of Object.keys(byLane)) {
        ensureLane(String(swimlaneId));
        const list = Array.isArray(byLane[swimlaneId]) ? byLane[swimlaneId] : [];

        for (const card of list) {
          const cardId = card?.card_id != null ? String(card.card_id) : null;
          if (!cardId) continue;
          const laneKey = String(swimlaneId);

          if (cards[cardId]) {
            continue;
          }

          const kpiRaw = card.kpi_percentage;
          let progress = null;
          if (kpiRaw != null && String(kpiRaw).trim() !== "") {
            const n = Number(kpiRaw);
            if (Number.isFinite(n) && n >= 0) progress = n;
          }
          const timelineRaw = card.timeline;
          const timeLeft =
            timelineRaw != null && String(timelineRaw).trim() !== ""
              ? String(timelineRaw).trim()
              : null;

          const perCardColor =
            card?.card_color != null && String(card.card_color).trim() !== ""
              ? normalizeHexColor(String(card.card_color).trim(), stageColor)
              : null;

          // FE display: vesselName / taskName / cardName / title, user (avatar), timeLeft, progress — see CardItem ApiKanbanCardFull.
          cards[cardId] = {
            id: cardId,
            laneId: laneKey,
            columnId: colKey,
            workflow_id: wfId,
            workflow_role_id: workflowRoleId,
            workflow_name: title,
            title: card.card_name || "",
            name: card.billing_entity || "",
            user: card.username || "",
            vesselName: card.vessel_name || "",
            taskName:
              card.task_name != null && String(card.task_name).trim() !== ""
                ? String(card.task_name).trim()
                : "",
            taskId:
              card.task_id != null && String(card.task_id).trim() !== ""
                ? String(card.task_id).trim()
                : "",
            port: card.port_id != null && String(card.port_id).trim() !== "" ? String(card.port_id) : "",
            callId: String(card.call_id || ""),
            vesselId: String(card.vessel_id || ""),
            hasLinkedCall: card.has_linked_call === true || card.has_linked_call === "1" || card.has_linked_call === 1,
            linkedCardIds: Array.isArray(card.linked_card_id)
              ? card.linked_card_id.map((id) => String(id)).filter((id) => id !== cardId)
              : [],
            userId: String(card.user_id || ""),
            entityLogo:
              card.entity_logo && String(card.entity_logo).trim()
                ? String(card.entity_logo).trim()
                : "",
            createdDate: card.created_date && String(card.created_date).trim() ? String(card.created_date).trim() : "",
            progress,
            timeLeft,
            color: perCardColor ?? stageColor,
            cardName: card.card_name || "",
            billingEntity: card.billing_entity || "",
            card_type_id:
              card.card_type_id != null && String(card.card_type_id).trim() !== ""
                ? String(card.card_type_id)
                : null,
            card_tag_id:
              card.card_tag_id != null && String(card.card_tag_id).trim() !== ""
                ? String(card.card_tag_id)
                : card.tag_id != null && String(card.tag_id).trim() !== ""
                  ? String(card.tag_id)
                  : null,
            card_blocker_id:
              card.card_blocker_id != null && String(card.card_blocker_id).trim() !== ""
                ? String(card.card_blocker_id)
                : null,
            blockerIcon:
              card.blocker_icon != null && String(card.blocker_icon).trim() !== ""
                ? String(card.blocker_icon).trim()
                : null,
            blockerColor:
              card.blocker_color != null && String(card.blocker_color).trim() !== ""
                ? String(card.blocker_color).trim()
                : null,
            blockerName:
              card.blocker_name != null && String(card.blocker_name).trim() !== ""
                ? String(card.blocker_name).trim()
                : null,
            card_sticker_id:
              card.card_sticker_id != null && String(card.card_sticker_id).trim() !== ""
                ? String(card.card_sticker_id)
                : null,
            stickerIcon:
              card.sticker_icon != null && String(card.sticker_icon).trim() !== ""
                ? String(card.sticker_icon).trim()
                : null,
            stickerColor:
              card.sticker_color != null && String(card.sticker_color).trim() !== ""
                ? String(card.sticker_color).trim()
                : null,
            stickerName:
              card.sticker_name != null && String(card.sticker_name).trim() !== ""
                ? String(card.sticker_name).trim()
                : null,
            cardTypeIcon:
              card.card_type_icon != null && String(card.card_type_icon).trim() !== ""
                ? String(card.card_type_icon).trim()
                : null,
            cardTypeColor:
              card.card_type_color != null && String(card.card_type_color).trim() !== ""
                ? String(card.card_type_color).trim()
                : null,
            cardTypeName:
              card.card_type_name != null && String(card.card_type_name).trim() !== ""
                ? String(card.card_type_name).trim()
                : null,
            creditLimit:
              card.credit_limit != null && String(card.credit_limit).trim() !== ""
                ? Number(card.credit_limit)
                : null,
            transportCount:
              card.transport_count != null && String(card.transport_count).trim() !== ""
                ? Number(card.transport_count)
                : null,
            hotelCount:
              card.hotel_count != null && String(card.hotel_count).trim() !== ""
                ? Number(card.hotel_count)
                : null,
            medicalCount:
              card.medical_count != null && String(card.medical_count).trim() !== ""
                ? Number(card.medical_count)
                : null,
            materialManagementCount:
              card.material_management_count != null && String(card.material_management_count).trim() !== ""
                ? Number(card.material_management_count)
                : null,
            wasteDisposalCount:
              card.waste_disposal != null && String(card.waste_disposal).trim() !== ""
                ? Number(card.waste_disposal)
                : null,
            raw: card,
            cardSource: "api",
            // Task Card modal (kanban_card/create_task_card) cards always live under the
            // "Task Workflow" workflow name — that's the signal CardForm uses to show TaskCardDetailView.
            isSubTask: isTaskWorkflow,
            cardId: isTaskWorkflow ? cardId : undefined,
            dueDate: isTaskWorkflow
              ? (card.due_date != null && String(card.due_date).trim() !== "" ? String(card.due_date).trim() : "")
              : undefined,
          };

          if (swimlanes[laneKey]?.cardMap?.[colKey]) {
            swimlanes[laneKey].cardMap[colKey].push(cardId);
          }
        }
      }
    }
  }

  const raw = {
    id: wfId,
    workflow_id: wfId,
    workflow_name: title,
    role_id: workflow.role_id ?? null,
    description: workflow.description,
    boardId,
    title,
    columnOrder,
    columns,
    swimlaneOrder,
    swimlanes,
    cards,
    isPinned: workflow.is_pinned === "1" || workflow.is_pinned === 1 || workflow.is_pinned === true,
    isCollapsed:
      workflow.is_collapsed === "1" || workflow.is_collapsed === 1 || workflow.is_collapsed === true,
  };

  return normalizeWorkflowFromApi(raw);
}

/**
 * Ensures columnOrder, cardMap arrays, and defaults are applied to a normalized-ish payload.
 * @param {object} payload
 * @returns {object|null}
 */
export function normalizeWorkflowFromApi(payload) {
  if (!payload || typeof payload !== "object") return null;

  const columnOrder = Array.isArray(payload.columnOrder)
    ? payload.columnOrder
    : Object.keys(payload.columns || {});

  const columns = {};
  for (const key of columnOrder) {
    const c = payload.columns?.[key];
    if (!c) continue;
    columns[key] = {
      ...c,
      id: c.id ?? key,
      title: c.title ?? key,
      color: c.color,
      wipLimit: c.wipLimit ?? null,
      cardsPerRow: c.cardsPerRow ?? DEFAULT_CARDS_PER_ROW,
    };
  }

  const swimlaneOrder = Array.isArray(payload.swimlaneOrder)
    ? payload.swimlaneOrder
    : Object.keys(payload.swimlanes || {});

  const swimlanes = {};
  for (const laneId of swimlaneOrder) {
    const lane = payload.swimlanes?.[laneId];
    if (!lane) continue;
    const cardMap = { ...lane.cardMap };
    for (const colKey of columnOrder) {
      if (!Array.isArray(cardMap[colKey])) {
        cardMap[colKey] = [];
      }
    }
    swimlanes[laneId] = {
      ...lane,
      id: lane.id ?? laneId,
      title: lane.title ?? laneId,
      cardMap,
    };
  }

  const cards = { ...payload.cards };
  return {
    ...payload,
    columnOrder,
    columns,
    swimlaneOrder,
    swimlanes,
    cards,
  };
}

/** Empty initial state for the Kanban board before a board id is selected or after a failed load. */
export const initialData = [];

/** Static template for the Task Workflow injected on the frontend. */
export const TASK_WORKFLOW_TEMPLATE = {
  id: "wf-demo",
  title: "Task Workflow",
  columnOrder: ["col-todo", "col-progress", "col-done"],
  columns: {
    "col-todo":     { id: "col-todo",     title: "To Do",       color: "#3b82f6", stageId: "stage-1", stageTitle: "To Do",       wipLimit: null, cardsPerRow: 2, backgroundColor: "#ffffff" },
    "col-progress": { id: "col-progress", title: "In Progress", color: "#f59e0b", stageId: "stage-2", stageTitle: "In Progress", wipLimit: null, cardsPerRow: 2, backgroundColor: "#ffffff" },
    "col-done":     { id: "col-done",     title: "Completed",   color: "#22c55e", stageId: "stage-3", stageTitle: "Completed",   wipLimit: null, cardsPerRow: 2, backgroundColor: "#ffffff" },
  },
  swimlaneOrder: ["default"],
  swimlanes: {
    default: { id: "default", title: "Default", color: "#ffffff", cardMap: { "col-todo": [], "col-progress": [], "col-done": [] } },
  },
  cards: {},
};

/** Ensures the Task Workflow is always present in the workflows array. */
export const ensureTaskWorkflow = (mapped) => {
  const has = mapped.some((wf) => wf.id === "wf-demo" || wf.title === "Task Workflow");
  if (has) return mapped;
  return [...mapped, TASK_WORKFLOW_TEMPLATE];
};
