import { useEffect, useId, useRef, useState } from 'react';
import { FiCheck, FiChevronDown, FiHash } from 'react-icons/fi';
import { LuArrowUpDown, LuBeaker, LuGauge, LuRuler, LuThermometer, LuWeight } from 'react-icons/lu';
import CopyButton from './CopyButton';
import { formatNumber } from './calculatorEngine';
import { UNIT_CATEGORIES, convert, getCategory, getUnit } from './unitConversions';

const CATEGORY_ICONS = {
  weight: LuWeight,
  length: LuRuler,
  volume: LuBeaker,
  speed: LuGauge,
  temperature: LuThermometer,
};

// Grouped for reading ("1,852"); copy/"use value" keep the raw number for pasting.
const displayFormatter = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 10 });
const formatDisplay = (value) => (Number.isFinite(value) ? displayFormatter.format(value) : '');

// Custom listbox instead of a native <select>, whose open list is drawn by the OS
// and can't be styled. Focus stays on the trigger; aria-activedescendant tracks
// the highlighted option for screen readers.
function UnitSelect({ units, value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef(null);
  const listId = useId();
  const selected = units.find((unit) => unit.id === value) ?? units[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (!wrapRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const open = () => {
    setActiveIndex(Math.max(units.findIndex((unit) => unit.id === value), 0));
    setIsOpen(true);
  };

  const choose = (unit) => {
    onChange(unit.id);
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        open();
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (index + step + units.length) % units.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(units[activeIndex]);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.stopPropagation();
      setIsOpen(false);
    }
  };

  return (
    <span className={`converter-unit ${isOpen ? 'is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="converter-unit-trigger"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
        aria-label={`${label}: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={isOpen ? `${listId}-${activeIndex}` : undefined}
      >
        <span className="converter-unit-text">
          {selected.label} <small>{selected.symbol}</small>
        </span>
        <FiChevronDown className="converter-unit-icon" aria-hidden />
      </button>

      {isOpen && (
        <ul className="converter-unit-menu" id={listId} role="listbox" aria-label={label}>
          {units.map((unit, index) => {
            const isSelected = unit.id === value;
            return (
              <li
                key={unit.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                className={`converter-unit-option ${isSelected ? 'is-selected' : ''} ${
                  index === activeIndex ? 'is-active' : ''
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(unit)}
              >
                <span>{unit.label}</span>
                <small>{unit.symbol}</small>
                {isSelected && <FiCheck className="converter-unit-check" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}

function UnitConverter({ calculatorValue }) {
  const [categoryId, setCategoryId] = useState(UNIT_CATEGORIES[0].id);
  const [fromId, setFromId] = useState(UNIT_CATEGORIES[0].units[0].id);
  const [toId, setToId] = useState(UNIT_CATEGORIES[0].units[1].id);
  const [amount, setAmount] = useState('1');

  const { units } = getCategory(categoryId);
  const value = parseFloat(amount);
  const result = Number.isFinite(value) ? convert(value, categoryId, fromId, toId) : NaN;
  const rate = convert(1, categoryId, fromId, toId);
  const fromUnit = getUnit(categoryId, fromId);
  const toUnit = getUnit(categoryId, toId);

  const handleCategoryChange = (id) => {
    const next = getCategory(id);
    setCategoryId(id);
    setFromId(next.units[0].id);
    setToId(next.units[1].id);
  };

  const handleSwap = () => {
    setFromId(toId);
    setToId(fromId);
  };

  return (
    <div className={`converter converter--${categoryId}`}>
      <div className="converter-categories" role="tablist" aria-label="Unit category">
        {UNIT_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.id];
          const isActive = category.id === categoryId;
          return (
            <button
              type="button"
              role="tab"
              key={category.id}
              aria-selected={isActive}
              title={category.label}
              className={`converter-category converter-category--${category.id} ${isActive ? 'is-active' : ''}`}
              onClick={() => handleCategoryChange(category.id)}
            >
              <Icon aria-hidden />
              <span>{category.shortLabel ?? category.label}</span>
            </button>
          );
        })}
      </div>

      <div className="converter-panels">
        <div className="converter-panel">
          <span className="converter-panel-head">
            <span className="converter-label">From</span>
            <UnitSelect units={units} value={fromId} onChange={setFromId} label="From unit" />
          </span>
          <input
            type="text"
            inputMode="decimal"
            className="converter-amount"
            value={amount}
            placeholder="0"
            onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
            onFocus={(e) => e.target.select()}
            aria-label="Amount"
          />
        </div>

        <button type="button" className="converter-swap" onClick={handleSwap} aria-label="Swap units" title="Swap units">
          <LuArrowUpDown />
        </button>

        <div className="converter-panel converter-panel--result">
          <span className="converter-panel-head">
            <span className="converter-label">To</span>
            <UnitSelect units={units} value={toId} onChange={setToId} label="To unit" />
          </span>
          <span className="converter-result-row" aria-live="polite">
            <output className="converter-amount" title={formatDisplay(result)}>
              {formatDisplay(result) || '—'}
            </output>
            <CopyButton text={Number.isFinite(result) ? formatNumber(result) : ''} />
          </span>
        </div>
      </div>

      <div className="converter-footer">
        <span className="converter-rate">
          1 {fromUnit.symbol} = {formatDisplay(rate)} {toUnit.symbol}
        </span>
        {Number.isFinite(calculatorValue) && (
          <button
            type="button"
            className="converter-chip"
            onClick={() => setAmount(formatNumber(calculatorValue))}
            title="Use the calculator's current value"
          >
            <FiHash aria-hidden />
            Use {formatDisplay(calculatorValue)}
          </button>
        )}
      </div>

      <section className="converter-all" aria-label="All unit conversions">
        <span className="converter-label">
          {Number.isFinite(value) ? `${formatDisplay(value)} ${fromUnit.symbol} in other units` : 'Other units'}
        </span>
        <ul className="converter-all-list">
          {units
            .filter((unit) => unit.id !== fromId)
            .map((unit) => {
              const converted = Number.isFinite(value) ? convert(value, categoryId, fromId, unit.id) : NaN;
              const isActive = unit.id === toId;
              return (
                <li key={unit.id}>
                  <button
                    type="button"
                    className={`converter-all-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => setToId(unit.id)}
                    aria-pressed={isActive}
                    title={`Convert to ${unit.label}`}
                  >
                    <span className="converter-all-unit">{unit.label}</span>
                    <span className="converter-all-value">
                      {formatDisplay(converted) || '—'}
                      <small>{unit.symbol}</small>
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}

export default UnitConverter;
