import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';
import BusinessRuleFieldValue from './BusinessRuleFieldValue';
import ThenFieldPickerModal from './ThenFieldPickerModal';
import { getGenericFieldKey, isCustomGenericField } from './genericThenAction';
import { getOperatorKey } from './businessRuleFieldUtils';

// "if <relative> card matches this filter" box of a relative-card action (updates guide 2.3):
// a list of field conditions (field, operator, value) sent as relative_conditions.
// A row is { id, fieldType: 'regular' | 'custom', fieldId, fieldLabel, operatorKey, value, timeUnitId }.
const detailsKeyOf = (row) => `${row.fieldType}-${row.fieldId}`;

function RelativeFilterBox({ label, rows, onChange }) {
  const {
    regularFields, customFields, fieldDetailsByKey, getFieldDetails, valueTimeUnits,
  } = useBusinessRuleReducer((s) => s);
  const [showPicker, setShowPicker] = useState(false);

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
  const rowKeyOf = (row) => {
    const field = findCatalogField(row);
    return field ? getGenericFieldKey(field) : '';
  };

  const handleAdd = (picked) => {
    const added = picked.map((field) => {
      const isCustom = isCustomGenericField(field);
      return {
        id: `relative-filter-${Date.now()}-${getGenericFieldKey(field)}`,
        fieldType: isCustom ? 'custom' : 'regular',
        fieldId: isCustom ? field.custom_field_id : field.regular_field_id,
        fieldLabel: field.field_label,
        operatorKey: '',
        value: '',
        timeUnitId: '',
      };
    });
    onChange([...rows, ...added]);
  };

  const setRow = (id, patch) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div>
      <p className="business-rule-form-when-fields-header">{label}</p>
      {rows.map((row) => {
        const details = fieldDetailsByKey[detailsKeyOf(row)];
        const operators = details?.operators ?? [];
        const operator = operators.find((op) => getOperatorKey(op) === row.operatorKey);
        const rowLabel = row.fieldLabel || findCatalogField(row)?.field_label || `Field #${row.fieldId}`;
        return (
          <div key={row.id} className="d-flex flex-column gap-2 mb-2">
            <div className="d-flex align-items-center justify-content-between gap-2">
              <span className="business-rule-form-action-chip-label">{rowLabel}</span>
              <button
                type="button"
                className="business-rule-form-condition-remove"
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                aria-label={`Remove ${rowLabel}`}
              >
                <FiTrash2 size={14} />
              </button>
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

      <ThenFieldPickerModal
        show={showPicker}
        fields={catalog}
        addedKeys={rows.map(rowKeyOf)}
        onClose={() => setShowPicker(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}

RelativeFilterBox.propTypes = {
  label: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default RelativeFilterBox;
