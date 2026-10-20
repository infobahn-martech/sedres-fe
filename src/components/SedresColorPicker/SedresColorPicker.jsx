import { useEffect, useId, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import {
  DEFAULT_PICKER_COLOR,
  PRIMARY_PRESET_COLORS,
  SECONDARY_PRESET_COLORS,
  normalizeHexColor,
} from './sedresColorPickerConstants';

/**
 * Shared Sedres color picker (presets, advanced HexColorPicker, hex field, preview, Apply/Cancel).
 * Styling uses global classes from `sidebar.scss` (kanban-dashboard-color-picker-*).
 */
function SedresColorPicker({
  initialHex,
  onApply,
  onCancel,
  onRemove,
  darkMode = false,
  ariaLabel = 'Pick color',
  hexInputId: hexInputIdProp,
  className = '',
  popoverRef: popoverRefProp,
  popoverId,
}) {
  const generatedId = useId();
  const hexInputId = hexInputIdProp ?? `sedres-color-hex-${generatedId}`;
  const internalPopoverRef = useRef(null);
  const popoverRef = popoverRefProp ?? internalPopoverRef;
  const colorHexInputRef = useRef(null);
  const [pickerColor, setPickerColor] = useState(() => normalizeHexColor(initialHex));
  const [isAdvancedPaletteOpen, setIsAdvancedPaletteOpen] = useState(false);

  useEffect(() => {
    setPickerColor(normalizeHexColor(initialHex));
    setIsAdvancedPaletteOpen(false);
  }, [initialHex]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  useEffect(() => {
    colorHexInputRef.current?.focus();
    colorHexInputRef.current?.select();
  }, []);

  const handlePresetClick = (hex) => {
    setPickerColor(normalizeHexColor(hex));
  };

  const handleHexInputChange = (nextValue) => {
    if (nextValue === '#') {
      setPickerColor('#');
      return;
    }
    const sanitized = nextValue.replace(/[^0-9a-fA-F#]/g, '').slice(0, 7);
    if (!sanitized) {
      setPickerColor('#');
      return;
    }
    setPickerColor(sanitized.startsWith('#') ? sanitized : `#${sanitized}`);
  };

  const handleApply = () => {
    onApply(normalizeHexColor(pickerColor));
  };

  return (
    <div
      ref={popoverRef}
      id={popoverId}
      className={`kanban-dashboard-color-picker-popover ${darkMode ? 'kanban-dashboard-color-picker-popover--dark' : ''} ${className}`.trim()}
      role="dialog"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="kanban-dashboard-color-picker-row">
        {PRIMARY_PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`kanban-dashboard-color-dot ${normalizeHexColor(pickerColor) === normalizeHexColor(color) ? 'is-active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => handlePresetClick(color)}
            aria-label={`Choose color ${color}`}
          />
        ))}
      </div>

      {isAdvancedPaletteOpen && (
        <div className="kanban-dashboard-color-picker-secondary-grid">
          {SECONDARY_PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`kanban-dashboard-color-dot kanban-dashboard-color-dot--secondary ${normalizeHexColor(pickerColor) === normalizeHexColor(color) ? 'is-active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => handlePresetClick(color)}
              aria-label={`Choose shade ${color}`}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="kanban-dashboard-color-picker-toggle"
        onClick={() => setIsAdvancedPaletteOpen((v) => !v)}
        aria-expanded={isAdvancedPaletteOpen}
      >
        {isAdvancedPaletteOpen ? 'Hide advanced palette' : 'Show advanced palette'}
      </button>

      {isAdvancedPaletteOpen && (
        <div className="kanban-dashboard-color-picker-advanced">
          <HexColorPicker color={normalizeHexColor(pickerColor)} onChange={setPickerColor} />
        </div>
      )}

      <div className="kanban-dashboard-color-picker-input-row">
        <label htmlFor={hexInputId} className="kanban-dashboard-color-picker-hex-label">
          HEX
        </label>
        <input
          id={hexInputId}
          ref={colorHexInputRef}
          type="text"
          value={pickerColor}
          onChange={(event) => handleHexInputChange(event.target.value)}
          className="kanban-dashboard-color-picker-hex-input"
          aria-label="Hex color value"
        />
        <span
          className="kanban-dashboard-color-picker-preview"
          style={{ backgroundColor: normalizeHexColor(pickerColor) }}
          aria-label={`Selected color preview ${normalizeHexColor(pickerColor)}`}
        />
      </div>

      <div className="kanban-dashboard-color-picker-actions">
        {onRemove ? (
          <button
            type="button"
            className="kanban-dashboard-color-picker-btn kanban-dashboard-color-picker-btn--remove"
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
        <button
          type="button"
          className="kanban-dashboard-color-picker-btn kanban-dashboard-color-picker-btn--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="kanban-dashboard-color-picker-btn kanban-dashboard-color-picker-btn--primary"
          onClick={handleApply}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export default SedresColorPicker;
