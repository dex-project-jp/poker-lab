"""Independent HiGHS primal/dual LPs. Reads integer equity counts directly.
No JS solver code is imported. scipy==1.17.0. --all solves every integer 5..20BB.
"""
import sys, json, struct, hashlib
from pathlib import Path
import numpy as np
from scipy.optimize import linprog
import scipy
root=Path(__file__).resolve().parents[1]
raw=(root/'data/equity169.bin').read_bytes()
assert raw[:8]==b'NUTSE169' and struct.unpack_from('<II',raw,8)==(169,1712304)
counts=np.frombuffer(raw,dtype='<u4',offset=16,count=169*169).reshape(169,169).astype(float)
half=np.frombuffer(raw,dtype='<u4',offset=114260,count=169*169).reshape(169,169).astype(float)
assert counts.sum()==1326*1225 and np.array_equal(counts,counts.T)
assert np.array_equal(half+half.T,2*1712304*counts)
w=counts/(1326*1225)

def solve(stack):
    # Chance-weighted showdown payoff, derived directly from integer half pots.
    called=stack*(half/1712304-counts)/(1326*1225)
    b=called-w
    a=1.5*w.sum(axis=1)
    # Scale the LP so tiny probability-weighted payoff differences are resolved.
    scale=1e6
    options={'dual_feasibility_tolerance':1e-10,'primal_feasibility_tolerance':1e-10}
    sb=linprog(scale*np.r_[-a,-np.ones(169)],A_ub=scale*np.c_[-b.T,np.eye(169)],b_ub=np.zeros(169),bounds=[(0,1)]*169+[(None,0)]*169,method='highs',options=options)
    bb=linprog(scale*np.r_[np.zeros(169),np.ones(169)],A_ub=scale*np.c_[b,-np.eye(169)],b_ub=-scale*a,bounds=[(0,1)]*169+[(0,None)]*169,method='highs',options=options)
    assert sb.success and bb.success, (sb.message,bb.message)
    p,q=sb.x[:169],bb.x[:169]
    value=-.5+a@p+p@b@q
    sb_br=-.5+np.maximum(0,a+b@q).sum()
    bb_min=-.5+a@p+np.minimum(0,p@b).sum()
    assert sb_br-bb_min < 1e-8
    return {'method':'independent primal/dual linear programs, scipy HiGHS','scipy':scipy.__version__,'matrixSha256':hashlib.sha256(raw).hexdigest(),'stackBB':stack,'sbShove':p.tolist(),'bbCall':q.tolist(),'value':float(value),'lowerBound':float(-sb.fun/scale-.5),'upperBound':float(bb.fun/scale-.5),'nashGap':float(sb_br-bb_min),'verified':False}

def check(old,new):
    assert old['stackBB']==new['stackBB'] and old['matrixSha256']==new['matrixSha256']
    assert max(abs(a-b) for key in ['sbShove','bbCall'] for a,b in zip(old[key],new[key],strict=True))<1e-9
    assert abs(old['value']-new['value'])<1e-10

if __name__=='__main__':
    all_stacks='--all' in sys.argv
    results=[solve(s) for s in (range(5,21) if all_stacks else [10])]
    target=root/('data/independent-hu.json' if all_stacks else 'data/independent-lp.json')
    result={'schemaVersion':1,'solutions':results} if all_stacks else results[0]
    if '--check' in sys.argv:
        previous=json.loads(target.read_text())
        if all_stacks:
            assert len(previous['solutions'])==len(results)
            for old,new in zip(previous['solutions'],results,strict=True): check(old,new)
        else: check(previous,result)
    else:
        if len(sys.argv)>1 and not sys.argv[1].startswith('--'):target=Path(sys.argv[1])
        target.write_text(json.dumps(result,indent=2)+'\n')
    for r in results:print(json.dumps({k:v for k,v in r.items() if k not in ['sbShove','bbCall']}))
