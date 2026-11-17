import { ACTION_GROUP_TYPE_TO_SECTION_ID } from './businessRulesData';

export const EMPTY_BOARD_POSITION = { boardId: '', workflowId: '', columnId: '', swimlaneId: '' };

// Value stored for a field_type "none" field that the user ticked (the field itself is the choice).
export const NONE_FIELD_CHECKED = '1';

export const EMPTY_GENERIC_ACTION_VALUE = { thenActionId: null, fields: {}, position: EMPTY_BOARD_POSITION };

export const isCustomGenericField = (field) => field.custom_field_id != null && field.regular_field_id == null;

export const getGenericFieldKey = (field) => (isCustomGenericField(field) ? `custom-${field.custom_field_id}` : field.field_key);

// Trigger actions whose group_type has no dedicated section; they are drawn by
// GenericThenActionEditor from the backend's own field catalog.
export const isGenericTriggerAction = (action) => !ACTION_GROUP_TYPE_TO_SECTION_ID[action.group_type];

const POSITION_PROPERTY_KEY = {
  boardId: 'target_board_id',
  workflowId: 'target_workflow_id',
  columnId: 'target_column_id',
  swimlaneId: 'target_swimlane_id',
};

const asProperty = (property_key, property_value) => ({ property_key, property_value, property_value_type: 'string' });

// One then_action per generic trigger action the user filled in. Regular fields go out as
// field_key + field_value pairs, custom fields as custom_field_id + property_value, and a
// board position as the four target_* ids (guide 5.4 / 5.5 / 5.6).
export const buildGenericThenActions = (triggerActions, genericActionValues) => {
  const entries = [];
  triggerActions.filter(isGenericTriggerAction).forEach((action) => {
    const value = genericActionValues[String(action.action_type_id)];
    if (!value) return;

    const properties = [];
    Object.entries(value.fields).forEach(([key, fieldValue]) => {
      if (fieldValue === '' || fieldValue == null) return;
      if (key.startsWith('custom-')) {
        properties.push({ custom_field_id: Number(key.slice('custom-'.length)), property_value: fieldValue });
        return;
      }
      properties.push(asProperty('field_key', key));
      if (fieldValue !== NONE_FIELD_CHECKED) properties.push(asProperty('field_value', fieldValue));
    });
    Object.entries(POSITION_PROPERTY_KEY).forEach(([stateKey, propertyKey]) => {
      if (value.position[stateKey]) properties.push(asProperty(propertyKey, value.position[stateKey]));
    });

    if (properties.length === 0) return;
    const entry = { action_type_id: action.action_type_id, properties };
    if (value.thenActionId != null) entry.then_action_id = value.thenActionId;
    entries.push(entry);
  });
  return entries;
};

// Inverse of buildGenericThenActions for one saved action from get_business_rule_by_id.
export const parseGenericThenAction = (savedAction) => {
  const fields = {};
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
      if (pendingKey != null) fields[pendingKey] = String(prop.property_value ?? '');
      pendingKey = null;
      return;
    }
    const positionKey = Object.keys(POSITION_PROPERTY_KEY).find((k) => POSITION_PROPERTY_KEY[k] === prop.property_key);
    if (positionKey) position[positionKey] = String(prop.property_value ?? '');
  });
  flushPending();

  return { ...EMPTY_GENERIC_ACTION_VALUE, thenActionId: savedAction.then_action_id ?? null, fields, position };
};
