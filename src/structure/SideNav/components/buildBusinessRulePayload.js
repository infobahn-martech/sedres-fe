import { ACTION_GROUP_TYPE_TO_SECTION_ID } from './businessRulesData';

const findActionTypeId = (triggerActions, sectionId) =>
  triggerActions.find((a) => ACTION_GROUP_TYPE_TO_SECTION_ID[a.group_type] === sectionId)?.action_type_id ?? null;

// A create action's `key` is the DEV-fallback's literal 'subtask' string, but a live backend
// response keys it by its own field_key — so the label is matched with `.includes()` rather
// than an exact string, since a strict `=== 'create subtask'` broke whenever the live
// field_label carried slightly different wording (e.g. "Create Sub Task"). Exported so
// BusinessRuleFormModal.jsx filters/renders create actions with the same check used on save.
export const isCreateSubtaskAction = (action) =>
  action?.key === 'subtask' || (action?.label ?? '').trim().toLowerCase().includes('subtask');

const getOperatorLabel = (fieldDetailsByKey, fieldType, fieldId, operatorId) => {
  if (!fieldType || fieldId == null) return null;
  const operators = fieldDetailsByKey[`${fieldType}-${fieldId}`]?.operators ?? [];
  return operators.find((op) => String(op.field_operator_id) === String(operatorId))?.operator_label ?? null;
};

// Flat conditions[] list: one entry per condition-box value row, in field-details-derived
// operator-label form (matches the "is"/"is not" convention confirmed by DUMMY_FIELD_OPERATORS
// lining up with the documented example's `operator: "is"`). The board restriction rows are
// folded in alongside real conditions using the same shape — best-effort, since the
// create_business_rule example only documents plain field conditions and board rows have no
// confirmed backend contract yet. whenFields is NOT folded in here — see
// buildWhenFields below, confirmed to be its own top-level request field instead.
const buildConditions = (formState, ctx) => {
  const { conditions, boardConditionRows } = formState;
  const { fieldDetailsByKey, triggerConfig } = ctx;
  const entries = [];

  conditions.forEach((cond) => {
    cond.values.forEach((row, index) => {
      const entry = {
        operator: getOperatorLabel(fieldDetailsByKey, cond.fieldType, cond.fieldId, cond.operatorId),
        input_value: row.value,
        connector: index === 0 ? 'AND' : row.joinWord,
      };
      // A value row restored from an existing rule carries the backend's own condition_id
      // (see the edit-mode routing effect in BusinessRuleFormModal.jsx) — sending it back
      // lets an update target that exact row instead of the whole condition list being
      // torn down and recreated with fresh ids. A row added this session has none, so the
      // key is omitted and the backend treats it as a new condition.
      if (row.conditionId != null) entry.condition_id = row.conditionId;
      if (cond.fieldType === 'custom') entry.custom_field_id = cond.fieldId;
      else if (cond.fieldType === 'regular') entry.regular_field_id = cond.fieldId;
      else entry.time_unit_key = cond.fieldKey; // best-effort: time-unit conditions have no confirmed id field
      entries.push(entry);
    });
  });

  // Board restriction rows carry no field id of their own — best-effort lookup
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

  return entries;
};

// "When fields" watch list (e.g. Recurring create cards' "watch this field" picker) — its
// own top-level `when_fields` array, confirmed against a real documented example
// (`[{ "regular_field_id": 21 }]`), not folded into conditions[] like the earlier best-effort
// guess did. No operator/value in the UI for these at all, matching the confirmed shape.
const buildWhenFieldsWatchList = (formState) => formState.whenFields.map((f) => {
  const entry = {};
  if (f.fieldType === 'custom') entry.custom_field_id = f.fieldId;
  else if (f.fieldType === 'regular') entry.regular_field_id = f.fieldId;
  return entry;
});

