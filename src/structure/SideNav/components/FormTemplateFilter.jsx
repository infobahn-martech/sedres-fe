import { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FiTrash2 } from 'react-icons/fi';
import useFormTemplateReducer from '../../../store/FormTemplateReducer';
import SearchableSelect from '../../../components/form/SearchableSelect';

const ALL_TEMPLATES_LABEL = 'All templates';

// "Show fields from template" dropdown shown above every custom-field list. Custom fields are
// copied per form template, so the same field name repeats until one template is picked; the
// chosen template_id is sent with the custom-field request and is not saved with the rule.
// The choices come from form_template/all_templates and are labelled by template_desc.
function FormTemplateFilter({ show, value, onChange }) {
  const allTemplates = useFormTemplateReducer((s) => s.allTemplates);
  const getAllTemplates = useFormTemplateReducer((s) => s.getAllTemplates);

  useEffect(() => {
    if (show && allTemplates === null) getAllTemplates();
  }, [show, allTemplates]);

  const options = useMemo(
    () => (allTemplates ?? []).map((tpl) => ({
      value: String(tpl.template_id),
      label: tpl.template_desc || tpl.template_name,
    })),
    [allTemplates]
  );

  // With a single template there is nothing to choose, so it is picked automatically.
  useEffect(() => {
    if (show && options.length === 1 && value === '') onChange(options[0].value);
  }, [show, options, value]);

  return (
    <div className="br-property-board-filter flex-fill">
      <span className="br-property-board-filter-label">Show fields from template:</span>
      <div className="br-property-board-filter-row">
        <div className="flex-fill">
          <SearchableSelect
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={[{ value: '', label: ALL_TEMPLATES_LABEL }, ...options]}
            placeholder={ALL_TEMPLATES_LABEL}
            menuPortalTarget={document.body}
            menuPlacement="auto"
          />
        </div>
        <button
          type="button"
          className="br-property-board-clear-btn"
          onClick={() => onChange('')}
          aria-label="Reset template filter"
        >
          <FiTrash2 size={14} />
        </button>
      </div>
    </div>
  );
}

FormTemplateFilter.propTypes = {
  show: PropTypes.bool,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default FormTemplateFilter;
