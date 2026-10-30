import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { FiClock, FiDelete, FiHash } from 'react-icons/fi';
import { LuArrowRightLeft } from 'react-icons/lu';
import ToolModal from './ToolModal';
import CopyButton from './CopyButton';
import UnitConverter from './UnitConverter';
import { useCalculatorStore } from '../../store/calculatorStore';
import {
  FUNCTION_CALL_AT_END,
  MAX_EXPRESSION_LENGTH,
  completeExpression,
  endsWithOperator,
  evaluate,
  formatNumber,
  groupDigits,
  isOperandEnd,
  numberToWords,
  openParenCount,
  prettify,
  splitLastOperand,
  toOperand,
} from './calculatorEngine';

const initialState = { expr: '', answer: null, lastExpression: '', error: false, evalId: 0 };

// evalId survives resets so the history effect can tell a new "=" from a re-render.
const fresh = (state, expr) => ({ ...initialState, evalId: state.evalId, expr });

const append = (state, text) =>
  state.expr.length + text.length > MAX_EXPRESSION_LENGTH ? state : { ...state, expr: state.expr + text };

// Function keys (√, sin, log…) wrap the last operand, or open "fn(" when there is none.
function applyUnary(state, type, fn) {
  const base = state.answer !== null ? toOperand(state.answer) : state.expr;
  const { head, operand } = splitLastOperand(base);
  if (!operand) {
    return type === 'function' && state.answer === null ? append(state, `${fn}(`) : state;
  }
  if (type === 'function') {
    const isGroup = operand.startsWith('(') && operand.endsWith(')');
    return fresh(state, head + (isGroup ? `${fn}${operand}` : `${fn}(${operand})`));
  }
  return fresh(state, head + (type === 'square' ? `${operand}^2` : `(1/${operand})`));
}

