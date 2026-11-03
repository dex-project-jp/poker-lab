"""Independent sequence-form LP best responses and chip-slice settlement audit.
Consumes the compiled finite tree, not the JS best-response algorithm. No paid service.
"""
import json, sys, hashlib
from pathlib import Path
import itertools
from collections import Counter
from fractions import Fraction
from decimal import Decimal
import numpy as np
from scipy.optimize import linprog
root=Path(__file__).resolve().parents[1]
tree_path=next((s for s in sys.argv[1:] if not s.startswith('--')), '/tmp/poker-btn-mini-tree.json')
tree_bytes=Path(tree_path).read_bytes()
g=json.loads(tree_bytes)
raw=(root/'data/btn-mini-candidate.json').read_bytes()
c=json.loads(raw);policy=c['solution']['policy'];nodes=g['nodes'];infos=g['infos'];chance=1/len(g['roots'])
assert len(g['roots'])==24 and len({tuple(nodes[r]['deal']) for r in g['roots']})==24
assert c['config']==g['config']
# Independent five-card subset evaluator verifies the suit reduction and fixed board.
def score5(cards):
    ranks=sorted(['23456789TJQKA'.index(c[0])+2 for c in cards],reverse=True)
    groups=sorted(((n,r) for r,n in Counter(ranks).items()),reverse=True)
    flush=len({c[1] for c in cards})==1
    uniq=set(ranks);uniq|={1} if 14 in uniq else set()
    straight=max((h for h in range(5,15) if all(h-k in uniq for k in range(5))),default=0)
    if flush and straight:return (8,straight)
    if groups[0][0]==4:return (7,groups[0][1],groups[1][1])
    if [x[0] for x in groups]==[3,2]:return (6,groups[0][1],groups[1][1])
    if flush:return (5,*ranks)
    if straight:return (4,straight)
    if groups[0][0]==3:return (3,groups[0][1],*sorted((r for n,r in groups[1:]),reverse=True))
    if [x[0] for x in groups[:2]]==[2,2]:return (2,*sorted((groups[0][1],groups[1][1]),reverse=True),groups[2][1])
    if groups[0][0]==2:return (1,groups[0][1],*sorted((r for n,r in groups[1:]),reverse=True))
    return (0,*ranks)
pair_combos=[[list(c) for c in itertools.combinations([r+s for s in 'cdhs'],2)] for r in 'AKQJ']
scores=[]
for pairs in pair_combos:
    ranks={max(score5(c) for c in itertools.combinations(h+g['config']['board'],5)) for h in pairs}
    assert len(ranks)==1
    scores.append(next(iter(ranks)))
assert scores==sorted(scores,reverse=True)
physical_deals=0
for types in itertools.permutations(range(4),3):
    for hs in itertools.product(*(pair_combos[t] for t in types)):
        cards=[c for h in hs for c in h]+g['config']['board'];assert len(cards)==len(set(cards))==11
        physical_deals+=1
assert physical_deals==5184
# Separate half-BB slice implementation. Dead ante goes to the main-pot winner;
# live caps (29BB for BB) determine eligibility for every separate side pot.
terminals=0
for n in nodes:
    d=n['deal'];assert len(set(d))==3
    cards=[card for t in d for card in g['config']['hands'][t]]+g['config']['board']
    assert len(cards)==len(set(cards))==11
    if n['actor']!=-1:continue
    s=n['state'];active=[i for i in range(3) if not s['folded'][i]]
    awards=np.zeros(3)
    def award(amount,eligible):
        assert eligible
        win=[min(eligible,key=lambda p:d[p])] if len(active)>1 else active
        for p in win:awards[p]+=amount/len(win)
    award(sum(s['ante']),active)
    for level in range(1,round(2*max(s['live']))+1):
        payers=[p for p in range(3) if round(2*s['live'][p])>=level]
        award(.5*len(payers),[p for p in payers if p in active])
    u=awards-np.array(s['ante'])-np.array(s['live'])
    assert np.max(np.abs(u-np.array(n['utility'])))<1e-10
    assert abs(sum(u))<1e-10
    terminals+=1
# Baseline expected value, independently propagated in Python.
v=np.zeros((len(nodes),3))
for i in range(len(nodes)-1,-1,-1):
    n=nodes[i]
    if n['actor']<0:v[i]=n['utility']
    else:v[i]=sum(policy[n['info']][k]*v[ch] for k,ch in enumerate(n['children']))
