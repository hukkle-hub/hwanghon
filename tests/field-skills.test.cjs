/* 필드 스킬 1~4 — «스킬을 누르고 공격을 누르면 그 스킬이 나간다» (디렉터 2026-10-07). 고르는 건 화면, 결과는 서버.
   배율은 솔로와 같은 표(js/dungeons.js SKILLS + rpg-skills.resolve), 재사용 대기는 서버가 센다. */
const test=require('node:test'),assert=require('node:assert/strict');
const {Field,reachOf}=require('../server/field.cjs'),{Store}=require('../server/store.cjs'),RS=require('../server/rpg-skills.cjs');
function setup(){ const store=new Store(null), g=store.guest('낫꾼'); store.chooseName(g.profile.id,'낫꾼','ain'); const id=g.profile.id;
 const f=new Field({store,emit:()=>{},rng:()=>0.5}); f.initBosses(0); const o=f.bosses.get('clave'); f.spawnBoss(o,1e9); o.max=o.hp=1e12;
 const p=f.join(id,store.public(id),'gangnam_b1'); p.x=o.x+reachOf(o)-0.3; p.z=o.z; return {store,f,o,p,id,prof:()=>store.public(id)}; }
test('타격 스킬: 낫 베기는 기본 공격의 2.2배 · 기본 공격 바로 뒤에도 나간다 · 재사용 대기 중엔 안 나간다',()=>{
 const {f,prof,id}=setup(), t=2e9, def=RS.resolve(prof()).skills[0];
 const base=f.hit(id,{boss:'clave'},prof(),t); assert.ok(base&&base.dmg>0,'기본 공격');
 const sk=f.command(id,{type:'fieldSkill',skill:0,boss:'clave'},prof()); assert.ok(sk&&sk.type==='bossHit'&&sk.skill===0&&sk.ok,'스킬 타격 '+JSON.stringify(sk));
 assert.ok(Math.abs(sk.dmg/base.dmg-def.mult)<0.02,'배율 '+(sk.dmg/base.dmg).toFixed(2)+' ≠ '+def.mult);
 const again=f.command(id,{type:'fieldSkill',skill:0,boss:'clave'},prof()); assert.equal(again.ok,false,'재사용 대기'); assert.ok(again.ready>Date.now());
});
test('회피 스킬: 그림자 걸음 → 회피 무적 + 다음 공격 치명타 확정(한 번만)',()=>{
 const {f,p,prof,id}=setup(), now=Date.now();
 const r=f.skill(id,{skill:1},prof(),now); assert.equal(r.type,'skillUsed'); assert.ok(r.ok); assert.ok(p.dodgeUntil>now,'회피 시간');
 const h1=f.hit(id,{boss:'clave'},prof(),now+1000); assert.equal(h1.crit,true,'다음 공격 치명타');
 const h2=f.hit(id,{boss:'clave'},prof(),now+2000); assert.equal(h2.crit,false,'두 번째는 평소대로');
});
test('버프 스킬: 결의 2초 동안 보스에게 받는 피해 절반 · 끝나면 원래대로',()=>{
 const {f,o,p,prof,id}=setup(), now=Date.now(), hit={damage:.1,skill:'slam',beat:0};
 p.invulnUntil=0; p.dodgeUntil=0; const plain=f.bossStrike(o,p,hit,now).amount; p.hp=p.maxHp;
 f.skill(id,{skill:3},prof(),now); p.dodgeUntil=0; const buffed=f.bossStrike(o,p,hit,now+100).amount; p.hp=p.maxHp;
 assert.ok(Math.abs(buffed/plain-0.5)<0.02,'결의 '+buffed+' / '+plain);
 const after=f.bossStrike(o,p,hit,now+2500).amount; assert.equal(after,plain,'2초 뒤 원래대로');
});
test('없는 스킬 번호는 무시한다',()=>{ const {f,prof,id}=setup(); assert.equal(f.skill(id,{skill:7},prof()),null); assert.equal(f.skill(id,{skill:-1},prof()),null); });
