/* 필드 몬스터 2인 시나리오 (문서 210) — 서버를 이 프로세스 안에서 띄우고, 한 사람은 2D(mmo.html) · 한 사람은 3D(world3d.html)로 같은 사냥터에 세운다.
     node tools/field-mob-scenario.mjs [스크린샷 폴더]      ZONE=daejeon  MOBILE=land|port(기본 land)
   확인: 두 화면이 서버와 같은 몬스터(id·세대)를 그리는지 · 몬스터가 다가와 공격(예고 고리)하고 사람이 맞는지(hurt[2] = 몬스터 id) ·
         2D 가 쳐서 mobHit 을 받고 쓰러뜨리는지 · 3D 화면에도 그 몬스터가 쓰러지는지.
   서버에 몬스터가 없으면(생태 미연결) «몬스터 0» 으로 끝난다. 헤드리스는 초당 1~2프레임 — 벽시계가 아니라 서버 상태를 기다린다. */
import {chromium, devices} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(ROOT + '/');
const {createPartyServer} = require('./server/index.cjs'), {Store} = require('./server/store.cjs');
const ZONE = process.env.ZONE || 'daejeon', OUT = process.argv[2] || ROOT + '/.node-shots/mobs-online'; fs.mkdirSync(OUT, {recursive: true});
const store = new Store(null), app = createPartyServer({store}), addr = await app.listen(Number(process.env.PORT || 8794), '127.0.0.1'), BASE = `http://127.0.0.1:${addr.port}`;
const acc = async (tag, character) => { const {profile, token} = await store.register('fm_' + tag, 'test-password-long', '요원_' + tag); store.chooseName(profile.id, '요원_' + tag, character); return {id: profile.id, token}; };
const one = await acc('two', 'ain'), two = await acc('three', 'kain');
const d = devices['Pixel 7'], port = process.env.MOBILE === 'port', VP = port ? d.viewport : {width: d.viewport.height, height: d.viewport.width};
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const mk = async token => { const ctx = await browser.newContext({...d, viewport: VP}); await ctx.addInitScript(([k, t]) => { try { localStorage.setItem(k, t); } catch {} }, [`tw:party-token:127.0.0.1:${addr.port}`, token]);
  /* 소켓에서 받은 mobHit · 맞은 값(hurt)을 그대로 적어 둔다 — 화면 숫자가 겹쳐 읽기 어려울 때 원본 */
  await ctx.addInitScript(() => { const W = window.WebSocket; window.__log = { mobHit: [], hurt: [] }; let last = null;
    window.WebSocket = function (...a) { const ws = new W(...a); ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.type === 'mobHit') window.__log.mobHit.push({ dmg: m.dmg, crit: m.crit, hp: m.hp, down: m.down, skill: m.skill, ok: m.ok });
      if (m.hurt && m.hurt[0] !== last) { last = m.hurt[0]; window.__log.hurt.push(m.hurt.slice(0, 5)); } } catch {} }); return ws; }; window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, W); });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e).slice(0, 240))); return p; };
