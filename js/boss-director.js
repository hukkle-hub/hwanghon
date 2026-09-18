/* Committed boss attacks: one readable destination, collision-safe motion,
   and a distance-aware rotation that does not repeat the same move forever. */
(function(){
  function create(world,boss,player,level){
    var last=null,plan=null;
    function pick(patterns,index){
      var near=world.dist(boss.x,boss.y,player.x,player.y)<240;
      var candidates=patterns.filter(function(p){return !p.range||p.range==='any'||(near?p.range!=='far':p.range!=='near');});
      if(!candidates.length)candidates=patterns;
      var varied=candidates.filter(function(p){return p.name!==last;});if(varied.length)candidates=varied;
      var result=candidates[index%candidates.length];last=result.name;return result;
    }
    function start(pattern,zoneSpec){
      var motion=(level.attackMotion||{})[pattern.name]||{},angle=world.angle(boss.x,boss.y,player.x,player.y);
      var distance=Math.min(motion.distance||0,Math.max(0,world.dist(boss.x,boss.y,player.x,player.y)-(motion.stop||100)));
      var dest={x:boss.x,y:boss.y,r:boss.r};
      world.moveEntity(dest,Math.cos(angle)*distance,Math.sin(angle)*distance*.55);
      plan={from:{x:boss.x,y:boss.y},to:dest,angle:angle,at:motion.at==null?.65:motion.at,applied:0};
      // A line attack warns along its entire approach; circles warn at the landing point.
      var origin=zoneSpec.kind==='line'?plan.from:dest;
      var zone=world.makeZone({zone:zoneSpec},origin.x,origin.y,origin.x+Math.cos(angle),origin.y+Math.sin(angle)*.55);
      return {zone:zone,angle:angle};
    }
    function advance(progress){
      if(!plan)return;
      var t=Math.max(0,Math.min(1,(progress-plan.at)/(1-plan.at))),e=t*t*(3-2*t),delta=e-plan.applied;
      world.moveEntity(boss,(plan.to.x-plan.from.x)*delta,(plan.to.y-plan.from.y)*delta);plan.applied=e;
      boss.dist=world.dist(boss.x,boss.y,player.x,player.y);
    }
    return {pick:pick,start:start,advance:advance};
  }
  var api={create:create};if(typeof window!=='undefined')window.TW_BOSS_DIRECTOR=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
