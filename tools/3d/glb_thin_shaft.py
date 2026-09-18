#!/usr/bin/env python3
"""낫 자루 두께 조정: 날 머리(Y_HEAD) 아래 정점의 자루 축 기준 반경을 K 배로 (축은 높이별 단면 중심에 직선 맞춤).
사용: python3 glb_thin_shaft.py in.glb out.glb K Y_HEAD"""
import sys, struct, json, numpy as np
src,dst,K,YH=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4])
d=bytearray(open(src,'rb').read()); jl=struct.unpack('<I',d[12:16])[0]; j=json.loads(d[20:20+jl]); off=20+jl; bl=struct.unpack('<I',d[off:off+4])[0]; b0=off+8
for m in j['meshes']:
    for p in m['primitives']:
        acc=j['accessors'][p['attributes']['POSITION']]; bv=j['bufferViews'][acc['bufferView']]; assert bv.get('byteStride',12)==12
        base=b0+bv['byteOffset']+acc.get('byteOffset',0); n=acc['count']
        arr=np.frombuffer(bytes(d[base:base+n*12]), dtype=np.float32).reshape(-1,3).copy()
        y=arr[:,1]; cy=[]; cx=[]; cz=[]
        for lo in np.arange(0.35, YH-0.05, 0.1):
            s=(y>=lo)&(y<lo+0.1)
            if s.sum()>20: cy.append(lo+0.05); cx.append((arr[s,0].min()+arr[s,0].max())/2); cz.append((arr[s,2].min()+arr[s,2].max())/2)
        fx=np.polyfit(cy,cx,1); fz=np.polyfit(cy,cz,1)
        ax=np.polyval(fx,y); az=np.polyval(fz,y)
        w=np.clip((YH-y)/0.08,0,1)          # 머리 8cm 구간에서 1→K 로 부드럽게
        k=1+(K-1)*w
        arr[:,0]=ax+(arr[:,0]-ax)*k; arr[:,2]=az+(arr[:,2]-az)*k
        d[base:base+n*12]=arr.astype(np.float32).tobytes()
        acc['min']=arr.min(0).tolist(); acc['max']=arr.max(0).tolist()
        print('axis x(y)=%.3f*y%+.3f  z(y)=%.3f*y%+.3f  scaled %d verts'%(fx[0],fx[1],fz[0],fz[1],(w>0).sum()))
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4: js+=b' '
body=bytes(d[b0:b0+bl]); total=12+8+len(js)+8+len(body)
with open(dst,'wb') as f: f.write(b'glTF'+struct.pack('<II',2,total)); f.write(struct.pack('<I',len(js))+b'JSON'+js); f.write(struct.pack('<I',len(body))+b'BIN\0'+body)
print('wrote',dst)
