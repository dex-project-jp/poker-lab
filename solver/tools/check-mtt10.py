"""Independent nine-player game rebuild, half-BB chip slices, LP and exact rational BR.
No two-player minimax certificate or imported strategy ranges are used.
"""
import json,hashlib,sys,itertools
from pathlib import Path
from fractions import Fraction as F
from collections import Counter
import numpy as np
from scipy.optimize import linprog
from scipy.sparse import lil_matrix
root=Path(__file__).resolve().parents[1]
craw=(root/'data/mtt10-candidate.json').read_bytes();c=json.loads(craw)
graw=Path('/tmp/mtt10-tree.json').read_bytes();compiled=json.loads(graw)
assert compiled['config']==c['config'] and len(compiled['roots'])==18
policy=[[F(v,c['denominator']) for v in row]for row in c['policyWeights']]
assert all(float(v)==c['policy'][i][k] for i,row in enumerate(policy) for k,v in enumerate(row))
assert len(policy)==len(compiled['infos']) and all(len(row)==2 and sum(row)==1 and min(row)>=0 for row in policy)
board=c['config']['board'];labels=['AA','KK','QQ','JJ','TT','99','88','77','66','55']
def score5(cards):
 ranks=sorted(['23456789TJQKA'.index(x[0])+2 for x in cards],reverse=True);groups=sorted(((n,r)for r,n in Counter(ranks).items()),reverse=True)
 flush=len({x[1]for x in cards})==1;u=set(ranks);u|={1}if 14 in u else set();straight=max((h for h in range(5,15)if all(h-k in u for k in range(5))),default=0)
 if flush and straight:return(8,straight)
 if groups[0][0]==4:return(7,groups[0][1],groups[1][1])
 if [n for n,r in groups]==[3,2]:return(6,groups[0][1],groups[1][1])
 if flush:return(5,*ranks)
 if straight:return(4,straight)
 if groups[0][0]==3:return(3,groups[0][1],*sorted([r for n,r in groups[1:]],reverse=True))
 if [n for n,r in groups[:2]]==[2,2]:return(2,*sorted([groups[0][1],groups[1][1]],reverse=True),groups[2][1])
 if groups[0][0]==2:return(1,groups[0][1],*sorted([r for n,r in groups[1:]],reverse=True))
 return(0,*ranks)
combos=[list(itertools.combinations([h[0]+s for s in 'cdhs'],2))for h in labels];scores=[]
for cs in combos:
 sc={max(score5(x)for x in itertools.combinations(list(h)+board,5))for h in cs};assert len(sc)==1;scores.append(next(iter(sc)))
assert scores==sorted(scores,reverse=True)
worlds=[[9 if p==w else p for p in range(9)]for w in range(10)]
# Factorized physical-card proof: every pair combination is disjoint from board and all other seats.
for d in worlds:
 for p in range(9):
  for h in combos[d[p]]:assert not set(h)&set(board)
  for q in range(p):
   for h in combos[d[p]]:
    for v in combos[d[q]]:assert not set(h)&set(v)
assert 10*6**9==int(c['config']['physicalDeals'])==100776960

def signature(player,hand,history):return(player,hand,tuple((x['seat'],x['kind'],x.get('to'))for x in history))
info_map={signature(x['player'],x['type'],x['history']):i for i,x in enumerate(compiled['infos'])}
nodes=[];roots=[];terminals=0

def payoff(live,folded,deal):
 active=[p for p in range(9)if not folded[p]];awards=[F(0)for _ in range(9)]
 def award(amount,eligible):
  assert eligible;win=[p for p in eligible if scores[deal[p]]==max(scores[deal[q]]for q in eligible)]
  for p in win:awards[p]+=F(amount,len(win))
 award(F(1),active)
 for unit in range(1,max(round(2*x)for x in live)+1):
  payers=[p for p in range(9)if round(2*live[p])>=unit]
  if len(payers)==1:awards[payers[0]]+=F(1,2)
  else:award(F(len(payers),2),[p for p in payers if not folded[p]])
 utility=[awards[p]-F(live[p])-(1 if p==8 else 0)for p in range(9)]
 assert sum(utility)==0
 return utility

