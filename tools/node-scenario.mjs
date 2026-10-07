/* 쉘터 «거점 관리» 카드 시나리오 (docs/design/201 §6) — 서버까지 이 프로세스에서 띄우고
   길드장 한 명 · 길드원 한 명 · 다른 길드 한 명을 실제로 붙인다.

     node tools/node-scenario.mjs [스크린샷 폴더]
     MOBILE=port|land node tools/node-scenario.mjs

   확인하는 것: 지난 주기 공헌으로 관리 길드가 정해지는지, 길드장만 정책 칸·대장 임명이 보이는지,
   예산을 넘기면 저장이 잠기는지, 길드장이 명단에서 보급대장을 맡기면 그 사람에게 보급 칸이 생기는지,
   보급이 서버에 실제로 쌓이는지, 다른 길드는 «보기만» 하는지. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(ROOT + '/');
const {Store} = require('./server/store.cjs');
const NODE = require('./server/node-store.cjs');
const N = 'namsan_n01';

const store = new Store(null);
const acc = async (tag, name) => {
  const {profile, token} = await store.register('nd_' + tag, 'test-password-long', name);
  store.chooseName(profile.id, name, 'ain');
  return {id: profile.id, token, name};
};
const lead  = await acc('lead', '한별');
const mate  = await acc('mate', '도윤');
const rival = await acc('rival', '서리');
store.createGuild(lead.id, '황혼단');
store.joinGuild(mate.id, store.guild(lead.id).code);
store.createGuild(rival.id, '새벽단');
/* 지난 주기: 황혼단은 방어·수리·구조, 새벽단은 보스 딜만 — 관리권은 황혼단으로 가야 한다 */
const past = Date.now() - NODE.WEEK;
store.nodeReport(mate.id, N, {outcome:'held', contrib:{defense:420, repair:260, npc_rescue:2, kill:6}}, past);
store.nodeReport(lead.id, N, {outcome:'held', contrib:{command:12, kill:9}}, past + 1);
store.nodeReport(rival.id, N, {outcome:'held', contrib:{boss:1500000, kill:4}}, past + 2);

const {createPartyServer} = require('./server/index.cjs');
const app = createPartyServer({store});
const addr = await app.listen(Number(process.env.PORT || 8802), '127.0.0.1');
const BASE = `http://127.0.0.1:${addr.port}`;
const OUT = process.argv[2] || ROOT + '/.node-shots';
fs.mkdirSync(OUT, {recursive: true});

const M = process.env.MOBILE || '';
const PHONE = M === 'port' ? {width:412,height:915} : M ? {width:915,height:412} : null;
const SUF = M ? '-' + M : '';
const browser = await chromium.launch();
const mk = async (token) => {
  const ctx = await browser.newContext(PHONE
    ? {viewport:PHONE, hasTouch:true, isMobile:true, deviceScaleFactor:2,
       userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36'}
    : {viewport:{width:1672,height:941}});
  await ctx.addInitScript(([k,t]) => { try{ localStorage.setItem(k, t); }catch(e){} },
    [`tw:party-token:127.0.0.1:${addr.port}`, token]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => m.type()==='error' && errs.push(m.text()));
  page.errs = errs;
  return page;
};
const wait = (p, ms) => p.waitForTimeout(ms);
const pane = async (p, label) => { if (!M) return;
  const t = await p.$(`.mtabs button[data-label="${label}"]`); if (t) { await t.click(); await wait(p, 250); } };
const text = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g,' ').trim();
const visible = (p, sel) => p.$eval(sel, e => !e.hidden && e.offsetParent !== null).catch(() => false);
/* 카드가 패널 안에서 넘치면 스크롤 뒤로 숨는다 — 재서 찍는다 */
const overflow = (p) => p.evaluate(() => { const b = document.getElementById('nd-body'), st = document.querySelector('.stage,main');
  return {card: b.scrollHeight - b.clientHeight, page: document.documentElement.scrollHeight - innerHeight}; });
/* 휴대폰은 한 페인 안에서 위아래로 쌓이므로 카드까지 내려서 찍는다. 데스크톱은 그대로 한 장 */
const showCard = (p) => M && p.evaluate(() => document.getElementById('nd-panel').scrollIntoView({block:'start'}));

