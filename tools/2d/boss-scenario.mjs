/* 필드 보스 시나리오 (docs/design/188) — 두 사람을 실제로 띄워 «출현 → 타격 → 처치 → 바닥 드롭 → 줍기 → 서버 알림» 을 끝까지 밟고 찍는다.
   서버를 이 프로세스 안에서 띄우므로 따로 실행할 것이 없다.

     node tools/2d/boss-scenario.mjs [스크린샷 폴더] [보스 id=clave]

   헤드리스는 초당 1~2프레임이고 게임 시간은 프레임당 최대 0.05초다(CLAUDE.md §1) — 벽시계가 아니라 렌더된 프레임을 센다.
   드롭은 원래 1.5% · 0.2% 라서, 찍을 때만 서버의 난수를 0 으로 바꿔 «묶음마다 하나씩» 떨어지게 한다. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(ROOT + '/');
const {createPartyServer} = require('./server/index.cjs');
const {Store} = require('./server/store.cjs');
const fs = require('node:fs');

const OUT = process.argv[2] || ROOT + '/.boss-shots';
const BOSS = process.argv[3] || 'clave';
fs.mkdirSync(OUT, {recursive:true});
const store = new Store(null);
const app = createPartyServer({store});
const addr = await app.listen(Number(process.env.PORT || 8794), '127.0.0.1');
const BASE = `http://127.0.0.1:${addr.port}`;
const o = app.field.bosses.get(BOSS);
if (!o) throw Error('모르는 보스 ' + BOSS);
for (const b of app.field.bosses.values()) { b.alive = false; b.nextAt = Date.now() + 1e9; }   /* 시나리오가 직접 세운다 */

const M = process.env.MOBILE || '';
const VIEW = M === 'port' ? {width:412, height:915} : M ? {width:915, height:412} : {width:1280, height:720};
const browser = await chromium.launch({args:['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
async function open(char, name) {
  const ctx = await browser.newContext({viewport:VIEW, deviceScaleFactor:1, isMobile:!!M, hasTouch:!!M});
  await ctx.addInitScript(n => { try { localStorage.setItem('tw:party-name', n); } catch {} }, name);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[' + name + '] pageerror', e.message));
  await page.goto(`${BASE}/mmo.html?zone=${o.zone}&char=${char}&online=1`);
  await page.waitForFunction(() => window.__MMO && window.__MMO.net && window.__MMO.frames > 3, null, {timeout:240000});
  return page;
}
const frames = async (page, n) => { const f0 = await page.evaluate(() => __MMO.frames); await page.waitForFunction(f => __MMO.frames >= f, f0 + n, {timeout:240000}); };
/* 손님 위치를 화면과 서버 양쪽에서 옮긴다 (출발점에서 걸어가는 대신) */
async function put(page, x, z, yaw) {
  const id = await page.evaluate(([x, z, yaw]) => { __MMO.teleport(x, z, yaw); return __MMO.net.profile.id; }, [x, z, yaw]);
  const p = app.field.players.get(id); p.x = x; p.z = z; p.at = Date.now();
}
const shot = async (page, name) => { await page.screenshot({path:path.join(OUT, name + (M ? '-' + M : '') + '.png')}); console.log('찍음', name); };

const A = await open('kain', '검은기사');
const B = await open('ain', '은빛낫');
const yawTo = (x, z) => Math.atan2(o.x - x, o.z - z);
const ax = o.x - 2.2, az = o.z + 2.4, bx = o.x + 2.6, bz = o.z + 3.2;
await put(A, ax, az, yawTo(ax, az)); await put(B, bx, bz, yawTo(bx, bz));
await frames(A, 12); await frames(B, 4);
await shot(B, '1-before');   /* 보스 자리 — 지금은 없다 */

app.field.spawnBoss(o);
await frames(B, 9);
await shot(B, '2-spawn');     /* 땅에서 솟는 중 + 붉은 고리 + 서버 전체 알림 */
await frames(B, 24);

/* A 가 때린다 — 공격 단추(J). 피해는 서버가 굴려 돌려준다 */
/* 공격 동작 중(≈0.75초) 누른 키는 무시된다 — 동작이 끝난 뒤에 누르고, 마지막 숫자가 떠 있는 동안(0.9초) 찍는다 */
const swing = async () => { await A.waitForFunction(() => __MMO.me.busy <= 0, null, {timeout:240000}); await A.keyboard.press('KeyJ'); };
for (let i = 0; i < 4; i++) { await swing(); await frames(A, 4); }
await swing(); await frames(A, 5);
const hp1 = o.hp / o.max;
await shot(A, '3-hit');
console.log('체력', (hp1 * 100).toFixed(2) + '%', '· A 기여', o.dmg.size, '명');
await B.keyboard.press('KeyJ');   /* B 는 거리가 멀어 안 닿는다 → 기여 없음 */

/* 마무리: 체력을 거의 비우고, 드롭이 보이게 난수를 0 으로 */
o.hp = Math.min(o.hp, 4000); const rng = app.field.rng; app.field.rng = () => 0;
for (let i = 0; i < 4 && o.alive; i++) { await A.keyboard.press('KeyJ'); await frames(A, 8); }
app.field.rng = rng;
console.log('처치', !o.alive, '· 바닥', [...app.field.loot.values()].map(l => l.item).join(', '));
await frames(B, 10);
await shot(B, '4-down-B');    /* 처치 알림 + 빛기둥 셋 (B 에게는 «1위가 먼저») */
await shot(A, '4-down-A');

/* A 가 장검 위로 가서 줍는다 → 서버 전체 «… 획득» */
const blade = [...app.field.loot.values()].find(l => /blade|scythe|claws|catalyst|silence|hook|wrench|saber|staff|fixative/.test(l.item)) || [...app.field.loot.values()][0];
if (blade) {
  await put(A, blade.x, blade.z + 0.3);
  await frames(A, 6);
  await shot(A, '5-pick-btn');   /* 줍기 단추 */
  await A.keyboard.press('KeyF');
  await frames(A, 6); await frames(B, 6);
  await shot(B, '6-loot-announce');
  const aid = await A.evaluate(() => __MMO.net.profile.id);
  console.log('A 가방', JSON.stringify(store.get(aid).items));
}
console.log('처치 기록', JSON.stringify(store.bossKills(o.id).map(k => ({top:k.top_name, players:k.players, drops:JSON.parse(k.drops)}))));
await browser.close(); await app.close();
