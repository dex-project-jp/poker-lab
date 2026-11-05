import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePotExpression} from './pot-calculator.js';

test('POT calculator respects precedence and left associativity', () => {
  assert.equal(evaluatePotExpression('18100+4700×2'), 27500);
  assert.equal(evaluatePotExpression('20÷2×3−4−1'), 25);
  assert.equal(evaluatePotExpression('.1+.2'), .3);
  assert.equal(evaluatePotExpression('1e-7×2'), 2e-7);
});

test('POT calculator rejects malformed expressions and unsafe results', () => {
  for (const invalid of ['', '1+', '1..2', '1××2', '1foo', '2+÷3', '1e308×2']) {
    assert.throws(() => evaluatePotExpression(invalid));
  }
  assert.throws(() => evaluatePotExpression('5÷0'), /0では割れません/);
});
