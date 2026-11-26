import { ACTION_GROUP_TYPE_TO_SECTION_ID, DEADLINE_MODE_OPTIONS, LIST_UPDATE_MODE_OPTIONS } from './businessRulesData';
import { normalizeConnector } from './businessRuleFieldUtils';

export const EMPTY_BOARD_POSITION = { boardId: '', workflowId: '', columnId: '', swimlaneId: '' };

// Value stored for a field_type "none" field that the user ticked (the field itself is the choice).
export const NONE_FIELD_CHECKED = '1';

// extraValues: more lines added under one field with AND, sent as repeated field_key + field_value pairs.
// "Set deadline": relative / absolute mode, the days (relative) or date (absolute) and the non-working days.
// Kept per field key in value.deadlines, since it needs more than one value.
export const EMPTY_DEADLINE = { mode: DEADLINE_MODE_OPTIONS[0].key, days: '0', date: '', nonWorkingDays: [] };

// "Set tags" append / replace mode, kept per field key in value.listModes. The picker lists replace
// first and opens on it.
export const DEFAULT_LIST_MODE = LIST_UPDATE_MODE_OPTIONS[1].key;
export const LIST_MODE_CHOICES = [...LIST_UPDATE_MODE_OPTIONS].reverse().map((mode) => ({ value: mode.key, label: mode.label }));

export const EMPTY_GENERIC_ACTION_VALUE = { thenActionId: null, title: '', fields: {}, extraValues: {}, deadlines: {}, listModes: {}, position: EMPTY_BOARD_POSITION, cards: null, noFields: false, filterConditions: [], more: [] };

// One card of the recurring "Create cards" action.
export const EMPTY_CREATE_CARD = { thenActionId: null, title: '', fields: {}, position: EMPTY_BOARD_POSITION };

// get_trigger_config group_type of the recurring "Create cards" action (guide 5.10): it is saved
// as card_title + target_* + the card fields under their own property_key, not as field_key pairs.
export const CREATE_CARDS_GROUP_TYPE = 'create_card_recurring';

export const isCreateCardsAction = (action) => action?.group_type === CREATE_CARDS_GROUP_TYPE;

const CREATE_CARDS_RESERVED_KEYS = ['card_title', 'target_board_id', 'target_workflow_id', 'target_column_id', 'target_swimlane_id'];

// "Remove stickers" comes from the catalog as a field with no value control; the stickers to
// remove are picked from the board-management sticker list, like the Remove stickers update action.
export const REMOVE_STICKERS_FIELD_KEY = 'remove_stickers';

export const isRemoveStickersField = (field) => field.field_key === REMOVE_STICKERS_FIELD_KEY;

export const isCustomGenericField = (field) => field.custom_field_id != null && field.regular_field_id == null;

// "Set color" is picked with the colour picker (swatch + hex) instead of a text box; the key is the
// Set color update option's own key.
export const SET_COLOR_FIELD_KEY = 'set_color';

export const isSetColorField = (field) => !isCustomGenericField(field) && field.field_key === SET_COLOR_FIELD_KEY;

// "Set deadline" is drawn with its own mode / days / non-working-days controls; the key is the
// Set deadline update option's own key.
export const SET_DEADLINE_FIELD_KEY = 'set_deadline';

export const isSetDeadlineField = (field) => !isCustomGenericField(field) && field.field_key === SET_DEADLINE_FIELD_KEY;

// "Set X" fields read as "Set X to [value]" ("Set description to", "Set title to", "Set type to"),
// except the ones that carry their own wording: Set deadline ("to a relative date"), Set tags
// ("replace") and Set blocker.
export const SET_TAGS_FIELD_KEY = 'set_tags';

export const isSetTagsField = (field) => !isCustomGenericField(field) && field.field_key === SET_TAGS_FIELD_KEY;

const SET_FIELD_KEYS_WITHOUT_TO = [SET_DEADLINE_FIELD_KEY, SET_TAGS_FIELD_KEY, 'set_blocker'];

export const hasSetToPhrase = (field) => !isCustomGenericField(field)
  && String(field.field_key ?? '').startsWith('set_')
  && !SET_FIELD_KEYS_WITHOUT_TO.includes(field.field_key);

// A card field (Create card) is sent under its own property_key; other fields under field_key.
export const getGenericFieldKey = (field) => (isCustomGenericField(field) ? `custom-${field.custom_field_id}` : (field.property_key ?? field.field_key));

