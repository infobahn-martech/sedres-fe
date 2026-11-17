// Shared helpers for drawing a Business Rule field value (guide section 1): which control a
// field_type needs, and what an operator implies for the value box.

// field_types that never take a typed value (guide 1.2).
const NO_VALUE_FIELD_TYPES = ['file', 'none'];

// Operators that hide the value box entirely (guide 1.4).
const NO_VALUE_OPERATOR_KEYS = ['is_empty', 'is_not_empty', 'are_present', 'are_not_present'];

// Operators that need a number plus a time unit (guide 1.4).
const TIME_UNIT_OPERATOR_KEYS = ['in_next', 'in_last', 'was_more_than'];

const BETWEEN_OPERATOR_KEY = 'is_between';

export const BETWEEN_SEPARATOR = ',';

// The backend sends operator_id; older responses used field_operator_id.
export const getOperatorId = (operator) => operator?.field_operator_id ?? operator?.operator_id ?? '';

export const getOperatorKey = (operator) => operator?.operator_key ?? null;

export const fieldTakesValue = (details) => {
  if (!details) return true;
  if (Number(details.has_input_value) === 0) return false;
  return !NO_VALUE_FIELD_TYPES.includes(details.field_type);
};

export const operatorTakesValue = (operator) => !NO_VALUE_OPERATOR_KEYS.includes(getOperatorKey(operator));

export const operatorNeedsTimeUnit = (operator) => TIME_UNIT_OPERATOR_KEYS.includes(getOperatorKey(operator));

export const operatorIsBetween = (operator) => getOperatorKey(operator) === BETWEEN_OPERATOR_KEY;

export const splitMultiValue = (value) =>
  String(value ?? '').split(',').map((v) => v.trim()).filter((v) => v !== '');

export const joinMultiValue = (values) => values.join(',');
