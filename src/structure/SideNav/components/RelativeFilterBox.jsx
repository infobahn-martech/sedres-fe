import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2, FiUser, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import useAuthReducer from '../../../store/AuthReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';
import InlineTextDropdown from './InlineTextDropdown';
import BusinessRuleFieldValue from './BusinessRuleFieldValue';
import { isCustomGenericField } from './genericThenAction';
import { fieldTakesValue, getDateFieldEmptyLabel, getDatePeriods, getOperatorKey, isYesNoOptions, operatorTakesValue, normalizeConnector, splitMultiValue, splitNoValueOperatorLabel, NOT_SET_LABEL } from './businessRuleFieldUtils';
import BoardMinimapModal from './BoardMinimapModal';
import BoardFilterPicker from './BoardFilterPicker';
import { findLoadedColumnName, isPositionColumnField } from './positionColumnFields';

// "if <relative> card matches this filter" box of a relative-card action (updates guide 2.3):
// a list of field conditions (field, operator, value) sent under the action's own filter key (parent_conditions, child_conditions or relative_conditions).
// A row is { id, fieldType: 'regular' | 'custom', fieldId, fieldLabel, operatorKey, value, timeUnitId }.
const detailsKeyOf = (row) => `${row.fieldType}-${row.fieldId}`;

// master_key of a field whose options are users (Owner ...).
const USERS_MASTER_KEY = 'users';
const userAvatar = (content) => <span className="br-filter-user-avatar" aria-hidden>{content}</span>;

