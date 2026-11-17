import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import BusinessRuleFieldValue from './BusinessRuleFieldValue';
import MoveTargetAction from './MoveTargetAction';
import ThenFieldPickerModal from './ThenFieldPickerModal';
import CreateCardActionCard from './CreateCardActionCard';
import '../../../design/scss/business-rule-generic-action.scss';
import { EMPTY_CREATE_CARD, NONE_FIELD_CHECKED, getGenericFieldKey, isCreateCardsAction, isCustomGenericField } from './genericThenAction';

const OPTION_FIELD_TYPES = ['dropdown', 'radio', 'multiselect', 'checkbox'];

// Editable THEN action built entirely from the backend's own catalog (guide 5.2): every
// regular/custom field is drawn by the shared field value control. An action with a board
// position (Move the card) draws its own "Move card to" card; any other action starts as an
// "Add new action" link that opens the common field picker, and every picked field becomes
// its own card, like the Link the card section.
function GenericThenActionEditor({ action, value, defaultBoardId, onChange }) {
  const { thenActionFieldsByType, getThenActionFieldsByType, fieldDetailsByKey, getFieldDetails } = useBusinessRuleReducer((s) => s);
  const entry = thenActionFieldsByType[String(action.action_type_id)];
  const [showFieldPicker, setShowFieldPicker] = useState(false);

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

  const getDetails = (field) => {
    const detailsKey = isCustomGenericField(field) ? `custom-${field.custom_field_id}` : `regular-${field.regular_field_id}`;
    return fieldDetailsByKey[detailsKey] ?? field;
  };

  // Recurring "Create cards": title, where, card fields (guide 5.10) in the create-card card.
  if (isCreateCardsAction(action)) {
    const cards = value.cards ?? [];
    const setCards = (next) => onChange({ ...value, cards: next });
    return (
      <div className="br-link-card-list">
        {cards.map((card, index) => (
          <CreateCardActionCard
            key={index}
            action={{ label: action.action_name, title: card.title, position: card.position, fields: card.fields, copyKeys: [] }}
            catalog={entry}
            defaultBoardId={defaultBoardId}
            collapsible
            onChange={(next) => setCards(cards.map((c, i) => (i === index ? { ...c, title: next.title, position: next.position, fields: next.fields } : c)))}
            onRemove={() => setCards(cards.filter((c, i) => i !== index))}
          />
        ))}
        <div className="br-link-footer-actions">
          <button type="button" className="business-rule-form-add-link" onClick={() => setCards([...cards, EMPTY_CREATE_CARD])}>
            <FiPlus size={14} aria-hidden />
            Add new action
          </button>
          {cards.length > 1 && (
            <button type="button" className="business-rule-form-add-link" onClick={() => setCards([])}>
              Clear all
            </button>
          )}
        </div>
      </div>
    );
  }

  if (hasBoardPosition) {
    return (
      <div className="br-generic-action d-flex flex-column gap-3">
        <MoveTargetAction
          position={value.position}
          defaultBoardId={defaultBoardId}
          onChange={(position) => onChange({ ...value, position })}
        />
        {fields.map((field) => {
          const key = getGenericFieldKey(field);
          return (
            <div key={key} className="d-flex flex-column gap-1">
              <span className="business-rule-form-label">{field.field_label}</span>
              <BusinessRuleFieldValue
                details={getDetails(field)}
                value={value.fields[key] ?? ''}
                label={field.field_label}
                onChange={(next) => setField(key, next)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // A field is part of the action once it is in value.fields (even while still empty).
  const addedKeys = Object.keys(value.fields);
  const addedFields = fields.filter((f) => addedKeys.includes(getGenericFieldKey(f)));

  const handleAddFields = (picked) => {
    const next = { ...value.fields };
    picked.forEach((f) => {
      next[getGenericFieldKey(f)] = f.field_type === 'none' ? NONE_FIELD_CHECKED : '';
    });
    onChange({ ...value, fields: next });
  };

  const omitKey = (obj, key) => Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => k !== key));

  const handleRemoveField = (key) => {
    onChange({ ...value, fields: omitKey(value.fields, key), extraValues: omitKey(value.extraValues, key) });
  };

  // A field's lines: the first is its main value, the others were added under it with AND.
  const getLines = (key) => [value.fields[key] ?? '', ...(value.extraValues?.[key] ?? [])];

  const setLines = (key, lines) => {
    if (lines.length === 0) {
      handleRemoveField(key);
      return;
    }
    onChange({
      ...value,
      fields: { ...value.fields, [key]: lines[0] },
      extraValues: { ...(value.extraValues ?? {}), [key]: lines.slice(1) },
    });
  };

  return (
    <div className="br-link-card-list">
      {addedFields.map((field) => {
        const key = getGenericFieldKey(field);
        return (
          <div key={key} className="br-link-card">
            <button
              type="button"
              className="business-rule-form-action-detail-close"
              onClick={() => handleRemoveField(key)}
              aria-label={`Remove ${field.field_label}`}
            >
              <FiX size={14} />
            </button>

            <div className="br-link-card-header">
              <span className="br-sticker-action-label">{field.field_label}</span>
            </div>

            {field.field_type !== 'none' && getLines(key).map((line, index) => (
              <div key={index} className="br-link-card-value-row br-generic-action">
                <div className="br-generic-action-value">
                  <BusinessRuleFieldValue
                    details={getDetails(field)}
                    value={line}
                    label={field.field_label}
                    onChange={(next) => setLines(key, getLines(key).map((l, i) => (i === index ? next : l)))}
                  />
                </div>
                <div className="business-rule-form-filter-row-actions">
                  <button
                    type="button"
                    className="business-rule-form-or-btn"
                    onClick={() => setLines(key, [...getLines(key), ''])}
                  >
                    AND
                  </button>
                  <button
                    type="button"
                    className="business-rule-form-filter-row-delete"
                    onClick={() => setLines(key, getLines(key).filter((l, i) => i !== index))}
                    aria-label={`Remove ${field.field_label}`}
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="br-link-footer-actions">
        <button type="button" className="business-rule-form-add-link" onClick={() => setShowFieldPicker(true)}>
          <FiPlus size={14} aria-hidden />
          Add new action
        </button>
        {addedFields.length > 1 && (
          <button type="button" className="business-rule-form-add-link" onClick={() => onChange({ ...value, fields: {}, extraValues: {} })}>
            Clear all
          </button>
        )}
      </div>

      <ThenFieldPickerModal
        show={showFieldPicker}
        fields={fields}
        addedKeys={addedKeys}
        onClose={() => setShowFieldPicker(false)}
        onAdd={handleAddFields}
      />
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
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
};

export default GenericThenActionEditor;
