/* 파티 모집 화면(설계 시트 03) 시나리오 — 두 사람을 실제로 띄워 끝까지 밟는다.
   서버를 이 프로세스 안에서 띄우므로 따로 실행할 것이 없다.

     node tools/recruit-scenario.mjs [스크린샷 폴더]

   확인하는 것: 모집 조건(최소 전투력·음성)이 목록·방 머리에 실리는지,
   필터 여섯 칸이 실제로 거르는지, 카드의 5줄 등급표가 사람마다 다른지,
   임무 목록의 종류 탭·썸네일·Lv, 임무 상세의 권장 전투력·보상 4칸.
   화면을 «볼» 필요가 있어서 npm test 가 아니라 여기에 둔다. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(ROOT + '/');
const {createPartyServer} = require('./server/index.cjs');
const {Store} = require('./server/store.cjs');

const store = new Store(null);
const app = createPartyServer({store});
const addr = await app.listen(Number(process.env.PORT || 8793), '127.0.0.1');
const BASE = `http://127.0.0.1:${addr.port}`;
const OUT = process.argv[2] || ROOT + '/.recruit-shots';
require('node:fs').mkdirSync(OUT, {recursive:true});

/* 계정을 먼저 만들고, 화면에는 그 접속 키를 쥐어 준다 (recruit.html 은 키가 있어야 붙는다) */
const seed = (id, character, patch) => {
  const p = store.get(id); p.character = character; store.bumpSkill(p, patch); store.put(p);
};
const acc = async (tag, character, patch) => {
  const {profile, token} = await store.register('rc_'+tag, 'test-password-long', '요원_'+tag);
  store.chooseName(profile.id, '요원_'+tag, character);
  seed(profile.id, character, patch);
  return {id: profile.id, token};
};
const one = await acc('host','ain',  {counters:150,perfect:40,telegraphs:160,breaks:14,breakable:16,crafted:9,enhOk:6,repairs:4,craftedCons:8,potions:6,items:60,rare:6});
const two = await acc('mate','kain', {counters:30, perfect:6, telegraphs:50, breaks:3, breakable:12,crafted:2,enhOk:1,repairs:1,craftedCons:2,potions:1,items:14,rare:1});

