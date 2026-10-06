/* 필드 보스 출현 주기 — 리니지식 «주기 창» (docs/design/186 §3, 188 §6)
   시간축을 period 로 자른다. 주기마다 [start, end) 창 안의 무작위 시각에 한 번 나온다.
   chance 는 그 주기에 나올 확률 — 실패하면 그 주기는 건너뛴다.
   죽으면 같은 창에서는 다시 나오지 않는다 — 다음 주기의 창에서만.
   설계만 L1J 에서 배웠다(코드는 가져오지 않았다 — GPL). */
const UNIT={ s:1e3, m:6e4, h:36e5, d:864e5 };
/* '2h' · '30m' · '1h30m' · 숫자(ms) → ms */
function ms(v){
 if(Number.isFinite(v)) return v;
 if(typeof v!=='string') throw Error('시간 형식: '+v);
 let t=0, ok=false; v.replace(/(\d+(?:\.\d+)?)([smhd])/g,(_,n,u)=>{ t+=Number(n)*UNIT[u]; ok=true; });
 if(!ok) throw Error('시간 형식: '+v); return t;
}
/* 시간 배율 — 시험·촬영 때 BOSS_TIME_SCALE=0.01 이면 2시간 주기가 72초가 된다 */
function norm(c, scale=1){
 const period=ms(c.period)*scale, start=ms(c.start||0)*scale, end=ms(c.end||c.period)*scale, chance=c.chance==null?1:c.chance;
 if(!(period>0)||start<0||end>period||end<=start) throw Error('주기 창이 잘못되었습니다: '+JSON.stringify(c));
 if(!(chance>0&&chance<=1)) throw Error('출현 확률은 0 보다 크고 1 이하: '+chance);
 return { period, start, end, chance };
}
/* after 이후 첫 출현 시각. dead=true 면 after 가 든 주기는 건너뛴다(같은 창에 두 번은 없다). */
function nextSpawn(cycle, after, { rng=Math.random, dead=false }={}){
 const c=cycle.period?cycle:norm(cycle);
 let k=Math.floor(after/c.period)+(dead?1:0);
 for(let i=0;i<1000;i++,k++){
  const base=k*c.period, a=Math.max(after, base+c.start), b=base+c.end;
  if(a>=b) continue;                       /* 이 주기의 창은 이미 지났다 */
  if(rng()>=c.chance) continue;             /* 이 주기는 안 나온다 */
  return Math.floor(a+rng()*(b-a));
 }
 throw Error('출현 시각을 찾지 못했습니다');
}
/* 지금 창이 열려 있나 (알림용: «곧 나온다») */
function windowOf(cycle, t){ const c=cycle.period?cycle:norm(cycle), base=Math.floor(t/c.period)*c.period; return { from:base+c.start, to:base+c.end }; }
module.exports={ ms, norm, nextSpawn, windowOf };
