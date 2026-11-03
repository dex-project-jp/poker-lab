// Poker Lab — heads-up push/fold Chip EV payoff kernel (v0.1)
// Units: big blinds. This is NOT a complete solver or a GTO range.
// Heads-up: SB posts 0.5 BB, BB posts 1 BB, no ante.
// SB may shove or fold. BB may call or fold facing a shove.
// The effective stack S includes posted blinds. Both players start with S BB.
// The showdown equity e includes half of tie probability.
// These are net chip gains relative to each player's stack at hand start.
export function payoff({stackBB, equity, sbBlind=0.5, bbBlind=1, deadBB=0}) {
  if (!Number.isFinite(stackBB) || stackBB <= bbBlind) throw Error('stackBB must exceed BB blind');
  if (!Number.isFinite(equity) || equity < 0 || equity > 1) throw Error('equity must be in [0,1]');
  if (![sbBlind,bbBlind,deadBB].every(v=>Number.isFinite(v)&&v>=0)) throw Error('invalid blinds/ante');
  if (sbBlind > bbBlind || deadBB !== 0) throw Error('v0.1 supports only HU without ante');
  const S=stackBB;
  return Object.freeze({
    sbFold: -sbBlind,
    sbShoveBbFold: bbBlind,
    sbShoveBbCall: equity*S-(1-equity)*S,
    bbFoldToShove: -bbBlind,
    bbCallVsShove: (1-equity)*S-equity*S
  });
}
// Conditional SB shove EV against a BB call probability.
// equity must be conditional on the BB calling range, accounting for blockers.
export function shoveEV({stackBB,equity,bbCallProbability}) {
  if (!Number.isFinite(bbCallProbability)||bbCallProbability<0||bbCallProbability>1) throw Error('invalid call probability');
  const p=payoff({stackBB,equity});
  return (1-bbCallProbability)*p.sbShoveBbFold+bbCallProbability*p.sbShoveBbCall;
}
// The BB should call a specific hand when its equity against SB's *shove range*
// exceeds this threshold, under the heads-up equal-stack no-ante assumptions.
export function bbCallEquityThreshold(stackBB) {
  if(!Number.isFinite(stackBB)||stackBB<=1) throw Error('invalid stack');
  // BB has already invested 1BB; folding loses 1BB.
// Calling EV = equity*stackBB + (1-equity)*(-stackBB)
// vs folding EV = -1BB. Thus equity >= (stackBB-1)/(2*stackBB).
  return (stackBB-1)/(2*stackBB);
}
// NOTE: This kernel does not calculate equity, card removal, optimal mixed
// frequencies, equilibrium, rake, ante, ICM or alternative raise sizes.
// Before displaying frequencies, supply exact hand-combo equities and solve
// the coupled 1326-combo game, then verify against independent benchmarks.
