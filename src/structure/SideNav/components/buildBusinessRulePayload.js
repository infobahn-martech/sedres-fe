import { ACTION_GROUP_TYPE_TO_SECTION_ID, RELATIONAL_CREATE_ACTION_KEYWORDS } from './businessRulesData';

const findActionTypeId = (triggerActions, sectionId) =>
  triggerActions.find((a) => ACTION_GROUP_TYPE_TO_SECTION_ID[a.group_type] === sectionId)?.action_type_id ?? null;

// A create action's `key` is the DEV-fallback's literal 'child'/'parent'/... string, but a
// live backend response keys it by its own field_key instead — so relation_type has to be
// derived from the label ("Create child" -> "child") the same way hasCustomProperties does
// in BusinessRuleFormModal.jsx, not from action.key. Matched by keyword-in-label rather than
// exact phrase, since a live label may carry extra wording (e.g. "Create Child Card").
const getRelationTypeFromLabel = (label) => {
  const normalized = label?.trim().toLowerCase() ?? '';
  return RELATIONAL_CREATE_ACTION_KEYWORDS.find((kw) => normalized.includes(kw)) ?? null;
};

const getOperatorLabel = (fieldDetailsByKey, fieldType, fieldId, operatorId) => {
  if (!fieldType || fieldId == null) return null;
  const operators = fieldDetailsByKey[`${fieldType}-${fieldId}`]?.operators ?? [];
  return operators.find((op) => String(op.field_operator_id) === String(operatorId))?.operator_label ?? null;
};

// Flat conditions[] list: one entry per condition-box value row, in field-details-derived
// operator-label form (matches the "is"/"is not" convention confirmed by DUMMY_FIELD_OPERATORS
// lining up with the documented example's `operator: "is"`). whenFields and the board/position
// restriction rows are folded in alongside real conditions using the same shape — best-effort,
// since the create_business_rule example only documents plain field conditions and none of
// these three have a confirmed backend contract yet.
const buildConditions = (formState, ctx) => {
  const { conditions, whenFields, boardConditionRows, positionConditionRows } = formState;
  const { fieldDetailsByKey, triggerConfig } = ctx;
  const entries = [];

  conditions.forEach((cond) => {
    cond.values.forEach((row, index) => {
      const entry = {
        operator: getOperatorLabel(fieldDetailsByKey, cond.fieldType, cond.fieldId, cond.operatorId),
        input_value: row.value,
        connector: index === 0 ? 'AND' : row.joinWord,
      };
      if (cond.fieldType === 'custom') entry.custom_field_id = cond.fieldId;
      else if (cond.fieldType === 'regular') entry.regular_field_id = cond.fieldId;
      else entry.time_unit_key = cond.fieldKey; // best-effort: time-unit conditions have no confirmed id field
      entries.push(entry);
    });
  });

  // "When fields" watch list has no operator/value in the UI at all — best-effort only.
  whenFields.forEach((f) => {
    const entry = { operator: null, input_value: null, connector: 'AND' };
    if (f.fieldType === 'custom') entry.custom_field_id = f.fieldId;
    else if (f.fieldType === 'regular') entry.regular_field_id = f.fieldId;
    entries.push(entry);
  });

  // Board/position restriction rows carry no field id of their own — best-effort lookup
  // against this trigger's own default_conditions catalog by field_label.
  const defaultConditionFor = (label) =>
    (triggerConfig?.default_conditions ?? []).find((c) => String(c.field_label ?? '').trim().toLowerCase() === label);

  const boardDefault = defaultConditionFor('board');
  if (boardDefault) {
    boardConditionRows.filter((row) => row.boardId).forEach((row, index) => {
      entries.push({
        regular_field_id: boardDefault.regular_field_id ?? boardDefault.field_id ?? null,
        operator: 'is',
        input_value: row.boardId,
        connector: index === 0 ? 'AND' : row.joinWord,
      });
    });
  }

  const positionDefault = defaultConditionFor('position');
  if (positionDefault) {
    positionConditionRows.filter((row) => row.boardId).forEach((row, index) => {
      entries.push({
        regular_field_id: positionDefault.regular_field_id ?? positionDefault.field_id ?? null,
        operator: 'is',
        input_value: [row.boardId, row.swimlaneId, row.stageId].filter(Boolean).join(':'),
        connector: index === 0 ? 'AND' : row.joinWord,
      });
    });
  }

  return entries;
};

