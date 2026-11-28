import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import useKanbanManagementReducer, { isKanbanManagementRowDisabled } from '../../../store/KanbanManagementReducer';
import BusinessRuleFieldValue from './BusinessRuleFieldValue';
import MoveTargetAction from './MoveTargetAction';
import ThenFieldPickerModal from './ThenFieldPickerModal';
import RelativeFilterBox from './RelativeFilterBox';
import DeadlineActionValue, { DeadlineModeDropdown } from './DeadlineActionValue';
import InlineTextDropdown from './InlineTextDropdown';
import CreateCardActionCard from './CreateCardActionCard';
import '../../../design/scss/business-rule-generic-action.scss';
import { DEFAULT_LIST_MODE, EMPTY_CREATE_CARD, EMPTY_DEADLINE, LIST_MODE_CHOICES, EMPTY_GENERIC_ACTION_VALUE, NONE_FIELD_CHECKED, getActionFilterKind, getGenericFieldKey, hasSetToPhrase, isCreateCardsAction, isCustomGenericField, isRemoveStickersField, isRepeatableAction, isSetColorField, isSetDeadlineField, isSetTagsField, isTitleInCardAction } from './genericThenAction';

const OPTION_FIELD_TYPES = ['dropdown', 'radio', 'multiselect', 'checkbox'];