// Trigger actions whose group_type has no dedicated section; they are drawn by
// GenericThenActionEditor from the backend's own field catalog.
export const isGenericTriggerAction =(action) => !ACTION_GROUP_TYPE_TO_SECTION_ID[action.group_type];

const POSITION_PROPERTY_KEY = {
  boardId: 'target_board_id',
  workflowId: 'target_workflow_id',
  columnId: 'target_column_id',
  swimlaneId: 'target_swimlane_id',
};

const positionFromProperties = (properties) => {
  const position = { ...EMPTY_BOARD_POSITION };
  properties.forEach((prop) => {
    const stateKey = Object.keys(POSITION_PROPERTY_KEY).find((k) => POSITION_PROPERTY_KEY[k] === prop.property_key);
    if (stateKey) position[stateKey] = String(prop.property_value ?? '');
  });
  return position;
};

const asProperty = (property_key, property_value) => ({ property_key, property_value, property_value_type: 'string' });

// Which "if <kind> card matches this filter" box an action carries (has_parent_filter /
// has_child_filter / has_relative_filter in get_trigger_config) and the request key it is sent under.
const FILTER_KINDS = [
  { kind: 'parent', flag: 'has_parent_filter', requestKey: 'parent_conditions' },
  { kind: 'child', flag: 'has_child_filter', requestKey: 'child_conditions' },
  { kind: 'relative', flag: 'has_relative_filter', requestKey: 'relative_conditions' },
];

export const getActionFilterKind = (action) => FILTER_KINDS.find((k) => Number(action?.[k.flag]) === 1) ?? null;

// An action that is added once per target card (a move to a board position, or any action with a
// parent / child / relative filter, e.g. "Update the parent card details") can be added again.
export const isRepeatableAction = (action) => !isCreateCardsAction(action)
  && (Number(action?.has_board_position) === 1 || Boolean(getActionFilterKind(action)));

// A repeatable action with a filter draws one card per target; the action's title is drawn
// inside each card instead of above the section.
export const isTitleInCardAction = (action, allowRepeat = true) => allowRepeat
  && isRepeatableAction(action)
  && Boolean(getActionFilterKind(action));

// Filter rows of an action: one entry per filled-in row.
const buildFilterConditions = (rows = []) => rows
  .filter((row) => row.operatorKey)
  .map((row) => {
    const entry = { operator: row.operatorKey, input_value: row.value, connector: normalizeConnector(row.connector) };
    if (row.fieldType === 'custom') entry.custom_field_id = row.fieldId;
    else entry.regular_field_id = row.fieldId;
    if (row.timeUnitId) entry.time_unit_id = Number(row.timeUnitId);
    if (row.positionColumns?.length) entry.position_value = row.positionColumns.map((column) => column.id).join(',');
    return entry;
  });

const parseFilterConditions = (conditions = []) => conditions.map((c, index) => ({
  id: `relative-filter-saved-${index}`,
  fieldType: c.custom_field_id != null ? 'custom' : 'regular',
  fieldId: c.custom_field_id ?? c.regular_field_id,
  fieldLabel: c.field_label ?? '',
  operatorKey: c.operator_key ?? c.operator ?? '',
  connector: normalizeConnector(c.connector),
  value: String(c.input_value ?? ''),
  timeUnitId: c.time_unit_id != null ? String(c.time_unit_id) : '',
  positionColumns: String(c.position_value ?? '').split(',').map((id) => id.trim()).filter(Boolean).map((id) => ({ id, name: '' })),
}));