// Then-action groups the edit-mode routing effect couldn't invert into editable UI state
// (create-subtask, update_parent/child_card, copy_values_to_parent/child, execute_at —
// see ThenGroupRawSummary / the THEN routing effect in BusinessRuleFormModal.jsx) are
// shown read-only instead of being dropped from state entirely. Without this, saving an
// edit would silently wipe them from the rule, since buildThenActions below only ever
// walks the editable arrays. Resolves each group's action_type_id the same way
// findActionTypeId already does for editable sections (via its group_type -> section
// mapping) rather than trusting an unconfirmed action_type_id field on the raw action.
const buildRawThenActions = (rawGroups, ctx) => {
  const { triggerActions } = ctx;
  const entries = [];

  (rawGroups ?? []).forEach((group) => {
    const sectionId = ACTION_GROUP_TYPE_TO_SECTION_ID[group.group_type] ?? group.group_type;
    const actionTypeId = findActionTypeId(triggerActions, sectionId) ?? group.action_type_id ?? null;

    (group.actions ?? []).forEach((action) => {
      const entry = { action_type_id: actionTypeId ?? action.action_type_id ?? null };

      const properties = (action.properties ?? [])
        .filter((p) => p.property_value !== null && p.property_value !== undefined && p.property_value !== '')
        .map((p) => ({
          property_key: p.property_key,
          property_value: p.property_value,
          property_value_type: p.property_value_type ?? 'string',
        }));
      if (properties.length > 0) entry.properties = properties;

      if (Array.isArray(action.link_card) && action.link_card.length > 0) {
        entry.link_card = action.link_card.map((row) => ({
          relation_type: row.relation_type,
          operator_key: row.operator_key,
          input_value: row.input_value,
          remove_other: row.remove_other,
          connector: row.connector,
        }));
      }

      if (action.notification_id != null) entry.notification_id = action.notification_id;
      if (action.web_service_id != null) entry.web_service_id = action.web_service_id;
      // create-subtask's id is read from either shape on the way in (see the routing
      // effect's own dual check) since which one the backend actually returns is
      // unconfirmed — mirror that here so it isn't silently dropped either way.
      if (action.create_subtask_id != null) entry.create_subtask_id = action.create_subtask_id;

      entries.push(entry);
    });
  });

  return entries;
};