const sleep = ms => new Promise(r => setTimeout(r, ms)), until = async (f, ms = 120000, step = 250) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; };
const out = {};
try {
  const A = await mk(one.token), B = await mk(two.token);
  await A.goto(`${BASE}/mmo.html?zone=${ZONE}&char=ain`); await B.goto(`${BASE}/world3d.html?zone=${ZONE}&online=1`);
  const ready = await until(async () => { const a = await A.evaluate(() => !!(window.__MMO && window.__MMO.net && window.__MMO.me)), b = await B.evaluate(() => !!(window.__W3D && window.__W3D.net && window.__W3D.frames > 2)); out.ready = {a, b}; return a && b; }, 300000, 1000);
  if (!ready) throw Error('접속 대기 시간 초과 ' + JSON.stringify(out.ready) + ' ' + JSON.stringify([A.errs.slice(0, 2), B.errs.slice(0, 2)]));
  const F = app.field, pa = F.players.get(one.id), pb = F.players.get(two.id); out.joined = !!(pa && pb);
  const eco = F.ecologies && F.ecologies.get(ZONE); out.serverMobs = eco ? eco.mobs.size : 0;
  if (!eco) throw Error('서버에 생태가 없다 — 몬스터 0');
  /* 몬스터가 있는 무리 옆(둥지에서 5 m)으로 두 사람을 옮긴다 — 서버 자리를 옮기면 화면이 «서버와 3 m 넘게 어긋남» 으로 따라온다 */
  const g = eco.groups.find(g => g.kind !== 'patrol') || eco.groups[0], [gx, gz] = g.anchor; out.group = g.id || g.key || '';
  const put = (p, x, z) => { p.x = x; p.z = z; p.at = Date.now(); };
  put(pa, gx + 5, gz); put(pb, gx + 5.8, gz + 1.2);
  await A.evaluate(([x, z]) => window.__MMO.teleport(x, z), [gx + 5, gz]); await B.evaluate(([x, z]) => window.__W3D.teleport(x, z), [gx + 5.8, gz + 1.2]);
  /* 1) 두 화면이 서버와 같은 몬스터를 그리나 */
  const seen = await until(async () => { const a = await A.evaluate(() => window.__MMO.mobs ? [...window.__MMO.mobs.views.values()].map(v => v.id + '#' + v.gen) : []), b = await B.evaluate(() => window.__W3D.mobs ? [...window.__W3D.mobs.views.values()].map(v => v.id + '#' + v.gen) : []); return a.length && b.length ? {a, b} : null; });
  out.drawn = seen ? {a: seen.a.length, b: seen.b.length, shared: seen.a.filter(x => seen.b.includes(x)).length, serverMatch: seen.a.every(k => { const [id, gen] = k.split('#'); const m = eco.mobs.get(id); return m && String(m.generation) === gen; })} : null;
  await A.screenshot({path: `${OUT}/a-2d-near.png`}); await B.screenshot({path: `${OUT}/b-3d-near.png`});
  /* 2) 몬스터가 와서 공격 — 화면에 예고 고리, 사람이 맞음 */
  const hp0 = pa.hp + pb.hp; let hurtBy = null;
  const atk = await until(async () => { const w = await A.evaluate(() => [...(window.__MMO.mobs?.views.values() || [])].some(v => v.warn && v.warn.visible)) || await B.evaluate(() => [...(window.__W3D.mobs?.views.values() || [])].some(v => v.warn && v.warn.visible)); return w; }, 90000, 150);
  if (atk) { await A.screenshot({path: `${OUT}/a-2d-attack.png`}); await B.screenshot({path: `${OUT}/b-3d-attack.png`}); }
  await until(() => { for (const p of [pa, pb]) if (p.hurt && p.hurt[1] > 0) { hurtBy = p.hurt[2]; return true; } return pa.hp + pb.hp < hp0; }, 30000);
  out.attack = {ring: !!atk, hpBefore: hp0, hpAfter: pa.hp + pb.hp, hurtBy, hurtByIsMob: !!(hurtBy && eco.mobs.has(hurtBy))};
  /* 3) 2D 가 쳐서 쓰러뜨린다 — 서버 판정(mobHit) · 3D 화면에도 쓰러짐. 2D 사람이 앞서 쓰러졌을 수 있으니 살아날 때까지 기다리고 서버의 살아 있는 몬스터 옆으로 다시 옮긴다 */
  await until(() => !pa.dead, 20000);
  const pick = [...eco.mobs.values()].filter(m => m.alive).sort((m, n) => Math.hypot(m.x - gx, m.z - gz) - Math.hypot(n.x - gx, n.z - gz))[0];
  const target = pick ? {id: pick.id, gen: pick.generation, name: pick.catalogId} : null; out.target = target; let hits = 0;
  if (target) {
    const done = await until(async () => { const s = eco.mobs.get(target.id); if (!s || !s.alive || s.generation !== target.gen) return true; if (pa.dead) return false;
      put(pa, s.x + 1.6, s.z); await A.evaluate(([x, z]) => window.__MMO.teleport(x, z), [s.x + 1.6, s.z]);
      const ok = await A.evaluate(() => window.__MMO.me.busy <= 0 && window.__MMO.hitBoss() !== false); if (ok) hits++; return false; }, 150000, 420);
    const st = F.mobStates.get(target.id), v3 = await until(() => B.evaluate(id => { const v = window.__W3D.mobs && window.__W3D.mobs.views.get(id); return !v || !v.alive; }, target.id), 20000);
    out.kill = {done: !!done, hits, serverHpLeft: st ? st.hp : null, gone3d: !!v3};
    await A.screenshot({path: `${OUT}/a-2d-kill.png`}); await B.screenshot({path: `${OUT}/b-3d-kill.png`}); }
  out.log = { a: await A.evaluate(() => ({ mobHit: window.__log.mobHit.slice(0, 14), hurt: window.__log.hurt.slice(0, 8), maxHp: window.__MMO.net?.profile?.stats?.hp })), b: await B.evaluate(() => ({ hurt: window.__log.hurt.slice(0, 8), maxHp: window.__W3D.P.maxHp })) };
  out.errors = {a: A.errs.slice(0, 3), b: B.errs.slice(0, 3)};
} catch (e) { out.fail = String(e.message || e); }
finally { console.log(JSON.stringify(out, null, 1)); await browser.close(); await app.close(); }
