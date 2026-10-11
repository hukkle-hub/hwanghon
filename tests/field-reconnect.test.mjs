/* 끊기면 다시 들어간다 (문서 229 §25) — 무거운 로딩이 메인 스레드를 잡으면 핑에 답을 못 해 서버가 1006 으로 끊는다.
   field-net 은 닫힌 까닭(code)을 넘기고, world3d 는 다른 접속·제한·정상 종료가 아니면 다시 들어간다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectField } from '../js/mmo/field-net.js';

test('field-net: 들어간 뒤 닫히면 closed 에 code 를 싣는다', async () => {
  let sock = null; const sent = [];
  globalThis.location = { hostname: 'localhost', host: 'localhost:1', protocol: 'http:' }; globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.WebSocket = class { constructor() { sock = this; this.readyState = 1; setTimeout(() => this.onopen(), 0); } send(t) { sent.push(JSON.parse(t)); } close() {} };
  const got = []; const p = connectField({ q: new URLSearchParams(''), zone: 'gangnam', char: 'ain', onMessage: m => got.push(m) });
  await new Promise(r => setTimeout(r, 5));
  sock.onmessage({ data: JSON.stringify({ type: 'welcome', token: 't', profile: { characterCreated: true } }) });
  sock.onmessage({ data: JSON.stringify({ type: 'fieldJoined', zone: 'gangnam', x: 1, z: 2 }) });
  const net = await p; assert.deepEqual(sent.map(m => m.type), ['hello', 'fieldJoin']);
  sock.onclose({ code: 1006 }); assert.equal(net.closed, true); assert.deepEqual(got.at(-1), { type: 'closed', code: 1006 });
  delete globalThis.WebSocket; delete globalThis.location; delete globalThis.localStorage;
});
test('world3d: 1006 등은 다시 들어가고 · 다른 접속(4001)·제한(4003)·정상(1000)은 안 들어간다 · 들어온 문으로', () => {
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
  assert.match(W, /const NO_RETRY = new Set\(\[1000, 4001, 4003\]\);/);
  assert.match(W, /if \(m\.type === 'closed'\) \{ net = null;[^\n]*if \(!NO_RETRY\.has\(m\.code\)\) setTimeout\(reconnectField, 1500\); \} \}/);
  const f = W.slice(W.indexOf('async function reconnectField'), W.indexOf('async function reconnectField') + 700);
  assert.match(f, /if \(net \|\| !ONLINE\) return;/, '이미 붙었으면 두 번 들어가지 않는다');
  assert.match(f, /connectField\(\{ q, zone: ZONE, gate: ARRIVE && ARRIVE\.id,/);
  assert.match(f, /if \(netRetry < 6\) setTimeout\(reconnectField, Math\.min\(30000, 1500 \* 2 \*\* netRetry\)\)/, '물러나며 여섯 번까지');
});