const buildThenActions = (formState, ctx) => {
  const {
    createActions, linkActions, removeOtherLinksByType, moveActions, updateActions,
    copyValuesActions, convertSubtaskActions, notifyActions, invokeActions,
  } = formState;
  const { triggerActions } = ctx;
  const thenActions = [];

  const createActionTypeId = findActionTypeId(triggerActions, 'create');
  createActions.forEach((action) => {
    // Matched by label, not action.key — same reason as hasCustomProperties in
    // BusinessRuleFormModal.jsx: a live backend response keys this field by its own
    // field_key, not the dev-fallback's literal 'subtask' string.
    if (action.label?.trim().toLowerCase() === 'create subtask') {
      // Subtask owner/deadline/description are already saved server-side via
      // saveCreateSubtaskSettings (action.createSubtaskId) — only referenced here.
      // Property name is a best-effort guess, unverified against a real example.
      thenActions.push({
        action_type_id: createActionTypeId,
        properties: [{ property_key: 'create_subtask_id', property_value: action.createSubtaskId, property_value_type: 'number' }],
      });
      return;
    }
    const properties = [
      { property_key: 'target_board_id', property_value: action.boardId, property_value_type: 'number' },
      { property_key: 'target_column_id', property_value: action.stageId, property_value_type: 'number' },
      // No card-title input exists in the UI yet — falls back to the selected board
      // template name as a best-effort placeholder.
      { property_key: 'card_title', property_value: action.templateName ?? '', property_value_type: 'string' },
    ];
    // Same board-can-have-several-workflows reasoning as buildDestinationProperties below
    // (move/convert) — without these, a create action's workflow/swimlane pick is silently
    // dropped on save, so it can never be resolved back into a name on reopen and always
    // reads as "Any stage / Any lane".
    if (action.workflowId) {
      properties.push({ property_key: 'target_workflow_id', property_value: action.workflowId, property_value_type: 'number' });
    }
    if (action.swimlaneId) {
      properties.push({ property_key: 'target_swimlane_id', property_value: action.swimlaneId, property_value_type: 'number' });
    }
    const relationType = getRelationTypeFromLabel(action.label);
    if (relationType) {
      // Cross-card create variants (child/parent/predecessor/relative/successor) aren't
      // covered by the documented example (a plain "create card") — best-effort.
      properties.push({ property_key: 'relation_type', property_value: relationType, property_value_type: 'string' });
    }
    // Fields picked in the "Copy Card Details" step (relational creates only) — no
    // documented shape for this either, sent as comma-separated key lists, best-effort.
    if (action.copyFields?.regularFields?.length > 0) {
      properties.push({ property_key: 'copy_regular_fields', property_value: action.copyFields.regularFields.join(', '), property_value_type: 'string' });
    }
    if (action.copyFields?.customFields?.length > 0) {
      properties.push({ property_key: 'copy_custom_fields', property_value: action.copyFields.customFields.join(', '), property_value_type: 'string' });
    }
    thenActions.push({ action_type_id: createActionTypeId, properties });
  });

  // Update field — each chip is one field+value pair, wrapped in the generic
  // field_key/field_value property pair the documented example uses for action_type_id 4.
  // User-reference fields (Add/Remove co-owners, Add watcher) carry an array of picked
  // users, and sticker fields (Add/Remove stickers) carry an array of picked stickers,
  // instead of a single text value — best-effort joined into one comma-separated
  // field_value, since the example only documents a single scalar value.
  const updateActionTypeId = findActionTypeId(triggerActions, 'update');
  updateActions.forEach((action) => {
    const fieldValue = Array.isArray(action.values)
      ? action.values.map((v) => v.userId ?? v.stickerId).filter(Boolean).join(', ')
      : Array.isArray(action.tagIds)
        ? action.tagIds.join(', ')
        : (action.value ?? '');
    const properties = [
      { property_key: 'field_key', property_value: action.field, property_value_type: 'string' },
      { property_key: 'field_value', property_value: fieldValue, property_value_type: 'string' },
    ];
    // Sticker actions' "once"/"every time" frequency picker — no documented property
    // shape for this yet, best-effort until confirmed against a real example.
    if (action.frequency) {
      properties.push({ property_key: 'frequency', property_value: action.frequency, property_value_type: 'string' });
    }
    // Set milestones/Set tags' "append"/"replace" list-mode picker — same best-effort
    // status as frequency above.
    if (action.key === 'set_milestones' || action.key === 'set_tags') {
      properties.push({ property_key: 'list_mode', property_value: action.mode ?? '', property_value_type: 'string' });
    }
    // Set deadline's relative/absolute + non-working-days pickers — no documented
    // property shape for any of this yet, best-effort until confirmed.
    if (action.key === 'set_deadline') {
      properties.push({ property_key: 'deadline_mode', property_value: action.mode ?? '', property_value_type: 'string' });
      properties.push({ property_key: 'deadline_days', property_value: action.deadlineDays ?? 0, property_value_type: 'number' });
      properties.push({ property_key: 'deadline_date', property_value: action.deadlineDate ?? '', property_value_type: 'string' });
      properties.push({
        property_key: 'non_working_days',
        property_value: (action.nonWorkingDays ?? []).join(', '),
        property_value_type: 'string',
      });
    }
    thenActions.push({ action_type_id: updateActionTypeId, properties });
  });

  // Link card — a single then_actions entry for the whole section; link_card is fanned
  // out one entry per value row, across all link action rows (the API's link_card shape
  // only carries a single input_value per entry).
  if (linkActions.length > 0) {
    const linkCard = [];
    linkActions.forEach((action) => {
      action.values.forEach((row) => {
        linkCard.push({
          relation_type: action.key,
          operator_key: action.operatorKey,
          input_value: row.value,
          remove_other: removeOtherLinksByType[action.key] ? 1 : 0,
          connector: 'AND',
        });
      });
    });
    thenActions.push({ action_type_id: findActionTypeId(triggerActions, 'link'), link_card: linkCard });
  }

  // Destination picker also lets the user pin a workflow and swimlane (a board can have
  // several active workflows, each with its own stages/swimlanes — see boardMinimap.utils.js
  // — and the board minimap row/cell pick records which one), so target_workflow_id and
  // target_swimlane_id have to ride along with board/column. Left out when the user picked
  // a whole column (any-lane) or when the picker only ever surfaced one workflow, matching
  // handlePickColumn's blank swimlaneId.
  const buildDestinationProperties = (action) => {
    const properties = [
      { property_key: 'target_board_id', property_value: action.boardId, property_value_type: 'number' },
      { property_key: 'target_column_id', property_value: action.stageId, property_value_type: 'number' },
    ];
    if (action.workflowId) {
      properties.push({ property_key: 'target_workflow_id', property_value: action.workflowId, property_value_type: 'number' });
    }
    if (action.swimlaneId) {
      properties.push({ property_key: 'target_swimlane_id', property_value: action.swimlaneId, property_value_type: 'number' });
    }
    return properties;
  };

  const moveActionTypeId = findActionTypeId(triggerActions, 'move');
  moveActions.forEach((action) => {
    thenActions.push({ action_type_id: moveActionTypeId, properties: buildDestinationProperties(action) });
  });

  // Convert subtasks to — best-effort, reuses the move destination shape since it's the
  // same board/workflow/swimlane/column picker; unverified against a real example.
  const convertActionTypeId = findActionTypeId(triggerActions, 'convert');
  convertSubtaskActions.forEach((action) => {
    thenActions.push({ action_type_id: convertActionTypeId, properties: buildDestinationProperties(action) });
  });

  // Update related (parent/child) card fields: skipped. Those field chips have no value
  // input yet (the same gap the main "update" section had before this change), so there
  // is nothing valid to send until that input is added.

  // Copy values to parent — best-effort, unverified. No value per field: this action
  // copies whatever the child's current value is, so only the field reference is sent.
  const copyValuesActionTypeId = findActionTypeId(triggerActions, 'copy_values');
  copyValuesActions.filter((action) => action.fields.length > 0).forEach((action) => {
    thenActions.push({
      action_type_id: copyValuesActionTypeId,
      properties: action.fields.map((f) => ({ property_key: 'field_key', property_value: f.fieldLabel, property_value_type: 'string' })),
    });
  });

  // Notify / invoke: settings are already saved server-side via their own nested
  // modals — only the resulting id is referenced here.
  const notifyActionTypeId = findActionTypeId(triggerActions, 'notify');
  notifyActions.forEach((action) => {
    thenActions.push({ action_type_id: notifyActionTypeId, notification_id: action.notification_id });
  });

  const invokeActionTypeId = findActionTypeId(triggerActions, 'invoke');
  invokeActions.forEach((action) => {
    thenActions.push({ action_type_id: invokeActionTypeId, web_service_id: action.webServiceId });
  });

  thenActions.push(...buildRawThenActions(formState.rawThenActionGroups, ctx));

  return thenActions;
};

