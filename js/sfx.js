/* 황혼 — 절차 생성 효과음/환경음 (Web Audio, 파일 없음)
   TW_SFX.unlock() 은 첫 터치/키 입력에서 자동. TW_SFX.play(name) · TW_SFX.ambient(on) · TW_SFX.enabled */
(function(){
  var ctx=null, master=null, amb=null, enabled=true, volume=0.7;
  function ac(){ if(ctx) return ctx; var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null; ctx=new AC(); master=ctx.createGain(); master.gain.value=enabled?volume:0; master.connect(ctx.destination); return ctx; }
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
  window.TW_SFX=api;
})();
