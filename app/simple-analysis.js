import {ranks, classes, validate} from '../solver/simple-analysis.js?v=pot-25';
import {setupPotCalculator} from './pot-calculator.js?v=pot-27';

const $ = id => document.getElementById(id);
const suits = {s: '♠', h: '♥', c: '♣', d: '♦'};
const suitNames = {s: 'スペード', h: 'ハート', c: 'クラブ', d: 'ダイヤ'};
const groups = [
  ['自分の手札', ['自分の1枚目', '自分の2枚目']],
  ['フロップ', ['フロップ1枚目', 'フロップ2枚目', 'フロップ3枚目']],
  ['ターン', ['ターン']],
  ['リバー', ['リバー']]
];
const names = groups.flatMap(([, labels]) => labels);
const cards = names.map(() => '');
const customRange = {};
const tight = 'AA KK QQ JJ TT 99 AKs AQs AKo'.split(' ');
const middle = [...tight, ...'88 77 66 AJs ATs KQs KJs QJs JTs AQo AJo KQo'.split(' ')];
const loose = [...middle, ...'55 44 33 22 A9s A8s A7s A6s A5s A4s A3s A2s KTs QTs J9s T9s 98s 87s 76s ATo KJo QJo'.split(' ')];
const presets = {all: classes, tight, middle, loose};
let worker = null;
let activeCard = 0;
let chosenRank = '';
const amountIds = ['pot', 'bet'];
let pointsMode = false;

function invalidate(message = '') {
  worker?.terminate();
  worker = null;
  $('result').hidden = true;
  for (const id of ['verdict', 'equity', 'required', 'callEV', 'breakdown']) $(id).textContent = '';
  $('progress').hidden = true;
  $('cancel').hidden = true;
  $('cancel').disabled = true;
  $('status').textContent = message;
}

function makeButton(text, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.onclick = action;
  return button;
}

function renderCard(index) {
  const slot = $('card' + index);
  const card = cards[index];
  slot.textContent = card ? card[0] + suits[card[1]] : '+';
  slot.dataset.suit = card[1] || '';
  slot.classList.toggle('empty', !card);
  slot.setAttribute('aria-label', names[index] + (card ? ' ' + slot.textContent + 'を変更' : 'を選択'));
}

const board = document.createElement('div');
board.className = 'board-cards';
let cardIndex = 0;
for (const [label, labels] of groups) {
  const group = document.createElement('div');
  group.className = 'card-group';
  const heading = document.createElement('span');
  heading.textContent = label;
  const row = document.createElement('div');
  row.className = 'card-row';
  row.style.setProperty('--count', labels.length);
  group.append(heading, row);
  if (cardIndex === 0) {
    group.classList.add('hero-cards');
    $('cards').append(group, board);
  } else {
    board.append(group);
  }
  for (const name of labels) {
    const index = cardIndex++;
    const slot = makeButton('+', () => openPicker(index));
    slot.id = 'card' + index;
    slot.setAttribute('aria-haspopup', 'dialog');
    row.append(slot);
    renderCard(index);
  }
}

function isUsed(card) {
  return cards.some((value, index) => index !== activeCard && value === card);
}

function openPicker(index) {
  activeCard = index;
  chosenRank = '';
  $('pickerTitle').textContent = names[index];
  $('pickerStep').textContent = '1. ランクを選択';
  $('clearCard').hidden = !cards[index];
  $('suitOptions').hidden = true;
  $('rankOptions').replaceChildren(...Array.from(ranks, rank => {
    const button = makeButton(rank, () => chooseRank(rank));
    button.disabled = Object.keys(suits).every(suit => isUsed(rank + suit));
    button.setAttribute('aria-pressed', 'false');
    return button;
  }));
  if (!$('picker').open) $('picker').showModal();
  $('rankOptions').querySelector('button:not(:disabled)')?.focus();
}

