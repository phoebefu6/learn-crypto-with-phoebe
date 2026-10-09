import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
bad=[];n=[0]
def w(x,y,p):
    if isinstance(x,dict) and isinstance(y,dict):
        for k in set(x)|set(y):
            if k=='elapsedMs': continue
            if k not in x or k not in y: bad.append((p+'/'+k,'missing')); continue
            w(x[k],y[k],p+'/'+k)
    elif isinstance(x,list) and isinstance(y,list):
        if len(x)!=len(y): bad.append((p,'len %d vs %d'%(len(x),len(y)))); return
        for i,(u,v) in enumerate(zip(x,y)): w(u,v,p+'[%d]'%i)
    elif isinstance(x,(int,float)) and isinstance(y,(int,float)) and not isinstance(x,bool):
        n[0]+=1
        if abs(x-y)>1e-6*max(1,abs(x)): bad.append((p,x,y))
    else:
        n[0]+=1
        if x!=y: bad.append((p,x,y))
w(a,b,'')
print('leaves compared',n[0],'mismatches',len(bad))
for r in bad[:30]: print(r)
