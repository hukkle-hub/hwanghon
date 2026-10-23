/* 던전 장치 2인 시나리오 (문서 233): 서버를 이 프로세스 안에서 띄우고 두 사람을 한강 터널(3D)에 세운다.
     node tools/device-scenario.mjs [스크린샷 폴더]
   확인: A 가 내측 기계실 핀 둘을 자르면 → 서버가 fieldDevice 를 되돌리고 → B 의 화면에서도 같은 핀이 잘리고(DEV.cut) 내측 차수문이 떨어진다(down). 헤드리스는 초당 1~2 프레임 — 벽시계가 아니라 상태를 기다린다. */
import {chromium, devices} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(ROOT + '/');
const {createPartyServer} = require('./server/index.cjs'), {Store} = require('./server/store.cjs');
const ZONE = 'hangang_tunnel', OUT = process.argv[2] || ROOT + '/.node-shots/device-online'; fs.mkdirSync(OUT, {recursive: true});
const store = new Store(null), app = createPartyServer({store}), addr = await app.listen(Number(process.env.PORT || 8795), '127.0.0.1'), BASE = `http://127.0.0.1:${addr.port}`;
const acc = async (tag, character) => { const {profile, token} = await store.register('dv_' + tag, 'test-password-long', '요원_' + tag); store.chooseName(profile.id, '요원_' + tag, character); return {id: profile.id, token}; };
const one = await acc('a', 'ain'), two = await acc('b', 'kain');
const d = devices['Pixel 7'], VP = {width: d.viewport.height, height: d.viewport.width};
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const mk = async token => { const ctx = await browser.newContext({...d, viewport: VP}); await ctx.addInitScript(([k, t]) => { try { localStorage.setItem(k, t); sessionStorage.setItem('tw:bossIntro:leviathan', '1'); } catch {} }, [`tw:party-token:127.0.0.1:${addr.port}`, token]);
  await ctx.addInitScript(() => { const W = window.WebSocket; window.__dev = []; window.WebSocket = function (...a) { const ws = new W(...a); ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.type === 'fieldDevice') window.__dev.push(m); } catch {} }); return ws; }; window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, W); });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e).slice(0, 240))); return p; };