// One then_action per generic trigger action the user filled in. Regular fields go out as
// field_key + field_value pairs, custom fields as custom_field_id + property_value, and a
// board position as the four target_* ids (guide 5.4 / 5.5 / 5.6).
export const buildGenericThenActions = (triggerActions, genericActionValues) => {
  const entries = [];
  triggerActions.filter(isGenericTriggerAction).forEach((action) => {
    const value = genericActionValues[String(action.action_type_id)];
    if (!value) return;

    if (isCreateCardsAction(action)) {
      // One then_action per "Create card" card the user added.
      (value.cards ?? []).forEach((card) => {
        const cardProperties = [];
        if (card.title?.trim()) cardProperties.push(asProperty('card_title', card.title.trim()));
        Object.entries(card.fields).forEach(([key, fieldValue]) => {
          if (fieldValue !== '' && fieldValue != null) cardProperties.push(asProperty(key, fieldValue));
        });
        Object.entries(POSITION_PROPERTY_KEY).forEach(([stateKey, propertyKey]) => {
          if (card.position[stateKey]) cardProperties.push(asProperty(propertyKey, card.position[stateKey]));
        });
        if (cardProperties.length === 0) return;
        const createEntry = { action_type_id: action.action_type_id, properties: cardProperties };
        if (card.thenActionId != null) createEntry.then_action_id = card.thenActionId;
        entries.push(createEntry);
      });
      return;
    }
    // An action can be added again (e.g. Move its parent card to, each with its own filter): the first
    // instance is the value itself, the others are in value.more.
    [value, ...(value.more ?? [])].forEach((instance) => {
      const properties = [];
      Object.entries(instance.fields).forEach(([key, fieldValue]) => {
        if (key === SET_DEADLINE_FIELD_KEY) {
          // Same properties as the Set deadline update action (deadline_mode / deadline_days /
          // deadline_date / non_working_days); the field value is the days or the date.
          const deadline = { ...EMPTY_DEADLINE, ...(instance.deadlines?.[key] ?? {}) };
          const isRelative = deadline.mode === DEADLINE_MODE_OPTIONS[0].key;
          properties.push(asProperty('field_key', key));
          properties.push(asProperty('field_value', isRelative ? String(deadline.days) : deadline.date));
          properties.push(asProperty('deadline_mode', deadline.mode));
          properties.push({ property_key: 'deadline_days', property_value: Number(deadline.days) || 0, property_value_type: 'number' });
          properties.push(asProperty('deadline_date', deadline.date));
          properties.push(asProperty('non_working_days', deadline.nonWorkingDays.join(', ')));
          return;
        }
        if (fieldValue === '' || fieldValue == null) return;
        if (key.startsWith('custom-')) {
          properties.push({ custom_field_id: Number(key.slice('custom-'.length)), property_value: fieldValue });
          return;
        }
        properties.push(asProperty('field_key', key));
        if (fieldValue !== NONE_FIELD_CHECKED) properties.push(asProperty('field_value', fieldValue));
        (instance.extraValues?.[key] ?? []).filter((extra) => extra !== '' && extra != null).forEach((extra) => {
          properties.push(asProperty('field_key', key));
          properties.push(asProperty('field_value', extra));
        });
        // Same list_mode property as the Set tags update action.
        if (key === SET_TAGS_FIELD_KEY) properties.push(asProperty('list_mode', instance.listModes?.[key] ?? DEFAULT_LIST_MODE));
      });
      Object.entries(POSITION_PROPERTY_KEY).forEach(([stateKey, propertyKey]) => {
        if (instance.position[stateKey]) properties.push(asProperty(propertyKey, instance.position[stateKey]));
      });

      // An action with no fields at all (Archive cards) is sent as just its action_type_id.
      const filterConditions = buildFilterConditions(instance.filterConditions);
      if (properties.length === 0 && !instance.noFields && filterConditions.length === 0) return;
      const entry = { action_type_id: action.action_type_id };
      if (properties.length > 0) entry.properties = properties;
      const filterKind = getActionFilterKind(action);
      if (filterKind && filterConditions.length > 0) entry[filterKind.requestKey] = filterConditions;
      if (instance.thenActionId != null) entry.then_action_id = instance.thenActionId;
      entries.push(entry);
    });
  });
  return entries;
};