// renderPropertyPicker draws the Card Property Match modal (the same field picker as the AND column);
// it is handed in because that modal lives in BusinessRuleFormModal.jsx.
function RelativeFilterBox({ label, rows, renderPropertyPicker, defaultBoardId = '', cardLayout = false, onChange }) {
  const {
    regularFields, customFields, fieldDetailsByKey, getFieldDetails, valueTimeUnits, boardWorkflowsByBoard,
    boardPickerWorkspaces, getBoardPickerWorkspaces,
  } = useBusinessRuleReducer((s) => s);
  const userProfile = useAuthReducer((s) => s.userProfile);
  const loggedInUserId = String(userProfile?.user_id ?? userProfile?.userid ?? '');
  const [showPicker, setShowPicker] = useState(false);
  // Board Minimap of a "Last date moved to"-type row: the row it picks columns for and its board.
  const [columnPickRowId, setColumnPickRowId] = useState(null);
  const [columnPickBoardId, setColumnPickBoardId] = useState('');
  // The modal reports every ticked field one by one in the same tick, so they are collected here.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Rows that already got their default (date "Today", current board, logged-in user), so a later choice such as
  // "Select date" is not overwritten by it.
  const todayDefaultedRowIds = useRef(new Set());

  // The first operator of a field is its default; its details (operators, options) load on demand.
  // A date field under is / is not opens on its Today period.
  useEffect(() => {
    rows.forEach((row) => {
      const details = fieldDetailsByKey[detailsKeyOf(row)];
      if (details === undefined) {
        getFieldDetails(row.fieldType, row.fieldId);
        return;
      }
      if (!row.operatorKey && details?.operators?.length > 0) {
        onChange(rows.map((r) => (r.id === row.id ? { ...r, operatorKey: getOperatorKey(details.operators[0]) } : r)));
        return;
      }
      if (row.value !== '' || todayDefaultedRowIds.current.has(row.id)) return;
      // cardLayout: a new Board row opens on the current board (the AND "Board is" one).
      if (cardLayout && details.structure_level === 'board' && defaultBoardId) {
        todayDefaultedRowIds.current.add(row.id);
        onChange(rows.map((r) => (r.id === row.id ? { ...r, value: String(defaultBoardId) } : r)));
        return;
      }
      // cardLayout: a new user row (Owner) opens on the logged-in user, when the list has them.
      if (cardLayout && details.master_key === USERS_MASTER_KEY && details.field_type === 'dropdown'
        && details.options?.some((o) => String(o.option_value) === loggedInUserId)) {
        todayDefaultedRowIds.current.add(row.id);
        onChange(rows.map((r) => (r.id === row.id ? { ...r, value: loggedInUserId } : r)));
        return;
      }
      const operator = (details.operators ?? []).find((op) => getOperatorKey(op) === row.operatorKey);
      const today = (getDatePeriods(details, operator)).find((period) => String(period.option_label).trim().toLowerCase() === 'today');
      if (!today) return;
      todayDefaultedRowIds.current.add(row.id);
      onChange(rows.map((r) => (r.id === row.id ? { ...r, value: String(today.option_value) } : r)));
    });
  }, [rows, fieldDetailsByKey, defaultBoardId, loggedInUserId]);

  useEffect(() => {
    if (cardLayout) getBoardPickerWorkspaces();
  }, [cardLayout]);

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
        const isColumnRow = row.fieldType === 'regular' && isPositionColumnField(row.fieldId, rowLabel);
        const pickedColumns = row.positionColumns ?? [];
        const columnNames = pickedColumns
          .map((column) => column.name || findLoadedColumnName(boardWorkflowsByBoard, column.id) || `Column ${column.id}`)
          .join(', ');
        // cardLayout ("Parent card is moved"): every row is a card, "are present" splits into "are" / "present".
        const isColumnCard = cardLayout || (isColumnRow && pickedColumns.length > 0);
        const operatorParts = (op) => (cardLayout ? splitNoValueOperatorLabel(op) : { head: op?.operator_label, tail: '' });
        // The fixed line under the title: "present", or the field's own name for a state field ("Blocked is / Blocked").
        const isStateField = cardLayout && details && operator && !fieldTakesValue(details) && operatorTakesValue(operator);
        const operatorTail = operatorParts(operator).tail || (isStateField ? rowLabel : '');
        const removeRow = () => onChange(rows.filter((r) => r.id !== row.id));
        const toggleConnector = () => setRow(row.id, { connector: normalizeConnector(row.connector) === 'AND' ? 'OR' : 'AND' });
        // cardLayout: only a row with a typed or chosen value (Blocker) gets the OR / bin pill, same as the AND column.
        const hasValueRowActions = cardLayout && fieldTakesValue(details) && operatorTakesValue(operator)
          && !isYesNoOptions(details?.options ?? []) && !getDateFieldEmptyLabel(details);
        // cardLayout: a Board value is picked on the same workspace board picker as the AND "Board is" row.
        const isBoardValue = cardLayout && details?.structure_level === 'board';
        const boardIds = splitMultiValue(row.value);
        // cardLayout: a single user value (Owner) shows the user's initial beside the name.
        const isUserValue = cardLayout && details?.master_key === USERS_MASTER_KEY && details.field_type === 'dropdown' && details.options?.length > 0;
        const userOptions = isUserValue
          ? details.options.map((o) => ({ value: String(o.option_value), label: String(o.option_label), icon: userAvatar(String(o.option_label).charAt(0).toUpperCase()) }))
          : [];
        const selectedUser = userOptions.find((o) => o.value === String(row.value));
        let valueControl = isBoardValue ? (
          <BoardFilterPicker
            workspaces={boardPickerWorkspaces ?? []}
            value={row.value}
            onChange={(boardId) => setRow(row.id, { value: String(boardId) })}
            wrapClassName="br-board-condition-wrap"
            triggerClassName="business-rule-form-condition-label-btn br-condition-value-text d-inline-flex align-items-center gap-1"
            triggerIconSize={16}
            panelClassName="br-board-condition-panel"
            placeholder={boardIds.length > 1 ? `${boardIds.length} selected` : NOT_SET_LABEL}
          />
        ) : (
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
        );
        if (isUserValue) {
          valueControl = (
            <InlineTextDropdown
              value={row.value}
              options={[{ value: '', label: NOT_SET_LABEL }, ...userOptions]}
              placeholder={NOT_SET_LABEL}
              triggerIcon={selectedUser?.icon ?? userAvatar(<FiUser size={16} />)}
              triggerClassName="business-rule-form-condition-label-btn br-condition-value-text d-inline-flex align-items-center gap-2"
              searchable
              onChange={(next) => setRow(row.id, { value: next })}
            />
          );
        }
        return (
          <div key={row.id} className={`d-flex flex-column gap-2 mb-2 w-100${isColumnCard ? ' br-filter-card' : ''}${cardLayout ? ' br-filter-card--roomy' : ''}`}>
            <div className="d-flex align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center flex-wrap gap-1">
                <span className={isColumnCard ? 'br-filter-card-title' : 'business-rule-form-action-chip-label'}>{columnNames ? `${rowLabel} ${columnNames}` : rowLabel}</span>
                {operators.length > 0 && isColumnCard && (
                  <InlineTextDropdown
                    value={row.operatorKey}
                    options={operators.map((op) => ({ value: getOperatorKey(op), label: operatorParts(op).head }))}
                    placeholder="Operator"
                    triggerClassName="br-condition-operator-trigger"
                    onChange={(operatorKey) => setRow(row.id, { operatorKey, value: '', timeUnitId: '' })}
                  />
                )}
              </div>
              {isColumnCard ? (
                <>
                  {!cardLayout && rows.length > 1 && (
                    <button
                      type="button"
                      className="business-rule-form-or-btn"
                      onClick={toggleConnector}
                      aria-label={`Connector of ${rowLabel}`}
                    >
                      {normalizeConnector(row.connector)}
                    </button>
                  )}
                  <button type="button" className="br-filter-card-close" onClick={removeRow} aria-label={`Remove ${rowLabel}`}>
                    <FiX size={10} />
                  </button>
                </>
              ) : (
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="business-rule-form-or-btn"
                    onClick={toggleConnector}
                    aria-label={`Connector of ${rowLabel}`}
                  >
                    {normalizeConnector(row.connector)}
                  </button>
                  <button type="button" className="business-rule-form-condition-remove" onClick={removeRow} aria-label={`Remove ${rowLabel}`}>
                    <FiTrash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            {operators.length > 0 && !isColumnCard && (
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
            {operatorTail && <span className={`br-condition-value-text${isStateField ? '' : ' text-capitalize'}`}>{operatorTail}</span>}
            {isColumnRow && pickedColumns.length === 0 && (
              <div className="br-position-column-row">
                <button type="button" className="business-rule-form-add-link" onClick={() => handleOpenColumnPick(row.id)}>
                  <FiPlus size={14} aria-hidden />
                  Choose column
                </button>
              </div>
            )}
            {hasValueRowActions ? (
              <div className="br-board-condition-value-row">
                {valueControl}
                <div className="business-rule-form-filter-row-actions">
                  <button type="button" className="business-rule-form-or-btn" onClick={toggleConnector} aria-label={`Connector of ${rowLabel}`}>
                    {normalizeConnector(row.connector)}
                  </button>
                  <button type="button" className="business-rule-form-filter-row-delete" onClick={removeRow} aria-label={`Remove ${rowLabel}`}>
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            ) : valueControl}
          </div>
        );
      })}
      <div className="br-link-footer-actions w-100">
        <button type="button" className="business-rule-form-add-link" onClick={() => setShowPicker(true)}>
          <FiPlus size={14} aria-hidden />
          Add new property
        </button>
        {cardLayout && rows.length > 1 && (
          <button type="button" className="business-rule-form-add-link" onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </div>

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
  cardLayout: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};

export default RelativeFilterBox;
