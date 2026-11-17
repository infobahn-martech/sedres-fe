import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import BusinessRuleFieldValue from './BusinessRuleFieldValue';
import MoveTargetAction from './MoveTargetAction';
import ThenFieldPickerModal from './ThenFieldPickerModal';
import '../../../design/scss/business-rule-generic-action.scss';
import { getGenericFieldKey } from './genericThenAction';

const OPTION_FIELD_TYPES = ['dropdown', 'radio', 'multiselect', 'checkbox'];
const EMPTY_LIST = [];

// One Create card / child / parent action (guide 5.7): title, where it is created (board
// minimap), the card fields to set and the fields copied from this card. The lists of card
// fields and copy fields come from get_then_action_fields; nothing is typed in the code.
function CreateCardActionCard({ action, catalog, defaultBoardId, collapsible = false, onChange, onRemove }) {
  const { fieldDetailsByKey, getFieldDetails } = useBusinessRuleReducer((s) => s);
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  const cardFields = catalog?.cardFields ?? EMPTY_LIST;
  const copyFields = catalog?.copyFields ?? EMPTY_LIST;

  useEffect(() => {
    cardFields.forEach((field) => {
      if (!OPTION_FIELD_TYPES.includes(field.field_type) || field.regular_field_id == null) return;
      if (fieldDetailsByKey[`regular-${field.regular_field_id}`] === undefined) getFieldDetails('regular', field.regular_field_id);
    });
  }, [catalog]);

  const set = (patch) => onChange({ ...action, ...patch });
  const addedKeys = Object.keys(action.fields);
  const addedFields = cardFields.filter((f) => addedKeys.includes(getGenericFieldKey(f)));

  const getDetails = (field) => fieldDetailsByKey[`regular-${field.regular_field_id}`] ?? field;

  const handleAddFields = (picked) => {
    const next = { ...action.fields };
    picked.forEach((f) => { next[getGenericFieldKey(f)] = ''; });
    set({ fields: next });
  };

  const handleRemoveField = (key) => {
    set({ fields: Object.fromEntries(Object.entries(action.fields).filter(([k]) => k !== key)) });
  };

  const toggleCopyKey = (key) => {
    set({ copyKeys: action.copyKeys.includes(key) ? action.copyKeys.filter((k) => k !== key) : [...action.copyKeys, key] });
  };

  return (
    <div className="br-link-card">
      <button type="button" className="business-rule-form-action-detail-close" onClick={onRemove} aria-label="Remove action">
        <FiX size={14} />
      </button>

      {collapsible ? (
        <h5 className="business-rule-form-action-detail-title">{action.label}</h5>
      ) : (
        <div className="br-link-card-header">
          <span className="br-sticker-action-label">{action.label}</span>
        </div>
      )}

      <MoveTargetAction
        embedded
        emptyLabel={collapsible ? 'Configure details' : 'Choose where to create'}
        position={action.position}
        defaultBoardId={defaultBoardId}
        onChange={(position) => set({ position })}
      />

      {!collapsible && (
      <>

      {addedFields.map((field) => {
        const key = getGenericFieldKey(field);
        return (
          <div key={key} className="d-flex flex-column gap-1">
            <span className="br-sticker-action-label">{field.field_label}</span>
            <div className="br-link-card-value-row br-generic-action">
              <div className="br-generic-action-value">
                <BusinessRuleFieldValue
                  details={getDetails(field)}
                  value={action.fields[key] ?? ''}
                  label={field.field_label}
                  onChange={(next) => set({ fields: { ...action.fields, [key]: next } })}
                />
              </div>
              <div className="business-rule-form-filter-row-actions">
                <button
                  type="button"
                  className="business-rule-form-filter-row-delete"
                  onClick={() => handleRemoveField(key)}
                  aria-label={`Remove ${field.field_label}`}
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {!collapsible && cardFields.length > 0 && (
        <button type="button" className="business-rule-form-add-link" onClick={() => setShowFieldPicker(true)}>
          <FiPlus size={14} aria-hidden />
          Add new property
        </button>
      )}

      {copyFields.length > 0 && (
        <div className="d-flex flex-column gap-2">
          <span className="br-sticker-action-label">Copy from this card</span>
          {copyFields.map((field) => (
            <label key={field.field_key} className="br-link-checkbox-row">
              <input
                type="checkbox"
                checked={action.copyKeys.includes(field.field_key)}
                onChange={() => toggleCopyKey(field.field_key)}
              />
              {field.field_label}
            </label>
          ))}
        </div>
      )}
      </>
      )}

      <ThenFieldPickerModal
        show={showFieldPicker}
        fields={cardFields}
        addedKeys={addedKeys}
        onClose={() => setShowFieldPicker(false)}
        onAdd={handleAddFields}
      />
    </div>
  );
}

CreateCardActionCard.propTypes = {
  action: PropTypes.shape({
    label: PropTypes.string,
    title: PropTypes.string,
    position: PropTypes.object,
    fields: PropTypes.object,
    copyKeys: PropTypes.array,
  }).isRequired,
  catalog: PropTypes.object,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  collapsible: PropTypes.bool,  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default CreateCardActionCard;
