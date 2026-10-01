import PropTypes from 'prop-types';
import closeIcon from '../assets/images/icon-close.svg';

function CommonFilter({ 
  filters = [], 
  filterValues = {}, 
  onFilterChange, 
  onApplyFilter, 
  onClearFilter 
}) {
  const handleFilterChange = (key, value) => {
    if (onFilterChange) {
      onFilterChange(key, value);
    }
  };

  const handleApply = () => {
    if (onApplyFilter) {
      onApplyFilter();
    }
  };

  const handleClear = () => {
    if (onClearFilter) {
      onClearFilter();
    }
  };

  if (!filters || filters.length === 0) {
    return null;
  }

  return (
    <div className="collapse show" id="filtersInputs" >
      <div className="filters-inputs-wrp">
        <div className="row w-100">
          {filters.map((filter) => (
            <div key={filter.key} className="col-xl col-lg-6 col-sm-12 my-1">
              <div className="form-floating">
                <select
                  className="form-select"
                  id={`floating${filter.key}`}
                  value={filterValues[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                >
                  <option value="">{filter.placeholder || `Select ${filter.label}`}</option>
                  {filter.options?.map((option) => {
                    const value = typeof option === 'object' ? option.value : option;
                    const label = typeof option === 'object' ? option.label : option;
                    return (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <label htmlFor={`floating${filter.key}`}>{filter.label}</label>
              </div>
            </div>
          ))}

          {/* Buttons */}
          <div className="col-xl-auto col-lg-6 col-sm-12 my-1">
            <div className="inp-wrp">
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={handleApply}
              >
                Apply Filter
              </button>
              <button 
                type="button"
                className="btn btn-outline-danger"
                onClick={handleClear}
              >
                <img src={closeIcon} alt="close" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

CommonFilter.propTypes = {
  filters: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      placeholder: PropTypes.string,
      options: PropTypes.array.isRequired,
    })
  ),
  filterValues: PropTypes.object,
  onFilterChange: PropTypes.func,
  onApplyFilter: PropTypes.func,
  onClearFilter: PropTypes.func,
};

export default CommonFilter;
