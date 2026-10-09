// Actual field client and mobile LOD; deterministic pose sampling, not live FPS.
const fs=require('node:fs'),path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.argv[2]||'.node-shots/kain-grip');fs.mkdirSync(out,{recursive:true});
// Pages serves the pure CJS modules as static files too. The old online server
// deliberately does not; this offline pose audit must use the Pages host path.
const root=path.resolve(__dirname,'../..'),mime={'.html':'text/html','.js':'text/javascript','.cjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'};
const app=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);return res.end();}
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.stat(file,(err,s)=>{if(err||!s.isFile()){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);});
});let browser;
(async()=>{
 await new Promise(ok=>app.listen(0,'127.0.0.1',ok));const addr=app.address();
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={scope:'actual_world3d_Animated_deterministic_pose_sampling',realAndroidFPS:false,errors:[],poses:[]};
 for(const lod of [1,0]){
  const p=await browser.newPage({viewport:{width:1200,height:900}});
  p.on('pageerror',e=>{report.errors.push(e.stack);console.error(e.message);});
  await p.addInitScript(()=>{const raf=window.requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>{if(!window.__qaPause)cb(t);});});
  await p.goto(`http://127.0.0.1:${addr.port}/world3d.html?offline=1&zone=daejeon&char=kain&lod=${lod}`,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.__W3D?.frames>=3,null,{timeout:180000});
  await p.evaluate(()=>{window.__W3D.hold=true;window.__qaPause=true;});
  for(const [clip,u] of [['idle',.3],['run',.5],['attack1',.4],['attack2',.4],['attack3',.4],['smash',.45],['skill1',.45],['counter',.4],['ult',.4]]){
   const result=await p.evaluate(async({clip,u})=>{
    const T=await import('./vendor/three/three.module.js'),q=window.__W3D,h=q.me.hero,V=()=>new T.Vector3(),bones={};
    h.model.traverse(n=>{if(n.isBone)bones[n.name.replace(/^mixamorig:?/,'')]=n;});
    h.armBlend?.restore();h.rig?.restore();h.mixer.stopAllAction();h.armBlend?.reset();
    const c=h.clips[clip],a=h.mixer.clipAction(c);a.reset().play();
    // Warm the actual mixer -> two-hand IK -> arm stabilizer at 60 Hz.
    for(let i=0;i<=60;i++){
     h.armBlend?.restore();h.rig?.restore();a.time=c.duration*u*i/60;h.mixer.update(0);
     const elapsed=a.time,action=/attack|smash|skill|counter|ult/.test(clip)?{id:clip,clip,kind:'attack',elapsed,duration:c.duration,hitAt:c.duration*.42}:null;
     h.rig?.apply(action,clip==='run',false,1/60,clip,null);h.armBlend?.apply(1/60);
    }
    h.root.updateMatrixWorld(true);
    const slot=h.weapon.parent,origin=h.weapon.getWorldPosition(V()),axis=V().set(0,1,0).applyQuaternion(h.weapon.getWorldQuaternion(new T.Quaternion()));
    const palms=Object.fromEntries(['Right','Left'].map(side=>{
     const hand=bones[side+'Hand'],local=globalThis.TW_LOOKS.palm(T,hand).clone(),p=hand.localToWorld(local),d=p.clone().sub(origin);
     return [side,{point:p.toArray(),axisGap:d.clone().addScaledVector(axis,-d.dot(axis)).length(),along:d.dot(axis),grip:hand.userData.gripPoint?.toArray()}];
    }));
    const at=V().fromArray(palms.Right.point).add(V().fromArray(palms.Left.point)).multiplyScalar(.5);
    const center=h.root.getWorldPosition(V());
    // Camera on the character's front (+Z), unobstructed close-up of both palms.
    q.cam.position.copy(at).add(new T.Vector3(.65,.28,1.15));q.cam.lookAt(at);q.cam.updateMatrixWorld(true);
    q.renderer.render(q.scene,q.cam);
    const close=q.renderer.domElement.toDataURL('image/png'),details={};
    for(const side of ['Right','Left']){
     const hand=bones[side+'Hand'],gp=h.handGrip.grips[side],hq=hand.getWorldQuaternion(new T.Quaternion()),at=V().fromArray(palms[side].point);
     const n=V().fromArray(gp.n).applyQuaternion(hq),f=V().fromArray(gp.f).applyQuaternion(hq),ax=V().fromArray(gp.a).applyQuaternion(hq);
     q.cam.position.copy(at).addScaledVector(n,.45).addScaledVector(f,.08).addScaledVector(ax,.12);q.cam.lookAt(at);q.cam.updateMatrixWorld(true);q.renderer.render(q.scene,q.cam);
     details[side]=q.renderer.domElement.toDataURL('image/png');
    }
    q.cam.position.copy(center).add(new T.Vector3(2.5,2.1,4));q.cam.lookAt(center.clone().add(new T.Vector3(0,1.1,0)));q.cam.updateMatrixWorld(true);q.renderer.render(q.scene,q.cam);
    return {clip,u,palms,slot:slot.name,slotParent:slot.parent.name,looks:!!globalThis.TW_LOOKS,grips:h.handGrip?.grips,close,details,wide:q.renderer.domElement.toDataURL('image/png')};
   },{clip,u});
   for(const type of ['close','wide']){const f=path.join(out,`lod${lod}-${clip}-${type}.png`);fs.writeFileSync(f,Buffer.from(result[type].split(',')[1],'base64'));delete result[type];}
   for(const [side,data] of Object.entries(result.details))fs.writeFileSync(path.join(out,`lod${lod}-${clip}-${side.toLowerCase()}.png`),Buffer.from(data.split(',')[1],'base64'));delete result.details;
   report.poses.push({lod,...result});console.log('sampled',lod,clip,JSON.stringify(result.palms));
  }
  await p.close();
 }
 fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
 if(report.errors.length)throw Error(report.errors.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(ok=>app.close(ok));});
