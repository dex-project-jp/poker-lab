"""Independent exact-rational finite oracle. No JS game, sampling or pot imports."""
from pathlib import Path
from fractions import Fraction as F
from itertools import permutations
import json, hashlib, math
root=Path(__file__).resolve().parents[1]
r=json.loads((root/'data/mtt10-br-sampling-lab.json').read_text())
for p,digest in r['sources'].items(): assert hashlib.sha256((root/p).read_bytes()).hexdigest()==digest,p
assert not r['gtoVerified'] and not r['liveEngineChanged'] and not r['plan']['adoptLiveEngine']
assert r['plan']['fitSeeds']==[170201,170202,170203] and r['plan']['budgets']==[64,256,1024]
assert r['plan']['selectionSamples']==r['plan']['holdoutSamples']==8192
assert r['config']['id']=='three-seat-four-pairs-10bb-sampling-lab-v1'
assert r['config']['board']==['2c','3d','4h','8c','9d']
worlds=list(permutations(range(4),3));assert [list(w)for w in worlds]==r['worlds']
infos=r['infos'];rows=len(infos)*4
assert [(i['actor'],i['history']) for i in infos]==[(0,[]),(1,[0]),(2,[0,1]),(1,[1]),(2,[1,0]),(2,[1,1])]
index={tuple(x['history']):i for i,x in enumerate(infos)}
policy=[]
for x in infos: policy.extend(map(F,['0.95','0.04','0.002','0.0001']if x['actor']==0 else ['0.8','0.03','0.001','0.0001']if 1 in x['history'] else ['0.9','0.08','0.003','0.0002']))
assert [float(q)for q in policy]==r['baseline']
def settle(live,folded,w):
 # Half-BB integer slices, including an independent treatment of dead ante.
 paid=[F(v,2)for v in live];u=[-paid[p]-(p==2)for p in range(3)]
 active=[p for p in range(3)if not folded[p]];u[min(active,key=lambda p:w[p])]+=1
 before=0
 for level in sorted(set(x for x in live if x)):
  payers=[p for p in range(3)if live[p]>=level];amount=F((level-before)*len(payers),2)
  eligible=payers if len(payers)==1 else[p for p in payers if not folded[p]]
  assert eligible;u[min(eligible,key=lambda p:w[p])]+=amount;before=level
 assert sum(u)==0
 return u
def evaluate(w,response=None,seat=None):
 details={}
 def rec(history,live,folded,reach):
  p=len(history)
  if p==3 or sum(not f for f in folded)==1:return settle(live,folded,w)
  info=index[tuple(history)];row=info*4+w[p];baseq=policy[row];q=response[row]if p==seat else baseq
  f=folded.copy();f[p]=True;a=rec(history+[0],live.copy(),f,reach*(1-baseq))
  chips=live.copy();chips[p]=min(max(chips),18 if p==2 else 20)if 1 in history else 18 if p==2 else 20
  b=rec(history+[1],chips,folded.copy(),reach*baseq)
  details[row]=(reach,b[p]-a[p]);return[(1-q)*x+q*y for x,y in zip(a,b)]
 values=rec([],[0,1,2],[False]*3,F(1));return values,details
base=[evaluate(w)for w in worlds];mass=[F(0)]*rows;adv=[F(0)]*rows;second=[F(0)]*rows;weighted_second=[F(0)]*rows
for _,ds in base:
 for row,(reach,delta)in ds.items():mass[row]+=reach/24;adv[row]+=reach*delta/24;second[row]+=(reach*delta)**2/24;weighted_second[row]+=reach*delta**2/24
oracle=[policy[row]if mass[row]==0 else F(int(adv[row]>0))for row in range(rows)]
def score(response):
 response=list(map(lambda q:F(str(q)),response))
 return[sum((evaluate(w,response,p)[0][p]-base[j][0][p])/24 for j,w in enumerate(worlds))for p in range(3)]
def near(a,b):assert math.isclose(float(a),float(b),rel_tol=1e-10,abs_tol=1e-10),(a,b)
for name,truth in [('mass',mass),('advantage',adv),('response',oracle)]:
 for a,b in zip(r['oracle'][name],truth):near(a,b)
gains=score(oracle)
for a,b in zip(r['oracle']['gains'],gains):near(a,b)
for row,v in enumerate(r['estimatorVariancesAt64']):
 near(v['mean'],adv[row]);near(v['jointVariance'],(second[row]-adv[row]**2)/64)
 near(v['conditionalVariance'],(mass[row]*weighted_second[row]-adv[row]**2)/16)
for run in r['runs']:
 assert run['samples']in r['plan']['budgets'] and run['seed']in r['plan']['fitSeeds']
 for fit in run['fits']:
  assert fit['rowValueLookups']==run['samples']*len(infos)
  actual=score(fit['response'])
  for a,b in zip(fit['exactGainsBB'],actual):near(a,b)
  for a,b in zip(fit['exactBRGapBB'],[g-x for g,x in zip(gains,actual)]):near(a,b)
  assert fit['rowChoiceErrors']==sum(float(x)!=y for x,y in zip(oracle,fit['response']))
  assert fit['selection']['seed']==run['seed']+1000
  expected=[x['lowerBB']>0 for x in fit['selection']['contrasts']];assert expected==fit['selectedSeats']
  selected=[fit['response'][i]if expected[infos[i//4]['actor']]else float(policy[i])for i in range(rows)]
  assert selected==fit['selectedResponse']
  for a,b in zip(fit['selectedExactGainsBB'],score(selected)):near(a,b)
 for key in ['rawHoldout','selectedHoldout']:assert run[key]['seed']==run['seed']+2000
print('Independent rational oracle: 24 physical-rank worlds, settlement, reach masses, action values, exact BR, both estimator variances and all response scores passed. No full MTT claim.')
