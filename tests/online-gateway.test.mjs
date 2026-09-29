import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Online v6 matchmaker (tools/online/gateway.mjs, docs/design/153-154): tickets are one-time and instance-bound,
// the server-to-server endpoints need the shared secret, and there is no built-in secret.
const SECRET = 'test-secret-' + Math.random().toString(36).slice(2);

async function start(env) {
  const port = 18000 + Math.floor(Math.random() * 2000);
  const p = spawn(process.execPath, ['tools/online/gateway.mjs'], { env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  return { p, port };
}

async function ready(g) {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${g.port}/health`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('gateway did not start');
}

const post = (g, path, body, secret) => fetch(`http://127.0.0.1:${g.port}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-instance-secret': secret } : {}) }, body: JSON.stringify(body),
});

test('the matchmaker refuses to start without a secret or with the placeholder', async () => {
  for (const env of [{ INSTANCE_SECRET: '' }, { INSTANCE_SECRET: 'change-me' }]) {
    const g = await start(env);
    const [code] = await once(g.p, 'exit');
    assert.equal(code, 1, JSON.stringify(env));
  }
});

test('tickets are one-time and bound to their instance; server calls need the secret', async (t) => {
  const g = await start({ INSTANCE_SECRET: SECRET });
  t.after(() => g.p.kill());
  await ready(g);

  // servers register
  assert.equal((await post(g, '/internal/instances/heartbeat', { instanceId: 's1', address: '127.0.0.1:7777', kind: 'shelter' })).status, 401);
  for (const b of [{ instanceId: 's1', address: '127.0.0.1:7777', kind: 'shelter' }, { instanceId: 'd1', address: '127.0.0.1:7780', kind: 'dungeon', missionId: 'GangnamStation_B2' }])
    assert.equal((await post(g, '/internal/instances/heartbeat', b, SECRET)).status, 200);

  // a client asks for a shelter (public): one ticket, first spawn in the town
  const m = await (await post(g, '/v1/match/shelter', { character: 'ain', accountId: 'acc-a' })).json();
  assert.equal(m.instanceId, 's1');
  assert.equal((await post(g, '/internal/shelter-tickets/consume', { token: m.joinToken, instanceId: 's1' })).status, 401, 'consume needs the secret');
  assert.equal((await post(g, '/internal/shelter-tickets/consume', { token: m.joinToken, instanceId: 'other' }, SECRET)).status, 403, 'wrong instance');
  const ok = await post(g, '/internal/shelter-tickets/consume', { token: m.joinToken, instanceId: 's1' }, SECRET);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).spawnPoint, 'TownStart');
  assert.equal((await post(g, '/internal/shelter-tickets/consume', { token: m.joinToken, instanceId: 's1' }, SECRET)).status, 409, 'reuse');

  // only a server may book a dungeon or a return - a client could otherwise mint tickets and forge a party leader
  const party = { partyId: 'p1', missionId: 'GangnamStation_B2', leaderAccountId: 'acc-a', originShelterInstanceId: 's1',
    members: [{ accountId: 'acc-a', character: 'ain' }, { accountId: 'acc-b', character: 'kain' }] };
  assert.equal((await post(g, '/v1/match/dungeon', party)).status, 401);
  assert.equal((await post(g, '/v1/match/return-shelter', { ...party, preferredShelterInstanceId: 's1' })).status, 401);
  assert.equal((await fetch(`http://127.0.0.1:${g.port}/v1/status`)).status, 401);

  const d = await (await post(g, '/v1/match/dungeon', party, SECRET)).json();
  assert.equal(d.instanceId, 'd1');
  const tok = d.tickets['acc-b'];
  const c = await (await post(g, '/internal/dungeon-tickets/consume', { token: tok, instanceId: 'd1' }, SECRET)).json();
  assert.equal(c.partyId, 'p1');
  assert.equal(c.character, 'kain');
  assert.equal(c.partyLeader, false);
  assert.equal((await post(g, '/internal/dungeon-tickets/consume', { token: tok, instanceId: 'd1' }, SECRET)).status, 409, 'dungeon ticket reuse');

  // the way back: the same shelter, spawned at the manpower office
  const r = await (await post(g, '/v1/match/return-shelter', { ...party, preferredShelterInstanceId: 's1' }, SECRET)).json();
  assert.equal(r.instanceId, 's1');
  const back = await (await post(g, '/internal/shelter-tickets/consume', { token: r.tickets['acc-a'], instanceId: 's1' }, SECRET)).json();
  assert.equal(back.spawnPoint, 'ManpowerOfficeReturn');
  assert.equal(back.partyId, 'p1');
  assert.equal(back.partyLeader, true);
});