def build(actor,live,folded,history,deal,jammer):
 global terminals
 i=len(nodes);nodes.append(None)
 if actor==9 or sum(not f for f in folded)<=1:
  u=payoff(live,folded,deal);nodes[i]={'actor':-1,'u':u,'children':[]};terminals+=1
 else:
  info=info_map[signature(actor,deal[actor],history)];children=[]
  for action in [dict(kind='fold'),dict(kind='allin'if jammer is None else'call',to=(9 if actor==8 else 10)if jammer is None else min(max(live),9 if actor==8 else 10))]:
   nl=list(live);nf=list(folded)
   if action['kind']=='fold':nf[actor]=True
   else:nl[actor]=action['to']
   children.append(build(actor+1,nl,nf,history+[dict(seat=actor,**action)],deal,actor if action['kind']=='allin'else jammer))
  nodes[i]={'actor':actor,'info':info,'children':children}
 # Cross-check independent tree structure/payoffs against compiled JS tree at matching preorder indices.
 x=nodes[i];j=compiled['nodes'][i];assert x['actor']==j['actor'] and x['children']==j['children']
 if actor<9:assert j['deal']==deal
 if x['actor']<0:assert x['u']==[F(v)for v in j['utility']]
 else:assert x['info']==j['info']
 return i
for w in [0]*9+list(range(1,10)):roots.append(build(0,[0]*7+[.5,1],[False]*9,[],worlds[w],None))
assert roots==compiled['roots'] and len(nodes)==len(compiled['nodes'])==18378
# Exact rational baseline evaluation.
v=[None]*len(nodes)
for i in range(len(nodes)-1,-1,-1):
 n=nodes[i]
 v[i]=n['u']if n['actor']<0 else [sum(policy[n['info']][k]*v[ch][p]for k,ch in enumerate(n['children']))for p in range(9)]
values=[sum(v[r][p]for r in roots)/18 for p in range(9)];assert sum(values)==0
responses=[];lp_responses=[]
for player in range(9):
 coeff={i:[F(0),F(0)]for i,x in enumerate(compiled['infos'])if x['player']==player};constant=F(0)
 def prefix(i,reach):
  global constant
  n=nodes[i]
  if n['actor']<0:constant+=reach*n['u'][player];return
  if n['actor']==player:
   for k,ch in enumerate(n['children']):coeff[n['info']][k]+=reach*v[ch][player]
  else:
   for k,ch in enumerate(n['children']):prefix(ch,reach*policy[n['info']][k])
 for r in roots:prefix(r,F(1,18))
 # A player acts at most once, hence each information set has an independent simplex constraint.
 entries=list(coeff);objective=np.array([float(x)for i in entries for x in coeff[i]]);constraints=lil_matrix((len(entries),2*len(entries)))
 for row in range(len(entries)):constraints[row,2*row:2*row+2]=1
 lp=linprog(-objective*1e6,A_eq=constraints.tocsr(),b_eq=np.ones(len(entries)),bounds=(0,1),method='highs',options={'primal_feasibility_tolerance':1e-10,'dual_feasibility_tolerance':1e-10});assert lp.success,lp.message
 br=constant+sum(max(coef)for coef in coeff.values());lp_value=float(constant)-lp.fun/1e6
 assert abs(float(br)-lp_value)<1e-9
 responses.append(br);lp_responses.append(lp_value)
 # Verify baseline linear objective against the independent tree evaluation.
 assert constant+sum(sum(policy[i][k]*coeff[i][k]for k in range(2))for i in entries)==values[player]
gains=[responses[p]-values[p]for p in range(9)];assert min(gains)>=0;epsilon=max(gains);conv=sum(gains);tolerance=F(1,500)
assert epsilon<=tolerance and max(abs(float(gains[p])-c['validation']['gains'][p])for p in range(9))<1e-9
out={'method':'Independent Python tree rebuild, five-card-subset evaluator, half-BB pot slices, sparse LP and exact rational unilateral best responses','passed':True,'candidateSha256':hashlib.sha256(craw).hexdigest(),'treeSha256':hashlib.sha256(graw).hexdigest(),'physicalDealsDistinct':100776960,'chanceTickets':18,'terminalsAudited':terminals,'values':[float(x)for x in values],'bestResponses':[float(x)for x in responses],'lpBestResponses':lp_responses,'gains':[float(x)for x in gains],'epsilon':float(epsilon),'nashConv':float(conv),'toleranceBB':float(tolerance),'exactRational':{'epsilonNumerator':str(epsilon.numerator),'epsilonDenominator':str(epsilon.denominator),'nashConvNumerator':str(conv.numerator),'nashConvDenominator':str(conv.denominator),'passed':True}}
path=root/'data/mtt10-independent.json';content=json.dumps(out,indent=2)+'\n'
if '--check'in sys.argv:assert path.read_text()==content,'Stale independent verification'
else:path.write_text(content)
print(json.dumps({k:out[k]for k in ['passed','epsilon','nashConv','terminalsAudited','physicalDealsDistinct']}))
