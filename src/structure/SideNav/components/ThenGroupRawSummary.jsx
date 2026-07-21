import { Fragment } from 'react';
import PropTypes from 'prop-types';

// Read-only fallback for a saved THEN group whose properties have no reliable inverse
// mapping back into the editable chip UI (update_parent_card/update_child_card,
// copy_values_to_parent, execute_at, and create-subtask create actions — see the THEN
// routing effect in BusinessRuleFormModal.jsx). Shows exactly what the backend stored
// instead of guessing at fields that don't exist in the UI yet.
const ThenGroupRawSummary = ({ group }) => (
  <div className="business-rule-form-raw-summary">
    {(group.actions ?? []).map((action) => {
      const properties = (action.properties ?? []).filter(
        (p) => p.property_value !== null && p.property_value !== undefined && p.property_value !== ''
      );
      return (
        <div key={action.then_action_id} className="business-rule-form-raw-summary-action">
          {action.action_title && (
            <div className="business-rule-form-raw-summary-action-title">{action.action_title}</div>
          )}
          {properties.length > 0 ? (
            <dl className="business-rule-form-raw-summary-kv">
              {properties.map((p) => (
                <Fragment key={p.action_property_id}>
                  <dt>{p.property_key}</dt>
                  <dd>{String(p.property_value)}</dd>
                </Fragment>
              ))}
            </dl>
          ) : (
            <p className="business-rule-form-raw-summary-empty">No properties recorded.</p>
          )}
        </div>
      );
    })}
  </div>
);

ThenGroupRawSummary.propTypes = {
  group: PropTypes.shape({
    then_group_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    group_type: PropTypes.string,
    actions: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
};

export default ThenGroupRawSummary;
