/* 황혼 — organic audio sample pack v2 (legacy synthesis below is inactive)
   TW_SFX.unlock() 은 첫 터치/키 입력에서 자동. TW_SFX.play(name) · TW_SFX.ambient(on) · TW_SFX.enabled */
(function(){
  var ctx=null, master=null, amb=null, enabled=true, volume=0.7;
  function ac(){ if(ctx) return ctx; var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null; ctx=new AC(); master=ctx.createGain(); master.gain.value=enabled?volume:0; var compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-8;compressor.knee.value=8;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.2;master.connect(compressor);compressor.connect(ctx.destination); return ctx; }
  function unlock(){ var c=ac(); if(!c) return; if(c.state==='suspended') c.resume(); }
  function env(g, t0, a, d, s, r, peak){ g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak||1, t0+a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001,(peak||1)*s), t0+a+d); g.gain.exponentialRampToValueAtTime(0.0001, t0+a+d+r); }
  function noise(dur){ var c=ac(), b=c.createBuffer(1, Math.ceil(c.sampleRate*dur), c.sampleRate), d=b.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=Math.random()*2-1; var s=c.createBufferSource(); s.buffer=b; return s; }
  function tone(type, f0, f1, dur, vol, filt){ var c=ac(); if(!c) return; var o=c.createOscillator(), g=c.createGain(), t=c.currentTime; o.type=type; o.frequency.setValueAtTime(f0,t); if(f1) o.frequency.exponentialRampToValueAtTime(f1,t+dur); env(g,t,0.005,dur*0.5,0.3,dur*0.5,vol||0.5);
    var node=o; if(filt){ var f=c.createBiquadFilter(); f.type=filt.type||'lowpass'; f.frequency.value=filt.f; o.connect(f); node=f; } node.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.05); }
  function burst(dur, vol, filt, pitchTo){ var c=ac(); if(!c) return; var n=noise(dur), g=c.createGain(), t=c.currentTime, f=c.createBiquadFilter(); f.type=filt.type||'bandpass'; f.frequency.setValueAtTime(filt.f,t); if(pitchTo) f.frequency.exponentialRampToValueAtTime(pitchTo,t+dur); f.Q.value=filt.q||1; env(g,t,0.004,dur*0.4,0.25,dur*0.6,vol||0.5); n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t+dur+0.05); }
  var SFX={
    swing:function(){ burst(0.18,0.35,{type:'bandpass',f:1800,q:0.8},500); },
    hit:function(crit){ burst(0.12,0.6,{type:'lowpass',f:900}); tone('square',180,60,0.12,0.35); if(crit){ tone('triangle',900,300,0.18,0.3); } },
    counter:function(perfect){ burst(0.16,0.7,{type:'highpass',f:2500}); tone('sawtooth',660,110,0.35,0.5,{type:'lowpass',f:2400}); tone('sine',perfect?1320:990,perfect?1760:1180,0.3,0.25); },
    brk:function(){ burst(0.35,0.8,{type:'lowpass',f:700}); tone('square',120,40,0.4,0.5); burst(0.5,0.4,{type:'bandpass',f:3000,q:2},400); },
    down:function(){ tone('sawtooth',90,30,0.9,0.6,{type:'lowpass',f:500}); burst(0.6,0.5,{type:'lowpass',f:300}); },
    ult:function(){ tone('sawtooth',55,440,0.6,0.6,{type:'lowpass',f:1800}); burst(0.8,0.7,{type:'bandpass',f:800,q:0.5},4000); tone('sine',880,220,0.8,0.3); },
    hurt:function(guarded){ if(guarded){ tone('triangle',420,180,0.15,0.4); burst(0.1,0.3,{type:'highpass',f:3000}); } else { burst(0.2,0.6,{type:'lowpass',f:600}); tone('square',140,50,0.2,0.4); } },
    roll:function(){ burst(0.22,0.3,{type:'bandpass',f:600,q:0.7},250); },
    guard:function(){ tone('triangle',300,300,0.08,0.2); },
    tele:function(){ tone('sine',220,330,0.25,0.18); },
    gate:function(){ burst(0.5,0.6,{type:'lowpass',f:400}); tone('square',70,45,0.6,0.5); setTimeout(function(){ burst(0.3,0.5,{type:'bandpass',f:2500,q:3},800); },120); },
    chains:function(){ for(var i=0;i<6;i++) setTimeout(function(){ burst(0.06,0.35,{type:'bandpass',f:3200+Math.random()*1500,q:4}); }, i*70+Math.random()*40); },
    ui:function(){ tone('sine',880,660,0.08,0.15); },
    phase:function(){ tone('sawtooth',110,55,0.8,0.5,{type:'lowpass',f:900}); SFX.chains(); },
    clear:function(){ [523,659,784,1046].forEach(function(f,i){ setTimeout(function(){ tone('triangle',f,f,0.5,0.3); }, i*140); }); }
  };
  function ambient(on){ var c=ac(); if(!c) return; if(!on){ if(amb){ amb.g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.5); setTimeout(function(){ try{ amb.n.stop(); }catch(e){} }, 600); amb=null; } return; } if(amb) return;
    var n=noise(4); n.loop=true; var f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=380; var g=c.createGain(); g.gain.value=0.0001; n.connect(f); f.connect(g); g.connect(master); n.start(); g.gain.exponentialRampToValueAtTime(0.09, c.currentTime+2);
    var lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=0.13; lg.gain.value=180; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    /* 불꽃 탁탁 */
    var crack=setInterval(function(){ if(!amb||!enabled) return; if(Math.random()<0.45) burst(0.03,0.12,{type:'bandpass',f:2500+Math.random()*3000,q:6}); }, 160);
    amb={ n:n, g:g, crack:crack }; }
  var api={ get volume(){return volume;},set volume(v){volume=Math.max(0,Math.min(1,Number(v)||0));if(master)master.gain.value=enabled?volume:0;}, unlock:unlock, ambient:ambient, get enabled(){ return enabled; }, set enabled(v){ enabled=!!v; if(master) master.gain.value=enabled?volume:0; if(!enabled) ambient(false); },
    play:function(name, a){ if(!enabled||!ac()) return; try{ SFX[name] && SFX[name](a); }catch(e){} } };
  ['pointerdown','keydown','touchstart'].forEach(function(ev){ document.addEventListener(ev, unlock, { passive:true }); });
  /* Organic sample pack. Missing samples stay silent; rejected synth is never used. */
  var buffers={}, loading=null, bed=null, desired='off', active=[], lastSound={};
  var originalUnlock=unlock;
  var audioBase=new URL('../art/audio/',document.currentScript.src);
  function preload(){
    if(loading)return loading;
    var c=ac();if(!c)return Promise.resolve();
    loading=Promise.all(['swing','hit','hit_heavy','counter','counter_perfect','execute','brk','roll','tele','phase','explore','boss'].map(function(name){
      return fetch(new URL(name+'.wav?v=organic2',audioBase)).then(function(r){if(!r.ok)throw Error(r.status);return r.arrayBuffer();})
        .then(function(data){return c.decodeAudioData(data);}).then(function(b){buffers[name]=b;})
        .catch(function(){/* Missing samples remain silent: never restore rejected synth sounds. */});
    })).then(syncBed);return loading;
  }
  function stopBed(){if(!bed)return;var old=bed;bed=null;old.g.gain.cancelScheduledValues(ctx.currentTime);old.g.gain.setTargetAtTime(0,ctx.currentTime,.15);old.s.stop(ctx.currentTime+.8);}
  function syncBed(){
    if(!ctx||!enabled||document.hidden||desired==='off'){stopBed();return;}
    if(bed&&bed.name===desired)return;
    stopBed();if(!buffers[desired]||ctx.state!=='running')return;
    var s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffers[desired];s.loop=true;
    g.gain.value=0;s.connect(g);g.connect(master);g.gain.setTargetAtTime(desired==='boss'?.15:.1,ctx.currentTime,.5);
    s.onended=function(){s.disconnect();g.disconnect();};s.start();bed={s:s,g:g,name:desired};
  }
  api.scene=function(name){desired=['explore','boss'].indexOf(name)>=0?name:'off';syncBed();};
  api.diagnostics=function(){return {loaded:Object.keys(buffers).length,context:ctx?ctx.state:'locked',scene:bed?bed.name:'off',voices:active.length};};
  api.ambient=function(on){api.scene(on?'explore':'off');};
  api.unlock=function(){originalUnlock();if(ctx)Promise.resolve(ctx.resume()).then(function(){preload();syncBed();}).catch(function(){});};
  ['pointerdown','keydown','touchstart'].forEach(function(ev){document.removeEventListener(ev,unlock);document.addEventListener(ev,api.unlock,{passive:true});});
  api.play=function(name,a){
    if(!enabled||document.hidden)return;
    var key=name==='hit'&&a?'hit_heavy':name==='counter'&&a?'counter_perfect':name;
    var aliases={down:'brk',ult:'execute',hurt:a?'counter':'hit',guard:'counter',gate:'phase',chains:'brk',ui:'roll',clear:'counter_perfect'};
    key=aliases[key]||key;
    if(!buffers[key]||!ctx||ctx.state!=='running'){return;}
    var t=ctx.currentTime;if(t-(lastSound[key]||-10)<.045)return;lastSound[key]=t;
    if(active.length>=12){try{active.shift().stop();}catch(e){}}
    var s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffers[key];g.gain.value=name==='ui'?.08:name==='guard'?.24:.48;
    s.connect(g);g.connect(master);active.push(s);
    s.onended=function(){active=active.filter(function(x){return x!==s;});s.disconnect();g.disconnect();};s.start();
    if(bed){bed.g.gain.cancelScheduledValues(t);bed.g.gain.setTargetAtTime(.035,t,.02);bed.g.gain.setTargetAtTime(desired==='boss'?.15:.1,t+.3,.3);}
  };
  Object.defineProperty(api,'enabled',{get:function(){return enabled;},set:function(v){enabled=!!v;if(master)master.gain.value=enabled?volume:0;syncBed();}});
  document.addEventListener('visibilitychange',function(){syncBed();if(ctx){if(document.hidden)ctx.suspend();else if(enabled)ctx.resume().then(syncBed).catch(function(){});}});
  window.addEventListener('pagehide',function(){desired='off';stopBed();});
  window.TW_SFX=api;
})();
