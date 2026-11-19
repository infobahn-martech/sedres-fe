import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import { FiX } from 'react-icons/fi';
import { getGenericFieldKey, isCustomGenericField } from './genericThenAction';

const EMPTY_LIST = [];

// The common "Add new action" picker of the THEN column: the fields the backend offers for
// the action (regular + custom) as pills, several can be ticked and added at once.
function ThenFieldPickerModal({ show, fields, addedKeys = EMPTY_LIST, onClose, onAdd }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (!show) return;
    setSelectedKeys([]);
    setFilterText('');
  }, [show]);

  const query = filterText.trim().toLowerCase();
  const available = fields
    .filter((f) => !addedKeys.includes(getGenericFieldKey(f)))
    .filter((f) => !query || String(f.field_label ?? '').toLowerCase().includes(query));
  const regularFields = available.filter((f) => !isCustomGenericField(f));
  const customFields = available.filter((f) => isCustomGenericField(f));

  const toggle = (key) => setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleAdd = () => {
    onAdd(fields.filter((f) => selectedKeys.includes(getGenericFieldKey(f))));
    onClose();
  };

  const renderPills = (list) => (
    <div className="br-property-pill-grid">
      {list.map((field) => {
        const key = getGenericFieldKey(field);
        return (
          <button
            key={key}
            type="button"
            className={`br-property-pill${selectedKeys.includes(key) ? ' br-property-pill--selected' : ''}`}
            onClick={() => toggle(key)}
          >
            {field.field_label}
          </button>
        );
      })}
    </div>
  );

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Add new action</h2>
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

          {regularFields.length > 0 && (
            <div className="br-property-section">
              <div className="br-property-section-toggle">Regular fields</div>
              {renderPills(regularFields)}
            </div>
          )}

          {customFields.length > 0 && (
            <div className="br-property-section">
              <div className="br-property-section-toggle">Custom fields</div>
              {renderPills(customFields)}
            </div>
          )}
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
