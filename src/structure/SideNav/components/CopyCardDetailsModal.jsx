import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import { FiChevronDown, FiChevronUp, FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';

// One collapsible group of copy pills with its own Select all / Deselect all.
function CopySection({ title, options, selected, emptyText = '', onChange }) {
  const [expanded, setExpanded] = useState(true);
  const toggle = (key) => onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <div className="br-property-section">
      <button type="button" className="br-property-section-toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <span className="br-property-section-toggle-icon">
          {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
        </span>
        {title}
      </button>
      {expanded && (
        <>
          <div className="br-property-select-all-row">
            <button type="button" className="business-rule-form-add-link" onClick={() => onChange(options.map((o) => o.key))}>
              Select all
            </button>
            /
            <button type="button" className="business-rule-form-add-link" onClick={() => onChange([])}>
              Deselect all
            </button>
          </div>
          <div className="br-property-pill-grid">
            {options.length === 0 && <div className="br-property-picker-empty">{emptyText}</div>}
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`br-property-pill${selected.includes(option.key) ? ' br-property-pill--selected' : ''}`}
                aria-pressed={selected.includes(option.key)}
                onClick={() => toggle(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

CopySection.propTypes = {
  title: PropTypes.string.isRequired,
  options: PropTypes.array.isRequired,
  selected: PropTypes.array.isRequired,
  emptyText: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

// Step after "where to create": which fields of the originator card are copied to the new one.
function CopyCardDetailsModal({ show, copyFields, triggerTypeId, boardId = '', copyKeys, copyCustomKeys, onClose, onContinue }) {
  const [regular, setRegular] = useState([]);
  const [custom, setCustom] = useState([]);
  const { customFields, isLoadingCustomFields, getCustomFields } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    setRegular(copyKeys);
    setCustom(copyCustomKeys);
    getCustomFields({ params: { trigger_type_id: triggerTypeId, board_ids: boardId || undefined } });
  }, [show]);

  const regularOptions = copyFields.map((f) => ({ key: f.field_key, label: f.field_label }));
  const customOptions = customFields.map((f) => ({ key: String(f.custom_field_id), label: f.field_label ?? f.field_name ?? f.custom_field_name }));

  // With every regular field ticked the custom fields section is not offered, nor are its picks sent.
  const allRegular = regularOptions.length > 0 && regularOptions.every((o) => regular.includes(o.key));

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
          <h2 className="card-property-match-modal-title">Copy Card Details</h2>
          <button type="button" className="business-rule-form-modal-close" onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <p>Select the fields that you want to copy from the originator</p>
          {regularOptions.length > 0 && (
            <CopySection title="Regular fields" options={regularOptions} selected={regular} onChange={setRegular} />
          )}
          {!allRegular && (
            <CopySection
              title="Custom fields"
              options={customOptions}
              selected={custom}
              emptyText={isLoadingCustomFields ? 'Loading...' : 'No custom fields found'}
              onChange={setCustom}
            />
          )}
        </div>

        <footer className="card-property-match-modal-footer">
          <button type="button" className="br-property-add-btn" onClick={() => onContinue(regular, allRegular ? [] : custom)}>
            Continue
          </button>
        </footer>
      </div>
    </Modal>
  );
}

CopyCardDetailsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  copyFields: PropTypes.array.isRequired,
  triggerTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  copyKeys: PropTypes.array.isRequired,
  copyCustomKeys: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
};

export default CopyCardDetailsModal;
