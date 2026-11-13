import { useEffect } from 'react';
import PropTypes from 'prop-types';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';

// Read-only listing of a THEN action's own field catalog (get_then_action_fields) for action
// groups this form has no editable picker for yet, so the backend's properties are visible
// instead of the section looking empty.
const GenericThenActionFields = ({ actionTypeId }) => {
  const { thenActionFieldsByType, getThenActionFieldsByType } = useBusinessRuleReducer((s) => s);
  const entry = thenActionFieldsByType[String(actionTypeId)];

  useEffect(() => {
    if (actionTypeId != null) getThenActionFieldsByType(actionTypeId);
  }, [actionTypeId]);

  if (!entry || entry.isLoading) return <div className="br-property-picker-empty">Loading...</div>;

  const labels = [
    ...entry.regularFields.map((f) => f.field_label),
    ...entry.customFields.map((f) => f.field_label),
    ...entry.timeUnits.map((u) => u.unit_label),
  ].filter(Boolean);

  if (labels.length === 0) return <div className="br-property-picker-empty">No properties available.</div>;

  return (
    <div className="br-subtask-preview-row">
      {labels.map((label) => (
        <span key={label} className="br-subtask-preview-pill">{label}</span>
      ))}
    </div>
  );
};

GenericThenActionFields.propTypes = {
  actionTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default GenericThenActionFields;