/* MOBILE=land|port 로 휴대폰(Pixel 7) 뷰포트에서도 같은 시나리오를 돌린다 */
const M = process.env.MOBILE || '';
const PHONE = M === 'port' ? {width:412,height:915} : M ? {width:915,height:412} : null;
const SUF = M ? '-' + M : '';
const browser = await chromium.launch();
const mk = async (token) => {
  const ctx = await browser.newContext(PHONE
    ? {viewport:PHONE, hasTouch:true, isMobile:true, deviceScaleFactor:2,
       userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36'}
    : {viewport:{width:1672,height:941}});
  await ctx.addInitScript(([k,t]) => { try{ localStorage.setItem(k, t); }catch(e){} }, [`tw:party-token:127.0.0.1:${addr.port}`, token]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => m.type()==='error' && errs.push(m.text()));
  page.errs = errs;
  return page;
};
const wait = (p,ms) => p.waitForTimeout(ms);

const A = await mk(one.token), B = await mk(two.token);
await A.goto(BASE+'/recruit.html', {waitUntil:'networkidle'});
await wait(A, 1200);
await B.goto(BASE+'/recruit.html', {waitUntil:'networkidle'});
await wait(B, 1200);

console.log('1P 등급', store.techGrades(one.id), '2P 등급', store.techGrades(two.id));

/* 휴대폰에서는 페인 탭으로 옮겨 다녀야 요소가 보인다 */
const pane = async (p, label) => { if (!M) return;
  const t = await p.$(`.mtabs button[data-label="${label}"]`); if (t) { await t.click(); await wait(p, 250); } };

/* 1P: 모집 조건을 걸고 파티를 만든다 (모집 설정은 «상세» 페인에 있다) */
await pane(A, '상세');
await A.selectOption('#rc-minpower','10000');
await A.selectOption('#rc-voice','1');
await A.click('#rc-create');
await wait(A, 900);
console.log('1P 안내', (await A.textContent('#rc-state')).trim());
await pane(A, '파티');
const code = await A.textContent('#rc-code');
console.log('방 코드', code);

/* 2P: 파티 찾기 — 필터 바가 보이는 상태를 먼저 찍는다 */
await pane(B, '파티'); await pane(A, '파티');
await B.click('#rc-refresh');
await wait(B, 700);
await B.screenshot({path: OUT+'/rc-find'+SUF+'.png'});
console.log('목록 줄:', (await B.textContent('#rc-find')).replace(/\s+/g,' ').trim().slice(0,160));

/* 필터가 실제로 거르는지 */
const count = async () => (await B.$$('#rc-find [data-join]')).length;
console.log('필터 없음 →', await count());
await B.selectOption('#rc-f-role','ryu'); await wait(B,250);
console.log('역할=류 →', await count(), '(파티에 류가 없으니 0 이어야 한다)');
await B.selectOption('#rc-f-role','ain'); await wait(B,250);
console.log('역할=아인 →', await count());
await B.selectOption('#rc-f-role',''); await wait(B,250);
await B.selectOption('#rc-f-pw','free'); await wait(B,250);
console.log('조건 없는 방만 →', await count(), '(최소 전투력이 걸려 있으니 0)');
await B.selectOption('#rc-f-pw','fit'); await wait(B,250);
console.log('내 전투력으로 가능 →', await count());
await B.selectOption('#rc-f-pw',''); await wait(B,250);

/* 합류 */
await B.click('#rc-find [data-join]');
await wait(B, 900);
await wait(A, 500);
await A.click('#rc-ready'); await wait(A, 400);
await B.click('#rc-ready'); await wait(B, 600);
await wait(A, 600);

await pane(A, '파티');
/* Playwright 의 click 은 대상을 화면 안으로 굴린다 — «준비 완료» 가 아래에 있어서
   페인이 끝까지 내려가 있다. 도착했을 때의 그림을 찍으려고 맨 위로 돌린다. */
if (M) { await A.evaluate(()=>{const p=document.querySelector('.mpane.is-active'); p.scrollTop=0;}); await wait(A,150); }
await A.screenshot({path: OUT+'/rc-party'+SUF+'.png'});
/* 임무 목록: 종류 탭 · 썸네일 · Lv, 그리고 상세의 권장 전투력 · 보상 4칸 */
await pane(A, '임무');
for (const k of ['all','story','order','hunt']) {
  await A.click(`#rc-kinds [data-k="${k}"]`); await wait(A, 200);
  const rows = await A.$$eval('#rc-missions .mrow3', ns => ns.map(n => n.innerText.replace(/\n/g,' / ')));
  console.log('탭', k, '→', rows.length + '줄', rows[0] ? '| ' + rows[0] : '(' + (await A.textContent('#rc-missions')).trim().slice(0,24) + ')');
}
await A.click('#rc-kinds [data-k="all"]'); await wait(A, 200);
await A.click('#rc-missions .mrow3:nth-child(2)'); await wait(A, 400);   /* 갈대습지 */
await pane(A, '상세');
console.log('상세', (await A.textContent('#rc-detail')).replace(/\s+/g,' ').trim().slice(0,220));
console.log('보상칸', (await A.$$('#rc-detail .rw')).length);
await A.screenshot({path: OUT+'/rc-missions'+SUF+'.png'});
const cards = await A.$$eval('.slot4', ns => ns.map(n => n.innerText.replace(/\n/g,' | ')));
cards.forEach((c,i)=>console.log(`${i+1}P`, c));
console.log('머리', (await A.textContent('#rc-avg')).replace(/\s+/g,' ').trim());
console.log('시작 잠김?', await A.getAttribute('#rc-start','disabled') !== null);
console.log('오류 A', A.errs.filter(e=>!/version\.json|favicon/.test(e)));
console.log('오류 B', B.errs.filter(e=>!/version\.json|favicon/.test(e)));
console.log('스크린샷', OUT);
await browser.close(); app.close(); process.exit(0);