function toggleSign(state) {
  if (state.answer !== null) return { ...state, answer: formatNumber(-parseFloat(state.answer)) };
  const { head, operand } = splitLastOperand(state.expr);
  if (!operand) return state;
  if (/^\(-[^()+\-*/^]*\)$/.test(operand)) return { ...state, expr: head + operand.slice(2, -1) };
  const hasUnaryMinus = head.endsWith('-') && (head.length === 1 || /[+\-*/^(]$/.test(head.slice(0, -1)));
  if (hasUnaryMinus) return { ...state, expr: head.slice(0, -1) + operand };
  return { ...state, expr: head ? `${head}(-${operand})` : `-${operand}` };
}

function reducer(state, action) {
  const isFresh = state.answer !== null || state.error;

  switch (action.type) {
    case 'digit':
      if (isFresh) return fresh(state, action.value);
      if (/(?:^|[^\d.])0$/.test(state.expr)) return { ...state, expr: state.expr.slice(0, -1) + action.value };
      return append(state, action.value);
    case 'dot': {
      if (isFresh) return fresh(state, '0.');
      const trailing = state.expr.match(/[\d.]*$/)[0];
      if (trailing.includes('.')) return state;
      return append(state, trailing ? '.' : '0.');
    }
    case 'operator': {
      if (state.error) return state;
      const base = state.answer ?? state.expr;
      const op = action.value;
      if (!base || base.endsWith('(')) return op === '-' ? append(fresh(state, base), '-') : state;
      if (endsWithOperator(base)) {
        if (op === '-' && /[*/^]$/.test(base)) return append(fresh(state, base), '-');
        const stripped = base.replace(/[+\-*/^]+$/, '');
        return isOperandEnd(stripped) ? fresh(state, stripped + op) : state;
      }
      return append(fresh(state, base), op);
    }
    case 'lparen':
      return isFresh ? fresh(state, '(') : append(state, '(');
    case 'rparen':
      if (isFresh || openParenCount(state.expr) <= 0 || !isOperandEnd(state.expr)) return state;
      return append(state, ')');
    case 'constant':
      return isFresh ? fresh(state, action.value) : append(state, action.value);
    case 'percent': {
      if (state.error) return state;
      const base = state.answer ?? state.expr;
      if (!isOperandEnd(base) || base.endsWith('%')) return state;
      return fresh(state, `${base}%`);
    }
    case 'function':
    case 'square':
    case 'reciprocal':
      return state.error ? state : applyUnary(state, action.type, action.value);
    case 'sign':
      return state.error ? state : toggleSign(state);
    case 'backspace':
      if (state.error) return fresh(state, '');
      if (state.answer !== null) return state;
      return { ...state, expr: state.expr.slice(0, -(state.expr.match(FUNCTION_CALL_AT_END)?.[0].length ?? 1)) };
    case 'clear':
      return fresh(state, '');
    case 'equals': {
      if (isFresh || !state.expr) return state;
      const expression = completeExpression(state.expr);
      const result = evaluate(expression, { angleUnit: action.angleUnit });
      if (result === null) return state;
      if (!Number.isFinite(result)) return { ...fresh(state, ''), error: true, lastExpression: expression };
      return { ...fresh(state, ''), answer: formatNumber(result), lastExpression: expression, evalId: state.evalId + 1 };
    }
    case 'insert': {
      if (isFresh || !state.expr) return fresh(state, action.value);
      if (/[+\-*/^(]$/.test(state.expr)) return append(state, toOperand(action.value));
      return { ...state, expr: splitLastOperand(state.expr).head + toOperand(action.value) };
    }
    case 'load':
      return { ...fresh(state, ''), answer: action.result, lastExpression: action.expression };
    default:
      return state;
  }
}

const op = (label, value) => ({ label, action: { type: 'operator', value }, variant: 'operator' });
const digit = (value) => ({ label: value, action: { type: 'digit', value } });

const BASIC_KEYS = [
  { label: 'C', action: { type: 'clear' }, variant: 'clear' },
  { label: '±', action: { type: 'sign' }, variant: 'muted' },
  { label: '%', action: { type: 'percent' }, variant: 'muted' },
  op('÷', '/'),
  digit('7'), digit('8'), digit('9'), op('×', '*'),
  digit('4'), digit('5'), digit('6'), op('−', '-'),
  digit('1'), digit('2'), digit('3'), op('+', '+'),
  { label: <FiDelete />, ariaLabel: 'Backspace', action: { type: 'backspace' }, variant: 'back' },
  digit('0'),
  { label: '.', action: { type: 'dot' } },
  { label: '=', action: { type: 'equals' }, variant: 'equals' },
];

const fn = (label, value, ariaLabel) => ({ label, ariaLabel, action: { type: 'function', value } });

// 7 × 2 grid; the angle key is handled outside the reducer (it's a store setting).
const SCIENTIFIC_KEYS = [
  fn('sin', 'sin', 'Sine'),
  fn('cos', 'cos', 'Cosine'),
  fn('tan', 'tan', 'Tangent'),
  fn('log', 'log', 'Log base 10'),
  fn('ln', 'ln', 'Natural log'),
  { label: '(', action: { type: 'lparen' } },
  { label: ')', action: { type: 'rparen' } },
  { label: 'xʸ', ariaLabel: 'Power', action: { type: 'operator', value: '^' } },
  fn('√', '√', 'Square root'),
  { label: 'x²', ariaLabel: 'Square', action: { type: 'square' } },
  { label: '1/x', ariaLabel: 'Reciprocal', action: { type: 'reciprocal' } },
  { label: 'π', ariaLabel: 'Pi', action: { type: 'constant', value: 'π' } },
  { label: 'e', ariaLabel: 'Euler number', action: { type: 'constant', value: 'ℯ' } },
  { label: 'angle', ariaLabel: 'Toggle degrees / radians', action: { type: 'angle' } },
];

const MODES = [
  { id: 'basic', label: 'Basic' },
  { id: 'scientific', label: 'Scientific' },
];

const TABS = [
  { id: 'calculator', label: 'Calculator', icon: <FiHash /> },
  { id: 'converter', label: 'Converter', icon: <LuArrowRightLeft /> },
];

const keyToAction = (key) => {
  if (/^\d$/.test(key)) return { type: 'digit', value: key };
  if (key === '.' || key === ',') return { type: 'dot' };
  if (['+', '-', '*', '/', '^'].includes(key)) return { type: 'operator', value: key };
  if (key === '(') return { type: 'lparen' };
  if (key === ')') return { type: 'rparen' };
  if (key === 'Enter' || key === '=') return { type: 'equals' };
  if (key === 'Backspace') return { type: 'backspace' };
  if (key === 'Delete' || key.toLowerCase() === 'c') return { type: 'clear' };
  if (key === '%') return { type: 'percent' };
  return null;
};

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="tool-segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          role="tab"
          key={option.id}
          aria-selected={option.id === value}
          className={`tool-segmented-btn ${option.id === value ? 'is-active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CalculatorModal({ show, onClose }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showHistory, setShowHistory] = useState(false);
  const {
    history,
    memory,
    mode,
    angleUnit,
    activeTab,
    addHistory,
    clearHistory,
    setMemory,
    setMode,
    toggleAngleUnit,
    setActiveTab,
  } = useCalculatorStore();
  const loggedEvalId = useRef(state.evalId);
  const valueRef = useRef(null);

  const isCalculatorTab = activeTab === 'calculator';
  const isScientific = mode === 'scientific';

  useEffect(() => {
    if (!show || !isCalculatorTab) return undefined;
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // The window is non-modal, so only take keys while focus is inside it —
      // otherwise typing elsewhere on the page (e.g. an open card) would feed the calculator.
      if (!event.target.closest?.('.calculator-modal')) return;
      if (event.target.closest?.('input, select, textarea')) return;
      const action = keyToAction(event.key);
      if (!action) return;
      event.preventDefault();
      dispatch({ ...action, angleUnit });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show, isCalculatorTab, angleUnit]);

  useEffect(() => {
    if (state.evalId === loggedEvalId.current) return;
    loggedEvalId.current = state.evalId;
    addHistory({ expression: state.lastExpression, result: state.answer });
  }, [state.evalId, state.lastExpression, state.answer, addHistory]);

  // Keep the end of a long expression in view as it grows.
  useLayoutEffect(() => {
    if (valueRef.current) valueRef.current.scrollLeft = valueRef.current.scrollWidth;
  }, [state.expr, state.answer]);

  const preview = state.answer === null && !state.error ? evaluate(state.expr, { angleUnit }) : null;
  const previewText = Number.isFinite(preview) ? formatNumber(preview) : '';
  const currentValue = state.answer !== null ? parseFloat(state.answer) : Number.isFinite(preview) ? preview : null;

  let expressionLine = previewText && previewText !== state.expr ? `= ${groupDigits(previewText)}` : '';
  if (state.answer !== null || state.error) expressionLine = `${prettify(state.lastExpression)} =`;
  const valueLine = state.error ? 'Error' : state.answer !== null ? groupDigits(state.answer) : prettify(state.expr) || '0';
  const amountInWords = currentValue === null ? '' : numberToWords(currentValue);
  const activeOperator = state.answer === null ? state.expr.slice(-1) : null;

  const handleMemoryAdd = (sign) => {
    if (currentValue === null) return;
    setMemory((memory ?? 0) + sign * currentValue);
  };

  const handleHistorySelect = (entry) => {
    dispatch({ type: 'load', expression: entry.expression, result: entry.result });
    setShowHistory(false);
  };

  const run = (action) => (action.type === 'angle' ? toggleAngleUnit() : dispatch({ ...action, angleUnit }));

  const renderKey = ({ label, ariaLabel, action, variant }) => (
    <button
      type="button"
      key={ariaLabel || label}
      aria-label={ariaLabel}
      className={`calculator-key ${variant ? `calculator-key--${variant}` : ''} ${
        action.type === 'operator' && action.value === activeOperator ? 'is-active' : ''
      }`}
      onClick={() => run(action)}
    >
      {action.type === 'angle' ? angleUnit.toUpperCase() : label}
    </button>
  );

  return (
    <ToolModal show={show} onClose={onClose} title="Calculator" icon={<FiHash />} className="calculator-modal">
      <Segmented options={TABS} value={activeTab} onChange={setActiveTab} label="Calculator tools" />

      {isCalculatorTab ? (
        <>
          <div className="calculator-toolbar">
            <Segmented options={MODES} value={mode} onChange={setMode} label="Calculator mode" />
            <div className="calculator-toolbar-actions">
              <button
                type="button"
                className={`calculator-icon-btn ${showHistory ? 'is-active' : ''}`}
                onClick={() => setShowHistory((v) => !v)}
                aria-label="History"
                aria-pressed={showHistory}
                title="History"
              >
                <FiClock />
              </button>
              <CopyButton text={currentValue === null ? '' : formatNumber(currentValue)} />
            </div>
          </div>

          <div className="calculator-display" aria-live="polite">
            <div className="calculator-flags">
              {memory !== null && <span title={`Memory: ${groupDigits(formatNumber(memory))}`}>M</span>}
              {isScientific && <span title="Angle unit">{angleUnit.toUpperCase()}</span>}
            </div>
            <div className="calculator-expression" title={expressionLine}>{expressionLine || ' '}</div>
            <div
              ref={valueRef}
              className={`calculator-value ${valueLine.length > 14 ? 'is-long' : ''}`}
              title={valueLine}
            >
              {valueLine}
            </div>
            <div className="calculator-words" title={amountInWords}>{amountInWords || ' '}</div>
          </div>

          {showHistory ? (
            <div className="calculator-history">
              <div className="calculator-history-head">
                <span>History</span>
                {history.length > 0 && (
                  <button type="button" className="tool-link-btn" onClick={clearHistory}>
                    Clear
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="tool-state">No calculations yet.</p>
              ) : (
                <ul className="calculator-history-list">
                  {history.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" className="calculator-history-item" onClick={() => handleHistorySelect(entry)}>
                        <span className="calculator-history-expression">{prettify(entry.expression)} =</span>
                        <span className="calculator-history-result">{groupDigits(entry.result)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="calculator-memory">
                <button type="button" className="calculator-memory-btn" onClick={() => setMemory(null)} disabled={memory === null} title="Memory clear">
                  MC
                </button>
                <button
                  type="button"
                  className="calculator-memory-btn"
                  onClick={() => run({ type: 'insert', value: formatNumber(memory) })}
                  disabled={memory === null}
                  title="Memory recall"
                >
                  MR
                </button>
                <button type="button" className="calculator-memory-btn" onClick={() => handleMemoryAdd(1)} disabled={currentValue === null} title="Memory add">
                  M+
                </button>
                <button type="button" className="calculator-memory-btn" onClick={() => handleMemoryAdd(-1)} disabled={currentValue === null} title="Memory subtract">
                  M−
                </button>
              </div>

              {isScientific && (
                <div className="calculator-keys calculator-keys--scientific">
                  {SCIENTIFIC_KEYS.map((key) => renderKey({ ...key, variant: 'fn' }))}
                </div>
              )}
              <div className="calculator-keys">{BASIC_KEYS.map(renderKey)}</div>
            </>
          )}

          <p className="tool-modal-hint">Tip: you can type with your keyboard.</p>
        </>
      ) : (
        <UnitConverter calculatorValue={currentValue} />
      )}
    </ToolModal>
  );
}

export default CalculatorModal;
