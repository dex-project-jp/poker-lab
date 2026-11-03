"""Independent HiGHS LP solution. Reads integer table directly, no JS solver code.
Requires scipy==1.17.0, numpy. Outputs full precision, no fabricated frequencies.
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
# Directly use integer half-pot sums: called payoff, weighted by chance.
called=10*(half/1712304-counts)/(1326*1225)
b=called-w
a=1.5*w.sum(axis=1)
# SB maximizes -.5 + a.p + sum(min(0, B[:,j].p)).
sb=linprog(np.r_[-a,-np.ones(169)],A_ub=np.c_[-b.T,np.eye(169)],b_ub=np.zeros(169),bounds=[(0,1)]*169+[(None,0)]*169,method='highs',options={'dual_feasibility_tolerance':1e-9,'primal_feasibility_tolerance':1e-9})
# BB minimizes -.5 + sum(max(0, a[i]+B[i,:].q)).
bb=linprog(np.r_[np.zeros(169),np.ones(169)],A_ub=np.c_[b,-np.eye(169)],b_ub=-a,bounds=[(0,1)]*169+[(0,None)]*169,method='highs',options={'dual_feasibility_tolerance':1e-9,'primal_feasibility_tolerance':1e-9})
assert sb.success and bb.success, (sb.message,bb.message)
p,q=sb.x[:169],bb.x[:169]
value=-.5+a@p+p@b@q
sb_br=-.5+np.maximum(0,a+b@q).sum()
bb_min=-.5+a@p+np.minimum(0,p@b).sum()
assert sb_br-bb_min < 1e-8
result={'method':'independent primal/dual linear programs, scipy HiGHS','scipy':scipy.__version__,'matrixSha256':hashlib.sha256(raw).hexdigest(),'stackBB':10,'sbShove':p.tolist(),'bbCall':q.tolist(),'value':float(value),'lowerBound':float(-sb.fun-.5),'upperBound':float(bb.fun-.5),'nashGap':float(sb_br-bb_min),'verified':False}
if len(sys.argv)>1 and sys.argv[1]=='--check':
    previous=json.loads((root/'data/independent-lp.json').read_text())
    assert previous['matrixSha256']==result['matrixSha256']
    assert max(abs(a-b) for key in ['sbShove','bbCall'] for a,b in zip(previous[key],result[key],strict=True))<1e-9
    assert abs(previous['value']-result['value'])<1e-10
else:
    Path(sys.argv[1] if len(sys.argv)>1 else root/'data/independent-lp.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['sbShove','bbCall']}))
