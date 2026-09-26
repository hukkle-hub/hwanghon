import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=fs.readFileSync('js/game3d.js','utf8');
test('game3d wires cinematic layer after two-hand rig without changing combat clock',()=>{
 assert.match(s,/createCharacterCinema\(ain\.model,ain\.root,CID\)/);
 const restoreCinema=s.indexOf('if(ain.cinema) ain.cinema.restore()');
 const restoreRig=s.indexOf('if(ain.rig) ain.rig.restore()',restoreCinema);
 const mixer=s.indexOf('ain.mixer.update(dt)',restoreRig);
 const applyRig=s.indexOf('if(ain.rig) ain.rig.apply(',mixer);
 const applyCinema=s.indexOf('ain.cinema.apply(',applyRig);
 assert.ok(restoreCinema>=0&&restoreCinema<restoreRig&&restoreRig<mixer&&mixer<applyRig&&applyRig<applyCinema);
 assert.doesNotMatch(s,/combatAction\.elapsed\s*[+\-*/]?=/); // presentation layer must not rewrite authoritative action time
});
