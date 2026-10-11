import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('stage is initialized before server wait allows model promises to attach',async()=>{
 const source=fs.readFileSync('world3d.html','utf8'),init=source.indexOf('const STAGE = createBossStage('),wait=source.indexOf('net = await connectField(');
 assert.ok(init>source.indexOf('const cam = new THREE.PerspectiveCamera('));assert.ok(init<wait);
 assert.equal((source.match(/const STAGE = createBossStage\(/g)||[]).length,1);
 // Reproduce the actual ordering: a loaded model settles during server await.
 const run=late=>vm.runInNewContext(`(async()=>{let attached=false;${late?'':'const STAGE={attach(){attached=true}};'}const model=Promise.resolve().then(()=>STAGE.attach());await model;${late?'const STAGE={attach(){attached=true}};':''}return attached;})()`);
 await assert.rejects(run(true),/before initialization/);
 assert.equal(await run(false),true);
});
