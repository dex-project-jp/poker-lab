import test from 'node:test';
import assert from 'node:assert/strict';
import './mtt-model.js';
import './practical-ranges.js';
import './practical-reraises.js';
import '../app/preflop-bets.js';

const mtt = globalThis.PokerLabMTT;
const practical = globalThis.PokerLabPractical;
const reraises = globalThis.PokerLabReraises;
const bets = globalThis.PokerLabBets;

test('30BB reference coverage: 152 spots × 169 hands, with legal actions and exact live sizes', () => {
  const game = mtt.defaults(30);
  let count = 0;
  function check(scenario, hero, opener, bettor, jam = false) {
    const reraise = scenario === 'vs3bet' || scenario === 'vs4bet';
    const table = reraise
      ? reraises.table(hero, scenario, opener, bettor, {fourBetAllIn: jam})
      : practical.table(hero, scenario, opener);
    const sizes = bets.defaults(opener, bettor);
    const input = {scenario, hero, opener, bettor, stacks: game.stacksBeforePostsBB,
      ante: game.ante, ...sizes, fourTo: jam ? 30 : 14, fourBetAllIn: jam};
    const math = bets.calculate(input);
    assert.ok(bets.matchesReference(input, math), JSON.stringify(input));
    assert.equal(table.hero, hero);
    assert.equal(table.scenario, scenario);
    assert.equal(table.metadata.gtoVerified, false);
    assert.equal(table.metadata.frequencyModel, 'none');
    assert.deepEqual(Object.keys(table.hands).sort(), [...mtt.hands].sort());
    if (reraise) {
      assert.equal(table.opener, opener);
      assert.equal(table.threeBettor, bettor);
      assert.equal(table.money.potBeforeActionBB, math.potBeforeActionBB);
    }

    const allowed = {Fold: null};
    if (scenario === 'open') {
      allowed.Raise = sizes.openTo;
      if (hero === 'SB') allowed.Limp = 1;
    } else {
      allowed.Call = math.call.toBB;
      if (scenario === 'vsopen') allowed['3-bet'] = sizes.threeTo;
      if (scenario === 'vs3bet') {
        allowed['4-bet'] = 14;
        allowed['4-bet All-in'] = math.heroLiveCapBB;
      }
      if (scenario === 'vs4bet' && !jam) allowed['5-bet All-in'] = math.heroLiveCapBB;
    }
    const prior = scenario === 'vs3bet' ? practical.table(hero)
      : scenario === 'vs4bet' ? practical.table(hero, 'vsopen', opener) : null;
    for (const hand of mtt.hands) {
      const row = table.hands[hand];
      assert.equal(row.frequencies, undefined);
      if (prior) {
        const eligible = prior.hands[hand].action === (scenario === 'vs3bet' ? 'Raise' : '3-bet');
        assert.equal(row.historyEligible, eligible);
        if (!eligible) {
          assert.equal(row.action, null);
          assert.equal(row.sizeBB, null);
          continue;
        }
      }
      assert.ok(Object.hasOwn(allowed, row.action), scenario + ' ' + hand + ' ' + row.action);
      assert.equal(row.sizeBB, allowed[row.action]);
    }
    count++;
  }

  for (const [i, opener] of mtt.positions.slice(0, -1).entries()) {
    check('open', opener, opener, null);
    for (const bettor of mtt.positions.slice(i + 1)) {
      check('vsopen', bettor, opener, bettor);
      check('vs3bet', opener, opener, bettor);
      check('vs4bet', bettor, opener, bettor);
      check('vs4bet', bettor, opener, bettor, true);
    }
  }
  assert.equal(count, 152);
  assert.equal(practical.table('BB').state, 'walk');
  assert.equal(practical.table('BTN', 'vsopen', 'BB'), null);
  assert.equal(reraises.table('BTN', 'vs3bet', 'BTN', 'CO'), null);
  assert.equal(reraises.table('BTN', 'cold4bet', 'CO', 'SB'), null);
});
