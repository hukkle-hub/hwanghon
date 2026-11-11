const test=require('node:test'),assert=require('node:assert/strict');
const KIT=require('../server/field-boss-kit.cjs');
test('canonical kits stay default; motion studies require explicit object-local opt-in',()=>{
 const a={id:'leviathan',x:0,z:0,max:100,hp:100,alive:true},b={...a,motionStudy:true};
 KIT.setup(a,0);KIT.setup(b,0);
 assert.equal(KIT.KITS.leviathan.skills.pressure,undefined);
 assert.ok(KIT.skillWeights(a,{x:0,z:10}).rush>0);
 assert.ok(KIT.skillWeights(b,{x:0,z:10}).rush>0,'a serializable flag cannot activate a study');
 assert.equal(KIT.configureMotionStudy(a),true);KIT.setup(a,0);
 assert.ok(KIT.skillWeights(a,{x:0,z:10}).pressure>0);
 assert.ok(KIT.skillWeights(b,{x:0,z:10}).rush>0,'same boss ID in another field remains canonical');
 assert.equal(KIT.configureMotionStudy({id:'unknown'}),false);
});
