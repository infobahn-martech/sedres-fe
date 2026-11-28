import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import { FiChevronDown, FiChevronUp, FiFilePlus, FiLayers, FiLayout, FiTriangle, FiMaximize, FiDroplet, FiPlus, FiGrid, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import BusinessRuleFieldValue from './BusinessRuleFieldValue';
import BoardMinimapModal from './BoardMinimapModal';
import SedresColorPicker from '../../../components/SedresColorPicker/SedresColorPicker';
import { normalizeHexColor } from '../../../components/SedresColorPicker/sedresColorPickerConstants';
import { PRIMARY_PRESET_COLORS, SECONDARY_PRESET_COLORS } from '../../../components/SedresColorPicker/sedresColorPickerConstants';
import { buildBoardMinimapWorkflows } from './boardMinimap.utils';
import { getGenericFieldKey, isCustomGenericField } from './genericThenAction';
import '../../../design/scss/business-rule-card-details.scss';

const OPTION_FIELD_TYPES = ['dropdown', 'radio', 'multiselect', 'checkbox'];
const EMPTY_LIST = [];
// Custom fields carry a coloured dot, cycled like in the other field pickers.
const DOT_COLORS = [...PRIMARY_PRESET_COLORS, ...SECONDARY_PRESET_COLORS];
// The rows the client's card shows without pressing "+", matched on the catalog's labels.
const CLIENT_FIELDS = ['Owner', 'Co-owners', 'Deadline', 'Size', 'Tags', 'Custom card ID'];
const FULL_WIDTH_FIELDS = ['Tags', 'Custom card ID'];
const USER_FIELDS = ['Owner', 'Co-owners'];
const COPIED_CUSTOM_NOTE = "Custom fields in this tab that match those selected to be copied from the trigger card will be ignored during new card creation. If the 'All custom fields' option is selected, all custom fields in this tab will be ignored when creating the new card.";
const NOT_OFFERED_HINT = 'Not available yet: the backend does not offer this field';

// "Co-owners" / "Co owner" / "co_owners" all match.
const labelKey = (label) => String(label ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
const labelOf = (field) => labelKey(field.field_label);

// "Card details" of a create-card action: the values set on the new card and where it goes.
// Only fields the backend offers (cardFields) are drawn, so nothing typed here is lost on save.
function CardDetailsModal({ show, action, cardFields, titleCopied, showCopyNote, triggerTypeId, onChange, onSave, onClose }) {
  const {
    fieldDetailsByKey, getFieldDetails, customFields, getCustomFields, boardPickerWorkspaces, getBoardPickerWorkspaces, boardWorkflowsByBoard, getBoardWorkflows,
  } = useBusinessRuleReducer((s) => s);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [fieldFilter, setFieldFilter] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  useEffect(() => { if (!show) setEditingTitle(false); }, [show]);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showCustom, setShowCustom] = useState(true);
  const [showFields, setShowFields] = useState(true);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [minimapBoardId, setMinimapBoardId] = useState('');
  const { position, fields } = action;

  useEffect(() => {
    if (!show) return;
    getBoardPickerWorkspaces();
    if (position.boardId) getBoardWorkflows(position.boardId);
  }, [show, position.boardId]);

  useEffect(() => {
    if (show) getCustomFields({ params: { trigger_type_id: triggerTypeId, board_ids: position.boardId || undefined } });
  }, [show, position.boardId]);

  // The catalog's own fields plus the board's custom fields it does not already list.
  const allFields = [
    ...cardFields,
    ...customFields
      .filter((c) => !cardFields.some((f) => String(f.custom_field_id) === String(c.custom_field_id)))
      .map((c) => ({ ...c, regular_field_id: null, field_label: c.field_label ?? c.field_name ?? c.custom_field_name })),
  ];
  const detailsKey = (field) => (isCustomGenericField(field) ? `custom-${field.custom_field_id}` : `regular-${field.regular_field_id}`);

  useEffect(() => {
    if (!show) return;
    allFields.forEach((field) => {
      const isCustom = isCustomGenericField(field);
      const id = isCustom ? field.custom_field_id : field.regular_field_id;
      if (!OPTION_FIELD_TYPES.includes(field.field_type) || id == null) return;
      if (fieldDetailsByKey[detailsKey(field)] === undefined) getFieldDetails(isCustom ? 'custom' : 'regular', id);
    });
  }, [show, cardFields, customFields]);

  // The title is typed in the header (saved as card_title), so it is not a row here.
  const findField = (label) => allFields.find((f) => labelOf(f) === labelKey(label));
  const description = findField('Description');
  const others = allFields.filter((f) => f !== description && labelOf(f) !== labelKey('Title'));
  const defaults = CLIENT_FIELDS.map(findField).filter(Boolean);
  const addableFields = others.filter((f) => !defaults.includes(f));
  const added = addableFields.filter((f) => getGenericFieldKey(f) in fields);
  const addedRegular = added.filter((f) => !isCustomGenericField(f));
  const customRows = added.filter(isCustomGenericField);

  const priorityField = findField('Priority');
  const colorField = findField('Color');
  const isHeaderField = (field) => field === priorityField || field === colorField;
  const pickerFields = addableFields.filter((f) => !isHeaderField(f));
  const colorKey = colorField ? getGenericFieldKey(colorField) : '';
  const cardColor = fields[colorKey] ? normalizeHexColor(fields[colorKey]) : '';

  const setValue = (key, value) => onChange({ fields: { ...fields, [key]: value } });
  const removeField = (key) => onChange({ fields: Object.fromEntries(Object.entries(fields).filter(([k]) => k !== key)) });

  const board = (boardPickerWorkspaces ?? EMPTY_LIST).flatMap((w) => w.boards ?? EMPTY_LIST)
    .find((b) => String(b.board_id) === String(position.boardId));
  const workflow = buildBoardMinimapWorkflows(boardWorkflowsByBoard[String(position.boardId)])
    .find((wf) => wf.id === String(position.workflowId));
  const lane = workflow?.swimlanes.find((l) => l.id === String(position.swimlaneId));

  const openMinimap = () => { setMinimapBoardId(position.boardId); setShowMinimap(true); };

  // A field the client's card shows but the backend does not offer yet: same look, disabled.
  const renderPlaceholder = (label) => {
    if (USER_FIELDS.includes(label)) {
      return (
        <button type="button" className="br-card-details-user" disabled title={NOT_OFFERED_HINT} aria-label={label}>
          <span className="br-card-details-avatar">N</span>
          None
          <FiChevronDown size={14} aria-hidden />
        </button>
      );
    }
    if (label === 'Size') {
      return (
        <select className="form-select" disabled title={NOT_OFFERED_HINT} aria-label={label}>
          <option>Not Set</option>
        </select>
      );
    }
    return <input type="text" className="form-control" disabled title={NOT_OFFERED_HINT} aria-label={label} />;
  };

  const toggleFieldPicker = () => { setFieldFilter(''); setShowFieldPicker((v) => !v); };
  const pickableFields = pickerFields.filter((f) => !(getGenericFieldKey(f) in fields)
    && String(f.field_label ?? '').toLowerCase().includes(fieldFilter.trim().toLowerCase()));

  const renderSection = (title, open, toggle, actions = null) => (
    <div className="br-card-details-section">
      <button type="button" className="br-card-details-section-toggle" onClick={() => toggle((v) => !v)} aria-expanded={open}>
        <span className="br-card-details-badge">{open ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}</span>
        {title}
      </button>
      {actions}
    </div>
  );

  const renderField = (field, full = true) => {
    const key = getGenericFieldKey(field);
    return (
      <div key={key} className={`br-card-details-field${full ? ' br-card-details-field--full' : ''}`}>
        <div className="br-card-details-field-head">
          <label>{field.field_label}</label>
          {!defaults.includes(field) && (
            <button type="button" className="br-card-details-section-action" onClick={() => removeField(key)} aria-label={`Remove ${field.field_label}`}>
              <FiX size={12} />
            </button>
          )}
        </div>
        <div className="br-generic-action">
          <BusinessRuleFieldValue
            details={fieldDetailsByKey[detailsKey(field)] ?? field}
            value={fields[key] ?? ''}
            label={field.field_label}
            onChange={(value) => setValue(key, value)}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        className="card-property-match-modal"
        dialogClassName="card-property-match-modal-dialog br-card-details-dialog"
        backdropClassName="card-property-match-modal-backdrop"
        centered
      >
        <div className="br-card-details">
          <button type="button" className="br-card-details-round br-card-details-corner" disabled title={NOT_OFFERED_HINT} aria-label="Card template">
            <FiLayers size={18} />
          </button>
          <header className="card-property-match-modal-header br-card-details-header">
            {cardColor && (
              <svg className="br-card-details-header-fill" width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
                <rect width="100%" height="100%" fill={cardColor} />
              </svg>
            )}
            {titleCopied && !editingTitle ? (
              <h2 className="card-property-match-modal-title br-card-details-heading">
                <button type="button" onClick={() => setEditingTitle(true)} title="Type a card title">Card details</button>
              </h2>
            ) : (
              <input
                type="text"
                className="br-card-details-title-input"
                placeholder="Enter card title"
                aria-label="Card title"
                autoFocus={editingTitle}
                value={action.title}
                onChange={(e) => onChange({ title: e.target.value })}
              />
            )}
            <div className="br-card-details-header-actions">
              <button
                type="button"
                className="business-rule-form-modal-close"
                disabled={!colorField}
                title={colorField ? 'Card color' : NOT_OFFERED_HINT}
                aria-label="Card color"
                aria-expanded={showColorPicker}
                onClick={() => { setShowPriority(false); setShowColorPicker((v) => !v); }}
              >
                <FiDroplet size={18} />
              </button>
              <button
                type="button"
                className="business-rule-form-modal-close"
                disabled={!priorityField}
                title={priorityField ? 'Priority' : NOT_OFFERED_HINT}
                aria-label="Priority"
                aria-expanded={showPriority}
                onClick={() => { setShowColorPicker(false); setShowPriority((v) => !v); }}
              >
                <FiTriangle size={18} />
              </button>
              <button type="button" className="business-rule-form-modal-close" disabled title={NOT_OFFERED_HINT} aria-label="Card layout">
                <FiLayout size={18} />
              </button>
              <button type="button" className="business-rule-form-modal-close" onClick={onClose} aria-label="Close">
                <FiX size={20} />
              </button>
            </div>
          </header>

          {showPriority && priorityField && (
            <div className="br-card-details-priority-panel">{renderField(priorityField)}</div>
          )}

          {showColorPicker && (
            <div className="br-card-details-color-panel">
              <SedresColorPicker
                initialHex={cardColor || undefined}
                onApply={(next) => { setValue(colorKey, normalizeHexColor(next)); setShowColorPicker(false); }}
                onCancel={() => setShowColorPicker(false)}
                ariaLabel="Card color"
              />
            </div>
          )}

          <div className="br-card-details-body">
            {/* shortcut: plain text, switch to the rich editor once the backend confirms it stores HTML. */}
            <textarea
              className="br-card-details-description"
              placeholder="Enter card description"
              aria-label="Card description"
              disabled={!description}
              title={description ? undefined : NOT_OFFERED_HINT}
              value={description ? fields[getGenericFieldKey(description)] ?? '' : ''}
              onChange={(e) => setValue(getGenericFieldKey(description), e.target.value)}
            />

            <aside className="br-card-details-sidebar">
              <div className="br-card-details-add">
                {renderSection('Card fields', showFields, setShowFields, (
                  <button
                    type="button"
                    className="br-card-details-section-action"
                    onClick={toggleFieldPicker}
                    aria-label="Add card field"
                    aria-expanded={showFieldPicker}
                  >
                    <FiPlus size={16} />
                  </button>
                ))}
                {showFieldPicker && (
                  <>
                    <button type="button" className="br-card-details-add-backdrop" onClick={toggleFieldPicker} aria-label="Close field list" />
                    <div className="br-card-details-add-panel">
                      <input
                        type="text"
                        placeholder="Filter"
                        aria-label="Filter fields"
                        value={fieldFilter}
                        onChange={(e) => setFieldFilter(e.target.value)}
                        autoFocus
                      />
                      {pickableFields.length === 0 && <div className="br-property-picker-empty">No fields found</div>}
                      {pickableFields.map((field) => (
                        <button
                          key={getGenericFieldKey(field)}
                          type="button"
                          onClick={() => { setValue(getGenericFieldKey(field), ''); setShowFields(true); toggleFieldPicker(); }}
                        >
                          {isCustomGenericField(field) && (
                            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                              <circle cx="10" cy="10" r="10" fill={DOT_COLORS[others.filter(isCustomGenericField).indexOf(field) % DOT_COLORS.length]} />
                            </svg>
                          )}
                          {field.field_label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {showFields && (
                <>
                  <div className="br-card-details-grid">
                    {CLIENT_FIELDS.map((label) => {
                      const full = FULL_WIDTH_FIELDS.includes(label);
                      const field = findField(label);
                      if (field) return renderField(field, full);
                      return (
                        <div key={label} className={`br-card-details-field${full ? ' br-card-details-field--full' : ''}`}>
                          <label>{label}</label>
                          {renderPlaceholder(label)}
                        </div>
                      );
                    })}
                    {addedRegular.filter((f) => !isHeaderField(f)).map((field) => renderField(field))}
                  </div>

                  <div className="br-card-details-custom">
                    <button type="button" className="br-card-details-custom-toggle" onClick={() => setShowCustom((v) => !v)} aria-expanded={showCustom}>
                      {`Custom fields (${customRows.length})`}
                      {showCustom ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                    </button>
                    <button type="button" className="br-card-details-round" disabled title={NOT_OFFERED_HINT} aria-label="Expand custom fields">
                      <FiMaximize size={14} />
                    </button>
                    <button type="button" className="br-card-details-round" disabled title={NOT_OFFERED_HINT} aria-label="Custom field layout">
                      <FiGrid size={14} />
                    </button>
                  </div>
                  {showCustom && showCopyNote && <p className="br-card-details-note">{COPIED_CUSTOM_NOTE}</p>}
                  {showCustom && customRows.length > 0 && (
                    <div className="br-card-details-grid">{customRows.map((field) => renderField(field))}</div>
                  )}
                </>
              )}

              {/* shortcut: Subtasks and Docs stay disabled until the create-card payload accepts them. */}
              {renderSection('Subtasks', showSubtasks, setShowSubtasks)}
              {showSubtasks && (
                <textarea
                  className="br-card-details-subtask"
                  placeholder="Press ctrl/cmd + enter to create new subtask"
                  aria-label="New subtask"
                  title={NOT_OFFERED_HINT}
                  disabled
                />
              )}

              {renderSection('Docs (0)', showDocs, setShowDocs, (
                <>
                  <button type="button" className="br-card-details-section-action" disabled title={NOT_OFFERED_HINT} aria-label="New doc">
                    <FiFilePlus size={15} />
                  </button>
                  <button type="button" className="br-card-details-section-action" disabled title={NOT_OFFERED_HINT} aria-label="Add doc">
                    <FiPlus size={16} />
                  </button>
                </>
              ))}
            </aside>
          </div>

          <footer className="br-card-details-footer">
            <div className="br-card-details-breadcrumb">
              Board{' '}
              <button type="button" className="br-card-details-link" onClick={openMinimap}>{board?.board_name ?? 'Choose'}</button>
              {workflow && <> / Workflow <button type="button" className="br-card-details-link" onClick={openMinimap}>{workflow.name}</button></>}
              {lane && <> / Swimlane <button type="button" className="br-card-details-link" onClick={openMinimap}>{lane.name}</button></>}
            </div>

            <div className="br-card-details-footer-row">
              <div className="br-card-details-stepper">
                {workflow?.stageSegments.flatMap((segment) => segment.columns.map((column) => {
                  const isActive = String(position.columnId) === column.id;
                  const color = segment.color || 'currentColor';
                  return (
                    <button
                      key={column.id}
                      type="button"
                      className="br-card-details-step"
                      title={column.name}
                      aria-label={column.name}
                      aria-pressed={isActive}
                      onClick={() => onChange({ position: { ...position, columnId: column.id } })}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                        <circle cx="12" cy="12" r="11" stroke={color} strokeWidth="1.5" fill={isActive ? color : 'none'} />
                      </svg>
                      <span className="br-card-details-step-label">{isActive ? column.name : ''}</span>
                    </button>
                  );
                }))}
              </div>
              <button type="button" className="br-property-add-btn" onClick={onSave}>
                Save details
              </button>
            </div>
          </footer>
        </div>
      </Modal>

      <BoardMinimapModal
        show={showMinimap}
        value={position}
        boardId={minimapBoardId}
        onBoardChange={setMinimapBoardId}
        cellOnly
        onPick={(next) => { onChange({ position: next }); setShowMinimap(false); }}
        onClose={() => setShowMinimap(false)}
      />
    </>
  );
}

CardDetailsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  action: PropTypes.shape({
    title: PropTypes.string,
    position: PropTypes.object.isRequired,
    fields: PropTypes.object.isRequired,
  }).isRequired,
  cardFields: PropTypes.array.isRequired,
  titleCopied: PropTypes.bool.isRequired,
  showCopyNote: PropTypes.bool.isRequired,
  triggerTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default CardDetailsModal;
