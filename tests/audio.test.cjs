const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('sample pack decodes, starts one bed, respects mute and hidden tab, and bounds voices',async()=>{
 const listeners={},sources=[],param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(){},setTargetAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}});
 class AC{constructor(){this.currentTime=1;this.state='running';this.destination={};this.sampleRate=24000;}createGain(){return node();}createDynamicsCompressor(){return Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,param()]).concat([['connect',()=>{}]]));}createBufferSource(){const n=node();sources.push(n);return n;}decodeAudioData(){return Promise.resolve({duration:16});}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}}
 const document={hidden:false,currentScript:{src:'http://localhost/js/sfx.js'},addEventListener(k,v){listeners[k]=v;},removeEventListener(){}};
 const window={AudioContext:AC,addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('js/sfx.js','utf8'),{window,document,URL,Promise,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)}),setTimeout,setInterval,Math});
 const a=window.TW_SFX;a.scene('boss');a.unlock();await new Promise(r=>setImmediate(r));
 assert.equal(a.diagnostics().loaded,12);assert.equal(a.diagnostics().scene,'boss');
 for(let i=0;i<100;i++)a.scene('boss');assert.equal(sources.length,1);
 a.play('execute');assert.equal(a.diagnostics().voices,1);
 a.enabled=false;assert.equal(a.diagnostics().scene,'off');a.play('execute');assert.equal(a.diagnostics().voices,1);
 a.enabled=true;assert.equal(a.diagnostics().scene,'boss');
 document.hidden=true;listeners.visibilitychange();assert.equal(a.diagnostics().scene,'off');
 document.hidden=false;listeners.visibilitychange();await new Promise(r=>setImmediate(r));assert.equal(a.diagnostics().scene,'boss');
 a.scene('off');assert.equal(a.diagnostics().scene,'off');
});
test('all original WAV files are stereo PCM with valid lengths',()=>{
 const manifest=JSON.parse(fs.readFileSync('art/audio/manifest.json'));
 assert.equal(Object.keys(manifest).length,12);
 for(const [name,m]of Object.entries(manifest)){const b=fs.readFileSync('art/audio/'+name+'.wav');assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(24),24000);assert.equal((b.length-44)/96000,m.seconds);}
});
