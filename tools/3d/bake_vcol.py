# Hi3D 4-뷰 PNG → 정점 색 투영 (임시 컬러). 프레임: Y-up, 정면 +Z, 캐릭터 왼쪽 +X
import trimesh, numpy as np
from PIL import Image
m=trimesh.load('glb/ain_small.glb', force='mesh')   # 노드 회전(+90°X) 적용됨 → Y-up
v=m.vertices.copy(); n=m.vertex_normals.copy()
lo,hi=v.min(0),v.max(0); s=1.68/(hi[1]-lo[1])
v=(v-[(lo[0]+hi[0])/2, lo[1], (lo[2]+hi[2])/2])*s
lo,hi=v.min(0),v.max(0)
# 뷰: (파일, 카메라방향 벡터, 화면 오른쪽 축 (axis, sign), 가로 범위 축)
VIEWS=[('glb/ain_view1.png',np.array([0,0,1.]),(0,+1)), ('glb/ain_view2.png',np.array([1.,0,0]),(2,-1)),
       ('glb/ain_view3.png',np.array([0,0,-1.]),(0,-1)), ('glb/ain_view4.png',np.array([-1.,0,0]),(2,+1))]
imgs=[]; 
for f,d,(ax,sg) in VIEWS:
    a=np.asarray(Image.open(f).convert('RGB')).astype(np.int16); bg=a[5,5]; mask=(np.abs(a-bg).sum(2)>40)
    ys,xs=np.where(mask); imgs.append((a,mask,xs.min(),xs.max(),ys.min(),ys.max()))
N=len(v); acc=np.zeros((N,3)); wsum=np.zeros(N)
def srgb2lin(c):
    c=c/255.0; return np.where(c<=0.04045, c/12.92, ((c+0.055)/1.055)**2.4)
for vi,(f,d,(ax,sg)) in enumerate(VIEWS):
    a,mask,x0,x1,y0,y1=imgs[vi]
    w=np.clip(n@d,0,1)**2; sel=np.where(w>0.02)[0]
    h=v[sel,ax]*sg; hlo,hhi=(lo[ax],hi[ax]) if sg>0 else (-hi[ax],-lo[ax])
    u=(h-hlo)/(hhi-hlo); t=(hi[1]-v[sel,1])/(hi[1]-lo[1])
    px=np.clip((x0+u*(x1-x0)).astype(int),0,a.shape[1]-1); py=np.clip((y0+t*(y1-y0)).astype(int),0,a.shape[0]-1)
    ok=mask[py,px]
    acc[sel[ok]]+=srgb2lin(a[py[ok],px[ok]].astype(float))*w[sel[ok]][:,None]; wsum[sel[ok]]+=w[sel[ok]]
got=wsum>0; col=np.zeros((N,3)); col[got]=acc[got]/wsum[got][:,None]
col=np.clip(col*255,0,255)
print('direct hits',got.sum(),'/',N)
# 나머지: 이웃 평균으로 채움
adj=m.vertex_neighbors
for it in range(12):
    miss=np.where(~got)[0]
    if len(miss)==0: break
    newc={}; 
    for i in miss:
        nb=[j for j in adj[i] if got[j]]
        if nb: newc[i]=col[nb].mean(0)
    for i,c in newc.items(): col[i]=c; got[i]=True
    print('fill pass',it,len(newc),'left',(~got).sum())
col[~got]=[8,7,8]
out=trimesh.Trimesh(vertices=v, faces=m.faces, vertex_normals=n, process=False)
out.visual=trimesh.visual.ColorVisuals(out, vertex_colors=np.hstack([col,np.full((N,1),255)]).astype(np.uint8))
out.export('/home/user/hwanghon/art/3d/ain_hi3d_vcol_v1.glb')
print('exported', out.bounds)
