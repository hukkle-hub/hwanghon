/* 나가는 길 — 화면마다 뒤로 가기 (docs/design/37).
   디렉터가 짚은 것: 「각 탭 안에 ui마다 뒤로 가기 버튼이 있어야돼. 없는게 너무 많아.」
   실제로 34개 화면 중 data-mback 을 선언한 것이 4개뿐이었다. */
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');

/* 플레이어가 들어가는 화면 — 개발 도구(viewer·benchmark·*-review)와
   진입점(title·index), 전투 중 화면(game3d·battle·arena…)은 뺀다 */
const SCREENS={
  'office.html':'index.html', 'quest.html':'office.html', 'inventory.html':'index.html',
  'forge.html':'index.html', 'craft.html':'index.html', 'shop.html':'index.html',
  'profile.html':'index.html', 'skills.html':'index.html', 'characters.html':'index.html',
  'result.html':'office.html', 'recruit.html':'index.html', 'shelter.html':'index.html',
  'party.html':'index.html', 'board.html':'shelter.html', 'looks.html':'inventory.html',
  'story.html':'index.html', 'admin.html':'shelter.html',
};

test('플레이어 화면은 모두 «돌아갈 곳» 을 선언한다',()=>{
 for(const [f,dest] of Object.entries(SCREENS)){
   const h=fs.readFileSync(path.join(ROOT,f),'utf8');
   const m=h.match(/data-mback="([^"]+)"/);
   assert.ok(m, f+' 에 data-mback 이 없다');
   assert.equal(m[1], dest, f+' 의 돌아갈 곳');
   assert.ok(fs.existsSync(path.join(ROOT,m[1])), f+' → '+m[1]+' 가 실제로 있다');
 }
});

test('모두 back.js 를 읽는다',()=>{
 for(const f of Object.keys(SCREENS))
   assert.match(fs.readFileSync(path.join(ROOT,f),'utf8'), /js\/back\.js/, f);
});

test('back.js: 세 가지 자리를 모두 챙긴다',()=>{
 const s=fs.readFileSync(path.join(ROOT,'js/back.js'),'utf8');
 assert.match(s,/document\.body\.getAttribute\('data-mback'\) \|\| \(mn && mn\.getAttribute/,
   'body 와 main 둘 다 본다 — 인력사무실은 main 에 붙어 있다');
 assert.match(s,/querySelector\('\.topbar'\)/,'.topbar 가 있으면 그 안에');
 assert.match(s,/body > header, header/,'제 헤더를 쓰는 화면은 헤더 안에');
 assert.match(s,/position:fixed/,'둘 다 없으면 떠 있는 단추');
 assert.match(s,/\.topbar__back, \.backfab/,'두 번 붙지 않는다');
});

test('css/ui.css 를 안 읽는 화면에서도 손가락이 닿는다',()=>{
 /* 협동 출격은 제 스타일시트만 읽는다 — 클래스만 주면 높이 19px 글자 링크가 됐다 */
 const s=fs.readFileSync(path.join(ROOT,'js/back.js'),'utf8');
 assert.match(s,/min-height:44px/,'떠 있는 단추는 44px');
 assert.match(s,/min-height:40px/,'헤더 안 단추는 40px');
 const p=fs.readFileSync(path.join(ROOT,'party.html'),'utf8');
 assert.ok(!/css\/ui\.css/.test(p),'협동 출격은 ui.css 를 안 읽는다 (인라인 모양이 필요한 이유)');
});

test('넘겨주기만 하는 문서에는 붙이지 않는다',()=>{
 /* lobby.html 은 index.html 로 보내는 종이 한 장이다 */
 const s=fs.readFileSync(path.join(ROOT,'lobby.html'),'utf8');
 assert.match(s,/location\.replace\('index\.html'\)/);
 assert.ok(!/js\/back\.js/.test(s),'넘겨주기 문서에는 단추가 필요 없다');
});