/* ── 길드장 ── */
const L = await mk(lead.token);
await L.goto(BASE + '/shelter.html', {waitUntil:'networkidle'});
await wait(L, 1600);
await pane(L, '명단');
console.log('거점 카드', await text(L, '#nd-kv'), '| 접속 직후 상태 문구', await text(L, '#sh-state'));
console.log('길드장 정책 칸?', await visible(L, '#nd-policy'), '| 보급 칸?', await visible(L, '#nd-supply'));
/* 예산 넘기기: 정문 4 + 발전기 4 + 정찰 3 = 11 */
for (const p of ['gate_reinforce', 'generator_reinforce', 'scouting']) await L.check(`#nd-pols input[data-p="${p}"]`);
console.log('예산 초과 표시', await text(L, '#nd-budget'), '| 저장 잠김?', await L.$eval('#nd-psave', b => b.disabled));
await L.uncheck('#nd-pols input[data-p="generator_reinforce"]');
await L.check('#nd-pols input[data-p="medical_stock"]');
console.log('고른 뒤', await text(L, '#nd-budget'));
await L.click('#nd-psave');
await wait(L, 700);
console.log('서버 정책', JSON.stringify(store.nodeLoad(N).policies));
/* 명단에서 도윤에게 보급대장 */
await pane(L, '명단');
const sel = await L.$(`select[data-cap="${mate.id}"]`);
console.log('대장 임명 칸?', !!sel);
await L.selectOption(`select[data-cap="${mate.id}"]`, 'supply');
await wait(L, 900);
console.log('서버 직책', store.guildRoleOf(mate.id).role, '| 선택 칸 값', await L.$eval(`select[data-cap="${mate.id}"]`, s => s.value));
await showCard(L);
await L.screenshot({path: `${OUT}/nd-leader${SUF}.png`});
console.log('길드장 카드·페이지 넘침', JSON.stringify(await overflow(L)));

/* ── 보급대장 ── */
const S = await mk(mate.token);
await S.goto(BASE + '/shelter.html', {waitUntil:'networkidle'});
await wait(S, 1600);
await pane(S, '명단');
console.log('보급대장 정책 칸?', await visible(S, '#nd-policy'), '| 보급 칸?', await visible(S, '#nd-supply'),
  '| 대장 임명 칸?', !!(await S.$('select.nd-role')));
let clicks = 0; while (!(await S.$eval('#nd-sgo', b => b.disabled)) && clicks < 6) { await S.click('#nd-sgo'); clicks++; await wait(S, 450); }
console.log('보급 +3 누른 횟수', clicks, '| 다 차면 잠김?', await S.$eval('#nd-sgo', b => b.disabled));
console.log('보급 화면', await text(S, '#nd-sup'), '| 서버', store.nodeView(N).supply,
  await text(S, '#sh-state').catch(() => ''));
await showCard(S);
await S.screenshot({path: `${OUT}/nd-supply${SUF}.png`});
console.log('보급대장 명단 배지', await S.$$eval('.mrow2__t--c', ns => ns.map(n => n.textContent)), '| 카드 넘침', JSON.stringify(await overflow(S)));

/* ── 다른 길드 ── */
const R = await mk(rival.token);
await R.goto(BASE + '/shelter.html', {waitUntil:'networkidle'});
await wait(R, 1600);
await pane(R, '명단');
console.log('다른 길드', await text(R, '#nd-kv'));
console.log('다른 길드 정책 칸?', await visible(R, '#nd-policy'), '| 보급 칸?', await visible(R, '#nd-supply'));
/* 화면이 숨겨도 서버가 막는지 — 직접 보낸다 */
await R.evaluate(() => window.__ND && window.__ND.refresh());
console.log('서버 거절', (() => { try { store.nodePolicy(rival.id, N, ['scouting']); return '통과(문제)'; } catch (e) { return e.message; } })());
await showCard(R);
await R.screenshot({path: `${OUT}/nd-rival${SUF}.png`});

/* 구글 폰트(헤드리스에서 막힘)·version.json(배포 때만 생김)은 거른다 */
for (const [k, p] of [['길드장', L], ['보급대장', S], ['다른 길드', R]])
  console.log('오류', k, p.errs.filter(e => !/version\.json|favicon|CERT_AUTHORITY|status of 404/.test(e)));
console.log('스크린샷', OUT);
await browser.close(); app.close(); process.exit(0);
