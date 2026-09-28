const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const hasRaid=fs.existsSync('server/raid.cjs')&&fs.existsSync('server/content.cjs');
const Raid=hasRaid?require('../server/raid.cjs').Raid:null;
const C=hasRaid?require('../server/content.cjs'):null;

test('integration preserves Kain tank threat and Sera party support roles',()=>{
  const patch=fs.readFileSync('tools/ue/apply-system-core-v2-current.py','utf8');
  assert.match(patch,/threatMult:p\.character==='kain'\?1\.25:1/);
  assert.match(patch,/p\.threat\+=amount\*\(p\.stats\.threatMult\|\|1\)/);
  assert.match(patch,/p\.character==='sera'/);
  assert.match(patch,/this\.L\.player\.reach\*2/);
  assert.match(patch,/this\.event\('heal',\{player:q\.id,by:id,amount:h\}\)/);

  const local=fs.readFileSync(
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCharacterKitComponent.cpp','utf8');
  assert.match(local,/SupportRadiusCm = 520\.f/);
  assert.match(local,/AllyCombat->Heal/);
  assert.match(local,/AllyCombat->ApplyDamageReduction\(0\.50f, 3\.f\)/);
});

(hasRaid?test:test.skip)('Sera recovery ward heals and protects nearby authoritative party members',()=>{
  const level=Object.keys(C.levels).includes('d01')?'d01':Object.keys(C.levels)[0];
  const stats=id=>{
    const b=C.characters[id].stats;
    return {
      hp:b.hp,atk:b.atk,aspd:b.aspd,defense:b.def,
      critChance:b.crit/100,critDamage:b.critDmg/100,moveMult:b.mspd/100
    };
  };
  const member=(id,ch)=>({
    id,name:id.toUpperCase(),character:ch,stats:stats(ch),
    skills:{skills:C.skills[ch],ult:C.skills[ch+'Ult']}
  });
  const raid=new Raid(level,[member('s','sera'),member('a','ain')]);
  const sera=raid.players.get('s'),ain=raid.players.get('a');
  // Spawn points are adjacent and have line of sight.
  sera.hp=Math.round(sera.maxHp*.5);
  ain.hp=Math.round(ain.maxHp*.5);
  const beforeS=sera.hp,beforeA=ain.hp;

  raid.input('s',{type:'skill',index:3});

  assert.ok(sera.hp>beforeS,'Sera heals herself');
  assert.ok(ain.hp>beforeA,'Sera heals nearby ally');
  assert.equal(sera.buffT,3);
  assert.equal(ain.buffT,3);
  assert.equal(sera.buffReduce,.5);
  assert.equal(ain.buffReduce,.5);
});

test('authoritative store patch gives Kain the same 1.25 threat identity as local fallback',()=>{
  const patch=fs.readFileSync('tools/ue/apply-system-core-v2-current.py','utf8');
  assert.match(patch,/threatMult:p\.character==='kain'\?1\.25:1/);
});
