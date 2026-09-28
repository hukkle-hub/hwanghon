const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const has=fs.existsSync('server/store.cjs');
const Store=has?require('../server/store.cjs').Store:null;

const expected={
  ain:{hp:24450,atk:2980,defense:1780,aspd:112.5,mspd:105,critChance:.182,critDamage:1.426,moveMult:1.05},
  kain:{hp:38200,atk:3410,defense:2960,aspd:96,mspd:98,critChance:.094,critDamage:1.18,moveMult:.98},
  ryu:{hp:21800,atk:2640,defense:1520,aspd:124,mspd:112,critChance:.226,critDamage:1.51,moveMult:1.12},
  sera:{hp:19600,atk:1480,defense:1610,aspd:100,mspd:104,critChance:.06,critDamage:1.10,moveMult:1.04},
};

(has?test:test.skip)('authoritative store keeps each design-sheet combat identity at level 1',()=>{
  const store=new Store();
  try{
    let n=0;
    for(const [character,e] of Object.entries(expected)){
      const guest=store.guest(`Guest${++n}`);
      const profile=store.chooseName(guest.profile.id,`Hero${n}`,character);
      const s=profile.stats;
      assert.equal(s.hp,e.hp,`${character}:hp`);
      assert.equal(s.atk,e.atk,`${character}:atk`);
      assert.equal(s.defense,e.defense,`${character}:defense`);
      assert.equal(s.aspd,e.aspd,`${character}:aspd`);
      assert.equal(s.mspd,e.mspd,`${character}:mspd`);
      assert.ok(Math.abs(s.critChance-e.critChance)<1e-9,`${character}:crit`);
      assert.ok(Math.abs(s.critDamage-e.critDamage)<1e-9,`${character}:critDamage`);
      assert.ok(Math.abs(s.moveMult-e.moveMult)<1e-9,`${character}:move`);
    }
  }finally{
    store.close();
  }
});
