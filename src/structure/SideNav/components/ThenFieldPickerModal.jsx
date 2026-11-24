import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import { FiChevronDown, FiChevronUp, FiX } from 'react-icons/fi';
import { PRIMARY_PRESET_COLORS, SECONDARY_PRESET_COLORS } from '../../../components/SedresColorPicker/sedresColorPickerConstants';
import { getGenericFieldKey, isCustomGenericField } from './genericThenAction';

const EMPTY_LIST = [];

// Custom field pills carry a coloured dot cycled from the colour picker's presets, like the Card
// property match modal's custom fields.
const DOT_COLORS = [...PRIMARY_PRESET_COLORS, ...SECONDARY_PRESET_COLORS];

// The common "Add new action" picker of the THEN column: the fields the backend offers for
// the action (regular + custom) as pills, several can be ticked and added at once.
function ThenFieldPickerModal({ show, fields, addedKeys = EMPTY_LIST, onClose, onAdd }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [expandedRegular, setExpandedRegular] = useState(true);
  const [expandedCustom, setExpandedCustom] = useState(true);

  useEffect(() => {
    if (!show) return;
    setSelectedKeys([]);
    setFilterText('');
    setExpandedRegular(true);
    setExpandedCustom(true);
  }, [show]);

  const query = filterText.trim().toLowerCase();
  // Fields already added stay in the list, drawn disabled, like the Card property match modal does.
  const available = fields.filter((f) => !query || String(f.field_label ?? '').toLowerCase().includes(query));
  const regularFields = available.filter((f) => !isCustomGenericField(f));
  const customFields = available.filter((f) => isCustomGenericField(f));

  const toggle = (key) => setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleAdd = () => {
    onAdd(fields.filter((f) => selectedKeys.includes(getGenericFieldKey(f))));
    onClose();
  };

  const renderPills = (list, withDots = false) => (
    <div className="br-property-pill-grid">
      {list.map((field, index) => {
        const key = getGenericFieldKey(field);
        const isAdded = addedKeys.includes(key);
        return (
          <button
            key={key}
            type="button"
            className={`br-property-pill${selectedKeys.includes(key) ? ' br-property-pill--selected' : ''}${isAdded ? ' br-property-pill--disabled' : ''}`}
            disabled={isAdded}
            onClick={() => toggle(key)}
          >
            {withDots && (
              <svg className="br-property-pill-dot" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="12" fill={DOT_COLORS[index % DOT_COLORS.length]} />
              </svg>
            )}
            {field.field_label}
          </button>
        );
      })}
    </div>
  );

  // Collapsible section, drawn like the Card property match modal's own Regular / Custom fields.
  const renderSection = (title, list, expanded, setExpanded, withDots = false) => (
    <div className="br-property-section">
      <button type="button" className="br-property-section-toggle" onClick={() => setExpanded((v) => !v)}>
        <span className="br-property-section-toggle-icon">
          {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
        </span>
        {title}
      </button>
      {expanded && renderPills(list, withDots)}
    </div>
  );

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog card-property-match-modal-dialog--full"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Card property match</h2>
          <button type="button" className="business-rule-form-modal-close" onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          {available.length === 0 && <div className="br-property-picker-empty">No fields found</div>}

          {regularFields.length > 0 && renderSection('Regular fields', regularFields, expandedRegular, setExpandedRegular)}

          {customFields.length > 0 && renderSection('Custom fields', customFields, expandedCustom, setExpandedCustom, true)}
        </div>

        <footer className="card-property-match-modal-footer">
          <button type="button" className="br-property-add-btn" disabled={selectedKeys.length === 0} onClick={handleAdd}>
            Add
          </button>
        </footer>
      </div>
    </Modal>
  );
}

ThenFieldPickerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  fields: PropTypes.array.isRequired,
  addedKeys: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
};

export default ThenFieldPickerModal;
