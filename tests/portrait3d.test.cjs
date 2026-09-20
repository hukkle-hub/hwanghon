/* 내 초상 (3D) — 장비가 그대로 보이는 얼굴 그림 (docs/design/36 §8).
   WebGL 은 node 에서 못 돌린다. 그래서 «규약» 을 지키는지를 소스에서 검증한다 —
   특히 한 번 겪은 두 가지 실수가 되돌아오지 않게 못박는다. */
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'js/portrait3d.js'),'utf8');

test('한 번만 굽고 돌려 쓴다 — 자리마다 WebGL 맥락을 열지 않는다',()=>{
 assert.match(SRC,/sessionStorage/,'구운 그림을 세션에 둔다');
 assert.match(SRC,/inflight/,'동시에 두 번 굽지 않는다');
 assert.match(SRC,/r\.dispose\(\)/,'구운 뒤 렌더러를 버린다');
 const n=(SRC.match(/new THREE\.WebGLRenderer/g)||[]).length;
 assert.equal(n,1,'렌더러는 한 곳에서만 만든다');
});

test('열쇠에 캐릭터·장착·염색이 모두 들어간다',()=>{
 /* 하나라도 빠지면 옷을 갈아입어도 옛 초상이 남는다 */
 const m=SRC.match(/function stateKey\(mode\)\{[\s\S]*?\n\}/);
 assert.ok(m,'stateKey 가 있다');
 assert.match(m[0],/mode/); assert.match(m[0],/G\.char\(\)/);
 assert.match(m[0],/s\.equipped/); assert.match(m[0],/s\.dye/);
});

test('방어구가 다 올 때까지 기다린다 — 후드를 써도 초상이 그대로였던 버그',()=>{
 /* 무기(onMain)만 기다렸다가 구웠더니 방어구가 빠진 채로 구워졌다 */
 assert.match(SRC,/new THREE\.LoadingManager\(\)/,'전용 로딩 관리자');
 assert.match(SRC,/mgr\.onLoad/,'«전부 끝났다» 를 기다린다');
 assert.ok(!/onMain:once/.test(SRC),'무기 하나로 굽기를 시작하지 않는다');
 assert.match(SRC,/setTimeout\(once, 5000\)/,'그래도 언젠가는 나온다');
});

test('머리 뼈를 기준으로 잡는다 — 경계 상자는 무기 때문에 어긋난다',()=>{
 assert.match(SRC,/==='Head'/,'Head 뼈를 찾는다');
 assert.match(SRC,/p\.y\+0\.042/,'머리 뼈는 목에 있어 위로 올려 잡는다');
 assert.match(SRC,/at\.z\+0\.82/,'0.62 로 붙였다가 턱이 잘렸다');
});

test('실패해도 빈 칸을 남기지 않는다',()=>{
 assert.match(SRC,/\.catch\(/,'실패를 삼킨다');
 assert.match(SRC,/원화 유지/,'원화를 그대로 둔다');
});

test('초상을 쓰는 자리가 표시되어 있다',()=>{
 for(const f of ['index.html','profile.html']){
   const h=fs.readFileSync(path.join(ROOT,f),'utf8');
   assert.match(h,/data-portrait="me"/, f+' 에 자리 표시');
   assert.match(h,/portrait3d\.js/, f+' 가 초상을 읽는다');
   assert.match(h,/js\/looks\.js/, f+' 가 장비 외형을 읽는다 — 없으면 맨몸이 구워진다');
 }
 /* 전신을 쓰는 자리 */
 for(const f of ['result.html','recruit.html','inventory.html']){
   const h=fs.readFileSync(path.join(ROOT,f),'utf8');
   assert.match(h,/portrait3d\.js/, f+' 가 초상을 읽는다');
   assert.match(h,/js\/looks\.js/, f+' 가 장비 외형을 읽는다');
 }
 assert.match(fs.readFileSync(path.join(ROOT,'result.html'),'utf8'),/data-portrait="me-body"/);
 assert.match(fs.readFileSync(path.join(ROOT,'js/recruit.js'),'utf8'),/data-portrait="me-body"/);
 assert.match(fs.readFileSync(path.join(ROOT,'inventory.html'),'utf8'),/id="doll"[^>]*data-portrait="me-body"/);
});

test('인벤토리는 캐릭터를 바꿔도 종이인형이 따라간다',()=>{
 const h=fs.readFileSync(path.join(ROOT,'inventory.html'),'utf8');
 assert.match(h,/d\.src = 'art\/full-' \+ c\.dataset\.char/,'먼저 원화로 바로 반응한다');
 assert.match(h,/TW_PORTRAIT\.apply\(\)/,'그 뒤 3D 를 덮는다');
 assert.match(h,/tw:gearchar/,'캐릭터 교체 신호도 듣는다');
});

test('전신은 원화와 같은 비율로 굽는다 — 파티 카드에 나란히 선다',()=>{
 /* art/full-*.webp 는 382×932 (0.41). 256×624 = 0.41 */
 const m=SRC.match(/body:\{ w:(\d+), h:(\d+) \}/);
 assert.ok(m,'전신 크기가 정의되어 있다');
 const r=(+m[1])/(+m[2]);
 assert.ok(Math.abs(r-382/932)<0.02, `비율 ${r.toFixed(3)} ≈ 0.410`);
});

test('전신은 «몸» 만 재서 맞춘다 — 낫을 넣으면 사람이 손톱만 해진다',()=>{
 assert.match(SRC,/isSkinnedMesh\) bb\.expandByObject/,'스킨 메시만 잰다');
 assert.match(SRC,/at\.y\+=h\*0\.045/,'머리 위 여백 — 결과 화면에서 정수리가 붙어 있었다');
});

test('얼굴·전신을 따로 담아 둔다',()=>{
 assert.match(SRC,/function slot\(mode\)/,'모양마다 칸이 따로');
 assert.match(SRC,/stateKey\(mode\)/,'열쇠에 모양이 들어간다');
 assert.match(SRC,/const inflight=\{\}/,'모양마다 따로 굽는다');
});

test('내 칸에만 3D 를 끼운다 — 남의 장비는 알 수 없다',()=>{
 const r=fs.readFileSync(path.join(ROOT,'js/recruit.js'),'utf8');
 assert.match(r,/\(me\?' data-portrait="me-body"':''\)/,'me 인 칸만');
 assert.match(r,/TW_PORTRAIT&&TW_PORTRAIT\.apply\(\)/,'카드를 다시 그리면 초상도 다시 끼운다');
});