const sleep = ms => new Promise(r => setTimeout(r, ms)), until = async (f, ms = 120000, step = 500) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; };
const A28 = 28 * Math.PI / 180, XZ = (s, t) => [s * Math.cos(A28) - t * Math.sin(A28), -s * Math.sin(A28) - t * Math.cos(A28)];
const out = {};
try {
  const A = await mk(one.token), B = await mk(two.token);
  await A.goto(`${BASE}/world3d.html?zone=${ZONE}&online=1`); await B.goto(`${BASE}/world3d.html?zone=${ZONE}&online=1`);
  const ready = await until(async () => { const a = await A.evaluate(() => !!(window.__W3D && window.__W3D.net && window.__W3D.frames > 2)), b = await B.evaluate(() => !!(window.__W3D && window.__W3D.net && window.__W3D.frames > 2)); out.ready = {a, b}; return a && b; }, 600000, 1000);
  if (!ready) throw Error('접속 대기 시간 초과 ' + JSON.stringify(out.ready) + ' ' + JSON.stringify([A.errs.slice(0, 2), B.errs.slice(0, 2)]));
  const F = app.field, pa = F.players.get(one.id), pb = F.players.get(two.id); out.joined = !!(pa && pb);
  const LV = F.bosses.get('leviathan'); if (LV && !LV.alive) F.spawnBoss(LV, Date.now()); out.bossAlive0 = !!(LV && LV.alive);   /* 온라인 «가둠»: 핀 넷이면 서버가 봉쇄로 끝낸다 (문서 233 §4) */
  /* 둘 다 내측 기계실 핀 1 옆으로 (s 305.6, t 14) — 서버 자리도 같이 */
  const [x, z] = XZ(305.6, 14); const put = (p, x, z) => { p.x = x; p.z = z; p.at = Date.now(); p.invulnUntil = 1e15; };   /* 서버 무적 — 장치 시나리오는 보스 판정을 보지 않는다 (레비아탄 기술표가 오고부터 외측 기계실에서 맞아 죽었다) */ put(pa, x, z); put(pb, x + 1.5, z + 1.0);
  await A.evaluate(([x, z]) => { const W = window.__W3D; W.dtCap = 0.05; W.P.invulnUntil = 1e12; W.teleport(x, z, 0); window.__DEV.attached = false; }, [x, z]); await B.evaluate(([x, z]) => { const W = window.__W3D; W.dtCap = 0.05; W.P.invulnUntil = 1e12; W.teleport(x + 1.5, z + 1.0, 0); window.__DEV.attached = false; }, [x, z]);
  const btn = await until(async () => { const t = await A.evaluate(() => document.getElementById('gatebtn').hidden ? '' : document.getElementById('gatebtn').textContent); return /고정핀 1/.test(t) ? t : null; }, 120000, 1000); out.btnA = btn;
  if (!btn) throw Error('A 에 핀 단추가 안 떴다');
  await A.evaluate(() => document.getElementById('gatebtn').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})));
  out.bSawPin0 = !!(await until(async () => B.evaluate(() => window.__DEV.cut.has('inner-pin0')), 60000, 500));
  out.bMsgs = await B.evaluate(() => window.__dev.map(m => m.kind + ':' + m.id));
  /* 핀 2 — A 가 자리를 옮겨 자른다 */ const [x2, z2] = XZ(310.4, 14); put(pa, x2, z2); await A.evaluate(([x, z]) => window.__W3D.teleport(x, z, 0), [x2, z2]);
  const btn2 = await until(async () => { const t = await A.evaluate(() => document.getElementById('gatebtn').hidden ? '' : document.getElementById('gatebtn').textContent); return /고정핀 2/.test(t) ? t : null; }, 120000, 1000); out.btnA2 = btn2;
  if (btn2) await A.evaluate(() => document.getElementById('gatebtn').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})));
  out.bDoorDown = !!(await until(async () => B.evaluate(() => { const g = window.__DEV.gates.get('inner'); return g && g.down; }), 90000, 500));
  out.aDoorDown = await A.evaluate(() => { const g = window.__DEV.gates.get('inner'); return !!(g && g.down); });
  /* 외측 기계실 핀 둘 (s 345.6 · 350.4, t −14) — 넷째 핀에 서버가 레비아탄을 가두고(bossDown sealed) B 화면에 «가둠» 카드가 뜬다 */
  for (const [sv, label] of [[345.6, /고정핀 1/], [350.4, /고정핀 2/]]) { const [ox, oz] = XZ(sv, -14); put(pa, ox, oz); await A.evaluate(([x, z]) => window.__W3D.teleport(x, z, 0), [ox, oz]);
    let bo = null; for (let k = 0; k < 3 && !bo; k++) { if (k) await A.evaluate(([x, z]) => { window.__DEV.attached = false; window.__W3D.teleport(x, z, 0); }, [ox, oz]); bo = await until(async () => { const t = await A.evaluate(() => document.getElementById('gatebtn').hidden ? '' : document.getElementById('gatebtn').textContent); return label.test(t) && /외측/.test(t) ? t : null; }, 90000, 1000); } out['btnOuter' + (label.source.slice(-1))] = bo || ('없음: ' + await A.evaluate(() => document.getElementById('gatebtn').textContent.slice(0, 40)));
    if (bo) await A.evaluate(() => document.getElementById('gatebtn').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}))); }
  out.sealedServer = !!(await until(async () => LV && !LV.alive && LV.sealed, 60000, 500)); out.serverPins = [...(F.pins.get(ZONE) || [])];
  out.bSealCard = !!(await until(async () => B.evaluate(() => { const rc = document.getElementById('regionCard'); return rc.classList.contains('on') && /가둠/.test(rc.textContent); }), 60000, 500));
  out.bCut = await B.evaluate(() => [...window.__DEV.cut]); out.aCut = await A.evaluate(() => [...window.__DEV.cut]);
  out.bSent = await B.evaluate(() => window.__dev.length); out.errs = [A.errs.slice(0, 2), B.errs.slice(0, 2)];
  /* 사진: B 가 보스 방에서 떨어진 내측 문을 본다 */ const [vx, vz] = XZ(290, 0); await B.evaluate(([x, z, ax, az]) => { window.__W3D.teleport(x, z, 0); window.__W3D.view([x - 6, 2.6, z + 4], [ax, 2.2, az]); }, [vx, vz, ...XZ(308, 0)]); const f0 = await B.evaluate(() => window.__W3D.frames); await until(async () => (await B.evaluate(() => window.__W3D.frames)) > f0 + 14, 120000, 1000);
  await B.screenshot({path: `${OUT}/b-inner-door.png`, timeout: 600000}); await A.screenshot({path: `${OUT}/a-pin.png`, timeout: 600000});
  out.ok = out.bDoorDown && out.sealedServer && out.bSealCard && !out.errs[0].length && !out.errs[1].length;
} catch (e) { out.error = String(e).slice(0, 400); }
console.log(JSON.stringify(out)); await browser.close(); await app.close?.(); process.exit(out.error || out.ok === false ? 1 : 0);
