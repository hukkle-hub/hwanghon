/* Persistent expedition state. No DOM, rendering, loot or combat ownership. */
(function(){
  function create(o){
    var L=o.level,W=o.world,def=L.expedition||{},saved=o.saved||{},events=[];
    var valid=saved.version===1&&saved.level===L.id&&!saved.finished;
    var s=valid?JSON.parse(JSON.stringify(saved)):{version:1,level:L.id,id:o.id||String(Date.now()),done:{},discovered:{},checkpoint:null,finished:false};
    var time=0,hurtCd=0,current=null;
    var nodes=(def.nodes||[]).map(function(n){return Object.assign({},n,{x:(n.cx+.5)*L.cell,y:(n.cy+.5)*L.cell});});
    var hazards=(def.hazards||[]).map(function(n){return Object.assign({},n,{x:(n.cx+.5)*L.cell,y:(n.cy+.5)*L.cell});});
    function emit(t,d){events.push(Object.assign({t:t},d||{}));}
    function persist(){if(o.save)o.save(JSON.parse(JSON.stringify(s)));}
    function enabled(n){return !s.done[n.id]&&(n.requires||[]).every(function(k){return !!s.done[k];});}
    function visible(n,p){return W.dist(p.x,p.y,n.x,n.y)<=(n.range||110)&&W.lineOfSight(p.x,p.y,n.x,n.y);}
    function ready(){return (def.required||[]).every(function(id){return !!s.done[id];});}
    function phase(h){if(h.disabledBy&&s.done[h.disabledBy])return 'off';var k=(time+(h.offset||0))%(h.period||5);return k<(h.warning||1.2)?'warning':k<(h.warning||1.2)+(h.active||1.5)?'active':'off';}
    function nearby(p){return nodes.filter(function(n){return enabled(n)&&visible(n,p);}).sort(function(a,b){return W.dist(p.x,p.y,a.x,a.y)-W.dist(p.x,p.y,b.x,b.y);})[0]||null;}
    return {
      nodes:nodes,hazards:hazards,
      tick:function(dt,p,active){if(!active||s.finished)return;time+=dt;hurtCd=Math.max(0,hurtCd-dt);current=nearby(p);
        nodes.forEach(function(n){if(!s.discovered[n.id]&&W.dist(p.x,p.y,n.x,n.y)<300&&W.lineOfSight(p.x,p.y,n.x,n.y)){s.discovered[n.id]=true;persist();}});
        if(hurtCd<=0&&!p.dodging){var h=hazards.find(function(h){return phase(h)==='active'&&W.dist(p.x,p.y,h.x,h.y)<h.r;});if(h){hurtCd=.9;emit('hazard',{id:h.id,fraction:h.damage||.08,reason:h.reason||' 위험 구역에서 너무 오래 머물렀다. 예고 뒤 빈틈에 통과해라.'});}}
      },
      interact:function(p){if(s.finished)return false;var n=nearby(p);if(!n)return false;s.done[n.id]=true;s.discovered[n.id]=true;
        if(n.kind==='checkpoint')s.checkpoint={x:n.x,y:n.y,id:n.id};persist();emit('interact',{node:n});if(ready())emit('gateReady');current=null;return true;},
      checkpoint:function(){return s.checkpoint&&Object.assign({},s.checkpoint);},
      finish:function(){if(s.finished)return false;s.finished=true;persist();return true;},
      nearest:function(p){return nearby(p);},ready:ready,hazardPhase:phase,
      completed:function(id){return !!s.done[id];},discovered:function(id){return !!s.discovered[id];},
      objectiveCount:function(key){return nodes.filter(function(n){return n.objective===key&&s.done[n.id];}).length;},
      snapshot:function(){return JSON.parse(JSON.stringify(s));},
      drain:function(){var e=events;events=[];return e;}
    };
  }
  var API={create:create};if(typeof window!=='undefined')window.TW_EXPEDITION=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})();
