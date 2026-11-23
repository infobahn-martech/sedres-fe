import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';
import BusinessRuleFieldValue from './BusinessRuleFieldValue';
import { isCustomGenericField } from './genericThenAction';
import { getOperatorKey, normalizeConnector } from './businessRuleFieldUtils';
import BoardMinimapModal from './BoardMinimapModal';
import { findLoadedColumnName, isPositionColumnField } from './positionColumnFields';

// "if <relative> card matches this filter" box of a relative-card action (updates guide 2.3):
// a list of field conditions (field, operator, value) sent under the action's own filter key (parent_conditions, child_conditions or relative_conditions).
// A row is { id, fieldType: 'regular' | 'custom', fieldId, fieldLabel, operatorKey, value, timeUnitId }.
const detailsKeyOf = (row) => `${row.fieldType}-${row.fieldId}`;

// renderPropertyPicker draws the Card Property Match modal (the same field picker as the AND column);
// it is handed in because that modal lives in BusinessRuleFormModal.jsx.
function RelativeFilterBox({ label, rows, renderPropertyPicker, defaultBoardId = '', onChange }) {
  const {
    regularFields, customFields, fieldDetailsByKey, getFieldDetails, valueTimeUnits, boardWorkflowsByBoard,
  } = useBusinessRuleReducer((s) => s);
  const [showPicker, setShowPicker] = useState(false);
  // Board Minimap of a "Last date moved to"-type row: the row it picks columns for and its board.
  const [columnPickRowId, setColumnPickRowId] = useState(null);
  const [columnPickBoardId, setColumnPickBoardId] = useState('');
  // The modal reports every ticked field one by one in the same tick, so they are collected here.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // The first operator of a field is its default; its details (operators, options) load on demand.
  useEffect(() => {
    rows.forEach((row) => {
      const details = fieldDetailsByKey[detailsKeyOf(row)];
      if (details === undefined) {
        getFieldDetails(row.fieldType, row.fieldId);
        return;
      }
      if (!row.operatorKey && details?.operators?.length > 0) {
        onChange(rows.map((r) => (r.id === row.id ? { ...r, operatorKey: getOperatorKey(details.operators[0]) } : r)));
      }
    });
  }, [rows, fieldDetailsByKey]);

  const catalog = [...(regularFields ?? []), ...(customFields ?? [])];
  const findCatalogField = (row) => catalog.find((f) => (row.fieldType === 'custom'
    ? isCustomGenericField(f) && String(f.custom_field_id) === String(row.fieldId)
    : !isCustomGenericField(f) && String(f.regular_field_id) === String(row.fieldId)));
  const handleSelect = (field, category) => {
    const isCustom = category?.category_key === 'custom';
    const fieldId = isCustom ? field.custom_field_id : field.regular_field_id;
    if (fieldId == null || category?.category_key === 'time_unit') return;
    rowsRef.current = [...rowsRef.current, {
      id: `relative-filter-${Date.now()}-${rowsRef.current.length}`,
      fieldType: isCustom ? 'custom' : 'regular',
      fieldId,
      fieldLabel: field.field_label ?? field.custom_field_name ?? '',
      operatorKey: '',
      connector: 'OR',
      value: '',
      timeUnitId: '',
      positionColumns: category?.positionColumns ?? [],
    }];
    onChange(rowsRef.current);
  };

  const setRow = (id, patch) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const handleOpenColumnPick = (rowId) => {
    setColumnPickBoardId((prev) => prev || String(defaultBoardId ?? ''));
    setColumnPickRowId(rowId);
  };

  // A column picked on the minimap is added to the row (several are allowed).
  const handlePickColumn = (position) => {
    const rowId = columnPickRowId;
    setColumnPickRowId(null);
    const row = rows.find((r) => r.id === rowId);
    if (!row || !position.columnId) return;
    const picked = row.positionColumns ?? [];
    if (picked.some((column) => String(column.id) === String(position.columnId))) return;
    setRow(rowId, {
      positionColumns: [...picked, { id: String(position.columnId), name: findLoadedColumnName(boardWorkflowsByBoard, position.columnId) }],
    });
  };

  return (
    <div className="br-related-filter">
      <p className="business-rule-form-when-fields-header">{label}</p>
      {rows.map((row) => {
        const details = fieldDetailsByKey[detailsKeyOf(row)];
        const operators = details?.operators ?? [];
        const operator = operators.find((op) => getOperatorKey(op) === row.operatorKey);
        const rowLabel = row.fieldLabel || findCatalogField(row)?.field_label || `Field #${row.fieldId}`;
        return (
          <div key={row.id} className="d-flex flex-column gap-2 mb-2 w-100">
            <div className="d-flex align-items-center justify-content-between gap-2">
              <span className="business-rule-form-action-chip-label">{rowLabel}</span>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="business-rule-form-or-btn"
                  onClick={() => setRow(row.id, { connector: normalizeConnector(row.connector) === 'AND' ? 'OR' : 'AND' })}
                  aria-label={`Connector of ${rowLabel}`}
                >
                  {normalizeConnector(row.connector)}
                </button>
                <button
                  type="button"
                  className="business-rule-form-condition-remove"
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  aria-label={`Remove ${rowLabel}`}
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
            {operators.length > 0 && (
              <SearchableSelect
                value={row.operatorKey}
                onChange={(e) => setRow(row.id, { operatorKey: e.target.value, value: '', timeUnitId: '' })}
                options={operators.map((op) => ({ value: getOperatorKey(op), label: op.operator_label }))}
                placeholder="Operator"
                className="br-value-select"
                menuPortalTarget={document.body}
                menuPlacement="auto"
              />
            )}
            {row.fieldType === 'regular' && isPositionColumnField(row.fieldId, rowLabel) && (
              <div className="br-position-column-row">
                {(row.positionColumns ?? []).map((column) => (
                  <span key={column.id} className="br-position-column-chip">
                    {column.name || findLoadedColumnName(boardWorkflowsByBoard, column.id) || `Column ${column.id}`}
                    <button
                      type="button"
                      className="br-position-column-chip-remove"
                      onClick={() => setRow(row.id, { positionColumns: row.positionColumns.filter((c) => c.id !== column.id) })}
                      aria-label="Remove column"
                    >
                      <FiX size={12} />
                    </button>
                  </span>
                ))}
                <button type="button" className="business-rule-form-add-link" onClick={() => handleOpenColumnPick(row.id)}>
                  <FiPlus size={14} aria-hidden />
                  {(row.positionColumns ?? []).length > 0 ? 'Add column' : 'Choose column'}
                </button>
              </div>
            )}
            <BusinessRuleFieldValue
              details={details}
              operator={operator}
              value={row.value}
              timeUnitId={row.timeUnitId}
              timeUnits={valueTimeUnits}
              label={rowLabel}
              onChange={(next) => setRow(row.id, { value: next })}
              onTimeUnitChange={(unitId) => setRow(row.id, { timeUnitId: unitId })}
            />
          </div>
        );
      })}
      <button type="button" className="business-rule-form-add-link" onClick={() => setShowPicker(true)}>
        <FiPlus size={14} aria-hidden />
        Add new property
      </button>

      <BoardMinimapModal
        show={Boolean(columnPickRowId)}
        value={{ boardId: columnPickBoardId, workflowId: '', columnId: '', swimlaneId: '' }}
        boardId={columnPickBoardId}
        onBoardChange={setColumnPickBoardId}
        onPick={handlePickColumn}
        onClose={() => setColumnPickRowId(null)}
        columnOnly
      />

      {renderPropertyPicker({
        show: showPicker,
        onClose: () => setShowPicker(false),
        onSelect: handleSelect,
        existingFieldLabels: rows.map((row) => (row.fieldLabel || findCatalogField(row)?.field_label || '').trim().toLowerCase()),
      })}
    </div>
  );
}

RelativeFilterBox.propTypes = {
  label: PropTypes.string.isRequired,
  renderPropertyPicker: PropTypes.func.isRequired,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default RelativeFilterBox;
