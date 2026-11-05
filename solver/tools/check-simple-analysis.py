"""Independent Python reference: rank 5-card subsets with count tuples."""
import itertools, json, subprocess
from collections import Counter
from fractions import Fraction
ranks='23456789TJQKA'
deck=[r+s for r in ranks for s in 'cdhs']
def five(cards):
    rs=[ranks.index(c[0])+2 for c in cards]; counts=Counter(rs)
    groups=sorted(((n,r) for r,n in counts.items()),reverse=True)
    unique=set(rs); unique |= {1} if 14 in unique else set()
    straight=max([h for h in range(5,15) if set(range(h-4,h+1)) <= unique] or [0])
    flush=len({c[1] for c in cards})==1
    ordered=tuple(sorted(rs,reverse=True))
    if flush and straight:return (8,straight)
    if groups[0][0]==4:return (7,groups[0][1],groups[1][1])
    if [n for n,r in groups]==[3,2]:return (6,groups[0][1],groups[1][1])
    if flush:return (5,)+ordered
    if straight:return (4,straight)
    if groups[0][0]==3:return (3,groups[0][1])+tuple(sorted((r for n,r in groups[1:]),reverse=True))
    if [n for n,r in groups][:2]==[2,2]:return (2,)+tuple(sorted((groups[0][1],groups[1][1]),reverse=True))+(groups[2][1],)
    if groups[0][0]==2:return (1,groups[0][1])+tuple(sorted((r for n,r in groups[1:]),reverse=True))
    return (0,)+ordered
def best(cards):return max(map(five,itertools.combinations(cards,5)))
def reference(case):
    hero,board=case['hero'],case['board']; known=set(hero+board)
    mass=Fraction(0); value=Fraction(0); total=0
    for a,b in itertools.combinations(deck,2):
        if a in known or b in known:continue
        ra,rb=sorted([a[0],b[0]],key=ranks.index,reverse=True)
        hand=ra+rb+('' if ra==rb else 's' if a[1]==b[1] else 'o')
        weight=Fraction(str(case['range'].get(hand,0)))
        if not weight:continue
        rest=[c for c in deck if c not in known|{a,b}]
        for extra in itertools.combinations(rest,5-len(board)):
            h=best(hero+board+list(extra));v=best([a,b]+board+list(extra))
            value+=weight*(1 if h>v else Fraction(1,2) if h==v else 0);mass+=weight;total+=1
    return float(value/mass),total
cases=[
 {'hero':['As','Kd'],'board':['Qs','Js','2c'],'range':{'AA':.25,'AKs':.5}},
 {'hero':['Th','9h'],'board':['8h','7c','2h','Ad'],'range':{'AA':.5,'AKo':.25,'QJs':1}},
 {'hero':['As','Kd'],'board':['Ac','7h','8h','9d','2c'],'range':{'AA':.25,'KK':.75,'T9s':.5}},
 {'hero':['2c','3d'],'board':['As','Ks','Qs','Js','Ts'],'range':{'AA':1,'KK':.5}}
]
script="import {analyze} from './solver/simple-analysis.js';let s='';for await(const c of process.stdin)s+=c;console.log(JSON.stringify(JSON.parse(s).map(analyze)));"
results=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],input=json.dumps([dict(c,pot=100,bet=50) for c in cases]).encode()))
for case,result in zip(cases,results):
    equity,total=reference(case)
    assert abs(equity-result['equity'])<1e-12,(equity,result)
    assert total==result['total']
    assert abs(result['callEV']-(equity*200-50))<1e-10
    print(f"PASS board={len(case['board'])} worlds={total} equity={equity:.12f}")