function chooseRank(rank) {
  chosenRank = rank;
  $('pickerStep').textContent = '2. ' + rank + 'のスートを選択';
  for (const button of $('rankOptions').children) {
    button.setAttribute('aria-pressed', String(button.textContent === rank));
  }
  $('suitOptions').replaceChildren(...Object.entries(suits).map(([suit, symbol]) => {
    const button = makeButton(symbol, () => chooseCard(chosenRank + suit));
    button.dataset.suit = suit;
    button.disabled = isUsed(rank + suit);
    button.setAttribute('aria-label', rank + ' ' + suitNames[suit]);
    return button;
  }));
  $('suitOptions').hidden = false;
  $('suitOptions').querySelector('button:not(:disabled)')?.focus();
}

function chooseCard(card) {
  if (isUsed(card)) return;
  const wasEmpty = !cards[activeCard];
  if (cards[activeCard] !== card) {
    cards[activeCard] = card;
    renderCard(activeCard);
    invalidate();
  }
  const next = cards.findIndex((value, index) => index > activeCard && !value);
  if (wasEmpty && $('autoNext').checked && next !== -1) openPicker(next);
  else $('picker').close();
}

$('pickerClose').onclick = () => $('picker').close();
$('clearCard').onclick = () => {
  cards[activeCard] = '';
  renderCard(activeCard);
  invalidate();
  $('picker').close();
};

function renderRange() {
  for (const button of $('range').children) {
    const weight = customRange[button.dataset.hand] || 0;
    button.setAttribute('aria-pressed', String(weight > 0));
    button.title = button.dataset.hand + ' ' + Math.round(weight * 100) + '%';
  }
  $('selectionSummary').textContent = '選択したハンド：' + Object.keys(customRange).length;
  $('selected').replaceChildren();
  for (const hand of classes.filter(hand => customRange[hand])) {
    const row = document.createElement('div');
    row.className = 'range-row';
    const label = document.createElement('label');
    label.textContent = hand + ' 頻度（%）';
    const input = document.createElement('input');
    input.id = 'freq-' + hand;
    label.htmlFor = input.id;
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = Math.round(customRange[hand] * 100);
    input.setAttribute('aria-label', hand + ' 頻度');
    input.oninput = () => invalidate();
    input.onchange = () => {
      const frequency = input.valueAsNumber;
      if (!Number.isInteger(frequency) || frequency < 0 || frequency > 100) {
        input.value = Math.round(customRange[hand] * 100);
        $('status').textContent = '頻度は0〜100の整数で入力してください';
        return;
      }
      if (frequency === 0) delete customRange[hand];
      else customRange[hand] = frequency / 100;
      renderRange();
    };
    row.append(label, input);
    $('selected').append(row);
  }
}

for (const hand of classes) {
  const button = makeButton(hand, () => {
    invalidate();
    if (customRange[hand]) delete customRange[hand];
    else customRange[hand] = Number($('frequency').value);
    renderRange();
  });
  button.dataset.hand = hand;
  $('range').append(button);
}
$('all').onclick = () => {
  invalidate();
  for (const hand of classes) customRange[hand] = Number($('frequency').value);
  renderRange();
};
$('clear').onclick = () => {
  invalidate();
  for (const hand of Object.keys(customRange)) delete customRange[hand];
  renderRange();
};

$('preset').onchange = () => {
  invalidate();
  const mode = $('preset').value;
  const hands = presets[mode];
  $('customRange').hidden = mode !== 'custom';
  $('presetDetails').hidden = !hands;
  $('presetDetails').open = false;
  $('presetHands').textContent = mode === 'all' ? '169クラスすべてを100%で使用。' : hands?.join('、') || '';
  $('presetSummary').textContent = hands
    ? '参考用・' + hands.length + 'クラス、各100%。GTOレンジではありません。'
    : mode === 'custom' ? 'ハンドごとの頻度を指定できます。GTOレンジではありません。'
    : 'プリセットは参考用です。GTOレンジではありません。';
};

function formatEV(value) {
  if (!pointsMode) return value.toFixed(4) + ' BB';
  return value.toLocaleString('ja-JP', {maximumFractionDigits: 4}) + ' 点';
}

