import { Fragment, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiChevronDown, FiFilter } from 'react-icons/fi';
import OptionColorBadge from './OptionColorBadge';

// Text-style dropdown ("Deadline is in v", "Blocked"): the selected option reads as plain text
// and clicking it opens a compact list. Uses the same trigger / panel classes as the AND
// condition operator picker, so it needs no styles of its own. Options may carry a colour and
// icon (types, stickers, blockers) which are drawn as the same chip as on the card.
function InlineTextDropdown({ value, options, placeholder, triggerClassName, triggerPrefix = '', showChevron = true, searchable = false, onChange }) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const selected = options.find((o) => o.value === String(value ?? ''));
  const filterQuery = filterText.trim().toLowerCase();
  const visibleOptions = filterQuery ? options.filter((o) => o.label.toLowerCase().includes(filterQuery)) : options;

  const handleToggle = () => {
    setFilterText('');
    setOpen((prev) => !prev);
  };

  return (
    <div className="board-minimap-picker-wrap br-condition-operator-wrap" ref={wrapRef}>
      <button
        type="button"
        className={triggerClassName}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {triggerPrefix}{selected?.label ?? placeholder}
        {showChevron && <FiChevronDown size={14} aria-hidden />}
      </button>

      {open && (
        <div className="board-minimap-picker-panel br-condition-operator-panel">
          {searchable && (
            <div className="board-minimap-picker-search">
              <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
              <input
                type="text"
                placeholder="Filter"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div className="board-minimap-picker-scroll">
            {visibleOptions.length === 0 ? (
              <div className="br-property-picker-empty">No matches</div>
            ) : (
              visibleOptions.map((option, index) => (
                <Fragment key={option.value}>
                  {option.group && option.group !== visibleOptions[index - 1]?.group && (
                    <div className="br-inline-dropdown-group">{option.group}</div>
                  )}
                  <button
                    type="button"
                    className="br-condition-operator-option d-flex align-items-center gap-2"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    {(option.colorCode || option.iconName) && (
                      <OptionColorBadge colorCode={option.colorCode} iconName={option.iconName} />
                    )}
                    {option.label}
                  </button>
                </Fragment>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

InlineTextDropdown.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string,
    label: PropTypes.string,
    colorCode: PropTypes.string,
    iconName: PropTypes.string,
    group: PropTypes.string,
  })).isRequired,
  placeholder: PropTypes.string,
  triggerClassName: PropTypes.string,
  triggerPrefix: PropTypes.string,
  showChevron: PropTypes.bool,
  searchable: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};

export default InlineTextDropdown;
