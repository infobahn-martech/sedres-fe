import { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import { FiX } from 'react-icons/fi';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import RelativeFilterBox from './RelativeFilterBox';
import { buildSubqueryConditions, parseFilterConditions } from './genericThenAction';
import { getOperatorKey, NOT_SET_LABEL } from './businessRuleFieldUtils';

// One-line text of a subquery that was changed here (a saved one comes with the backend's own label).
const summarize = ({ search, conditions }, fieldDetailsByKey) => [
  search ? `'${search}'` : '',
  ...conditions.map((c) => {
    const details = fieldDetailsByKey[c.custom_field_id != null ? `custom-${c.custom_field_id}` : `regular-${c.regular_field_id}`];
    const operator = details?.operators?.find((op) => getOperatorKey(op) === c.operator);
    const option = details?.options?.find((o) => String(o.option_value) === String(c.input_value));
    return [details?.field_label, operator?.operator_label, option?.option_label ?? c.input_value].filter(Boolean).join(' ');
  }),
].filter(Boolean).join(', ');

// Value of a subquery field (Parent cards / Child cards): a "Not Set" chip opening the Subquery Parameters
// popup. The value is the API object { search, conditions }; older rules hold a plain search string.
function SubqueryValue({ value, savedLabel, defaultBoardId, renderPropertyPicker, onChange }) {
  const fieldDetailsByKey = useBusinessRuleReducer((s) => s.fieldDetailsByKey);
  const [draft, setDraft] = useState(null);
  const saved = typeof value === 'object' && value !== null
    ? { search: value.search ?? '', conditions: value.conditions ?? [] }
    : { search: String(value ?? ''), conditions: [] };

  const handleOpen = () => setDraft({ search: saved.search, rows: parseFilterConditions(saved.conditions) });

  const handleApply = () => {
    const search = draft.search.trim();
    const conditions = buildSubqueryConditions(draft.rows);
    onChange(search || conditions.length > 0 ? { search, conditions } : '');
    setDraft(null);
  };

  return (
    <>
      <button type="button" className="business-rule-form-condition-label business-rule-form-condition-label-btn text-start" onClick={handleOpen}>
        {savedLabel || summarize(saved, fieldDetailsByKey) || NOT_SET_LABEL}
      </button>
      {draft && (
        <Modal
          show
          onHide={() => setDraft(null)}
          className="card-property-match-modal"
          dialogClassName="card-property-match-modal-dialog"
          backdropClassName="card-property-match-modal-backdrop"
          centered
          scrollable
        >
          <div className="card-property-match-modal-shell">
            <header className="card-property-match-modal-header">
              <h2 className="card-property-match-modal-title">Subquery Parameters</h2>
              <button type="button" className="business-rule-form-modal-close" onClick={() => setDraft(null)} aria-label="Close">
                <FiX size={20} />
              </button>
            </header>
            <div className="card-property-match-modal-body">
              <div className="d-flex gap-2 mb-3">
                <input
                  type="text"
                  className="br-property-filter-input flex-grow-1"
                  placeholder="ID, owner, title, description"
                  aria-label="ID, owner, title, description"
                  value={draft.search}
                  onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
                  autoFocus
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={handleApply}>Apply</button>
              </div>
              <RelativeFilterBox
                cardLayout
                subquery={{ onClearAll: () => setDraft({ search: '', rows: [] }) }}
                rows={draft.rows}
                onChange={(rows) => setDraft((prev) => (prev ? { ...prev, rows } : prev))}
                defaultBoardId={defaultBoardId}
                renderPropertyPicker={(pickerProps) => renderPropertyPicker({ ...pickerProps, list: 'subquery' })}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

SubqueryValue.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
  savedLabel: PropTypes.string,
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  renderPropertyPicker: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default SubqueryValue;
