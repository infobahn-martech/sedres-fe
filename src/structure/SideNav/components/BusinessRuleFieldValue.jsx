import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';
import BoardStructureValue from './BoardStructureValue';
import InlineTextDropdown from './InlineTextDropdown';
import '../../../design/scss/business-rule-generic-action.scss';
import {
  BETWEEN_SEPARATOR,
  NOT_SET_LABEL,
  fieldTakesValue,
  getDateFieldEmptyLabel,
  isYesNoOptions,
  joinMultiValue,
  operatorIsBetween,
  operatorNeedsTimeUnit,
  operatorTakesValue,
  splitMultiValue,
} from './businessRuleFieldUtils';

const EMPTY_OPTIONS = [];
const SELECT_DATE_LABEL = 'Select date';
const SELECT_DATE_VALUE = 'select_date';
const noop = () => {};

const toSelectOptions = (options) =>
  options.map((opt) => ({ value: String(opt.option_value), label: opt.option_label }));

// Same list for the text-style dropdown: keeps each option's colour and icon, and adds the
// leading "Not Set" entry that clears the value.
const toChoiceOptions = (options) => [
  { value: '', label: NOT_SET_LABEL },
  ...options.map((opt) => ({
    value: String(opt.option_value),
    label: opt.option_label,
    colorCode: opt.color_code ?? undefined,
    iconName: opt.icon_name ?? undefined,
  })),
];

// A Yes/No field (e.g. Blocked) reads as its own state instead of "Yes": "Blocked" / "Not blocked".
const toYesNoStateOptions = (options, fieldLabel) =>
  options.map((opt) => ({
    value: String(opt.option_value),
    label: String(opt.option_label).trim().toLowerCase() === 'yes' ? fieldLabel : `Not ${fieldLabel.toLowerCase()}`,
  }));

const toDateTimeLocal = (value) => (value ? String(value).replace(' ', 'T').slice(0, 16) : '');
const fromDateTimeLocal = (value) => (value ? `${value.replace('T', ' ')}:00` : '');

const getOptions = (details, masterOptionsByKey) => {
  if (details?.option_source === 'depends_on') return masterOptionsByKey[details.master_key] ?? EMPTY_OPTIONS;
  return details?.options ?? EMPTY_OPTIONS;
};

// One control for one value, picked by field_type only (guide 1.2).
function ValueControl({ details, options, value, onChange, ariaLabel }) {
  const fieldType = details?.field_type;
  const [isPickingDate, setIsPickingDate] = useState(false);

  // A Yes/No dropdown (e.g. Blocked) opens on its first option, so the row shows that state's
  // text right away. Any other dropdown (e.g. Blocker) starts as "not set" until one is picked.
  const isChoiceDropdown = fieldType === 'dropdown' || fieldType === 'radio';
  const isYesNoDropdown = isChoiceDropdown && isYesNoOptions(options);
  const defaultOptionValue = isYesNoDropdown && String(value ?? '') === ''
    ? String(options[0].option_value)
    : null;
  useEffect(() => {
    if (defaultOptionValue !== null) onChange(defaultOptionValue);
  }, [defaultOptionValue]);

  if (fieldType === 'board_structure' && details?.structure_level) {
    return <BoardStructureValue level={details.structure_level} value={value} onChange={onChange} />;
  }

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
      <InlineTextDropdown
        value={value ?? ''}
        options={isYesNoDropdown && ariaLabel ? toYesNoStateOptions(options, ariaLabel) : toChoiceOptions(options)}
        placeholder={NOT_SET_LABEL}
        triggerClassName="business-rule-form-condition-label-btn br-condition-value-text"
        showChevron={!isYesNoDropdown}
        searchable={!isYesNoDropdown}
        onChange={onChange}
      />
    );
  }

  // Deadline / Last moved conditions: read "Not Set v" / "Not Moved v" until a date is chosen
  // from the same list.
  const dateEmptyLabel = getDateFieldEmptyLabel(details);
  if (dateEmptyLabel) {
    const hasDate = String(value ?? '') !== '' || isPickingDate;
    return (
      <div className="d-flex flex-column gap-2">
        <InlineTextDropdown
          value={hasDate ? SELECT_DATE_VALUE : ''}
          options={[{ value: '', label: dateEmptyLabel }, { value: SELECT_DATE_VALUE, label: SELECT_DATE_LABEL }]}
          placeholder={dateEmptyLabel}
          triggerClassName="business-rule-form-condition-label-btn br-condition-value-text"
          onChange={(next) => {
            setIsPickingDate(next === SELECT_DATE_VALUE);
            if (next === '') onChange('');
          }}
        />
        {hasDate && (
          <input
            type={fieldType === 'datetime' ? 'datetime-local' : 'date'}
            className="business-rule-form-condition-input"
            aria-label={ariaLabel}
            value={fieldType === 'datetime' ? toDateTimeLocal(value) : (value ?? '')}
            onChange={(e) => onChange(fieldType === 'datetime' ? fromDateTimeLocal(e.target.value) : e.target.value)}
          />
        )}
      </div>
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
