import { useEffect } from 'react';
import PropTypes from 'prop-types';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import BusinessRuleFieldValue from './BusinessRuleFieldValue';
import BoardPositionPicker from './BoardPositionPicker';
import '../../../design/scss/business-rule-generic-action.scss';
import { NONE_FIELD_CHECKED, getGenericFieldKey, isCustomGenericField } from './genericThenAction';

const OPTION_FIELD_TYPES = ['dropdown', 'radio', 'multiselect', 'checkbox'];

// Editable THEN action built entirely from the backend's own catalog (guide 5.2): every
// regular/custom field is drawn by the shared field value control, and a board position
// picker is shown when the trigger action says has_board_position.
function GenericThenActionEditor({ action, value, onChange }) {
  const { thenActionFieldsByType, getThenActionFieldsByType, fieldDetailsByKey, getFieldDetails } = useBusinessRuleReducer((s) => s);
  const entry = thenActionFieldsByType[String(action.action_type_id)];

  useEffect(() => {
    if (action.action_type_id != null) getThenActionFieldsByType(action.action_type_id);
  }, [action.action_type_id]);

  const fields = entry && !entry.isLoading ? [...entry.regularFields, ...entry.customFields] : [];

  useEffect(() => {
    fields.forEach((field) => {
      if (!OPTION_FIELD_TYPES.includes(field.field_type)) return;
      const type = isCustomGenericField(field) ? 'custom' : 'regular';
      const id = isCustomGenericField(field) ? field.custom_field_id : field.regular_field_id;
      if (id != null && fieldDetailsByKey[`${type}-${id}`] === undefined) getFieldDetails(type, id);
    });
  }, [entry]);

  if (!entry || entry.isLoading) return <div className="br-property-picker-empty">Loading...</div>;

  const hasBoardPosition = Number(action.has_board_position) === 1;

  if (fields.length === 0 && !hasBoardPosition) {
    return <div className="br-property-picker-empty">No properties available.</div>;
  }

  const setField = (key, next) => onChange({ ...value, fields: { ...value.fields, [key]: next } });

  return (
    <div className="br-generic-action d-flex flex-column gap-3">
      {hasBoardPosition && (
        <BoardPositionPicker value={value.position} onChange={(position) => onChange({ ...value, position })} />
      )}

      {fields.map((field) => {
        const key = getGenericFieldKey(field);
        const detailsKey = isCustomGenericField(field) ? `custom-${field.custom_field_id}` : `regular-${field.regular_field_id}`;
        const details = fieldDetailsByKey[detailsKey] ?? field;
        const label = field.field_label;

        if (field.field_type === 'none') {
          return (
            <label key={key} className="form-check d-flex align-items-center gap-2 mb-0">
              <input
                type="checkbox"
                className="form-check-input mt-0"
                checked={value.fields[key] === NONE_FIELD_CHECKED}
                onChange={(e) => setField(key, e.target.checked ? NONE_FIELD_CHECKED : '')}
              />
              <span className="form-check-label">{label}</span>
            </label>
          );
        }

        return (
          <div key={key} className="d-flex flex-column gap-1">
            <span className="business-rule-form-label">{label}</span>
            <BusinessRuleFieldValue
              details={details}
              value={value.fields[key] ?? ''}
              label={label}
              onChange={(next) => setField(key, next)}
            />
          </div>
        );
      })}
    </div>
  );
}

GenericThenActionEditor.propTypes = {
  action: PropTypes.shape({
    action_type_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    has_board_position: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  value: PropTypes.shape({
    thenActionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    fields: PropTypes.object,
    position: PropTypes.object,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default GenericThenActionEditor;
