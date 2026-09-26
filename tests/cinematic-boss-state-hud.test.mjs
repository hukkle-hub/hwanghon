import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../game3d.html', import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../js/game3d.js', import.meta.url),'utf8');

test('v08 marker and compact boss-state affordances exist',()=>{
  assert.match(html,/109 — CINEMATIC BOSS STATE \/ PART UX v08/);
  assert.match(html,/id="b-stag-lb">STAGGER/);
  assert.match(html,/--part-dur/);
  assert.match(html,/target-cycle\.is-low::after/);
  assert.match(html,/target-cycle\.is-broken/);
});

test('posture and down window reuse existing rule values only',()=>{
  assert.match(js,/postureMax=Math\.max\(1,\(R\.posture&&R\.posture\.max\)\|\|100\)/);
  assert.match(js,/downDur=Math\.max\(\.001,\(R\.posture&&R\.posture\.downDur\)\|\|1\)/);
  assert.match(js,/s2\.enemy\.downT\/downDur\*100/);
  assert.match(js,/bossDown\?'BREAK':'STAGGER'/);
});

test('enemy bleed/downed duplicates are removed from right status but bleed remains on boss bar',()=>{
  assert.match(js,/el\.stack\.textContent=s2\.enemy\.bleed\?'출혈 ×'\+s2\.enemy\.bleed:''/);
  const i=js.indexOf('var lines=[];');
  assert.ok(i>=0);
  const line=js.slice(i,js.indexOf('\n',i));
  assert.doesNotMatch(line,/enemy\.bleed/);
  assert.doesNotMatch(line,/enemy\.state==='downed'/);
  assert.match(line,/enemy\.state==='telegraph'/);
  assert.match(line,/player\.riposte/);
});

test('selected part durability changes presentation only',()=>{
  assert.match(js,/tc\.style\.setProperty\('--part-dur',durPct\+'%'\)/);
  assert.match(js,/tc\.classList\.toggle\('is-low',!selectedPart\.broken&&pct!=null&&pct<=35\)/);
  assert.match(js,/tc\.classList\.toggle\('is-broken',!!selectedPart\.broken\)/);
  assert.match(js,/selectedPart\.hp\/selectedPart\.hpMax\*100/);
});

test('combat rule file is outside this pass',()=>{
  /* 저장소엔 combat.js 가 있다 — 이 패스가 거기에 손대지 않았는지(v08 표기 문자열이 없는지)로 본다 */
  const combat=fs.readFileSync(new URL('../js/combat.js', import.meta.url),'utf8');
  for(const k of ['b-stag-lb','--part-dur','STAGGER','is-low','is-broken']) assert.ok(!combat.includes(k),`combat.js must not carry ${k}`);
});
