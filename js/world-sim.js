/* 황혼 — 던전 월드 시뮬레이션 (DOM 없음 · 브라우저/Node 공용)
   맵(격자) · 충돌 · 이동 · 카메라 · 바닥 범위(존) 판정 · 보스 AI
   좌표: 바닥 평면 px. 깊이(y)는 화면에서 0.55 배로 눌러 그리므로 거리 계산도 같은 비율(anisotropic)을 쓴다 */
(function(){
  var DEPTH = 0.55;
  function dist(ax, ay, bx, by){ var dx = ax-bx, dy = (ay-by)/DEPTH; return Math.sqrt(dx*dx + dy*dy); }
  function angle(ax, ay, bx, by){ return Math.atan2((by-ay)/DEPTH, bx-ax); }
  function angDiff(a, b){ var d = a-b; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return Math.abs(d); }

  function parseMap(rows, cell){
    if(!rows.length||!rows[0].length||rows.some(function(r){return r.length!==rows[0].length;}))throw new Error('Map rows must have equal widths');
    var h = rows.length, w = rows[0].length, solid = [], marks = {};
    for (var y=0;y<h;y++){ solid.push([]); for (var x=0;x<w;x++){ var c = rows[y][x]; solid[y].push(c === '#' || c === '|');   /* G(문)는 열려 있다. 보스 방 입장 후 setSolid 로 잠근다 */ if (c !== '.' && c !== '#') (marks[c] = marks[c] || []).push({ x:(x+0.5)*cell, y:(y+0.5)*cell, cx:x, cy:y }); } }
    return { w:w, h:h, cell:cell, solid:solid, marks:marks, pw:w*cell, ph:h*cell, rows:rows };
  }
  function isSolid(map, x, y){ var cx = Math.floor(x/map.cell), cy = Math.floor(y/map.cell); if (cx<0||cy<0||cx>=map.w||cy>=map.h) return true; return map.solid[cy][cx]; }
  /* 원(반지름 r)이 벽과 겹치지 않게 이동 — 축 분리 슬라이딩 */
  function moveCircle(map, e, dx, dy){
    var r = e.r;
    function free(x, y){ return !isSolid(map, x-r, y) && !isSolid(map, x+r, y) && !isSolid(map, x, y-r*DEPTH) && !isSolid(map, x, y+r*DEPTH) && !isSolid(map, x-r*0.7, y-r*DEPTH*0.7) && !isSolid(map, x+r*0.7, y-r*DEPTH*0.7) && !isSolid(map, x-r*0.7, y+r*DEPTH*0.7) && !isSolid(map, x+r*0.7, y+r*DEPTH*0.7); }
    var steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy)/DEPTH)/(map.cell/4)));
    for(var i=0;i<steps;i++){if(free(e.x+dx/steps,e.y))e.x+=dx/steps;if(free(e.x,e.y+dy/steps))e.y+=dy/steps;}
  }
  function setSolid(map, cx, cy, v){ map.solid[cy][cx] = v; }

  /* ---------- 존(바닥 범위) ---------- */
  function inZone(z, px, py){
    if (z.kind === 'circle') return dist(z.x, z.y, px, py) <= z.r;
    if (z.kind === 'line'){ /* z.x,z.y 시작점, z.a 방향, z.len 길이, z.w 폭 */
      var dx = px - z.x, dy = (py - z.y)/DEPTH, ca = Math.cos(z.a), sa = Math.sin(z.a); var along = dx*ca + dy*sa, side = Math.abs(-dx*sa + dy*ca);
      return along >= -20 && along <= z.len && side <= z.w/2; }
    return false;
  }
  function makeZone(pat, bx, by, px, py){
    var a = angle(bx, by, px, py), s = pat.zone || { kind:'circle', r:150, fwd:110 };
    if (s.kind === 'line') return { kind:'line', x:bx, y:by, a:a, len:s.len, w:s.w };
    var fwd = s.fwd || 0; return { kind:'circle', x:bx + Math.cos(a)*fwd, y:by + Math.sin(a)*fwd*DEPTH, r:s.r };
  }

  /* ---------- 월드 ---------- */
  function createWorld(o){
    var map = parseMap(o.rows, o.cell || 64);
    var W = { map:map, t:0, ents:{}, events:[] };
    function emit(t, d){ d = d||{}; d.t = t; W.events.push(d); }
    W.add = function(id, e){ e.id = id; e.vx = 0; e.vy = 0; e.face = e.face || 'down'; e.moving = false; W.ents[id] = e; return e; };
    W.drain = function(){ var v = W.events; W.events = []; return v; };
    /* 플레이어 이동: 스틱 벡터(-1..1) */
    W.movePlayer = function(p, sx, sy, dt, speed){
      var m = Math.hypot(sx, sy); p.moving = m > 0.15;
      /* 넉백이 스틱보다 먼저다 — 맞는 동안은 내 뜻대로 못 움직인다.
         구르기와 같은 «밀림» 이지만 회피가 아니라서 rollT 와 섞지 않는다 (무적이 없다). */
      if (p.kbT > 0){
        /* 뒤로 갈수록 느려진다. 구간 «가운데» 에서 읽어야 dt 가 달라져도 총 거리가 len 이다
           (앞에서 읽으면 0.01초 틱에서 60px 이 63px 이 된다). */
        var f = Math.max(0, (p.kbT - dt*0.5) / (p.kbDur || 1));
        moveCircle(map, p, p.kbDx*2*f*dt, p.kbDy*2*f*dt);
        p.kbT = Math.max(0, p.kbT - dt); p.moving = false; return;
      }
      if (p.rollT > 0){ moveCircle(map, p, p.rollDx*dt, p.rollDy*dt); p.rollT -= dt; return; }
      /* 가속·감속. 예전엔 스틱을 미는 «그 프레임» 에 전속 4.6 m/s 가 됐다.
         정지에서 전속까지 한 프레임이면 달리기 클립이 이미 발이 날고 있는 자세에서
         시작해 «출발» 이 보이지 않는다. 멈출 때도 같은 이유로 뚝 끊긴다.
         출발은 빠르게(0.11초), 멈춤은 조금 더 끌어(0.16초) 체중을 남긴다.
         p.spd 는 0~1 — 던전은 이 값으로 달리기 배속도 같이 늦춘다 (docs/design/56). */
      /* lockT 가 없는 호출자도 있다 — «undefined <= 0» 은 false 라, 뒤집어 쓰면
         그런 호출자는 영영 안 움직인다 (실제로 탐사 시험이 「movement stuck」으로 잡아냈다). */
      var want = (p.moving && !(p.lockT > 0)) ? Math.min(1, m) : 0;
      var tau = want > (p.spd || 0) ? 0.11 : 0.16;
      p.spd = (p.spd || 0) + (want - (p.spd || 0)) * (1 - Math.exp(-dt / tau));
      if (p.spd < 0.02){ p.spd = 0; return; }
      if (m > 1e-6){                       /* 스틱을 놓아도 마지막 방향으로 미끄러져 멈춘다 */
        if (m > 1){ sx/=m; sy/=m; }
        p.face = Math.abs(sx) > Math.abs(sy)*0.9 ? (sx < 0 ? 'left' : 'right') : (sy < 0 ? 'up' : 'down');
        p.aim = Math.atan2(sy, sx);
      }
      var a = p.aim == null ? 0 : p.aim;
      moveCircle(map, p, Math.cos(a)*p.spd*speed*dt, Math.sin(a)*p.spd*speed*dt*DEPTH);
    };
    /* 넉백: 맞은 방향으로 len px 를 dur 초에 걸쳐 밀려난다 (벽에 막히면 거기까지). */
    W.knock = function(p, sx, sy, len, dur){
      var m = Math.hypot(sx, sy); if (m < 1e-6){ var a = p.aim==null ? 0 : p.aim; sx = -Math.cos(a); sy = -Math.sin(a); m = 1; }
      sx/=m; sy/=m; p.kbT = dur; p.kbDur = dur; p.kbDx = sx*len/dur; p.kbDy = sy*len/dur*DEPTH;
    };
    W.roll = function(p, sx, sy, len, dur){ var m = Math.hypot(sx, sy); if (m < 0.15){ var a = p.aim==null ? 0 : p.aim; sx = Math.cos(a); sy = Math.sin(a); m = 1; } sx/=m; sy/=m; p.rollT = dur; p.rollDx = sx*len/dur; p.rollDy = sy*len/dur*DEPTH; };
    W.moveEntity = function(e,dx,dy){ moveCircle(map,e,dx,dy); };
    /* 플레이어가 상대를 향하도록 */
    W.faceTo = function(p, tx, ty){ var a = angle(p.x, p.y, tx, ty); p.aim = a; p.face = Math.abs(Math.cos(a)) > 0.6 ? (Math.cos(a) < 0 ? 'left' : 'right') : (Math.sin(a) < 0 ? 'up' : 'down'); };
    /* 보스 AI: 추적/거리 유지 */
    W.bossThink = function(b, p, dt, ai, busy){
      var d = dist(b.x, b.y, p.x, p.y); b.dist = d;
      if (busy || !ai.speed){ b.moving = false; return; }
      if (d > ai.keep){ var a = angle(b.x, b.y, p.x, p.y); moveCircle(map, b, Math.cos(a)*ai.speed*dt, Math.sin(a)*ai.speed*dt*DEPTH); b.moving = true; }
      else b.moving = false;
      b.faceX = p.x < b.x ? -1 : 1;
    };
    W.dist = dist; W.angle = angle; W.angDiff = angDiff; W.inZone = inZone; W.makeZone = makeZone; W.isSolid = function(x,y){ return isSolid(map,x,y); }; W.setSolid = function(cx,cy,v){ setSolid(map,cx,cy,v); };
    W.lineOfSight=function(ax,ay,bx,by){var n=Math.max(1,Math.ceil(dist(ax,ay,bx,by)/(map.cell/4)));for(var i=1;i<=n;i++){if(isSolid(map,ax+(bx-ax)*i/n,ay+(by-ay)*i/n))return false;}return true;};
    W.marks = function(c){ return map.marks[c] || []; };
    /* 카메라 */
    W.camera = function(cam, tx, ty, vw, vh, dt){ var k = 1 - Math.pow(0.001, dt); cam.x += (tx - vw/2 - cam.x)*k; cam.y += (ty*DEPTH - vh*0.58 - cam.y)*k;
      cam.x = Math.max(0, Math.min(map.pw - vw, cam.x)); cam.y = Math.max(0, Math.min(map.ph*DEPTH - vh, cam.y)); };
    return W;
  }
  var API = { DEPTH:DEPTH, parseMap:parseMap, createWorld:createWorld, dist:dist, angle:angle, angDiff:angDiff, inZone:inZone, makeZone:makeZone };
  if (typeof window !== 'undefined') window.TW_WORLDSIM = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
