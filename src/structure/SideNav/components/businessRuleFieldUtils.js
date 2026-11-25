// Shared helpers for drawing a Business Rule field value (guide section 1): which control a
// field_type needs, and what an operator implies for the value box.

// The connector of a WHEN / AND / filter row is sent and read back as "AND" or "OR" in capitals;
// anything else (missing, lower case) reads as the "OR" the screen shows by default.
export const normalizeConnector = (value) => (String(value ?? '').trim().toUpperCase() === 'AND' ? 'AND' : 'OR');

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

// A field with has_time_unit = 1 (e.g. Cycle time) takes a number plus a unit whatever the operator.
// Under is / is not a date field offers its periods (below) instead, so no unit is asked for.
// A date field (e.g. Created at) sends has_time_unit = 1 but only asks for a unit under the
// in next / in last / was more than operators; before / after / is between take dates.
const isDateField = (details) => details?.field_type === 'date' || details?.field_type === 'datetime';

export const fieldNeedsTimeUnit = (details, operator) =>
  !hasDatePeriods(details, operator)
  && ((Number(details?.has_time_unit) === 1 && !isDateField(details)) || operatorNeedsTimeUnit(operator));

// Date fields offer their `periods` (Today, This week ...) under these operators (updates guide 4).
const PERIOD_OPERATOR_KEYS = ['is', 'is_not'];

export const getDatePeriods = (details, operator) =>
  PERIOD_OPERATOR_KEYS.includes(getOperatorKey(operator)) ? (details?.periods ?? []) : [];

function hasDatePeriods(details, operator) {
  return (details?.field_type === 'date' || details?.field_type === 'datetime') && getDatePeriods(details, operator).length > 0;
}

export const operatorIsBetween = (operator) => getOperatorKey(operator) === BETWEEN_OPERATOR_KEY;

export const splitMultiValue = (value) =>
  String(value ?? '').split(',').map((v) => v.trim()).filter((v) => v !== '');

export const joinMultiValue = (values) => values.join(',');

// Text of an empty dropdown / board-structure value in a condition row.
export const NOT_SET_LABEL = 'Not Set';

// Date condition fields that read as "<field> is v / <empty state> v" instead of showing a date
// box, keyed by lower-cased field label, with the text of their empty state.
// operatorKey is the operator saved when the empty state is chosen: "Not Set" / "Not Moved" mean the
// date is empty, so they are saved as is_empty (an "is" with an empty value carries no meaning).
const DATE_FIELD_EMPTY_STATES = {
  deadline: { label: 'Not Set', operatorKey: 'is_empty' },
  'last moved': { label: 'Not Moved', operatorKey: 'is_empty' },
  'last modified': { label: 'Today', operatorKey: null },
};

const getDateFieldEmptyState = (details) => {
  if (details?.field_type !== 'date' && details?.field_type !== 'datetime') return null;
  return DATE_FIELD_EMPTY_STATES[String(details.field_label ?? '').trim().toLowerCase()] ?? null;
};

export const getDateFieldEmptyLabel = (details) => getDateFieldEmptyState(details)?.label ?? null;

export const getDateFieldEmptyOperatorKey = (details) => getDateFieldEmptyState(details)?.operatorKey ?? null;

// A Yes/No field (e.g. Blocked) is a two-option dropdown labelled Yes and No.
export const isYesNoOptions = (options) =>
  options.length === 2 && options.every((opt) => ['yes', 'no'].includes(String(opt.option_label).trim().toLowerCase()));
