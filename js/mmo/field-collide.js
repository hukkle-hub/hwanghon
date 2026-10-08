/* 필드 걷기 충돌 — 길 좌표 띠 + 실측 건물 윤곽·상자·강 띠. mmo.html 의 것과 같은 규칙 (3D 필드 world3d.html 이 쓴다, 문서 206).
   meta = map.json 또는 env 빌더가 돌려준 { road, walk, blockers } */
export function createCollide(meta) {
  const ANG=meta.road.ang, ca=Math.cos(ANG), sa=Math.sin(ANG);
function toRoad(x,z){ return [x*ca - z*sa, -x*sa - z*ca]; }           /* (s, t) — env-gangnam 의 DIR·SIDE 기준 */
function fromRoad(s,t){ return [s*ca - t*sa, -s*sa - t*ca]; }
/* 실측 건물 윤곽(다각형) — 안이면 가장 가까운 변 밖으로, 밖이라도 반지름 안이면 밀어낸다 */
function polyPush(p, poly, r){ let inside=false, best=1e9, bx=0, bz=0;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i], b=poly[j];
    if((a[1]>p.z)!==(b[1]>p.z) && p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    const vx=b[0]-a[0], vz=b[1]-a[1], L2=vx*vx+vz*vz||1, u=Math.max(0,Math.min(1,((p.x-a[0])*vx+(p.z-a[1])*vz)/L2)), qx=a[0]+vx*u, qz=a[1]+vz*u, d=(p.x-qx)**2+(p.z-qz)**2;
    if(d<best){ best=d; bx=qx; bz=qz; } }
  const d=Math.sqrt(best); if(!inside&&d>=r) return; let nx=p.x-bx, nz=p.z-bz; const n=Math.hypot(nx,nz)||1; nx/=n; nz/=n; if(inside){ nx=-nx; nz=-nz; }
  const push=inside?d+r:r-d; p.x+=nx*push; p.z+=nz*push; }
function collide(p, r=0.35){ let [s,t]=toRoad(p.x,p.z); s=Math.min(meta.walk.s1,Math.max(meta.walk.s0,s)); t=Math.min(meta.walk.t1,Math.max(meta.walk.t0,t)); [p.x,p.z]=fromRoad(s,t);
  for(const b of meta.blockers){ if(b.line){ /* 강·하천 띠 (env-lib lines) — 중심선에서 반폭 + r 밖으로 */ const bb=b.bb||(b.bb=b.line.reduce((a,q)=>[Math.min(a[0],q[0]-b.w),Math.min(a[1],q[1]-b.w),Math.max(a[2],q[0]+b.w),Math.max(a[3],q[1]+b.w)],[1e9,1e9,-1e9,-1e9]));
      if(p.x<bb[0]-r||p.x>bb[2]+r||p.z<bb[1]-r||p.z>bb[3]+r) continue; let best=1e9,qx=0,qz=0; for(let i=1;i<b.line.length;i++){ const a=b.line[i-1],c=b.line[i],vx=c[0]-a[0],vz=c[1]-a[1],L2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((p.x-a[0])*vx+(p.z-a[1])*vz)/L2)),x=a[0]+vx*u,z=a[1]+vz*u,d=(p.x-x)**2+(p.z-z)**2; if(d<best){ best=d; qx=x; qz=z; } }
      const d=Math.sqrt(best), lim=b.w+r; if(d<lim){ const nx=(p.x-qx)/(d||1), nz=(p.z-qz)/(d||1); p.x=qx+nx*lim; p.z=qz+nz*lim; } continue; }
    if(b.poly){ const bb=b.bb||(b.bb=b.poly.reduce((a,q)=>[Math.min(a[0],q[0]),Math.min(a[1],q[1]),Math.max(a[2],q[0]),Math.max(a[3],q[1])],[1e9,1e9,-1e9,-1e9]));
      if(p.x<bb[0]-r||p.x>bb[2]+r||p.z<bb[1]-r||p.z>bb[3]+r) continue; polyPush(p,b.poly,r); continue; }
    if((p.x-b.x)**2+(p.z-b.z)**2>(Math.max(b.hw,b.hd)+r+0.5)**2) continue;
    const c=Math.cos(b.rot), sn=Math.sin(b.rot), dx=p.x-b.x, dz=p.z-b.z;
    /* 상자 로컬 = Ry(-rot)·(p-c) */ const lx=dx*c - dz*sn, lz=dx*sn + dz*c;
    const qx=Math.max(-b.hw,Math.min(b.hw,lx)), qz=Math.max(-b.hd,Math.min(b.hd,lz)); let ex=lx-qx, ez=lz-qz, d=Math.hypot(ex,ez);
    if(d>=r) continue;
    if(d<1e-4){ /* 상자 안 — 가까운 면으로 밀어낸다 */ const ox=b.hw-Math.abs(lx), oz=b.hd-Math.abs(lz);
      if(ox<oz){ ex=Math.sign(lx)||1; ez=0; d=-ox; } else { ex=0; ez=Math.sign(lz)||1; d=-oz; } }
    const n=Math.hypot(ex,ez)||1, nx=ex/n, nz=ez/n, push=r-d;
    p.x+=(nx*c + nz*sn)*push; p.z+=(-nx*sn + nz*c)*push; } }   /* Ry(rot) 로 되돌림 */
  return { toRoad, fromRoad, collide, polyPush };
}
