/* 쉘터 «서울 전략망 · 길드 전략 명령» 시나리오 (docs/design/202) — 서버까지 이 프로세스에서 띄우고
   길드장 · 전투대장 · 길드원 셋을 실제로 붙인다.

     node tools/region-scenario.mjs [스크린샷 폴더]
     MOBILE=port|land node tools/region-scenario.mjs

   남산을 14시간 전에 함락시켜 둔다 → 서버가 밀린 30분 스텝 28번을 돌려 이웃(서울역·북악·상암)이 저하된 망이 보여야 한다.
   확인: 전투대장이 지도에서 남산을 눌러 «탈환 준비»(긴급)를 내면 서버에 걸리고, 길드원은 보기만, 길드장은 내릴 수 있다. */
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
  const {profile, token} = await store.register('rg_' + tag, 'test-password-long', name);
  store.chooseName(profile.id, name, 'ain');
  return {id: profile.id, token, name};
};
const lead = await acc('lead', '한별'), war = await acc('war', '강토'), mem = await acc('mem', '은재');
store.createGuild(lead.id, '황혼단');
for (const p of [war, mem]) store.joinGuild(p.id, store.guild(lead.id).code);
store.guildAssign(lead.id, war.id, 'combat');
/* 지난 주기 공헌 → 이번 주기 남산 관리 길드 = 황혼단 (관리 용량 40/80) */
const past = Date.now() - NODE.WEEK;
store.nodeReport(lead.id, N, {outcome:'held', contrib:{defense:300, repair:200, kill:6}}, past);
/* 14시간 전 함락 */
store.nodeReport(war.id, N, {outcome:'fallen', contrib:{kill:4}}, Date.now() - 14 * NODE.HOUR);

const {createPartyServer} = require('./server/index.cjs');
const app = createPartyServer({store});
const addr = await app.listen(Number(process.env.PORT || 8803), '127.0.0.1');
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
  await ctx.addInitScript(([k,t]) => { try{ localStorage.setItem(k, t); }catch(e){} }, [`tw:party-token:127.0.0.1:${addr.port}`, token]);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type()==='error' && errs.push(m.text()));
  page.errs = errs; return page;
};
const wait = (p, ms) => p.waitForTimeout(ms);
const pane = async (p, label) => { if (!M) return; const t = await p.$(`.mtabs button[data-label="${label}"]`); if (t) { await t.click(); await wait(p, 250); } };
const text = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g,' ').trim();
const visible = (p, sel) => p.$eval(sel, e => !e.hidden && e.offsetParent !== null).catch(() => false);
/* 전략망을 카드 안에서 보이게 스크롤하고, 넘침·작은 조작 요소를 잰다 */
const show = (p) => p.evaluate(() => { const b = document.getElementById('nd-body'), h = document.querySelector('.rgw-head');
  if (!document.documentElement.classList.contains('mobile')) b.scrollTop = h.offsetTop - b.offsetTop - 6; else h.scrollIntoView({block:'start'}); });
const measure = (p) => p.evaluate(() => { const b = document.getElementById('nd-body'), m = document.getElementById('rgw-map').getBoundingClientRect();
  const els = [...document.querySelectorAll('#rgw-cmd button, #rgw-cmd input')].filter(e => e.offsetParent);
  /* 체크박스는 줄(label) 전체가 눌리므로 줄 높이로 잰다 */
  const small = els.map(e => (e.type === 'checkbox' ? e.parentElement : e).getBoundingClientRect()).filter(r => r.height < 36).length;
  return {cardScroll: b.scrollHeight - b.clientHeight, pageX: document.documentElement.scrollWidth - innerWidth, mapW: Math.round(m.width), mapH: Math.round(m.height), smallControls: small, controls: els.length}; });

/* ── 전투대장: 지도에서 남산 → 탈환 준비 (긴급) ── */
const W = await mk(war.token);
await W.goto(BASE + '/shelter.html', {waitUntil:'networkidle'}); await wait(W, 1800); await pane(W, '명단');
console.log('전략망', await text(W, '#rgw-band'), '|', await text(W, '#rgw-svc'), '|', await text(W, '#rgw-admin'));
console.log('서버 망', store.regionView('seoul').nodes.map(n => n.id + ':' + n.state + ' ' + n.threat).join(' '));
await show(W);
await W.click('#rgw-map .rgw-hit[data-n="N01"]', {force: true}); await wait(W, 300);
console.log('고른 거점', await text(W, '#rgw-pick'), '| 낼 수 있는 명령', await W.$$eval('#rgw-types button', bs => bs.map(b => b.textContent)));
await W.check('#rgw-urgent');
await W.click('#rgw-types button[data-order="prepare_retake"]'); await wait(W, 800);
console.log('서버 명령', JSON.stringify(store.regionView('seoul', Date.now(), war.id).me.orders.map(o => [o.name, o.node, o.priority])));
await W.click('#rgw-map .rgw-hit[data-n="N02"]', {force: true}); await wait(W, 300);
await W.click('#rgw-types button[data-order="reinforce"]'); await wait(W, 800);
await show(W);
await W.screenshot({path: `${OUT}/rg-war${SUF}.png`});
console.log('전투대장 측정', JSON.stringify(await measure(W)));

/* ── 길드원: 보기만 ── */
const P = await mk(mem.token);
await P.goto(BASE + '/shelter.html', {waitUntil:'networkidle'}); await wait(P, 1800); await pane(P, '명단');
console.log('길드원 명령 목록', await text(P, '#rgw-orders'), '| 명령 칸?', await visible(P, '#rgw-issue'), '| 내리기 버튼', (await P.$$('#rgw-orders button')).length);
await show(P); await P.screenshot({path: `${OUT}/rg-member${SUF}.png`});

/* ── 길드장: 내린다 ── */
const L = await mk(lead.token);
await L.goto(BASE + '/shelter.html', {waitUntil:'networkidle'}); await wait(L, 1800); await pane(L, '명단');
await show(L);
const before = (await L.$$('#rgw-orders button')).length;
await L.click('#rgw-orders button[data-cancel]'); await wait(L, 800);
console.log('길드장 내리기', before, '→', (await L.$$('#rgw-orders button')).length, '| 서버', store.regionView('seoul', Date.now(), lead.id).me.orders.length);
console.log('길드장 측정', JSON.stringify(await measure(L)));
for (const [k, p] of [['전투대장', W], ['길드원', P], ['길드장', L]])
  console.log('오류', k, p.errs.filter(e => !/version\.json|favicon|CERT_AUTHORITY|status of 404/.test(e)));
console.log('스크린샷', OUT);
await browser.close(); app.close(); process.exit(0);
