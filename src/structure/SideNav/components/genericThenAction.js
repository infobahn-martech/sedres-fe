import { ACTION_GROUP_TYPE_TO_SECTION_ID } from './businessRulesData';

export const EMPTY_BOARD_POSITION = { boardId: '', workflowId: '', columnId: '', swimlaneId: '' };

// Value stored for a field_type "none" field that the user ticked (the field itself is the choice).
export const NONE_FIELD_CHECKED = '1';

// extraValues: more lines added under one field with AND, sent as repeated field_key + field_value pairs.
export const EMPTY_GENERIC_ACTION_VALUE = { thenActionId: null, title: '', fields: {}, extraValues: {}, position: EMPTY_BOARD_POSITION, cards: [], noFields: false, relativeConditions: [] };

// One card of the recurring "Create cards" action.
export const EMPTY_CREATE_CARD = { thenActionId: null, title: '', fields: {}, position: EMPTY_BOARD_POSITION };

// get_trigger_config group_type of the recurring "Create cards" action (guide 5.10): it is saved
// as card_title + target_* + the card fields under their own property_key, not as field_key pairs.
export const CREATE_CARDS_GROUP_TYPE = 'create_card_recurring';

export const isCreateCardsAction = (action) => action?.group_type === CREATE_CARDS_GROUP_TYPE;

const CREATE_CARDS_RESERVED_KEYS = ['card_title', 'target_board_id', 'target_workflow_id', 'target_column_id', 'target_swimlane_id'];

export const isCustomGenericField = (field) => field.custom_field_id != null && field.regular_field_id == null;

// A card field (Create card) is sent under its own property_key; other fields under field_key.
export const getGenericFieldKey = (field) => (isCustomGenericField(field) ? `custom-${field.custom_field_id}` : (field.property_key ?? field.field_key));

// Trigger actions whose group_type has no dedicated section; they are drawn by
// GenericThenActionEditor from the backend's own field catalog.
export const isGenericTriggerAction = (action) => !ACTION_GROUP_TYPE_TO_SECTION_ID[action.group_type];

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

// relative_conditions of a relative-card action (updates guide 2.3): one entry per filled-in filter row.
const buildRelativeConditions = (rows = []) => rows
  .filter((row) => row.operatorKey)
  .map((row) => {
    const entry = { operator: row.operatorKey, input_value: row.value };
    if (row.fieldType === 'custom') entry.custom_field_id = row.fieldId;
    else entry.regular_field_id = row.fieldId;
    if (row.timeUnitId) entry.time_unit_id = Number(row.timeUnitId);
    return entry;
  });

const parseRelativeConditions = (conditions = []) => conditions.map((c, index) => ({
  id: `relative-filter-saved-${index}`,
  fieldType: c.custom_field_id != null ? 'custom' : 'regular',
  fieldId: c.custom_field_id ?? c.regular_field_id,
  fieldLabel: c.field_label ?? '',
  operatorKey: c.operator_key ?? c.operator ?? '',
  value: String(c.input_value ?? ''),
  timeUnitId: c.time_unit_id != null ? String(c.time_unit_id) : '',
}));

// One then_action per generic trigger action the user filled in. Regular fields go out as
// field_key + field_value pairs, custom fields as custom_field_id + property_value, and a
// board position as the four target_* ids (guide 5.4 / 5.5 / 5.6).
export const buildGenericThenActions = (triggerActions, genericActionValues) => {
  const entries = [];
  triggerActions.filter(isGenericTriggerAction).forEach((action) => {
    const value = genericActionValues[String(action.action_type_id)];
    if (!value) return;

    const properties = [];
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
    Object.entries(value.fields).forEach(([key, fieldValue]) => {
      if (fieldValue === '' || fieldValue == null) return;
      if (key.startsWith('custom-')) {
        properties.push({ custom_field_id: Number(key.slice('custom-'.length)), property_value: fieldValue });
        return;
      }
      properties.push(asProperty('field_key', key));
      if (fieldValue !== NONE_FIELD_CHECKED) properties.push(asProperty('field_value', fieldValue));
      (value.extraValues?.[key] ?? []).filter((extra) => extra !== '' && extra != null).forEach((extra) => {
        properties.push(asProperty('field_key', key));
        properties.push(asProperty('field_value', extra));
      });
    });
    Object.entries(POSITION_PROPERTY_KEY).forEach(([stateKey, propertyKey]) => {
      if (value.position[stateKey]) properties.push(asProperty(propertyKey, value.position[stateKey]));
    });

    // An action with no fields at all (Archive cards) is sent as just its action_type_id.
    const relativeConditions = buildRelativeConditions(value.relativeConditions);
    if (properties.length === 0 && !value.noFields && relativeConditions.length === 0) return;
    const entry = { action_type_id: action.action_type_id };
    if (properties.length > 0) entry.properties = properties;
    if (relativeConditions.length > 0) entry.relative_conditions = relativeConditions;
    if (value.thenActionId != null) entry.then_action_id = value.thenActionId;
    entries.push(entry);
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
  const fields = {};
  const extraValues = {};
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
    position,
    noFields: (savedAction.properties ?? []).length === 0 && (savedAction.relative_conditions ?? []).length === 0,
    relativeConditions: parseRelativeConditions(savedAction.relative_conditions),
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
