export function evaluatePotExpression(expression) {
  const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[+−×÷]/gi) ?? [];
  if (!tokens.length || tokens.join('') !== expression) throw Error('式を確認してください。');

  let index = 0;
  function readNumber() {
    const negative = tokens[index] === '−';
    if (negative) index++;
    const token = tokens[index++];
    const value = Number(token);
    if (!Number.isFinite(value) || /^[+−×÷]$/.test(token)) throw Error('式を確認してください。');
    return negative ? -value : value;
  }

  function readTerm() {
    let value = readNumber();
    while (tokens[index] === '×' || tokens[index] === '÷') {
      const operator = tokens[index++];
      const operand = readNumber();
      if (operator === '÷' && operand === 0) throw Error('0では割れません。');
      value = operator === '×' ? value * operand : value / operand;
    }
    return value;
  }

  let result = readTerm();
  while (index < tokens.length) {
    const operator = tokens[index++];
    if (operator !== '+' && operator !== '−') throw Error('式を確認してください。');
    const operand = readTerm();
    result = operator === '+' ? result + operand : result - operand;
  }
  if (!Number.isFinite(result)) throw Error('計算できる範囲を超えています。');
  return Number.isInteger(result) ? result : Number(result.toPrecision(15));
}

export function setupPotCalculator({pot, toggle, panel, current, expression, result, insert, apply, unit}) {
  let formula = '';
  let pending = null;
  function updatePot() {
    const value = pot.valueAsNumber;
    const valid = Number.isFinite(value) && value >= 0;
    current.textContent = valid ? value.toLocaleString('ja-JP', {maximumSignificantDigits: 16}) + ' ' + unit() : '—';
    insert.disabled = !valid;
  }

  function edit(value) {
    if (value.length > 120) return;
    formula = value;
    expression.textContent = formula || '0';
    result.textContent = '';
    pending = null;
    apply.disabled = true;
  }

  toggle.onclick = () => {
    panel.hidden = !panel.hidden;
    toggle.textContent = panel.hidden ? '＋' : '−';
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    toggle.setAttribute('aria-label', panel.hidden ? 'POT電卓を開く' : 'POT電卓を閉じる');
    updatePot();
  };

  panel.querySelectorAll('[data-pot-key]').forEach(button => {
    button.onclick = () => {
      const key = button.dataset.potKey;
      if (key === 'clear') edit('');
      else if (key === 'delete') edit(formula.slice(0, -1));
      else if (key === 'equals') {
        pending = null;
        apply.disabled = true;
        try {
          const value = evaluatePotExpression(formula);
          result.textContent = value.toLocaleString('ja-JP', {maximumSignificantDigits: 16}) + ' ' + unit();
          if (value > 0) {
            pending = value;
            apply.disabled = false;
          }
        } catch (error) {
          result.textContent = error.message;
        }
      } else edit(formula + key);
    };
  });

  insert.onclick = () => {
    const value = pot.valueAsNumber;
    if (!Number.isFinite(value) || value < 0) return;
    edit(`${value}+`);
  };
  apply.onclick = () => {
    if (pending === null) return;
    const value = pending;
    edit('');
    pot.value = String(value);
    pot.dispatchEvent(new Event('input', {bubbles: true}));
    result.textContent = 'POTに反映しました。';
  };
  pot.addEventListener('input', updatePot);
  updatePot();
  return () => {
    edit('');
    updatePot();
  };
}
