import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiChevronDown } from 'react-icons/fi';
import SedresColorPicker from '../../../components/SedresColorPicker/SedresColorPicker';
import { normalizeHexColor } from '../../../components/SedresColorPicker/sedresColorPickerConstants';

const SELECT_COLOR_LABEL = 'Select color';

// Colour value of a THEN field ("Set color to"): the picked colour as a swatch and its hex, which
// opens the shared Sedres colour picker. The value is the normalised hex string.
function ColorValueDropdown({ value, ariaLabel = 'Pick color', onChange }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const hex = value ? normalizeHexColor(value) : '';

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  return (
    <div className="board-minimap-picker-wrap br-color-condition-wrap">
      <button
        type="button"
        ref={triggerRef}
        className="br-color-condition-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg className="br-color-condition-swatch" viewBox="0 0 18 18" aria-hidden>
          <circle cx="9" cy="9" r="9" fill={hex || 'none'} />
        </svg>
        <span className="br-color-condition-hex">{hex || SELECT_COLOR_LABEL}</span>
        <FiChevronDown size={14} aria-hidden />
      </button>

      {open && (
        <div className="board-minimap-picker-panel br-color-condition-panel">
          <SedresColorPicker
            popoverRef={panelRef}
            initialHex={hex || undefined}
            onApply={(next) => { onChange(normalizeHexColor(next)); setOpen(false); }}
            onCancel={() => setOpen(false)}
            ariaLabel={ariaLabel}
          />
        </div>
      )}
    </div>
  );
}

ColorValueDropdown.propTypes = {
  value: PropTypes.string,
  ariaLabel: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

export default ColorValueDropdown;
