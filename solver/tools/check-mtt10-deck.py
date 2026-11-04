"""Independent integer shuffle, five-card ranking, half-BB slices and empirical BR.
Does not import JS algorithms. Same deterministic PRNG is replayed for equality,
not offered as independent randomness or a proof of Monte Carlo coverage.
"""
from pathlib import Path
from collections import Counter
from fractions import Fraction as F
from itertools import combinations
import json,hashlib,math,sys
root=Path(__file__).resolve().parents[1]
raw=(root/'data/mtt10-deck-candidate.json').read_bytes();c=json.loads(raw)
deck=[r+s for r in '23456789TJQKA'for s in 'cdhs'];mask=2**32-1

def rng(seed):
 a=seed
 while True:
  a=(a+0x6D2B79F5)&mask;t=((a^(a>>15))*(a|1))&mask
  t^=(t+(((t^(t>>7))*(t|61))&mask))&mask
  yield(t^(t>>14))&mask

def deals(seed,known={},prefix=[]):
 words=rng(seed);fixed=sum(known.values(),[])+prefix;assert len(set(fixed))==len(fixed)
 while True:
  available=[x for x in deck if x not in fixed];holes=[None]*9
  def draw():
   n=len(available);limit=(2**32//n)*n;x=next(words)
   while x>=limit:x=next(words)
   i=x%n
   # Same Fisher-Yates ordering, using removal-by-swap instead of cursor swaps.
   card=available[i];available[0],available[i]=available[i],available[0];available.pop(0);return card
  for p in range(9):holes[p]=known[str(p)].copy()if str(p)in known else[draw(),draw()]
  board=prefix.copy()
  while len(board)<5:board.append(draw())
  assert len(set(sum(holes,[])+board))==23
  yield{'hands':holes,'board':board}

def score5(cs):
 ranks=sorted(['23456789TJQKA'.index(x[0])+2 for x in cs],reverse=True);groups=sorted(((n,r)for r,n in Counter(ranks).items()),reverse=True)
 flush=len({x[1]for x in cs})==1;u=set(ranks);u|={1}if 14 in u else set();straight=max((h for h in range(5,15)if all(h-k in u for k in range(5))),default=0)
 if flush and straight:return(8,straight)
 if groups[0][0]==4:return(7,groups[0][1],groups[1][1])
 if [n for n,r in groups]==[3,2]:return(6,groups[0][1],groups[1][1])
 if flush:return(5,*ranks)
 if straight:return(4,straight)
 if groups[0][0]==3:return(3,groups[0][1],*sorted([r for n,r in groups[1:]],reverse=True))
 if [n for n,r in groups[:2]]==[2,2]:return(2,*sorted([groups[0][1],groups[1][1]],reverse=True),groups[2][1])
 if groups[0][0]==2:return(1,groups[0][1],*sorted([r for n,r in groups[1:]],reverse=True))
 return(0,*ranks)

def scores(d):return[max(score5(list(cs))for cs in combinations(h+d['board'],5))for h in d['hands']]
def settle(s,sc):
 live=s['live'];ante=s['ante'];folded=s['folded'];awards=[F(0)]*9;refunds=[F(0)]*9
 def award(amount,eligible):
  assert eligible;best=max(sc[p]for p in eligible);win=[p for p in eligible if sc[p]==best]
  for p in win:awards[p]+=F(amount,len(win))
 award(F(sum(ante)),[p for p in range(9)if not folded[p]])
 for unit in range(1,max(round(2*x)for x in live)+1):
  payers=[p for p in range(9)if round(live[p]*2)>=unit]
  if len(payers)==1:awards[payers[0]]+=F(1,2);refunds[payers[0]]+=F(1,2)
  else:award(F(len(payers),2),[p for p in payers if not folded[p]])
 utility=[awards[p]-F(live[p])-F(ante[p])for p in range(9)];assert sum(utility)==0
 return utility,awards,refunds

# Independent replay and ranking for every simulation draw (60,000 full nine-hand showdowns).
reports=[]
for scenario in c['scenarios']:
 draw=deals(scenario['seed'],scenario['knownHands'],scenario['boardPrefix']);sums=[0.]*9;squares=[0.]*9;util=[0.]*9;ties=0
 for i in range(scenario['samples']):
  d=next(draw);sc=scores(d);active=[p for p in range(9)if not scenario['state']['folded'][p]];best=max(sc[p]for p in active);win=[p for p in active if sc[p]==best];ties+=len(win)>1
  u,_,_=settle(scenario['state'],sc)
  for p in range(9):
   share=1/len(win)if p in win else 0;sums[p]+=share;squares[p]+=share**2;util[p]+=float(u[p])
 n=scenario['samples'];assert ties==scenario['ties'];difference=max(abs(sums[p]/n-scenario['equity'][p]['mean'])for p in range(9));udiff=max(abs(util[p]/n-scenario['utilityBB'][p]['mean'])for p in range(9));assert difference<1e-12 and udiff<1e-10
 radius=math.sqrt(math.log(18/scenario['alpha'])/(2*n));assert abs(radius-scenario['equityRadius'])<1e-15
 for p in range(9):
  assert abs(max(0,sums[p]/n-radius)-scenario['equity'][p]['lower'])<1e-12
  assert abs(min(1,sums[p]/n+radius)-scenario['equity'][p]['upper'])<1e-12
  se=math.sqrt(max(0,(squares[p]-sums[p]**2/n)/(n-1))/n);assert abs(se-scenario['equity'][p]['standardError'])<1e-12
 if scenario['id']=='all-nine-random':assert all(x['lower']<=1/9<=x['upper']for x in scenario['equity'])
 reports.append({'id':scenario['id'],'showdownsChecked':n,'equityMaxDifference':difference,'utilityMaxDifferenceBB':udiff,'equityRadius':radius})

# Empirical training diagnostic: verify every compiled terminal and independently evaluate all nine BRs.
graw=Path('/tmp/mtt10-deck-tree.json').read_bytes();g=json.loads(graw);e=c['empirical'];draw=deals(e['seed']);ds=[next(draw)for _ in range(e['samples'])];assert ds==g['deals'];ranked=[scores(d)for d in ds]
policy=e['policy'];assert len(policy)==len(g['infos']);assert all(len(row)==2 and min(row)>=0 and abs(sum(row)-1)<1e-10 for row in policy)
nodes=g['nodes'];v=[None]*len(nodes);terminals=0
for n in reversed(range(len(nodes))):
 x=nodes[n]
 if x['actor']<0:
  u,_,_=settle(x['state'],ranked[x['ticket']]);assert max(abs(float(u[p])-x['utility'][p])for p in range(9))<1e-10;v[n]=list(map(float,u));terminals+=1
 else:v[n]=[sum(policy[x['info']][k]*v[ch][p]for k,ch in enumerate(x['children']))for p in range(9)]
# Private combo + public history only; no ticket, board or opponent cards in information keys.
for info in g['infos']:
 for n in info['members']:
  x=nodes[n];p=info['player'];ids=sorted(deck.index(card)for card in ds[x['ticket']]['hands'][p]);assert info['combo']==','.join(map(str,ids)) and x['actor']==p and x['state']['history']==info['history']
values=[sum(v[r][p]for r in g['roots'])/len(ds)for p in range(9)];br=[]
for p in range(9):
 coeff={i:[0.,0.]for i,info in enumerate(g['infos'])if info['player']==p};constant=[0.]
 def walk(n,reach):
  x=nodes[n]
  if x['actor']<0:constant[0]+=reach*v[n][p]
  elif x['actor']==p:
   for k,ch in enumerate(x['children']):coeff[x['info']][k]+=reach*v[ch][p]
  else:
   for k,ch in enumerate(x['children']):walk(ch,reach*policy[x['info']][k])
 for r in g['roots']:walk(r,1/len(ds))
 br.append(constant[0]+sum(max(row)for row in coeff.values()))
gains=[max(0,br[p]-values[p])for p in range(9)];epsilon=max(gains);assert abs(epsilon-e['epsilonOnTrainingTicketsBB'])<1e-9
out={'schemaVersion':1,'passed':True,'candidateSha256':hashlib.sha256(raw).hexdigest(),'treeSha256':hashlib.sha256(graw).hexdigest(),'independentMethod':'Python removal-shuffle replay, 21 five-card subsets, half-BB pot slices, per-information-set empirical best responses','scenarios':reports,'empirical':{'terminalsChecked':terminals,'values':values,'bestResponses':br,'epsilonOnTrainingTicketsBB':epsilon,'fullDeckBestResponseVerified':False},'fullMTTGTO':False,'strategyPublished':False}
content=json.dumps(out,indent=2)+'\n';path=root/'data/mtt10-deck-independent.json'
if '--check'in sys.argv:assert path.read_text()==content,'Stale deck validation'
else:path.write_text(content)
print(json.dumps({'passed':True,'showdownsChecked':sum(x['showdownsChecked']for x in reports),'empiricalTerminalsChecked':terminals,'epsilonOnTrainingTicketsBB':epsilon}))
