"""Independent sampled-regret updates, hidden-information tree, paired holdout values.
No import of JS transition/evaluator/pot/regret code. The ideal-IID sampling assumption is separate.
"""
from pathlib import Path
from collections import Counter
from itertools import combinations
import json,hashlib,gzip,base64,math,sys
root=Path(__file__).resolve().parents[1];raw=(root/'data/mtt10-mccfr-candidate.json').read_bytes();c=json.loads(raw);a=json.loads(Path('/tmp/mtt10-mccfr-audit.json').read_text())
classes=[('AKQJT98765432'[i]+'AKQJT98765432'[j]+(''if i==j else's'if i<j else'o'))if i<=j else'AKQJT98765432'[j]+'AKQJT98765432'[i]+'o'for i in range(13)for j in range(13)]
# Canonical 13x13 grid above: offsuit lower triangle reverses ranks.
assert len(set(classes))==169
deck=[r+s for r in '23456789TJQKA'for s in 'cdhs'];MASK=2**32-1

def draw_stream(seed):
 state=seed
 def word():
  nonlocal state
  state=(state+0x6D2B79F5)&MASK;t=((state^(state>>15))*(state|1))&MASK;t^=(t+(((t^(t>>7))*(t|61))&MASK))&MASK;return(t^(t>>14))&MASK
 while True:
  pool=deck.copy();cards=[]
  for k in range(23):
   limit=2**32//len(pool)*len(pool);x=word()
   while x>=limit:x=word()
   j=x%len(pool);pool[0],pool[j]=pool[j],pool[0];cards.append(pool.pop(0))
  yield{'hands':[cards[2*p:2*p+2]for p in range(9)],'board':cards[18:]}

def hand_class(h):
 ranks=sorted([x[0]for x in h],key='23456789TJQKA'.index,reverse=True)
 return ''.join(ranks)+(''if ranks[0]==ranks[1]else's'if h[0][1]==h[1][1]else'o')

def score5(cs):
 ranks=sorted(['23456789TJQKA'.index(x[0])+2 for x in cs],reverse=True);groups=sorted(((n,r)for r,n in Counter(ranks).items()),reverse=True)
 flush=len({x[1]for x in cs})==1;u=set(ranks);u|={1}if 14 in u else set();st=max((h for h in range(5,15)if all(h-k in u for k in range(5))),default=0)
 if flush and st:return(8,st)
 if groups[0][0]==4:return(7,groups[0][1],groups[1][1])
 if [n for n,r in groups]==[3,2]:return(6,groups[0][1],groups[1][1])
 if flush:return(5,*ranks)
 if st:return(4,st)
 if groups[0][0]==3:return(3,groups[0][1],*sorted([r for n,r in groups[1:]],reverse=True))
 if [n for n,r in groups[:2]]==[2,2]:return(2,*sorted([groups[0][1],groups[1][1]],reverse=True),groups[2][1])
 if groups[0][0]==2:return(1,groups[0][1],*sorted([r for n,r in groups[1:]],reverse=True))
 return(0,*ranks)

nodes=[];infos=[]
def tree(actor=0,live=None,folded=None,jam=None,history=None):
 live=[0]*7+[.5,1]if live is None else live;folded=[False]*9 if folded is None else folded;history=[]if history is None else history;n=len(nodes);nodes.append(None)
 if actor==9 or sum(not f for f in folded)==1:
  active=[p for p in range(9)if not folded[p]];pots=[(1.,active)]
  # Independent half-BB slices, coalesced by eligibility for runtime only.
  slices={}
  for unit in range(1,max(round(2*x)for x in live)+1):
   payers=[p for p in range(9)if round(live[p]*2)>=unit];eligible=tuple(payers if len(payers)==1 else[p for p in payers if not folded[p]]);assert eligible;slices[eligible]=slices.get(eligible,0)+len(payers)*.5
  pots.extend((amount,list(eligible))for eligible,amount in slices.items());nodes[n]={'actor':-1,'pots':pots,'cost':[x+(1 if p==8 else 0)for p,x in enumerate(live)],'history':history};return n
 info=len(infos);infos.append({'player':actor,'history':history,'node':n});children=[]
 for kind in [0,1]:
  ls=live.copy();fs=folded.copy();jm=jam
  action={'seat':actor,'kind':'fold'}
  if kind:
   to=9 if actor==8 else 10;action={'seat':actor,'kind':'allin'if jam is None else'call','to':to};ls[actor]=to
   if jam is None:jm=actor
  else:fs[actor]=True
  children.append(tree(actor+1,ls,fs,jm,history+[action]))
 nodes[n]={'actor':actor,'info':info,'children':children,'history':history};return n