// Inverse of buildGenericThenActions for one saved action from get_business_rule_by_id.
export const parseGenericThenAction = (savedAction, groupType) => {
  if (groupType === CREATE_CARDS_GROUP_TYPE) {
    const props = savedAction.properties ?? [];
    const cardFields = {};
    props.forEach((p) => {
      if (p.property_key && !CREATE_CARDS_RESERVED_KEYS.includes(p.property_key)) cardFields[p.property_key] = String(p.property_value ?? '');
    });
    return {
      ...EMPTY_GENERIC_ACTION_VALUE,
      cards: [{
        ...EMPTY_CREATE_CARD,
        thenActionId: savedAction.then_action_id ?? null,
        title: String(props.find((p) => p.property_key === 'card_title')?.property_value ?? ''),
        fields: cardFields,
        position: positionFromProperties(props),
      }],
    };
  }
  const savedFilterConditions = FILTER_KINDS.map((k) => savedAction[k.requestKey]).find((list) => Array.isArray(list) && list.length > 0) ?? [];
  const fields = {};
  const extraValues = {};
  const deadline = { ...EMPTY_DEADLINE };
  let listMode = DEFAULT_LIST_MODE;
  const position = { ...EMPTY_BOARD_POSITION };
  let pendingKey = null;

  const flushPending = () => {
    if (pendingKey != null) fields[pendingKey] = NONE_FIELD_CHECKED;
    pendingKey = null;
  };

  (savedAction.properties ?? []).forEach((prop) => {
    if (prop.custom_field_id != null) {
      fields[`custom-${prop.custom_field_id}`] = String(prop.property_value ?? '');
      return;
    }
    if (prop.property_key === 'list_mode') listMode = String(prop.property_value ?? '') || listMode;
    if (prop.property_key === 'deadline_mode') deadline.mode = String(prop.property_value ?? '') || deadline.mode;
    if (prop.property_key === 'deadline_days') deadline.days = String(prop.property_value ?? '0');
    if (prop.property_key === 'deadline_date') deadline.date = String(prop.property_value ?? '');
    if (prop.property_key === 'non_working_days') {
      deadline.nonWorkingDays = String(prop.property_value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    }
    if (prop.property_key === 'field_key') {
      flushPending();
      pendingKey = prop.property_value;
      return;
    }
    if (prop.property_key === 'field_value') {
      if (pendingKey != null && fields[pendingKey] === undefined) {
        fields[pendingKey] = String(prop.property_value ?? '');
      } else if (pendingKey != null) {
        extraValues[pendingKey] = [...(extraValues[pendingKey] ?? []), String(prop.property_value ?? '')];
      }
      pendingKey = null;
      return;
    }
    const positionKey = Object.keys(POSITION_PROPERTY_KEY).find((k) => POSITION_PROPERTY_KEY[k] === prop.property_key);
    if (positionKey) position[positionKey] = String(prop.property_value ?? '');
  });
  flushPending();

  return {
    ...EMPTY_GENERIC_ACTION_VALUE,
    thenActionId: savedAction.then_action_id ?? null,
    fields,
    extraValues,
    deadlines: fields[SET_DEADLINE_FIELD_KEY] !== undefined ? { [SET_DEADLINE_FIELD_KEY]: deadline } : {},
    listModes: fields[SET_TAGS_FIELD_KEY] !== undefined ? { [SET_TAGS_FIELD_KEY]: listMode } : {},
    position,
    noFields: (savedAction.properties ?? []).length === 0 && savedFilterConditions.length === 0,
    filterConditions: parseFilterConditions(savedFilterConditions),
  };
};

// ---- Create card / child / parent (guide 5.7) --------------------------------------------

// One "create card" action: what to create, its title, where, the card fields and the fields
// copied from this card. Subtasks are handled by the dedicated create-subtask flow instead.
export const makeCreateCardAction = (relationType, label) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  thenActionId: null,
  relationType,
  label,
  title: '',
  position: { ...EMPTY_BOARD_POSITION },
  fields: {},
  copyKeys: [],
});

export const buildCreateCardThenActions = (actionTypeId, createCardActions) =>
  createCardActions.map((action) => {
    const properties = [asProperty('relation_type', action.relationType)];
    if (action.title.trim()) properties.push(asProperty('card_title', action.title.trim()));
    Object.entries(POSITION_PROPERTY_KEY).forEach(([stateKey, propertyKey]) => {
      if (action.position[stateKey]) properties.push(asProperty(propertyKey, action.position[stateKey]));
    });
    Object.entries(action.fields).forEach(([key, fieldValue]) => {
      if (fieldValue !== '' && fieldValue != null) properties.push(asProperty(key, fieldValue));
    });
    if (action.copyKeys.length > 0) properties.push(asProperty('copy_regular_fields', action.copyKeys.join(',')));
    const entry = { action_type_id: actionTypeId, properties };
    if (action.thenActionId != null) entry.then_action_id = action.thenActionId;
    return entry;
  });

const CREATE_CARD_RESERVED_KEYS = ['relation_type', 'card_title', 'copy_regular_fields', ...Object.values(POSITION_PROPERTY_KEY)];

export const parseCreateCardThenAction = (savedAction, label) => {
  const properties = savedAction.properties ?? [];
  const get = (key) => properties.find((p) => p.property_key === key)?.property_value ?? '';
  const fields = {};
  properties.forEach((p) => {
    if (p.property_key && !CREATE_CARD_RESERVED_KEYS.includes(p.property_key)) fields[p.property_key] = String(p.property_value ?? '');
  });
  return {
    ...makeCreateCardAction(String(get('relation_type')), label),
    id: `create-${savedAction.then_action_id}`,
    thenActionId: savedAction.then_action_id ?? null,
    title: String(get('card_title')),
    position: positionFromProperties(properties),
    fields,
    copyKeys: String(get('copy_regular_fields')).split(',').map((k) => k.trim()).filter(Boolean),
  };
};