// WHEN-side recurrence-schedule pill (recurrenceSchedule state in BusinessRuleFormModal.jsx,
// rendered only when triggerConfig.when_type === 'regular_fields') — its own when_fields
// entry keyed by a fixed regular_field_id per option, confirmed against real documented
// examples for these 4 (every_day: 20, every_workday: 63, advanced_schedule: 64,
// predefined_interval: 65). schedule_type/schedule_properties are confirmed present ONLY on
// the advanced_schedule/predefined_interval examples — every_day/every_workday's examples
// carry just the bare regular_field_id, and sending the extra keys there gets the request
// rejected. "every_week"/"every_month" (the other two RECURRENCE_SCHEDULE_OPTIONS entries)
// have no confirmed regular_field_id yet, so they're intentionally left unsent rather than
// guessed.
export const RECURRENCE_REGULAR_FIELD_ID = {
  every_day: 20,
  every_workday: 63,
  advanced_schedule: 64,
  predefined_interval: 65,
};

// The 4 reserved regular_field_ids above are recurrence-pill markers, not real watchable
// card fields — a saved rule's when_fields always echoes one of them back (see
// buildRecurrenceWhenField below), and BusinessRuleFormModal.jsx's edit-mode restore effect
// must exclude them from the separate "watch this field" chip list it rebuilds from the same
// when_fields array. Without this, reopening a recurring-create-cards rule silently carries
// that marker into whenFields state (invisible in the UI, since this trigger type renders the
// recurrence pill instead of the chip list) and re-saving sends it back as a stray duplicate
// when_fields entry alongside the real recurrence entry.
export const RECURRENCE_REGULAR_FIELD_IDS = Object.values(RECURRENCE_REGULAR_FIELD_ID);

// RRULE's 2-letter weekday codes (see WEEKDAY_KEY_TO_RRULE in BusinessRuleFormModal.jsx) to
// the 3-letter cron abbreviation the advanced_schedule example actually uses
// (BYDAY=WE,SA -> cron_day_of_week "WED,SAT"). Kept as its own local map instead of importing
// from BusinessRuleFormModal.jsx, which already imports from this file.
const RRULE_WEEKDAY_TO_CRON_ABBR = {
  SU: 'SUN', MO: 'MON', TU: 'TUE', WE: 'WED', TH: 'THU', FR: 'FRI', SA: 'SAT',
};

// Advanced schedule's stored value is either an RRULE-style string (FREQ=...;..., see
// buildAdvancedScheduleValue in BusinessRuleFormModal.jsx) or, for the "Custom cron
// expression" tab, a raw "day month dow year" string typed directly in that order. Converts
// either into the 4 schedule_properties keys. Only the weekly-generator case is confirmed
// against a real example (BYDAY=WE,SA -> { day: '?', month: '*', dow: 'WED,SAT', year: '*' });
// daily/monthly/yearly are best-effort until confirmed against a real saved rule.
export const buildAdvancedScheduleFields = (advancedSchedule) => {
  const raw = (advancedSchedule ?? '').trim();
  if (!raw) return { day: '*', month: '*', dow: '?', year: '*' };

  if (!raw.startsWith('FREQ=')) {
    const [day, month, dow, year] = raw.split(/\s+/);
    return { day: day || '*', month: month || '*', dow: dow || '?', year: year || '*' };
  }

  const parts = Object.fromEntries(raw.split(';').filter(Boolean).map((p) => p.split('=')));
  const toCronAbbr = (byDay) => (byDay ?? '').split(',').filter(Boolean)
    .map((code) => RRULE_WEEKDAY_TO_CRON_ABBR[code.slice(-2)] ?? code).join(',');

  if (parts.FREQ === 'WEEKLY') {
    return { day: '?', month: '*', dow: toCronAbbr(parts.BYDAY) || '?', year: '*' };
  }
  if (parts.FREQ === 'DAILY') {
    return parts.WEEKDAY
      ? { day: '?', month: '*', dow: 'MON-FRI', year: '*' }
      : { day: `*/${parts.INTERVAL ?? '1'}`, month: '*', dow: '?', year: '*' };
  }
  if (parts.FREQ === 'MONTHLY') {
    return parts.BYMONTHDAY
      ? { day: parts.BYMONTHDAY, month: '*', dow: '?', year: '*' }
      : { day: '?', month: '*', dow: toCronAbbr(parts.BYDAY) || '?', year: '*' };
  }
  // yearly
  return parts.BYMONTHDAY
    ? { day: parts.BYMONTHDAY, month: parts.BYMONTH ?? '*', dow: '?', year: '*' }
    : { day: '?', month: parts.BYMONTH ?? '*', dow: toCronAbbr(parts.BYDAY) || '?', year: '*' };
};

