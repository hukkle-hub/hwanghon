/* Exercise the page's real monster declarations and netMsg in their source order.
   Complements (does not replace) the actual two-browser/WebSocket render audit. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mobsFromPacket } from '../js/mmo/field-mobs.js';
import { bodyFor as n01BodyFor } from '../js/mmo/n01-body-catalog.js';

const page = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
const names = ['const tag3d =', 'let ECO =', 'const mobBody =', 'const n01CandidateCache=', 'const mobSpeciesBody=', 'const mobView ='];
const declarations = names.map(name => {
  const at = page.indexOf(name); assert.ok(at >= 0, name);
  return { at, code: page.slice(at, page.indexOf('\n', at)) };
});
const connectAt = page.indexOf('if (ONLINE) {');
const handler = page.slice(page.indexOf('function netMsg(m)'), connectAt);
const connect = page.slice(connectAt, page.indexOf('potShow();', connectAt));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function bootstrap(parts) {
  const observed = { made: 0, loaded: 0, remote: [], messages: [], tags: 0 };
  const row = ['daejeon:hunt:nest:0', 'G5_BREAKER', 1, 2, true, 'idle', 1, 100, 0];
  const run = new AsyncFunction('env', `
    const {connectField, createMobView, mobsFromPacket, document, root, bossPacket,
      remoteSet, v3, cam, THREE, SkeletonUtils, scene, load, window, CATALOG,location,n01BodyFor} = env;
    const q = new URLSearchParams(), ZONE='daejeon', ARRIVE=null, ME='ain', ONLINE=true;
    const gltfs={}, infos={}, netEl={textContent:''}, innerWidth=915, innerHeight=412;
    let net=null, ANIMS=[], lastField=null, fieldN=0;
    function potShow() {}
    ${handler}
    ${parts.sort((a,b)=>a.at-b.at).map(x=>x.code).join('\n')}
    return {net, netMobs, MOBS, infos, fieldN, status:netEl.textContent};
  `);
  const result = await run({
    mobsFromPacket, n01BodyFor,location:{search:''},window: {}, THREE: {}, SkeletonUtils: {clone() {}}, scene: {}, CATALOG: [], cam: {},
    v3: {x:0,y:0,z:0,set(){return this;},project(){observed.tags++;return this;}},
    document: {getElementById(){return {textContent:''};}}, root: {position:{set(){}}},
    bossPacket() {}, remoteSet(list) {observed.remote.push(list);},
    load() {observed.loaded++;return Promise.resolve({scene:{}});},
    createMobView(opts) {observed.made++; opts.tagAt({style:{}},1,2,3);opts.loadBody();return {views:new Map()};},
    async connectField(opts) {
      // The bridge deliberately preserves field/infos that arrive before fieldJoined.
      for (const m of [
        {type:'field',infos:{peer:{name:'상대',character:'kain'}},players:[['peer',1,2,0,0]],mobs:[row]},
        {type:'fieldJoined',x:1,z:2,mobs:[row],anims:['idle']},
      ]) { observed.messages.push(m.type);opts.onMessage(m); }
      return {send(){}};
    },
  });
  if (!result.net) throw Error(result.status);
  assert.equal(result.netMobs[0].id,row[0]);
  assert.equal(result.netMobs[0].hp,100);
  assert.equal(result.infos.peer.name,'상대');
  assert.equal(result.fieldN,1);
  assert.equal(observed.made,1,'field + fieldJoined must share one view');
  assert.equal(observed.loaded,1);
  assert.equal(observed.tags,1,'tag3d must also be initialized');
  assert.deepEqual(observed.messages,['field','fieldJoined']);
  return result;
}

test('3D first field and fieldJoined use ready monster state/factories without losing initial peer info', async () => {
  await bootstrap([...declarations,{at:connectAt,code:connect}]);
});

test('negative control: moving monster declarations after await reproduces the original TDZ', async () => {
  await assert.rejects(bootstrap([
    {at:0,code:connect},...declarations.map((x,i)=>({...x,at:i+1})),
  ]), /Cannot access '(netMobs|mobView)' before initialization/);
});
