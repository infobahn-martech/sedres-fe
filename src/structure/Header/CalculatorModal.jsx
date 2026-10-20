import { useEffect, useReducer } from 'react';
import { FiDelete, FiHash } from 'react-icons/fi';
import ToolModal from './ToolModal';

const ERROR = 'Error';
const MAX_DIGITS = 16;
const OPERATOR_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

const initialState = { display: '0', stored: null, operator: null, waiting: false, expression: '' };

const format = (value) => (Number.isFinite(value) ? String(parseFloat(value.toPrecision(12))) : ERROR);

const compute = (a, b, operator) => {
  if (operator === '+') return a + b;
  if (operator === '-') return a - b;
  if (operator === '*') return a * b;
  return b === 0 ? NaN : a / b;
};

// A small state machine instead of eval() — no arbitrary code execution.
function reducer(state, action) {
  const isError = state.display === ERROR;

  switch (action.type) {
    case 'digit': {
      if (state.waiting || isError) {
        return { ...(isError ? initialState : state), display: action.value, waiting: false };
      }
      if (state.display.replace(/[-.]/g, '').length >= MAX_DIGITS) return state;
      return { ...state, display: state.display === '0' ? action.value : state.display + action.value };
    }
    case 'dot': {
      if (state.waiting || isError) {
        return { ...(isError ? initialState : state), display: '0.', waiting: false };
      }
      return state.display.includes('.') ? state : { ...state, display: `${state.display}.` };
    }
    case 'operator': {
      if (isError) return state;
      const value = parseFloat(state.display);
      let stored = value;
      if (state.operator && !state.waiting) {
        stored = compute(state.stored, value, state.operator);
        if (!Number.isFinite(stored)) return { ...initialState, display: ERROR };
      } else if (state.stored !== null && state.waiting) {
        stored = state.stored;
      }
      return {
        display: format(stored),
        stored,
        operator: action.value,
        waiting: true,
        expression: `${format(stored)} ${OPERATOR_SYMBOLS[action.value]}`,
      };
    }
    case 'equals': {
      if (isError || !state.operator) return state;
      const value = parseFloat(state.display);
      const result = compute(state.stored, value, state.operator);
      return {
        ...initialState,
        display: format(result),
        waiting: true,
        expression: `${format(state.stored)} ${OPERATOR_SYMBOLS[state.operator]} ${format(value)} =`,
      };
    }
    case 'percent':
      return isError ? state : { ...state, display: format(parseFloat(state.display) / 100), waiting: false };
    case 'sign':
      if (isError || state.display === '0') return state;
      return {
        ...state,
        display: state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`,
      };
    case 'backspace': {
      if (state.waiting || isError) return state;
      const next = state.display.slice(0, -1);
      return { ...state, display: next === '' || next === '-' ? '0' : next };
    }
    case 'clear':
      return initialState;
    default:
      return state;
  }
}

const KEYS = [
  { label: 'C', action: { type: 'clear' }, variant: 'muted' },
  { label: '±', action: { type: 'sign' }, variant: 'muted' },
  { label: '%', action: { type: 'percent' }, variant: 'muted' },
  { label: '÷', action: { type: 'operator', value: '/' }, variant: 'operator' },
  { label: '7', action: { type: 'digit', value: '7' } },
  { label: '8', action: { type: 'digit', value: '8' } },
  { label: '9', action: { type: 'digit', value: '9' } },
  { label: '×', action: { type: 'operator', value: '*' }, variant: 'operator' },
  { label: '4', action: { type: 'digit', value: '4' } },
  { label: '5', action: { type: 'digit', value: '5' } },
  { label: '6', action: { type: 'digit', value: '6' } },
  { label: '−', action: { type: 'operator', value: '-' }, variant: 'operator' },
  { label: '1', action: { type: 'digit', value: '1' } },
  { label: '2', action: { type: 'digit', value: '2' } },
  { label: '3', action: { type: 'digit', value: '3' } },
  { label: '+', action: { type: 'operator', value: '+' }, variant: 'operator' },
  { label: <FiDelete />, ariaLabel: 'Backspace', action: { type: 'backspace' } },
  { label: '0', action: { type: 'digit', value: '0' } },
  { label: '.', action: { type: 'dot' } },
  { label: '=', action: { type: 'equals' }, variant: 'equals' },
];

const keyToAction = (key) => {
  if (/^\d$/.test(key)) return { type: 'digit', value: key };
  if (key === '.' || key === ',') return { type: 'dot' };
  if (['+', '-', '*', '/'].includes(key)) return { type: 'operator', value: key };
  if (key === 'Enter' || key === '=') return { type: 'equals' };
  if (key === 'Backspace') return { type: 'backspace' };
  if (key === 'Delete' || key.toLowerCase() === 'c') return { type: 'clear' };
  if (key === '%') return { type: 'percent' };
  return null;
};

function CalculatorModal({ show, onClose }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!show) return undefined;
    const handleKeyDown = (event) => {
      const action = keyToAction(event.key);
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show]);

  const activeOperator = state.waiting ? state.operator : null;

  return (
    <ToolModal show={show} onClose={onClose} title="Calculator" icon={<FiHash />} className="calculator-modal">
      <div className="calculator-display" aria-live="polite">
        <div className="calculator-expression">{state.expression || ' '}</div>
        <div className="calculator-value" title={state.display}>{state.display}</div>
      </div>
      <div className="calculator-keys">
        {KEYS.map(({ label, ariaLabel, action, variant }) => (
          <button
            type="button"
            key={ariaLabel || label}
            aria-label={ariaLabel}
            className={`calculator-key ${variant ? `calculator-key--${variant}` : ''} ${
              action.type === 'operator' && action.value === activeOperator ? 'is-active' : ''
            }`}
            onClick={() => dispatch(action)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="tool-modal-hint">Tip: you can type with your keyboard.</p>
    </ToolModal>
  );
}

export default CalculatorModal;
