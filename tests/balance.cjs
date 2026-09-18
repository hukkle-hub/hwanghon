// Deterministic stationary-in-range policy comparison, not a human playtest.
const fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};for(const f of ['world','dungeons'])vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),c);
const {RULES,ARENAS,SKILLS}=c.window.TW_DUNGEONS,{createBattle}=require('../js/combat.js');
function simulate(policy){let player,rows=[];
 for(let i=0;i<3;i++){
  const d=ARENAS.tutorial.stages[i];const b=createBattle({char:c.window.TW_WORLD.CHARS.ain,rules:RULES,dummy:d,skills:SKILLS.ain,ult:SKILLS.ainUlt,player,seed:7,hooks:{canHit:()=>true,canCounter:()=>true,inZone:()=>true,pick:(p,n)=>i===2?p[1]:p[n%p.length]}});
  for(let frame=0;frame<60000&&!b.over;frame++){
   const s=b.snapshot(),p=s.player,e=s.enemy;const target=e.parts.find(x=>x.breakable&&!x.broken)?.id||e.parts.find(x=>x.broken)?.id||'core';
   if(policy==='spam'){if(frame%10===0)b.input('attack','body');}
   else if(!p.hitstop&&!p.action&&!p.locked&&!p.dodging){
    if(e.state==='telegraph'&&e.tele<=.035){if(e.counterable)b.input('attack',target);else b.input('dodge');}
    else if(p.riposte)b.input('attack',target);
    else if(e.state==='downed'||e.state==='recover'||e.state==='stagger'){
      if(p.ult>=100&&e.state==='downed')b.input('ult');else b.input('attack',target);
    }
   }
   b.tick(.01);b.drain();
  }
  rows.push({phase:i+1,clear:b.over&&!b.dead,time:+b.time.toFixed(2),hp:Math.round(b.exportPlayer().hp),counters:b.metrics.counters,evades:b.metrics.evades,breaks:b.metrics.breaks,damage:Math.round(b.metrics.dmg)});
  if(b.dead)break;player=b.exportPlayer();
 }
 return rows;
}
if(require.main===module)console.log(JSON.stringify({spam:simulate('spam'),skilled:simulate('skilled')},null,2));
module.exports={simulate};