// Editable THEN action built entirely from the backend's own catalog (guide 5.2): every
// regular/custom field is drawn by the shared field value control. An action with a board
// position (Move the card) draws its own "Move card to" card; any other action starts as an
// "Add new action" link that opens the common field picker, and every picked field becomes
// its own card, like the Link the card section.
function GenericActionFields({ action, value, defaultBoardId, startOpen = false, inCard = false, onChange }) {
  const { thenActionFieldsByType, getThenActionFieldsByType, fieldDetailsByKey, getFieldDetails } = useBusinessRuleReducer((s) => s);
  const entry = thenActionFieldsByType[String(action.action_type_id)];
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const { cardStickers, cardStickersLoading, fetchKanbanCardStickers } = useKanbanManagementReducer((s) => s);

  useEffect(() => {
    if (action.action_type_id != null) getThenActionFieldsByType(action.action_type_id);
  }, [action.action_type_id]);

  const fields = entry && !entry.isLoading ? [...entry.regularFields, ...entry.customFields] : [];
  const hasRemoveStickersField = fields.some(isRemoveStickersField);

  useEffect(() => {
    if (hasRemoveStickersField && cardStickers.length === 0 && !cardStickersLoading) fetchKanbanCardStickers({ limit: 200 });
  }, [hasRemoveStickersField]);

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

  // An action with no fields at all (e.g. Archive cards) has nothing to fill in: adding it is the choice.
  if (fields.length === 0 && !hasBoardPosition) {
    if (!value.noFields) {
      return (
        <button type="button" className="business-rule-form-add-link" onClick={() => onChange({ ...value, noFields: true })}>
          <FiPlus size={14} aria-hidden />
          Add new action
        </button>
      );
    }
    return (
      <div className="br-link-card">
        <button
          type="button"
          className="business-rule-form-action-detail-close"
          onClick={() => onChange({ ...value, noFields: false })}
          aria-label={`Remove ${action.action_name}`}
        >
          <FiX size={14} />
        </button>
        <div className="br-link-card-header">
          <span className="br-sticker-action-label">{action.action_name}</span>
        </div>
      </div>
    );
  }

  const setField = (key, next) => onChange({ ...value, fields: { ...value.fields, [key]: next } });

  const getDetails = (field) => {
    if (isSetColorField(field)) return { ...field, field_type: 'color', has_input_value: 1 };
    if (isSetTagsField(field)) return { ...field, field_type: 'tags', has_input_value: 1 };
    if (isRemoveStickersField(field)) {
      return {
        ...field,
        field_type: 'dropdown',
        has_input_value: 1,
        option_source: undefined,
        options: cardStickers.filter((s) => !isKanbanManagementRowDisabled(s.status)).map((s) => ({
          option_value: s.sticker_id, option_label: s.label, color_code: s.color_code, icon_name: s.icon,
        })),
      };
    }
    const detailsKey = isCustomGenericField(field) ? `custom-${field.custom_field_id}` : `regular-${field.regular_field_id}`;
    return fieldDetailsByKey[detailsKey] ?? field;
  };

  // Recurring "Create cards": title, where, card fields (guide 5.10) in the create-card card.
  if (isCreateCardsAction(action)) {
    // null = untouched: show one default card (saved only once edited). [] = the user closed it.
    const cards = value.cards ?? [EMPTY_CREATE_CARD];
    const setCards = (next) => onChange({ ...value, cards: next });
    return (
      <div className="br-link-card-list">
        {cards.map((card, index) => (
          <CreateCardActionCard
            key={index}
            action={{ label: 'Create card', title: card.title, position: card.position, fields: card.fields, copyKeys: [], templateId: card.templateId }}
            catalog={entry}
            defaultBoardId={defaultBoardId}
            templateSelectable
            copyable={false}
            onChange={(next) => setCards(cards.map((c, i) => (i === index ? { ...c, title: next.title, position: next.position, fields: next.fields, templateId: next.templateId } : c)))}
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
        {inCard ? (
          <div className="br-create-action-card">
            <h5 className="br-create-action-title">{`Move ${getActionFilterKind(action)?.kind ?? 'card'} to`}</h5>
            <MoveTargetAction embedded position={value.position} defaultBoardId={defaultBoardId} onChange={(position) => onChange({ ...value, position })} />
          </div>
        ) : (
          <MoveTargetAction
            position={value.position}
            startOpen={startOpen}
            title={getActionFilterKind(action) ? `Move ${getActionFilterKind(action).kind} to` : undefined}
            defaultBoardId={defaultBoardId}
            onChange={(position) => onChange({ ...value, position })}
          />
        )}
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

  const getInitialFieldValue = (f) => (f.field_type === 'none' && !isRemoveStickersField(f) ? NONE_FIELD_CHECKED : '');

  const handleAddFields = (picked) => {
    const next = { ...value.fields };
    picked.forEach((f) => {
      next[getGenericFieldKey(f)] = getInitialFieldValue(f);
    });
    onChange({ ...value, fields: next });
  };

  const omitKey = (obj, key) => Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => k !== key));

  const handleRemoveField = (key) => {
    onChange({
      ...value,
      fields: omitKey(value.fields, key),
      extraValues: omitKey(value.extraValues, key),
      deadlines: omitKey(value.deadlines, key),
      listModes: omitKey(value.listModes, key),
    });
  };

  const getDeadline = (key) => ({ ...EMPTY_DEADLINE, ...(value.deadlines?.[key] ?? {}) });
  const setDeadline = (key, next) => onChange({ ...value, deadlines: { ...value.deadlines, [key]: { ...getDeadline(key), ...next } } });

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
              {field.field_type === 'none' && !isRemoveStickersField(field) ? (
                <button
                  type="button"
                  className="business-rule-form-condition-label-btn br-sticker-action-label"
                  onClick={() => setShowFieldPicker(true)}
                >
                  {field.field_label}
                </button>
              ) : (
                <span className="br-sticker-action-label">{field.field_label}</span>
              )}
              {hasSetToPhrase(field) && <span className="br-generic-field-title-suffix">to</span>}
              {isSetTagsField(field) && (
                <InlineTextDropdown
                  value={value.listModes?.[key] ?? DEFAULT_LIST_MODE}
                  options={LIST_MODE_CHOICES}
                  triggerClassName="business-rule-form-condition-label-btn br-condition-value-text d-inline-flex align-items-center"
                  onChange={(mode) => onChange({ ...value, listModes: { ...value.listModes, [key]: mode } })}
                />
              )}
              {isSetDeadlineField(field) && (
                <DeadlineModeDropdown mode={getDeadline(key).mode} onChange={(mode) => setDeadline(key, { mode })} />
              )}
            </div>

            {isSetDeadlineField(field) && (
              <DeadlineActionValue value={getDeadline(key)} onChange={(next) => setDeadline(key, next)} />
            )}

            {!isSetDeadlineField(field) && (field.field_type !== 'none' || isRemoveStickersField(field)) && getLines(key).map((line, index) => (
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
          <button type="button" className="business-rule-form-add-link" onClick={() => onChange({ ...value, fields: {}, extraValues: {}, deadlines: {}, listModes: {} })}>
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

const editorPropTypes = {
  action: PropTypes.shape({
    action_type_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    action_name: PropTypes.string,
    action_code: PropTypes.string,
    has_board_position: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    has_relative_filter: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    has_parent_filter: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    has_child_filter: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  value: PropTypes.shape({
    thenActionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    fields: PropTypes.object,
    noFields: PropTypes.bool,
    position: PropTypes.object,
    filterConditions: PropTypes.array,
    more: PropTypes.array,
  }).isRequired,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
};

GenericActionFields.propTypes = { ...editorPropTypes, startOpen: PropTypes.bool, inCard: PropTypes.bool };

// The action's own fields, then (parent / child / relative actions) the filter box that limits
// which related cards the action applies to.
function GenericInstance({ action, value, defaultBoardId, renderPropertyPicker, filterCardLayout = false, startOpen = false, inCard = false, onChange }) {
  const filterKind = getActionFilterKind(action);
  return (
    <div className="d-flex flex-column gap-3">
      <GenericActionFields action={action} value={value} defaultBoardId={defaultBoardId} startOpen={startOpen} inCard={inCard} onChange={onChange} />
      {filterKind && renderPropertyPicker && (
        <RelativeFilterBox
          renderPropertyPicker={renderPropertyPicker}
          cardLayout={filterCardLayout}
          defaultBoardId={defaultBoardId}
          label={`if ${filterKind.kind} card matches this filter`}
          rows={value.filterConditions ?? []}
          onChange={(filterConditions) => onChange({ ...value, filterConditions })}
        />
      )}
    </div>
  );
}

GenericInstance.propTypes = {
  ...editorPropTypes,
  startOpen: PropTypes.bool,
  inCard: PropTypes.bool,
  renderPropertyPicker: PropTypes.func,
  filterCardLayout: PropTypes.bool,
};

// An action that moves a card to a board position can be added again, each time with its own target
// and filter (value.more holds the extra ones): "Add new move action". The link's verb is the first
// word of the action's own action_code (move_parent_card -> move).
function GenericThenActionEditor({ action, title, value, defaultBoardId, renderPropertyPicker, filterCardLayout = false, onChange, allowRepeat = true }) {
  const more = value.more ?? [];
  const hasFirstTarget = Object.values(value.position ?? {}).some(Boolean);
  const canRepeat = allowRepeat && isRepeatableAction(action) && (hasFirstTarget || more.length > 0);
  const verb = String(action.action_code ?? '').split('_')[0];

  // A move with a parent / child filter reads like the update card: each target is a card holding
  // "Move parent to", its link and the filter box, and "Add new move action" sits under the cards.
  if (isTitleInCardAction(action, allowRepeat)) {
    const cards = [value, ...more];
    const setCard = (index, next) => (index === 0
      ? onChange({ ...next, more })
      : onChange({ ...value, more: more.map((m, i) => (i === index - 1 ? next : m)) }));
    // Removing the first card promotes the next one; the last card is only emptied.
    const removeCard = (index) => {
      if (index > 0) onChange({ ...value, more: more.filter((m, i) => i !== index - 1) });
      else if (more.length > 0) onChange({ ...more[0], more: more.slice(1) });
      else onChange({ ...EMPTY_GENERIC_ACTION_VALUE, thenActionId: value.thenActionId });
    };
    return (
      <div className="br-generic-then d-flex flex-column gap-2">
        {cards.map((card, index) => (
          <div key={index} className="business-rule-form-action-detail-card">
            <button
              type="button"
              className="business-rule-form-action-detail-close"
              onClick={() => removeCard(index)}
              aria-label={`Remove ${action.action_name}`}
            >
              <FiX size={14} />
            </button>
            <h5 className="business-rule-form-action-title">{title}</h5>
            <GenericInstance
              inCard
              action={action}
              value={card}
              defaultBoardId={defaultBoardId}
              renderPropertyPicker={renderPropertyPicker}
              filterCardLayout={filterCardLayout}
              onChange={(next) => setCard(index, next)}
            />
          </div>
        ))}
        <button
          type="button"
          className="business-rule-form-add-link"
          onClick={() => onChange({ ...value, more: [...more, { ...EMPTY_GENERIC_ACTION_VALUE }] })}
        >
          <FiPlus size={14} aria-hidden />
          Add new {verb} action
        </button>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <GenericInstance
        action={action}
        value={value}
        defaultBoardId={defaultBoardId}
        renderPropertyPicker={renderPropertyPicker}
        filterCardLayout={filterCardLayout}
        onChange={onChange}
      />
      {more.map((extra, index) => (
        <div key={index} className="position-relative">
          <button
            type="button"
            className="business-rule-form-action-detail-close"
            onClick={() => onChange({ ...value, more: more.filter((m, i) => i !== index) })}
            aria-label={`Remove ${action.action_name}`}
          >
            <FiX size={14} />
          </button>
          <GenericInstance
            action={action}
            value={extra}
            startOpen
            defaultBoardId={defaultBoardId}
            renderPropertyPicker={renderPropertyPicker}
            filterCardLayout={filterCardLayout}
            onChange={(next) => onChange({ ...value, more: more.map((m, i) => (i === index ? next : m)) })}
          />
        </div>
      ))}
      {canRepeat && (
        <button
          type="button"
          className="business-rule-form-add-link"
          onClick={() => onChange({ ...value, more: [...more, { ...EMPTY_GENERIC_ACTION_VALUE }] })}
        >
          <FiPlus size={14} aria-hidden />
          Add new {verb} action
        </button>
      )}
    </div>
  );
}

GenericThenActionEditor.propTypes = {
  ...editorPropTypes,
  renderPropertyPicker: PropTypes.func,
  allowRepeat: PropTypes.bool,
  filterCardLayout: PropTypes.bool,
  title: PropTypes.string,
};

export default GenericThenActionEditor;