tree();assert len(nodes)==1021 and len(infos)==510
for i,x in enumerate(nodes):
 js=a['tree']['nodes'][i];assert x['actor']==js['actor'] and x['history']==js['state']['history']
 if x['actor']>=0:assert x['children']==js['children'] and x['info']==js['info']
assert infos==a['tree']['infos']
ROWS=510*169

def terminal_values(d):
 allcards=sum(d['hands'],[])+d['board'];assert len(allcards)==len(set(allcards))==23
 sc=[max(score5(list(cs))for cs in combinations(h+d['board'],5))for h in d['hands']];u={}
 for n,x in enumerate(nodes):
  if x['actor']>=0:continue
  val=[-v for v in x['cost']]
  for amount,eligible in x['pots']:
   best=max(sc[p]for p in eligible);win=[p for p in eligible if sc[p]==best]
   for p in win:val[p]+=amount/len(win)
  assert abs(sum(val))<1e-9;u[n]=val
 return u

def evaluate(policy,d,choices=None):
 cs=[classes.index(hand_class(h))for h in d['hands']];v=terminal_values(d);dv={n:x.copy()for n,x in v.items()}if choices is not None else None;reach=[0.]*1021;reach[0]=1
 for n,x in enumerate(nodes):
  if x['actor']>=0:
   row=x['info']*169+cs[x['actor']];q=.5 if policy[row]is None else policy[row];ch=x['children'];reach[ch[0]]=reach[n]*(1-q);reach[ch[1]]=reach[n]*q
 for n in reversed(range(1021)):
  x=nodes[n]
  if x['actor']<0:continue
  p=x['actor'];row=x['info']*169+cs[p];q=.5 if policy[row]is None else policy[row];left,right=x['children'];v[n]=[(1-q)*v[left][r]+q*v[right][r]for r in range(9)]
  if dv is not None:dv[n]=[((1-choices[row])*dv[left][r]+choices[row]*dv[right][r])if r==p else(1-q)*dv[left][r]+q*dv[right][r]for r in range(9)]
 return cs,v,reach,dv

# Strict canonical physical-deal separation across all actual training/fit/test draws.
seeds=[c['training']['seed'],c['response']['seed']]+[e['seed']for e in c['evaluations']];assert len(set(seeds))==5
ledger={};counts={}
for phase,seed,n in [('train',c['training']['seed'],c['training']['iterations']),('fit',c['response']['seed'],c['response']['samples'])]+[('test:'+str(e['seed']),e['seed'],e['samples'])for e in c['evaluations']]:
 stream=draw_stream(seed)
 for _ in range(n):
  d=next(stream);key='/'.join(''.join(sorted(h))for h in d['hands'])+'|'+''.join(sorted(d['board']));assert key not in ledger or ledger[key]==phase;ledger[key]=phase;counts[phase]=counts.get(phase,0)+1
ledger_hash=hashlib.sha256(json.dumps(sorted(ledger.items()),separators=(',',':')).encode()).hexdigest();assert counts==c['separation']['phaseCounts'] and len(ledger)==c['separation']['distinctJointDeals'] and ledger_hash==c['separation']['canonicalLedgerSha256']

