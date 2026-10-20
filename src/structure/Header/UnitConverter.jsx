import { useState } from 'react';
import { FiChevronDown, FiHash } from 'react-icons/fi';
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

function UnitSelect({ units, value, onChange, label }) {
  return (
    <span className="converter-unit">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.label} ({unit.symbol})
          </option>
        ))}
      </select>
      <FiChevronDown className="converter-unit-icon" aria-hidden />
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
    <div className="converter">
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
              className={`converter-category ${isActive ? 'is-active' : ''}`}
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
    </div>
  );
}

export default UnitConverter;
