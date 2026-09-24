/* 스매시 «타점» — 날이 스윙의 어느 지점에서 맞았나에 따라 위력이 달라진다.
 *
 * 디렉터: 「스매쉬의 속도도 처음과 중간 마지막이 달라야하고. 그 지점에 따라
 * 데미지도 달라야하지」.
 *
 * 판정 «시각» 은 그대로다(접점 hitAt 한 순간 — combat.js impact). 바뀌는 건
 * 그 순간의 «기하» 로 정하는 위력 배율 하나다:
 *
 *   1) 언제 만났나 (u) — 부위 높이로 정한다.
 *      스매시는 머리 위에서 내려찍는다. 두손 리그는 2.0~3.25 m 부위를 향해
 *      접점 자세를 들어 올려 준다(js/ain-two-hand.js raised). 그래서
 *        · 1.3~2.85 m (몸통·핵·다리 대부분) → 내려치기 끝, 가장 빠른 곳 = 정타
 *        · 3.0 m 위 (머리)              → 날이 아직 내려오기 시작한 곳 = 처음
 *        · 1.2 m 아래                   → 접점을 지나 물린 뒤 = 끝
 *      앵커는 tools/3d/swing-point-table.mjs 로 잰 날끝 높이 궤적에서 잡았다
 *      (u .29 → 2.45 m, .346 → 2.08, .401 → 1.26, .453 → 0.54) +
 *      raised 가 들어 올리는 범위.
 *
 *   2) 그때 날이 얼마나 빨랐나 (v) — SPEED 표. 세 박자 템포(js/swing-body.js)가
 *      만든 자루 각속도를 최댓값 1 로 정규화한 것. js/ain-two-hand.js 의
 *      ainPathDir 로 잰 값이고(tools/3d/swing-speed-table.mjs) tests/swing-point.test.mjs 가 실제 곡선과
 *      어긋나지 않는지 지킨다(템포를 바꾸면 이 표를 다시 뽑아야 한다).
 *
 *   3) 날의 어디로 맞았나 (ρ) — 거리. 선속도 = 각속도 × 반지름. 붙어서 치면
 *      자루(손잡이 쪽)로 맞고, 사거리 끝에서 치면 날끝으로 맞는다.
 *
 *   배율 = 0.70 + 0.45 · (v · ρ)      → 날끝 정타 1.15 · 보통 ≈1.0 · 머리 빗맞음 ≈0.75
 *
 * 값은 근거 없음 — 디렉터와 같이 조정할 값이다. 기준 봇(기하 없음)은 배율 1 이라
 * 균형 게이트에는 영향이 없다. 실제 플레이는 서는 자리·노리는 부위로 달라진다.
 */
(function(root){
  var clamp=function(x,a,b){return Math.max(a,Math.min(b,x));};
  /* 부위 높이(m) → 스윙 위상 u. 높이 내림차순. */
  var HEIGHT_U = { smash:[[3.6,.29],[3.25,.33],[3.0,.37],[2.85,.39],[1.3,.39],[0.9,.44],[0.5,.47]] };
  /* 위상 u → 정규화 각속도 (.25~.55, .01 간격). ainPathDir('smash') 로 잰 값. */
  var SPEED = { smash:[[0.25,0.069],[0.26,0.07],[0.27,0.07],[0.28,0.08],[0.29,0.232],[0.3,0.391],
    [0.31,0.523],[0.32,0.642],[0.33,0.741],[0.34,0.822],[0.35,0.891],[0.36,0.946],[0.37,0.981],
    [0.38,0.999],[0.39,1],[0.4,0.983],[0.41,0.958],[0.42,0.701],[0.43,0.483],[0.44,0.463],
    [0.45,0.447],[0.46,0.432],[0.47,0.416],[0.48,0.401],[0.49,0.396],[0.5,0.394],[0.51,0.391],
    [0.52,0.388],[0.53,0.383],[0.54,0.377],[0.55,0.377]] };
  var BASE=0.70, GAIN=0.45, RHO0=0.45;
  function lerpTable(t,x,desc){
    if(desc){ if(x>=t[0][0]) return t[0][1]; if(x<=t[t.length-1][0]) return t[t.length-1][1];
      for(var i=0;i<t.length-1;i++) if(x<=t[i][0]&&x>=t[i+1][0]){ var f=(t[i][0]-x)/(t[i][0]-t[i+1][0]); return t[i][1]+(t[i+1][1]-t[i][1])*f; } }
    if(x<=t[0][0]) return t[0][1]; if(x>=t[t.length-1][0]) return t[t.length-1][1];
    for(var j=0;j<t.length-1;j++) if(x>=t[j][0]&&x<=t[j+1][0]){ var g=(x-t[j][0])/(t[j+1][0]-t[j][0]); return t[j][1]+(t[j+1][1]-t[j][1])*g; }
    return t[t.length-1][1];
  }
  function has(clip){ return !!HEIGHT_U[clip]; }
  /* contact: combat-quality.contact() 가 돌려주는 것 — y(부위 높이 m), reach(부위 표면까지 m), range(사거리 m) */
  function point(clip, contact){
    if(!has(clip)||!contact||!Number.isFinite(contact.y)) return null;
    var u=lerpTable(HEIGHT_U[clip], contact.y, true);
    var v=lerpTable(SPEED[clip], u, false);
    var R=contact.range>0?contact.range:1.5, d=Number.isFinite(contact.reach)?contact.reach:R;
    var rho=clamp(RHO0+(1-RHO0)*d/R, RHO0, 1);
    var s=v*rho, mult=BASE+GAIN*s;
    var phase=u<.37?'early':u>.425?'late':'sweet';
    var grade=s>=.85?'sweet':s<.45?'glance':'solid';
    return {u:+u.toFixed(3), v:+v.toFixed(3), rho:+rho.toFixed(3), s:+s.toFixed(3), mult:+mult.toFixed(3), phase:phase, grade:grade};
  }
  var api={HEIGHT_U:HEIGHT_U, SPEED:SPEED, BASE:BASE, GAIN:GAIN, has:has, point:point};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.TW_SWING_POINT=api;
})(typeof globalThis!=='undefined'?globalThis:this);
