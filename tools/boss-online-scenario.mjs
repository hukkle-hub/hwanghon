/* 정지 보스 기술표 2인 온라인 시나리오 (문서 233 §16.1, GPT 인계 «2인 온라인은 Claude 검수 전»): 서버를 이 프로세스 안에서 띄우고 두 사람을 보스 방에 세운다.
     node tools/boss-online-scenario.mjs [보스 id=nova] [스크린샷 폴더]
   확인: 서버 KIT 이 기술을 고르고(o.kit.state) → 두 화면 모두 같은 bossActs(ai 'kit', motion 'skill', 같은 seq) 를 받아 기술을 그리고 → 서버 bossStrike 가 서 있는 사람의 체력을 깎는다 (둘레 고리 orbit · 사출 eject).
   헤드리스는 초당 1~2 프레임 — 벽시계가 아니라 서버 상태·클라 netAct 를 기다린다. */
import {chromium, devices} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(ROOT + '/');
const {createPartyServer} = require('./server/index.cjs'), {Store} = require('./server/store.cjs'), {ZONES} = require('./js/mmo/zones.js');
const BOSS = process.argv[2] || 'nova', OUT = process.argv[3] || ROOT + '/.node-shots/boss-online'; fs.mkdirSync(OUT, {recursive: true});
const ZONE = Object.keys(ZONES).find(z => (ZONES[z].bosses || []).some(b => b.id === BOSS)); if (!ZONE) throw Error('보스 지역을 못 찾았다 ' + BOSS);
const store = new Store(null), app = createPartyServer({store}), addr = await app.listen(Number(process.env.PORT || 8796), '127.0.0.1'), BASE = `http://127.0.0.1:${addr.port}`;
const acc = async (tag, character) => { const {profile, token} = await store.register('bo_' + tag, 'test-password-long', '요원_' + tag); store.chooseName(profile.id, '요원_' + tag, character); return {id: profile.id, token}; };
const one = await acc('a', 'ain'), two = await acc('b', 'kain');
const d = devices['Pixel 7'], VP = {width: d.viewport.height, height: d.viewport.width};
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const mk = async token => { const ctx = await browser.newContext({...d, viewport: VP}); await ctx.addInitScript(([k, t, b]) => { try { localStorage.setItem(k, t); sessionStorage.setItem('tw:bossIntro:' + b, '1'); } catch {} }, [`tw:party-token:127.0.0.1:${addr.port}`, token, BOSS]);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e).slice(0, 240))); return p; };
const sleep = ms => new Promise(r => setTimeout(r, ms)), until = async (f, ms = 120000, step = 500) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; };
const out = {boss: BOSS, zone: ZONE};
try {
  const A = await mk(one.token), B = await mk(two.token);
  await A.goto(`${BASE}/world3d.html?zone=${ZONE}&online=1`); await B.goto(`${BASE}/world3d.html?zone=${ZONE}&online=1`);
  const ready = await until(async () => { const a = await A.evaluate(() => !!(window.__W3D && window.__W3D.net && window.__W3D.frames > 2)), b = await B.evaluate(() => !!(window.__W3D && window.__W3D.net && window.__W3D.frames > 2)); out.ready = [a, b]; return a && b; }, 900000, 2000);
  if (!ready) throw Error('접속 대기 시간 초과 ' + JSON.stringify(out.ready) + ' ' + JSON.stringify([A.errs.slice(0, 2), B.errs.slice(0, 2)]));
  const F = app.field, pa = F.players.get(one.id), pb = F.players.get(two.id); out.joined = !!(pa && pb);
  const o = F.bosses.get(BOSS); if (!o.alive) F.spawnBoss(o, Date.now()); out.serverKit = !!o.kit;
  /* 둘 다 보스 앞 8 m (고리 안쪽 4.5 m 밖) — 서버 자리도 같이 · 서버 쪽 무적 해제(피해를 본다) */
  const put = (p, x, z) => { p.x = x; p.z = z; p.at = Date.now(); p.invulnUntil = 0; }; put(pa, o.x, o.z + 8); put(pb, o.x + 2, o.z + 8);
  await A.evaluate(([x, z]) => { const W = window.__W3D; W.dtCap = 0.05; W.teleport(x, z, Math.PI); }, [o.x, o.z + 8]); await B.evaluate(([x, z]) => { const W = window.__W3D; W.dtCap = 0.05; W.teleport(x, z, Math.PI); }, [o.x + 2, o.z + 8]);
  const hpA0 = pa.hp;
  const act = p => p.evaluate(b => { const W = window.__W3D, o = (W.bosses || []).find(o => o.b.id === b); const a = o && o.netAct; return a ? {motion: a.motion, skill: a.skill, seq: a.seq, alive: o.netAlive, vis: o.root.visible, hasKit: !!o.kfx} : null; }, BOSS);
  const seen = {a: new Set(), b: new Set()}; let shot = false;
  for (let i = 0; i < 90; i++) { const a = await act(A), b = await act(B); if (a && a.motion === 'skill') seen.a.add(a.skill + '#' + a.seq); if (b && b.motion === 'skill') seen.b.add(b.skill + '#' + b.seq);
    if (!shot && a && a.motion === 'skill' && b && b.motion === 'skill') { shot = true; await A.screenshot({path: `${OUT}/a-${BOSS}.png`, timeout: 600000}); await B.screenshot({path: `${OUT}/b-${BOSS}.png`, timeout: 600000}); out.shotAt = {a, b}; }
    if (seen.a.size >= 2 && seen.b.size >= 2 && pa.hp < hpA0 && shot) break; await sleep(1500); }
  out.serverState = {state: o.kit.state, skill: o.kit.skill, history: o.kit.history.slice()}; out.seenA = [...seen.a]; out.seenB = [...seen.b]; out.same = [...seen.a].filter(x => seen.b.has(x)).length;
  out.hpA = [hpA0, pa.hp]; out.hpB = [pb.maxHp, pb.hp]; out.hurtA = pa.hurt; out.errs = [A.errs.slice(0, 3), B.errs.slice(0, 3)];
  out.ok = out.same >= 1 && pa.hp < hpA0 && !out.errs[0].length && !out.errs[1].length;
} catch (e) { out.error = String(e).slice(0, 400); }
console.log(JSON.stringify(out)); await browser.close(); await app.close?.(); process.exit(out.error || out.ok === false ? 1 : 0);
