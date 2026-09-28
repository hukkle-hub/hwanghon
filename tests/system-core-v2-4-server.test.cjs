const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const hasStore=fs.existsSync('server/store.cjs');
const hasRaid=hasStore&&fs.existsSync('server/raid.cjs')&&fs.existsSync('server/content.cjs');
const Store=hasStore?require('../server/store.cjs').Store:null;
const Raid=hasRaid?require('../server/raid.cjs').Raid:null;
const C=hasRaid?require('../server/content.cjs'):null;

const expected={
  ain:{hp:24450,atk:2980,defense:1780,aspd:112.5,mspd:105,critChance:.182,critDamage:1.426,moveMult:1.05},
  kain:{hp:38200,atk:3410,defense:2960,aspd:96,mspd:98,critChance:.094,critDamage:1.18,moveMult:.98},
  ryu:{hp:21800,atk:2640,defense:1520,aspd:124,mspd:112,critChance:.226,critDamage:1.51,moveMult:1.12},
  sera:{hp:19600,atk:1480,defense:1610,aspd:100,mspd:104,critChance:.06,critDamage:1.10,moveMult:1.04},
};

(hasStore?test:test.skip)('store exposes authoritative character identity stats',()=>{
  const store=new Store();
  try{
    let i=0;
    for(const [character,e] of Object.entries(expected)){
      const guest=store.guest(`Guest${++i}`);
      const profile=store.chooseName(guest.profile.id,`Hero${i}`,character);
      const s=profile.stats;
      for(const key of Object.keys(e)) assert.ok(Math.abs(s[key]-e[key])<1e-9,`${character}:${key}`);
      assert.equal(s.threatMult,character==='kain'?1.25:1);
    }
  }finally{ store.close(); }
});

(hasRaid?test:test.skip)('Sera ward supports nearby authoritative ally',()=>{
  const level=Object.keys(C.levels).includes('d01')?'d01':Object.keys(C.levels)[0];
  const stat=id=>{
    const b=C.characters[id].stats;
    return {hp:b.hp,atk:b.atk,aspd:b.aspd,mspd:b.mspd,defense:b.def,
      critChance:b.crit/100,critDamage:b.critDmg/100,moveMult:b.mspd/100,
      threatMult:id==='kain'?1.25:1};
  };
  const member=(id,ch)=>({id,name:id,character:ch,stats:stat(ch),skills:{skills:C.skills[ch],ult:C.skills[ch+'Ult']}});
  const raid=new Raid(level,[member('s','sera'),member('a','ain')]);
  const sera=raid.players.get('s'),ain=raid.players.get('a');
  sera.hp=Math.round(sera.maxHp*.5); ain.hp=Math.round(ain.maxHp*.5);
  ain.x=sera.x; ain.y=sera.y;
  const before=ain.hp;
  raid.input('s',{type:'skill',index:3});
  assert.ok(ain.hp>before);
  assert.equal(ain.buffT,3);
  assert.equal(ain.buffReduce,.5);
});
