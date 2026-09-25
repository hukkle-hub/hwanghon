/* 스킬 모션 이벤트 (docs/design/89) — 한 스킬 = 한 번 맞는 판정이 아니라, 모션을 따라 여러 «사건» 이 난다.
   GPT 설계(20종: 다단 접점 · 투척 release → detonate · 회복 결계)를 이 저장소 전투 규칙에 맞춰 옮긴 것.

   스킬 데이터(js/dungeons.js SKILLS)의 ev:
     { type:'hit',   hits:[[클립 비율, 가중치], ...] }            근접 — 가중치 합 1, 한 번 이상
     { type:'throw', at:클립 비율, flight:초, blasts:[[지연 초, 가중치], ...] }   손을 떠나고(release) 날아가 터진다(detonate)
     { type:'dodge' } · { type:'buff' } · { type:'heal', frac:최대 체력 비율 }   판정 없음
   가중치는 «총 배율을 나눈다» — 다단이 된다고 피해가 늘지 않는다.

   클립 비율 → 행동 시각: 판정 시각(hitAt)이 클립의 접점(clipHit)에 못 박혀 있으므로
   그 앞은 [0, clipHit] → [0, hitAt], 뒤는 [clipHit, 1] → [hitAt, duration] 으로 곧게 편다.
   (화면은 js/combat-motion.js 가 이 사이를 곡선으로 깎지만 끝점은 같다 — 오차는 몇 프레임.)
   솔로(js/combat.js)와 온라인(server/raid.cjs)이 같은 함수를 쓴다. */
(function(root){
  'use strict';
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function timeOf(frac,a){
    var c=clamp(a.clipHit||.5,.01,.99),f=clamp(frac,0,1);
    return f<=c?a.hitAt*f/c:a.hitAt+(a.duration-a.hitAt)*(f-c)/(1-c);
  }
  /* 행동 a 에 대한 사건표. 없으면(평타·스매시·카운터) null — 예전처럼 hitAt 한 번. */
  function schedule(ev,a){
    if(!ev)return null;
    if(ev.type==='hit'&&ev.hits&&ev.hits.length){
      return ev.hits.map(function(h,i){return {kind:'hit',t:Math.min(a.duration,timeOf(h[0],a)),w:h[1],i:i,n:ev.hits.length};})
        .sort(function(x,y){return x.t-y.t;});
    }
    if(ev.type==='throw'){
      return [{kind:'release',t:Math.min(a.duration,timeOf(ev.at!=null?ev.at:a.clipHit,a)),w:1,i:0,n:1,
        flight:ev.flight||.28,blasts:(ev.blasts||[[0,1]]).map(function(b,i,all){return {delay:b[0],w:b[1],i:i,n:all.length};})}];
    }
    return null;
  }
  /* 검사용: 계약이 맞는가 (tests/skill-events.test.cjs) */
  function validate(k){
    var e=k&&k.ev;if(!e)return 'ev 없음';
    var sum=function(list){return list.reduce(function(s,h){return s+h[1];},0);};
    if(e.type==='hit'){if(!(e.hits&&e.hits.length))return 'hits 비었음';if(Math.abs(sum(e.hits)-1)>1e-6)return '가중치 합 '+sum(e.hits);
      for(var i=0;i<e.hits.length;i++)if(!(e.hits[i][0]>=0&&e.hits[i][0]<=1))return '클립 비율 범위 밖';if(!(k.mult>0))return '배율 없음';return null;}
    if(e.type==='throw'){var b=e.blasts||[[0,1]];if(Math.abs(sum(b)-1)>1e-6)return '폭발 가중치 합 '+sum(b);if(!(e.flight>0))return 'flight 없음';if(!(k.mult>0))return '배율 없음';return null;}
    if(e.type==='dodge')return k.dodge?null:'dodge 인데 회피 아님';
    if(e.type==='buff')return k.buff?null:'buff 인데 버프 없음';
    if(e.type==='heal')return k.buff&&e.frac>0?null:'heal 은 버프+회복 비율';
    return '모르는 type '+e.type;
  }
  var api={schedule:schedule,timeOf:timeOf,validate:validate};
  root.TW_SKILL_EVENTS=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
