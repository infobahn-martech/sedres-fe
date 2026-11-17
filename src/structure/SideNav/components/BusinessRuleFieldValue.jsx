import { useEffect } from 'react';
import PropTypes from 'prop-types';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';
import '../../../design/scss/business-rule-generic-action.scss';
import {
  BETWEEN_SEPARATOR,
  fieldTakesValue,
  joinMultiValue,
  operatorIsBetween,
  operatorNeedsTimeUnit,
  operatorTakesValue,
  splitMultiValue,
} from './businessRuleFieldUtils';

const EMPTY_OPTIONS = [];
const noop = () => {};

const toSelectOptions = (options) =>
  options.map((opt) => ({ value: String(opt.option_value), label: opt.option_label }));

const toDateTimeLocal = (value) => (value ? String(value).replace(' ', 'T').slice(0, 16) : '');
const fromDateTimeLocal = (value) => (value ? `${value.replace('T', ' ')}:00` : '');

const getOptions = (details, masterOptionsByKey) => {
  if (details?.option_source === 'depends_on') return masterOptionsByKey[details.master_key] ?? EMPTY_OPTIONS;
  return details?.options ?? EMPTY_OPTIONS;
};

// One control for one value, picked by field_type only (guide 1.2).
function ValueControl({ details, options, value, onChange, ariaLabel }) {
  const fieldType = details?.field_type;

  if (fieldType === 'multiselect' || fieldType === 'checkbox') {
    return (
      <SearchableSelect
        isMulti
        showSelectAll
        value={splitMultiValue(value)}
        onChange={(e) => onChange(joinMultiValue(e.target.value))}
        options={toSelectOptions(options)}
        placeholder="Select"
        className="br-value-select"
        menuPortalTarget={document.body}
        menuPlacement="auto"
      />
    );
  }

  if (fieldType === 'dropdown' || fieldType === 'radio') {
    return (
      <SearchableSelect
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        options={toSelectOptions(options)}
        placeholder="Select"
        className="br-value-select"
        menuPortalTarget={document.body}
        menuPlacement="auto"
      />
    );
  }

  if (fieldType === 'date') {
    return (
      <input
        type="date"
        className="business-rule-form-condition-input"
        aria-label={ariaLabel}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (fieldType === 'datetime') {
    return (
      <input
        type="datetime-local"
        className="business-rule-form-condition-input"
        aria-label={ariaLabel}
        value={toDateTimeLocal(value)}
        onChange={(e) => onChange(fromDateTimeLocal(e.target.value))}
      />
    );
  }

  if (fieldType === 'textarea') {
    return (
      <textarea
        className="business-rule-form-condition-input"
        aria-label={ariaLabel}
        rows={2}
        placeholder="Enter value"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type={fieldType === 'number' ? 'number' : fieldType === 'email' ? 'email' : 'text'}
      className="business-rule-form-condition-input"
      aria-label={ariaLabel}
      placeholder="Enter value"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

ValueControl.propTypes = {
  details: PropTypes.object,
  options: PropTypes.array.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
};

/**
 * Value box for one Business Rule field row (guide section 1). The control comes from the
 * field's own field_type, the choices from option_source, and the box adapts to the picked
 * operator: hidden for is empty / are present, two values for is between, number + time
 * unit for in next / in last / was more than.
 */
function BusinessRuleFieldValue({
  details, operator, value, timeUnitId, timeUnits = EMPTY_OPTIONS, onChange, onTimeUnitChange = noop, label = 'Value',
}) {
  const { masterOptionsByKey, getMasterOptions } = useBusinessRuleReducer();

  const masterKey = details?.option_source === 'depends_on' ? details.master_key : null;
  useEffect(() => {
    if (masterKey) getMasterOptions(masterKey);
  }, [masterKey, getMasterOptions]);

  if (!fieldTakesValue(details) || !operatorTakesValue(operator)) return null;

  const options = getOptions(details, masterOptionsByKey);

  if (operatorNeedsTimeUnit(operator)) {
    return (
      <div className="d-flex align-items-center gap-2">
        <input
          type="number"
          min="0"
          className="business-rule-form-condition-input"
          aria-label={`${label} amount`}
          placeholder="Enter value"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <SearchableSelect
          value={timeUnitId ?? ''}
          onChange={(e) => onTimeUnitChange(e.target.value)}
          options={timeUnits.map((unit) => ({ value: String(unit.time_unit_id), label: unit.unit_label }))}
          placeholder="Unit"
          className="br-value-select"
          menuPortalTarget={document.body}
          menuPlacement="auto"
        />
      </div>
    );
  }

  if (operatorIsBetween(operator)) {
    const [from = '', to = ''] = String(value ?? '').split(BETWEEN_SEPARATOR);
    return (
      <div className="d-flex align-items-center gap-2">
        <ValueControl
          details={details}
          options={options}
          value={from}
          ariaLabel={`${label} from`}
          onChange={(next) => onChange(`${next}${BETWEEN_SEPARATOR}${to}`)}
        />
        <span>and</span>
        <ValueControl
          details={details}
          options={options}
          value={to}
          ariaLabel={`${label} to`}
          onChange={(next) => onChange(`${from}${BETWEEN_SEPARATOR}${next}`)}
        />
      </div>
    );
  }

  return (
    <ValueControl details={details} options={options} value={value} ariaLabel={label} onChange={onChange} />
  );
}

BusinessRuleFieldValue.propTypes = {
  details: PropTypes.object,
  operator: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  timeUnitId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  timeUnits: PropTypes.array,
  onChange: PropTypes.func.isRequired,
  onTimeUnitChange: PropTypes.func,
  label: PropTypes.string,
};

export default BusinessRuleFieldValue;