# Independent 32-iteration MCCFR audit with separately implemented regret matching and chance draws.
r0=[0.]*ROWS;r1=[0.]*ROWS;sums=[0.]*ROWS;visits=[0]*1521;stream=draw_stream(a['training']['seed'])
for t in range(a['training']['iterations']):
 d=next(stream);policy=[max(0,y)/(max(0,x)+max(0,y))if max(0,x)+max(0,y)>0 else.5 for x,y in zip(r0,r1)];cs,v,reach,_=evaluate(policy,d)
 for n,x in enumerate(nodes):
  if x['actor']<0:continue
  p=x['actor'];row=x['info']*169+cs[p];sums[row]+=policy[row];left,right=x['children'];r0[row]+=reach[n]*(v[left][p]-v[n][p]);r1[row]+=reach[n]*(v[right][p]-v[n][p])
 for p in range(9):visits[p*169+cs[p]]+=1
assert visits==a['training']['visits']
for i,info in enumerate(infos):
 for h in range(169):
  count=visits[info['player']*169+h];weight=a['training']['snapshot']['aggressiveWeights'][i*169+h]
  if count:assert abs(weight/1e6-sums[i*169+h]/count)<=.500001e-6
  else:assert weight is None
update_diff=max(max(abs(x-y)for x,y in zip(arr,a['training'][name]))for name,arr in [('regret0',r0),('regret1',r1),('sums',sums)]);assert update_diff<1e-9

# Independently score three unseen seed prefixes; no fitting or action selection on scoring data.
policy=a['policy'];choices=a['choices'];fit=a['fitAudit'];fa=[0.]*ROWS;fb=[0.]*ROWS;fit_draw=draw_stream(fit['seed'])
for _ in range(fit['samples']):
 cs,v,reach,_=evaluate(policy,next(fit_draw))
 for n,x in enumerate(nodes):
  if x['actor']>=0:
   p=x['actor'];row=x['info']*169+cs[p];left,right=x['children'];fa[row]+=reach[n]*v[left][p];fb[row]+=reach[n]*v[right][p]
fit_loss=max(max(x,y)-[x,y][fit['choices'][i]]for i,(x,y)in enumerate(zip(fa,fb)));assert fit_loss<1e-9
assert len(policy)==len(choices)==ROWS;eval_reports=[]
for ref in a['evaluations']:
 stream=draw_stream(ref['seed']);sums=[0.]*9;sq=[0.]*9;base=[0.]*9;deviations=[0.]*9
 for _ in range(ref['samples']):
  cs,v,reach,dv=evaluate(policy,next(stream),choices)
  for p in range(9):
   gain=dv[0][p]-v[0][p];sums[p]+=gain;sq[p]+=gain*gain;base[p]+=v[0][p];deviations[p]+=dv[0][p]
 n=ref['samples'];diff=max(abs(sums[p]/n-ref['gains'][p]['meanBB'])for p in range(9));assert diff<1e-9
 for p in range(9):
  assert abs(base[p]/n-ref['meanValuesBB'][p])<1e-9 and abs(deviations[p]/n-ref['meanDeviationValuesBB'][p])<1e-9
  se=math.sqrt(max(0,(sq[p]-sums[p]*sums[p]/n)/(n-1))/n);assert abs(se-ref['gains'][p]['standardErrorBB'])<1e-9
 radius=180*math.sqrt(math.log(18/ref['alpha'])/(2*n));assert abs(radius-ref['hoeffdingRadiusBB'])<1e-10
 eval_reports.append({'seed':ref['seed'],'samplesChecked':n,'maxPairedGainDifferenceBB':diff})

out={'schemaVersion':1,'passed':True,'candidateSha256':hashlib.sha256(raw).hexdigest(),'method':'independent Python shuffle, five-card subsets, rebuilt public tree, half-BB pots, standard sampled regret updates and paired fixed-deviation values','trainingAuditIterations':a['training']['iterations'],'maxRegretUpdateDifference':update_diff,'fitAuditSamples':fit['samples'],'maxFitChoiceLossBB':fit_loss,'physicalDealSeparationChecked':len(ledger),'canonicalLedgerSha256':ledger_hash,'holdoutAudits':eval_reports,'fullDeckBestResponseUpperBoundVerified':False,'nashConvergenceVerified':False,'strategyPublishedToApp':False}
path=root/'data/mtt10-mccfr-independent.json';content=json.dumps(out,indent=2)+'\n'
if '--check'in sys.argv:assert path.read_text()==content,'Stale independent MCCFR validation'
else:path.write_text(content)
print(json.dumps(out))
