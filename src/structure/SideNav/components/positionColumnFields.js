// Date fields that need a column as well as a date condition ("Last date moved to <column> in last
// 2 days"): Last date moved to, First date moved to and Last date moved out of (guide 3.2). The
// picked column ids are sent comma-separated in position_value, not in input_value.
export const POSITION_COLUMN_REGULAR_FIELD_IDS = [67, 125, 126];
const POSITION_COLUMN_FIELD_LABELS = ['last date moved to', 'first date moved to', 'last date moved out of'];

export const isPositionColumnField = (fieldId, label) => POSITION_COLUMN_REGULAR_FIELD_IDS.includes(Number(fieldId))
  || POSITION_COLUMN_FIELD_LABELS.includes(String(label ?? '').trim().toLowerCase());

// Name of a column (or sub-column) in the workflows loaded for the Board Minimap, if any are loaded.
export const findLoadedColumnName = (boardWorkflowsByBoard, columnId) => {
  const columns = Object.values(boardWorkflowsByBoard ?? {})
    .flat()
    .flatMap((workflow) => workflow?.stages ?? [])
    .flatMap((stage) => stage?.columns ?? [])
    .flatMap((column) => [column, ...(column?.children ?? [])]);
  return columns.find((column) => String(column?.column_id) === String(columnId))?.column_name ?? '';
};