values=sum(chance*v[r] for r in g['roots'])
responses=[]
for player in range(3):
    # One realization sequence for the empty sequence, then one per own action.
    seq={};size=1
    for i,info in enumerate(infos):
        if info['player']==player:
            for k in range(len(info['actions'])):seq[(i,k)]=size;size+=1
    constraints=[np.r_[1.,np.zeros(size-1)]];rhs=[1.]
    for i,info in enumerate(infos):
        if info['player']!=player:continue
        row=np.zeros(size)
        for k in range(len(info['actions'])):row[seq[(i,k)]]=1
        parent=info['parentSequence'];row[seq[tuple(parent)] if parent is not None else 0]-=1
        constraints.append(row);rhs.append(0.)
    coeff=np.zeros(size)
    def walk(i,weight,own):
        n=nodes[i]
        if n['actor']<0:coeff[own]+=weight*n['utility'][player];return
        for k,ch in enumerate(n['children']):
            walk(ch,weight if n['actor']==player else weight*policy[n['info']][k],seq[(n['info'],k)] if n['actor']==player else own)
    for r in g['roots']:walk(r,chance,0)
    lp=linprog(-coeff*1e6,A_eq=np.array(constraints),b_eq=np.array(rhs),bounds=[(0,1)]*size,method='highs',options={'primal_feasibility_tolerance':1e-10,'dual_feasibility_tolerance':1e-10})
    assert lp.success,lp.message
    assert np.max(np.abs(np.array(constraints)@lp.x-np.array(rhs)))<1e-9
    responses.append(float(-lp.fun/1e6))
gains=np.maximum(0,np.array(responses)-values)
assert np.max(np.abs(values-np.array(c['solution']['values'])))<1e-9
assert np.max(np.abs(np.array(responses)-np.array(c['solution']['bestResponses'])))<1e-9
# Exact rational verification: JSON decimal weights are normalized per info set.
# This removes floating-point ambiguity from the published finite-game certificate.
decimal_policy=json.loads(raw,parse_float=Decimal)['solution']['policy']
rp=[]
for row in decimal_policy:
    fr=[Fraction(x) for x in row];total=sum(fr);assert total>0
    rp.append([x/total for x in fr])
rv=[[Fraction(0) for _ in range(3)] for _ in nodes]
for i in range(len(nodes)-1,-1,-1):
    n=nodes[i]
    if n['actor']<0:rv[i]=[Fraction(str(u)) for u in n['utility']]
    else:rv[i]=[sum(rp[n['info']][k]*rv[ch][p] for k,ch in enumerate(n['children'])) for p in range(3)]
rvalues=[sum(rv[r][p] for r in g['roots'])/24 for p in range(3)]
rbr=[]
for player in range(3):
    cf=[Fraction(0) for _ in nodes];vv=[Fraction(0) for _ in nodes]
    for r in g['roots']:cf[r]=Fraction(1,24)
    for i,n in enumerate(nodes):
        if n['actor']<0:vv[i]=Fraction(str(n['utility'][player]));continue
        for k,ch in enumerate(n['children']):cf[ch]=cf[i]*(1 if n['actor']==player else rp[n['info']][k])
    for i in sorted(range(len(infos)),key=lambda i:-infos[i]['depth']):
        info=infos[i]
        if info['player']==player:
            actions=[sum(cf[n]*vv[nodes[n]['children'][k]] for n in info['members']) for k in range(len(info['actions']))]
            best=max(range(len(actions)),key=actions.__getitem__)
            for n in info['members']:vv[n]=vv[nodes[n]['children'][best]]
        else:
            for n in info['members']:vv[n]=sum(rp[i][k]*vv[ch] for k,ch in enumerate(nodes[n]['children']))
    rbr.append(sum(vv[r] for r in g['roots'])/24)
rgains=[rbr[p]-rvalues[p] for p in range(3)];repsilon=max(rgains)
assert all(x>=0 for x in rgains)
assert max(abs(float(rbr[p])-responses[p]) for p in range(3))<1e-9
rational_proof={'strategyDefinition':'JSON decimal weights normalized exactly per information set','epsilonNumerator':str(repsilon.numerator),'epsilonDenominator':str(repsilon.denominator),'toleranceNumerator':1,'toleranceDenominator':100000,'epsilonFloat':float(repsilon),'gainsFloat':[float(x) for x in rgains],'passed':bool(repsilon<=Fraction(1,100000))}
report={'method':'Independent Python sequence-form HiGHS LP for each unilateral deviation; separate 0.5BB chip-slice side-pot audit','candidateSha256':hashlib.sha256(raw).hexdigest(),'treeSha256':hashlib.sha256(tree_bytes).hexdigest(),'chanceDeals':len(g['roots']),'physicalDealsAudited':physical_deals,'independentEvaluator':'21 five-card subsets for all 24 pair-suit combinations','terminalStatesAudited':terminals,'values':values.tolist(),'bestResponses':responses,'gains':gains.tolist(),'epsilon':float(max(gains)),'maxBestResponseDifferenceBB':float(max(abs(np.array(responses)-np.array(c['solution']['bestResponses'])))),'toleranceBB':1e-5,'exactRational':rational_proof,'passed':bool(max(gains)<=1e-5 and rational_proof['passed'])}
target=root/'data/btn-mini-independent.json'
if '--check' in sys.argv:
    old=json.loads(target.read_text())
    for key in ['candidateSha256','treeSha256','chanceDeals','physicalDealsAudited','terminalStatesAudited','passed','exactRational']:assert old[key]==report[key]
    for key in ['values','bestResponses','gains']:assert max(abs(a-b) for a,b in zip(old[key],report[key],strict=True))<1e-9
    assert abs(old['epsilon']-report['epsilon'])<1e-9
else:target.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