const buildSharedUsers = (sharePermissions) =>
  Object.entries(sharePermissions)
    .filter(([, perm]) => perm?.viewer || perm?.editor)
    .map(([userId, perm]) => ({ user_id: Number(userId) || userId, permission_type: perm.editor ? 'edit' : 'view' }));

const buildBusinessRulePayload = (formState, ctx) => {
  const triggerActions = ctx.triggerConfig?.actions ?? [];
  const nextCtx = { ...ctx, triggerActions };

  return {
    rule_name: formState.name,
    description: formState.description,
    trigger_type_id: formState.triggerRuleId,
    owner_user_id: formState.ownerUserId ?? ctx.loggedInUserId,
    tags: formState.tags.join(', '),
    disallow_rule_action_trigger: formState.disallowTriggerChain ? 1 : 0,
    conditions: buildConditions(formState, nextCtx),
    then_actions: buildThenActions(formState, nextCtx),
    shared_users: buildSharedUsers(formState.sharePermissions),
  };
};

// New rules are always created disabled — there's no enable/disable input in the
// add-rule flow, matching the picker/form having no such toggle.
export const buildCreateBusinessRulePayload = (formState, ctx) => ({
  ...buildBusinessRulePayload(formState, ctx),
  is_enabled: 0,
});

// Edits must not silently flip an existing rule's enabled state, so ctx.isEnabled is
// expected to carry the rule's current status through from businessRuleDetails.
export const buildUpdateBusinessRulePayload = (formState, ctx) => ({
  ...buildBusinessRulePayload(formState, ctx),
  updated_by_user_id: ctx.loggedInUserId,
  is_enabled: ctx.isEnabled ? 1 : 0,
});

// Notify/invoke actions, and the "create subtask" create-action, only get a real backend
// id once their nested settings modal has been opened and saved — a row added but never
// configured has nothing to reference in then_actions, so saving must be blocked instead
// of silently dropping it.
export const getUnconfiguredActionLabels = (formState) => {
  const labels = [];
  formState.notifyActions.forEach((a) => { if (!a.notification_id) labels.push(a.label ?? 'Send notification'); });
  formState.invokeActions.forEach((a) => { if (!a.webServiceId) labels.push(a.label ?? 'Invoke web service'); });
  formState.createActions.forEach((a) => { if (a.key === 'subtask' && !a.createSubtaskId) labels.push(a.label ?? 'Create subtask'); });
  return labels;
};
