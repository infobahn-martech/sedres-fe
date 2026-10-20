// Calculator math + expression editing — pure functions, no eval().
// Internal expression syntax: digits, '.', + - * / ^, ( ), prefix functions
// ('√', sin, cos, tan, log, ln — always followed by '('), '%' postfix,
// 'π' and 'ℯ' (Euler — kept distinct from the 'e' of exponent notation like 1e+21).

export const MAX_EXPRESSION_LENGTH = 64;

const NUMBER_AT_START = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/;
const OPERAND_AT_END = /(?:\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+|π|ℯ)$/;
const FUNCTION_AT_START = /^(?:sin|cos|tan|log|ln|√)/;
const FUNCTION_AT_END = /(?:sin|cos|tan|log|ln|√)$/;
export const FUNCTION_CALL_AT_END = /(?:sin|cos|tan|log|ln|√)\($/;
const INCOMPLETE_TAIL = /(?:[+\-*/^√]|(?:sin|cos|tan|log|ln)?\()+$/;
const DISPLAY_SYMBOLS = { '*': '×', '/': '÷', '-': '−', ℯ: 'e' };

// Floating-point noise like sin(π) = 1.2e-16 is shown as 0.
const TRIG_EPSILON = 1e-12;
const cleanTrig = (value) => (Math.abs(value) < TRIG_EPSILON ? 0 : value);

const buildFunctions = (angleUnit) => {
  const toRadians = angleUnit === 'deg' ? (x) => (x * Math.PI) / 180 : (x) => x;
  return {
    '√': Math.sqrt,
    sin: (x) => cleanTrig(Math.sin(toRadians(x))),
    cos: (x) => cleanTrig(Math.cos(toRadians(x))),
    // tan is undefined at 90° + k·180°; Math.tan would return ~1.6e16 instead.
    tan: (x) => (angleUnit === 'deg' && Math.abs(x % 180) === 90 ? NaN : cleanTrig(Math.tan(toRadians(x)))),
    log: Math.log10,
    ln: Math.log,
  };
};

export const isOperandEnd = (expr) => /[\d.)πℯ%]$/.test(expr);
export const endsWithOperator = (expr) => /[+\-*/^]$/.test(expr);
export const openParenCount = (expr) => (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;

// Negative values are parenthesized when spliced into the middle of an expression.
export const toOperand = (value) => (value.startsWith('-') ? `(${value})` : value);

export const formatNumber = (value) => {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = parseFloat(value.toPrecision(12));
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

// Drops a dangling operator / open paren and closes any unbalanced parentheses,
// so "5+" and "(2+3" are still evaluable.
export const completeExpression = (expr) => {
  const trimmed = expr.replace(INCOMPLETE_TAIL, '');
  const missing = openParenCount(trimmed);
  return missing > 0 ? trimmed + ')'.repeat(missing) : trimmed;
};

// Splits off the last operand (number, constant, or parenthesized group incl. a
// leading function and trailing %) so unary keys (functions, x², 1/x, ±) can wrap it.
export function splitLastOperand(expr) {
  let end = expr.length;
  while (end > 0 && expr[end - 1] === '%') end -= 1;

  if (expr[end - 1] === ')') {
    let depth = 0;
    let start = end - 1;
    for (; start >= 0; start -= 1) {
      if (expr[start] === ')') depth += 1;
      if (expr[start] === '(') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (start < 0) return { head: expr, operand: '' };
    const fn = expr.slice(0, start).match(FUNCTION_AT_END);
    if (fn) start -= fn[0].length;
    return { head: expr.slice(0, start), operand: expr.slice(start) };
  }

  const match = expr.slice(0, end).match(OPERAND_AT_END);
  if (!match) return { head: expr, operand: '' };
  const start = end - match[0].length;
  return { head: expr.slice(0, start), operand: expr.slice(start) };
}

const endsPrimary = (token) => token && (token.type === 'num' || token.type === 'rparen' || token.type === 'percent');
const startsPrimary = (token) => token.type === 'num' || token.type === 'lparen' || token.type === 'func';

function tokenize(src, functions) {
  const tokens = [];
  const push = (token) => {
    // Implicit multiplication: 2(3), (2)(3), 2π, 3√(4)
    if (startsPrimary(token) && endsPrimary(tokens[tokens.length - 1])) tokens.push({ type: 'op', value: '*' });
    tokens.push(token);
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const number = src.slice(i).match(NUMBER_AT_START);
    const fn = src.slice(i).match(FUNCTION_AT_START);
    if (number) {
      push({ type: 'num', value: parseFloat(number[0]) });
      i += number[0].length;
    } else if (fn) {
      push({ type: 'func', apply: functions[fn[0]] });
      i += fn[0].length;
    } else {
      if (ch === 'π') push({ type: 'num', value: Math.PI });
      else if (ch === 'ℯ') push({ type: 'num', value: Math.E });
      else if ('+-*/^'.includes(ch)) tokens.push({ type: 'op', value: ch });
      else if (ch === '(') push({ type: 'lparen' });
      else if (ch === ')') tokens.push({ type: 'rparen' });
      else if (ch === '%') tokens.push({ type: 'percent' });
      else throw new SyntaxError(`Unexpected "${ch}"`);
      i += 1;
    }
  }
  return tokens;
}

// Recursive descent, lowest to highest precedence:
// + −  →  × ÷  →  unary −  →  ^ (right-assoc)  →  %  →  number | ( ) | function
function parse(tokens) {
  let pos = 0;
  const isOp = (value) => tokens[pos]?.type === 'op' && tokens[pos].value === value;

  function primary() {
    const token = tokens[pos];
    pos += 1;
    if (!token) throw new SyntaxError('Unexpected end');
    if (token.type === 'num') return token.value;
    if (token.type === 'func') return token.apply(postfix());
    if (token.type === 'lparen') {
      const value = expression();
      if (tokens[pos]?.type !== 'rparen') throw new SyntaxError('Missing )');
      pos += 1;
      return value;
    }
    throw new SyntaxError('Unexpected token');
  }

  function postfix() {
    let value = primary();
    while (tokens[pos]?.type === 'percent') {
      pos += 1;
      value /= 100;
    }
    return value;
  }

  function power() {
    const base = postfix();
    if (!isOp('^')) return base;
    pos += 1;
    return base ** unary();
  }

  function unary() {
    if (isOp('-')) {
      pos += 1;
      return -unary();
    }
    if (isOp('+')) {
      pos += 1;
      return unary();
    }
    return power();
  }

  function term() {
    let value = unary();
    while (isOp('*') || isOp('/')) {
      const op = tokens[pos].value;
      pos += 1;
      const right = unary();
      value = op === '*' ? value * right : value / right;
    }
    return value;
  }

  function expression() {
    let value = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos].value;
      pos += 1;
      const right = term();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  const result = expression();
  if (pos < tokens.length) throw new SyntaxError('Unexpected trailing input');
  return result;
}

// null = empty or not (yet) a valid expression; a non-finite number = math error (÷0, √−1).
export function evaluate(expr, { angleUnit = 'rad' } = {}) {
  const complete = completeExpression(expr);
  if (!complete) return null;
  try {
    return parse(tokenize(complete, buildFunctions(angleUnit)));
  } catch {
    return null;
  }
}

export function prettify(expr) {
  let out = '';
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    const symbol = DISPLAY_SYMBOLS[ch] ?? ch;
    const isBinary = '+-*/'.includes(ch) && i > 0 && isOperandEnd(expr.slice(0, i));
    out += isBinary ? ` ${symbol} ` : symbol;
  }
  return out;
}