function showResult(result) {
  const percent = value => (value * 100).toFixed(3) + '%';
  $('verdict').dataset.outcome = result.comparison;
  $('verdict').textContent = {
    call: 'コール有利',
    fold: 'フォールド有利',
    equal: 'コールとフォールドは同EV'
  }[result.comparison];
  $('equity').textContent = percent(result.equity);
  $('required').textContent = percent(result.required);
  $('callEV').textContent = formatEV(result.callEV);
  const rows = [
    ['勝ち・引き分け', percent(result.win) + ' ／ ' + percent(result.tie)],
    ['ポットオッズ', result.odds === null ? 'ベット0・コール費用なし' : result.odds.toFixed(3) + '：1'],
    ['フォールドEV', pointsMode ? '0 点' : '0 BB'],
    ['厳密列挙', result.total.toLocaleString() + '通り ／ 除外後' + result.combos + 'コンボ']
  ];
  $('breakdown').replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    return row;
  }));
  $('resultDetails').open = false;
  $('result').hidden = false;
}

const resetPotCalculator = setupPotCalculator({
  pot: $('pot'),
  toggle: $('potCalcToggle'),
  panel: $('potCalculator'),
  current: $('potCalcCurrent'),
  expression: $('potCalcExpression'),
  result: $('potCalcResult'),
  insert: $('potCalcInsert'),
  apply: $('potCalcApply'),
  unit: () => pointsMode ? '点' : 'BB'
});

function selectUnit(usePoints) {
  if (pointsMode === usePoints) return;
  pointsMode = usePoints;
  for (const id of amountIds) $(id).value = '';
  const label = pointsMode ? '点' : 'BB';
  document.querySelectorAll('[data-amount-unit]').forEach(element => { element.textContent = label; });
  $('unitBB').setAttribute('aria-pressed', String(!pointsMode));
  $('unitPoints').setAttribute('aria-pressed', String(pointsMode));
  resetPotCalculator();
  invalidate();
}

$('unitBB').onclick = () => selectUnit(false);
$('unitPoints').onclick = () => selectUnit(true);
for (const id of amountIds) $(id).oninput = () => invalidate();
$('cancel').onclick = () => invalidate('計算を中止しました。');
$('calculate').onclick = () => {
  invalidate();
  try {
    if (cards.slice(0, 5).some(card => !card)) throw Error('自分の2枚とフロップ3枚を指定してください');
    if (cards[6] && !cards[5]) throw Error('リバーを指定する場合はターンも指定してください');
    const mode = $('preset').value;
    if (!mode) throw Error('相手レンジを選択してください');
    const range = mode === 'custom' ? {...customRange} : Object.fromEntries(presets[mode].map(hand => [hand, 1]));
    const input = {
      hero: cards.slice(0, 2),
      board: cards.slice(2).filter(Boolean),
      range,
      pot: $('pot').valueAsNumber,
      bet: $('bet').valueAsNumber
    };
    validate(input);
    const current = new Worker(new URL('./simple-analysis-worker.js?v=pot-25', import.meta.url), {type: 'module'});
    worker = current;
    $('cancel').disabled = false;
    $('cancel').hidden = false;
    $('progress').hidden = false;
    $('progress').removeAttribute('value');
    $('status').textContent = '全組み合わせを厳密計算中…';
    current.onmessage = ({data}) => {
      if (worker !== current) return;
      if (data.error) invalidate(data.error);
      else if (data.progress) {
        const {done, total} = data.progress;
        $('progress').max = total;
        $('progress').value = done;
        $('status').textContent = '厳密計算中：' + done.toLocaleString() + ' / ' + total.toLocaleString();
      } else if (data.result) {
        invalidate('計算完了');
        showResult(data.result);
      }
    };
    current.onerror = () => {
      if (worker === current) invalidate('計算に失敗しました。再実行してください。');
    };
    current.postMessage(input);
  } catch (error) {
    invalidate(error.message);
  }
};
renderRange();