const buildRecurrenceWhenField = (formState) => {
  const key = formState.recurrenceSchedule;
  const regularFieldId = RECURRENCE_REGULAR_FIELD_ID[key];
  if (regularFieldId == null) return null; // every_week/every_month: no confirmed field id yet

  if (key !== 'advanced_schedule' && key !== 'predefined_interval') {
    return { regular_field_id: regularFieldId };
  }

  if (key === 'advanced_schedule') {
    const { day, month, dow, year } = buildAdvancedScheduleFields(formState.advancedSchedule);
    return {
      regular_field_id: regularFieldId,
      schedule_type: 'advanced_schedule',
      schedule_properties: [
        { property_key: 'cron_day_of_month', property_value: day },
        { property_key: 'cron_month', property_value: month },
        { property_key: 'cron_day_of_week', property_value: dow },
        { property_key: 'cron_year', property_value: year },
      ],
    };
  }

  // predefined_interval
  return {
    regular_field_id: regularFieldId,
    schedule_type: 'predefined_interval',
    schedule_properties: [
      { property_key: 'interval', property_value: String(formState.predefinedIntervalDays ?? '1') },
      { property_key: 'start_date', property_value: formState.predefinedIntervalStartDate ?? '' },
    ],
  };
};

const buildWhenFields = (formState, ctx) => {
  const entries = buildWhenFieldsWatchList(formState);
  if (ctx?.triggerConfig?.when_type === 'regular_fields') {
    const recurrenceField = buildRecurrenceWhenField(formState);
    if (recurrenceField) entries.push(recurrenceField);
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
      // These groups are never routed into editable state, so `action` here is still the
      // literal object the backend returned — its own then_action_id rides straight through.
      if (action.then_action_id != null) entry.then_action_id = action.then_action_id;

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
          link_card_id: row.link_card_id ?? undefined,
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
    createActions, linkActions, removeOtherLinksByType, updateActions,
    copyValuesActions, notifyActions, invokeActions,
  } = formState;
  const { triggerActions } = ctx;
  const thenActions = [];

  // An action restored from an existing rule carries the backend's own then_action_id
  // (see the edit-mode routing effect in BusinessRuleFormModal.jsx) — sending it back on
  // update lets that exact row be updated in place instead of the whole action being torn
  // down and recreated with a fresh id. An action added this session has none, so the key
  // is left off and the backend treats it as a new then_action.
  const withThenActionId = (entry, action) => {
    if (action.thenActionId != null) entry.then_action_id = action.thenActionId;
    return entry;
  };

  const createActionTypeId = findActionTypeId(triggerActions, 'create');
  // Only "Create subtask" create-actions are supported — no board/column/title to configure
  // (it's created under the current card, not a new board location). Only relation_type
  // marks it as a subtask.
  createActions.filter(isCreateSubtaskAction).forEach((action) => {
    const properties = [{ property_key: 'relation_type', property_value: 'subtask', property_value_type: 'string' }];
    const entry = withThenActionId({ action_type_id: createActionTypeId, properties }, action);
    // create_subtask_id (referencing the owner/deadline/description record already saved
    // server-side via saveCreateSubtaskSettings) is a top-level sibling field on the
    // then_action, confirmed from a real get_business_rule_by_id response — that action's
    // own "create_subtask_id": null sits next to "properties", not inside it.
    if (action.createSubtaskId != null) entry.create_subtask_id = action.createSubtaskId;
    thenActions.push(entry);
  });

  // Update field — each chip is one field+value pair, wrapped in the generic
  // field_key/field_value property pair the documented example uses for action_type_id 4,
  // reconfirmed against a real update_business_rule response (branch b35, 2026-07-25).
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
    // Add/Remove co-owners share the same field_key ('Co-owners'), so a round-tripped
    // rule can't otherwise tell which one was saved — the edit-mode routing effect below
    // always matched the first UPDATE_ACTION_OPTIONS entry for that field ('Add co-owners'),
    // silently relabeling every saved "Remove co-owners" action back to "Add" on reopen.
    // This marker property is best-effort (no documented shape), same status as frequency
    // above, but needed so BusinessRuleFormModal.jsx's restore logic can disambiguate.
    if (action.key === 'add_co_owners' || action.key === 'remove_co_owners') {
      properties.push({
        property_key: 'update_mode',
        property_value: action.key === 'remove_co_owners' ? 'remove' : 'add',
        property_value_type: 'string',
      });
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
    thenActions.push(withThenActionId({ action_type_id: updateActionTypeId, properties }, action));
  });

  // Link card — a single then_actions entry for the whole section; link_card is fanned
  // out one entry per value row, across all link action rows (the API's link_card shape
  // only carries a single input_value per entry). Shape confirmed against a real
  // update_business_rule response (action_type_id 5, branch b35, 2026-07-25).
  if (linkActions.length > 0) {
    const linkCard = [];
    linkActions.forEach((action) => {
      action.values.forEach((row) => {
        const entry = {
          relation_type: action.key,
          operator_key: action.operatorKey,
          input_value: row.value,
          remove_other: removeOtherLinksByType[action.key] ? 1 : 0,
          connector: 'AND',
        };
        // Each row carries its own backend link_card_id (restored in the edit-mode routing
        // effect) — sent per-row rather than as one then_action_id on this whole entry,
        // since all relation types are collapsed into a single then_actions entry here even
        // though the backend may have originally stored them as separate rows.
        if (row.linkCardId != null) entry.link_card_id = row.linkCardId;
        linkCard.push(entry);
      });
    });
    thenActions.push({ action_type_id: findActionTypeId(triggerActions, 'link'), link_card: linkCard });
  }

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
  // modals — only the resulting id is referenced here. notification_id/web_service_id as
  // top-level sibling fields confirmed against a real update_business_rule response
  // (action_type_id 2 and 9, branch b35, 2026-07-25).
  const notifyActionTypeId = findActionTypeId(triggerActions, 'notify');
  notifyActions.forEach((action) => {
    thenActions.push(withThenActionId({ action_type_id: notifyActionTypeId, notification_id: action.notification_id }, action));
  });

  const invokeActionTypeId = findActionTypeId(triggerActions, 'invoke');
  invokeActions.forEach((action) => {
    thenActions.push(withThenActionId({ action_type_id: invokeActionTypeId, web_service_id: action.webServiceId }, action));
  });

  // Execute at — Recurring create cards' schedule, confirmed against a real documented
  // example (action_type_id resolved dynamically like every other section, execute_time
  // property). Only sent when this trigger actually has an 'execute_at' action in its
  // catalog (executeActionTypeId resolves to null otherwise), since executeAtTime always
  // carries a value (defaults to '00:00') regardless of trigger type.
  const executeActionTypeId = findActionTypeId(triggerActions, 'execute');
  if (executeActionTypeId != null && formState.executeAtTime) {
    const entry = {
      action_type_id: executeActionTypeId,
      properties: [
        { property_key: 'execute_time', property_value: formState.executeAtTime, property_value_type: 'string' },
        // Repeat-pattern pill (Every day/Every week/Every month/...) — the documented
        // example only covered execute_time, so this key is best-effort (mirrors the
        // RECURRENCE_SCHEDULE_OPTIONS key itself) until confirmed against a real response.
        // "every_workday" has no further sub-config UI, so only the bare pattern key is
        // sent for that one.
        { property_key: 'recurrence_schedule', property_value: formState.recurrenceSchedule || 'every_day', property_value_type: 'string' },
        // "Advanced schedule"'s cron-builder value (RRULE-style string, or a raw custom cron
        // expression — see buildAdvancedScheduleValue in BusinessRuleFormModal.jsx). Property
        // key is best-effort/unconfirmed like recurrence_schedule above.
        ...(formState.recurrenceSchedule === 'advanced_schedule' && formState.advancedSchedule
          ? [{ property_key: 'advanced_schedule_cron', property_value: formState.advancedSchedule, property_value_type: 'string' }]
          : []),
        // "Every month"'s "on day [N]" rows (OR-joined, like the Board/Position AND-condition
        // rows) — comma-joined day-of-month numbers. Property key is best-effort/unconfirmed
        // like the two above.
        ...(formState.recurrenceSchedule === 'every_month' && formState.monthlyDays?.length > 0
          ? [{ property_key: 'recurrence_month_days', property_value: formState.monthlyDays.join(','), property_value_type: 'string' }]
          : []),
        // "Every week"'s "on [weekday]" rows (OR-joined, same pattern as the monthly day rows
        // above) — comma-joined weekday keys (monday, tuesday, ...). Property key is
        // best-effort/unconfirmed like recurrence_month_days above.
        ...(formState.recurrenceSchedule === 'every_week' && formState.weeklyDays?.length > 0
          ? [{ property_key: 'recurrence_week_days', property_value: formState.weeklyDays.join(','), property_value_type: 'string' }]
          : []),
        // "Predefined interval"'s "every N day(s) starting from [date]" pair — property
        // keys are best-effort/unconfirmed like the month/week ones above.
        ...(formState.recurrenceSchedule === 'predefined_interval' && formState.predefinedIntervalDays
          ? [{ property_key: 'recurrence_interval_days', property_value: String(formState.predefinedIntervalDays), property_value_type: 'string' }]
          : []),
        ...(formState.recurrenceSchedule === 'predefined_interval' && formState.predefinedIntervalStartDate
          ? [{ property_key: 'recurrence_interval_start_date', property_value: formState.predefinedIntervalStartDate, property_value_type: 'string' }]
          : []),
      ],
    };
    if (formState.executeThenActionId != null) entry.then_action_id = formState.executeThenActionId;
    thenActions.push(entry);
  }

  thenActions.push(...buildRawThenActions(formState.rawThenActionGroups, ctx));

  return thenActions;
};

const buildSharedUsers = (sharePermissions) =>
  Object.entries(sharePermissions)
    .filter(([, perm]) => perm?.viewer || perm?.editor)
    .map(([userId, perm]) => ({ user_id: Number(userId) || userId, permission_type: perm.editor ? 'edit' : 'view' }));

// Top-level field set (rule_name/description/trigger_type_id/owner_user_id/tags/
// disallow_rule_action_trigger/conditions/then_actions/shared_users) confirmed against a
// real update_business_rule response (branch b35, 2026-07-25) — same shape as the earlier
// create_business_rule example, so this shared builder is now independently confirmed
// correct for both create and update.
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
    when_fields: buildWhenFields(formState, ctx),
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
// updated_by_user_id/is_enabled as top-level sibling fields confirmed against a real
// update_business_rule response (branch b35, 2026-07-25).
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
  formState.createActions.forEach((a) => { if (isCreateSubtaskAction(a) && !a.createSubtaskId) labels.push(a.label ?? 'Create subtask'); });
  return labels;
};
