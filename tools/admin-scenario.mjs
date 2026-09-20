/* 운영 도구 화면(admin.html) 시나리오 — 서버까지 이 프로세스에서 띄우고
   운영자 한 명 · 신고자 한 명 · 대상 한 명을 실제로 붙인다.

     node tools/admin-scenario.mjs [스크린샷 폴더]
     MOBILE=port|land node tools/admin-scenario.mjs

   확인하는 것: 권한 없는 계정은 «권한 없음» 한 장만 보는지, 운영자는 신고를
   이름으로 보는지, 제재가 실제로 걸리는지(서버 상태로 확인), 공지가 모두에게
   가는지, 운영 기록에 남는지. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(ROOT + '/');
const {Store} = require('./server/store.cjs');

const store = new Store(null);
const acc = async (tag, name) => {
  const {profile, token} = await store.register('adm_' + tag, 'test-password-long', name);
  store.chooseName(profile.id, name, 'ain');
  return {id: profile.id, token, name};
};
const boss   = await acc('boss', '운영자');
const caller = await acc('call', '신고자');
const target = await acc('trgt', '문제요원');

/* 운영 권한은 서버가 뜨기 전에 정해진다 (ADMIN_IDS 를 createRpgCommands 가 읽는다) */
process.env.ADMIN_IDS = boss.id;
const {createPartyServer} = require('./server/index.cjs');
const app = createPartyServer({store});
const addr = await app.listen(Number(process.env.PORT || 8801), '127.0.0.1');
const BASE = `http://127.0.0.1:${addr.port}`;
const OUT = process.argv[2] || ROOT + '/.admin-shots';
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
  page.on('dialog', d => d.accept(d.type()==='prompt' ? '욕설 반복' : undefined));
  return page;
};
const wait = (p, ms) => p.waitForTimeout(ms);
const pane = async (p, label) => { if (!M) return;
  const t = await p.$(`.mtabs button[data-label="${label}"]`); if (t) { await t.click(); await wait(p, 250); } };

/* ── 신고를 하나 만든다 (신고자 → 문제요원) ── */
const C = await mk(caller.token);
await C.goto(BASE + '/shelter.html', {waitUntil:'networkidle'});
await wait(C, 1200);
/* 쉘터 화면의 «동료 · 차단» 칸으로 실제 신고를 넣는다 (휴대폰에서는 «채팅» 페인) */
await pane(C, '채팅');
await C.fill('#sh-who', target.name);
await C.click('#sh-report');
await wait(C, 900);
console.log('신고 접수', store.db.prepare('SELECT count(*) n FROM reports').get().n + '건');

/* ── 권한 없는 사람이 운영 도구를 열면 ── */
await C.goto(BASE + '/admin.html', {waitUntil:'networkidle'});
await wait(C, 1200);
console.log('비운영자 안내', (await C.textContent('#ad-detail')).replace(/\s+/g,' ').trim().slice(0,70));
console.log('비운영자 공지 잠김?', await C.getAttribute('#ad-post', 'disabled') !== null);
await C.screenshot({path: `${OUT}/ad-nogate${SUF}.png`});

/* ── 운영자 ── */
const A = await mk(boss.token);
await A.goto(BASE + '/admin.html', {waitUntil:'networkidle'});
await wait(A, 1600);
await pane(A, '신고');
console.log('신고 목록', (await A.textContent('#ad-rcount')).trim(),
  '|', (await A.textContent('#ad-reports')).replace(/\s+/g,' ').trim().slice(0,90));

await A.screenshot({path: `${OUT}/ad-reports${SUF}.png`});   /* 미처리가 남아 있을 때 */

/* 신고를 고르고 채팅 제한 */
await A.click('#ad-reports .rprow');
await wait(A, 400);
await pane(A, '처리');
console.log('대상', (await A.textContent('#ad-who')).trim(),
  '| 제재', (await A.textContent('#ad-detail')).match(/현재 제재\s*\S+/)?.[0]);
await A.selectOption('#ad-min', '60');
await A.fill('#ad-reason', '욕설 반복');
await A.click('#ad-detail [data-op="mute"]');
await wait(A, 900);
const s1 = store.sanction(target.id);
console.log('채팅 제한 걸림?', s1.mute_until > Date.now(), '| 사유', s1.reason,
  '| 남은 분', Math.round((s1.mute_until - Date.now()) / 60000));
console.log('화면 표시', (await A.textContent('#ad-detail')).match(/현재 제재[^사]*/)?.[0].replace(/\s+/g,' ').trim());

/* 검토 완료 */
await A.click('#ad-detail [data-op="resolve"]');
await wait(A, 900);
console.log('신고 상태', store.db.prepare('SELECT status FROM reports LIMIT 1').get().status);

/* 이름으로 찾아 제재 해제 */
await A.fill('#ad-find', target.name);
await A.click('#ad-findbtn');
await wait(A, 600);
console.log('이름으로 찾기', (await A.textContent('#ad-who')).trim());
await A.fill('#ad-reason', '오인 신고로 해제');
await A.click('#ad-detail [data-op="lift"]');
await wait(A, 900);
console.log('해제됨?', store.sanction(target.id).mute_until === 0);

/* 공지 */
await pane(A, '공지');
await A.fill('#ad-notice', '점검은 오늘 23시입니다.');
await A.click('#ad-post');
await wait(A, 700);
await wait(C, 400);
console.log('신고자에게 도착?', (await C.textContent('#ad-state')).includes('점검은'));
console.log('저장된 공지', store.db.prepare("SELECT value FROM meta WHERE key='announcement'").get()?.value);

/* 기록 */
await A.click('#ad-logtab [data-l="audit"]');
await wait(A, 300);
const log = await A.$$eval('#ad-log .logrow', ns => ns.slice(0,4).map(n => n.innerText.replace(/\n/g,' ')));
log.forEach(l => console.log('기록', l));
await pane(A, '처리');
if (M) await A.evaluate(()=>{const p=document.querySelector('.mpane.is-active'); if(p) p.scrollTop=0;});
await A.screenshot({path: `${OUT}/ad-admin${SUF}.png`});

console.log('오류 운영자', A.errs.filter(e => !/version\.json|favicon/.test(e)));
console.log('오류 신고자', C.errs.filter(e => !/version\.json|favicon/.test(e)));
console.log('스크린샷', OUT);
await browser.close(); app.close(); process.exit(0);
