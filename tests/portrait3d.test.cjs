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
 const m=SRC.match(/function stateKey\(\)\{[\s\S]*?\n\}/);
 assert.ok(m,'stateKey 가 있다');
 assert.match(m[0],/G\.char\(\)/); assert.match(m[0],/s\.equipped/); assert.match(m[0],/s\.dye/);
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
});
