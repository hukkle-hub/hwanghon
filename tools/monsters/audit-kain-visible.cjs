// Render real clients, including the equipment path previously missing gripHands.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.argv[2]||'.node-shots/kain-visible');fs.mkdirSync(out,{recursive:true});
const root=path.resolve(__dirname,'../..'),mime={'.html':'text/html','.js':'text/javascript','.cjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'};
const app=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.stat(f,(e,s)=>{if(e||!s.isFile()){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);});});
let browser;
(async()=>{
 await new Promise(ok=>app.listen(0,'127.0.0.1',ok));const base=process.env.KAIN_AUDIT_BASE||`http://127.0.0.1:${app.address().port}/`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={base,errors:[],poses:[],visualApproval:false};
 for(const client of (process.env.KAIN_AUDIT_CLIENTS||'viewer,field,dungeon').split(',')){
  const p=await browser.newPage({viewport:process.env.KAIN_AUDIT_MOBILE==='port'?{width:412,height:915}:process.env.KAIN_AUDIT_MOBILE==='land'?{width:915,height:412}:{width:1200,height:900}});
  p.on('pageerror',e=>report.errors.push({client,error:e.stack}));
  await p.addInitScript(()=>{localStorage.setItem('tw:save',JSON.stringify({char:'kain'}));const raf=requestAnimationFrame;window.__qaRAF=raf;window.requestAnimationFrame=cb=>raf(t=>{if(!window.__qaPause)cb(t);});});
  await p.goto(base+(client==='viewer'?'viewer.html?equip=1&fit=1&char=kain&wind=off':client==='dungeon'?'game3d.html?d=d01':'world3d.html?offline=1&zone=daejeon&char=kain&lod=1'),{waitUntil:'domcontentloaded'});
  await p.waitForFunction(c=>c==='viewer'?window.__TW_VIEW?.equippedWeapon&&window.__TW_VIEW?.handGrip:c==='dungeon'?window.TW_DUNGEON?.ain.ready&&window.TW_DUNGEON?.ain.weapon:window.__W3D?.frames>=3,client,{timeout:180000});
  if(client==='dungeon')await p.evaluate(()=>window.TW_DUNGEON.freeze(true));
  await p.screenshot({path:path.join(out,`${client}-default-framing.png`)});
  await p.evaluate(c=>{if(c!=='dungeon')window.__qaPause=true;},client);
  for(const clip of ['idle','attack1','smash']){
   const r=await p.evaluate(async({client,clip})=>{
    const T=await import('./vendor/three/three.module.js'),V=()=>new T.Vector3();
    const q=client==='viewer'?window.__TW_VIEW:client==='dungeon'?window.TW_DUNGEON:window.__W3D,h=client==='field'?q.me.hero:client==='dungeon'?q.ain:null;
    const model=h?.model||q.charRoot,w=h?.weapon||q.equippedWeapon,cam=q.cam,scene=q.scene,renderer=q.renderer||{domElement:document.querySelector('#game3d'),render(){}};
    const capture=async()=>{if(client==='dungeon')await new Promise(ok=>window.__qaRAF(()=>window.__qaRAF(ok)));else renderer.render(scene,cam);return renderer.domElement.toDataURL('image/png');};
    if(h){h.armBlend.restore();h.rig.restore();h.armBlend.reset();h.mixer.stopAllAction();const c=h.clips[clip],a=h.mixer.clipAction(c).reset().play();
     for(let i=0;i<90;i++){h.armBlend.restore();h.rig.restore();a.time=c.duration*.4;h.mixer.update(0);h.rig.apply(clip==='idle'?null:{id:clip,clip,kind:'attack',duration:c.duration,elapsed:a.time,hitAt:c.duration*.42},false,false,1/60,clip);h.armBlend.apply(1/60);}
    }else{q.play(clip);for(let i=0;i<90;i++)q.update(1/60);}
    model.updateMatrixWorld(true);
    const origin=w.getWorldPosition(V()),axis=V().set(0,1,0).applyQuaternion(w.getWorldQuaternion(new T.Quaternion())),verts=[];
    w.traverse(m=>{if(!m.isMesh)return;const P=m.geometry.attributes.position;for(let i=0;i<P.count;i++)verts.push(V().fromBufferAttribute(P,i).applyMatrix4(m.matrixWorld).sub(origin).dot(axis));});
    const length=Math.max(...verts)-Math.min(...verts),bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
    const palms={};for(const side of ['Right','Left']){
     const hand=bones[side+'Hand'],at=hand.localToWorld(hand.userData.gripPoint.clone()),d=at.clone().sub(origin),along=d.dot(axis),points=[],tris=[];
     model.traverse(m=>{if(!m.isSkinnedMesh)return;const bi=m.skeleton.bones.indexOf(hand),G=m.geometry,SI=G.attributes.skinIndex,SW=G.attributes.skinWeight;if(bi<0)return;m.skeleton.update();for(let i=0;i<G.attributes.position.count;i++){let weight=0;for(let k=0;k<4;k++)if(SI.getComponent(i,k)===bi)weight+=SW.getComponent(i,k);if(weight<.6)continue;const p=m.getVertexPosition(i,V()).applyMatrix4(m.matrixWorld);if(Math.abs(p.clone().sub(at).dot(axis))<.045)points.push(p);}});
     w.traverse(m=>{if(!m.isMesh)return;const G=m.geometry,P=G.attributes.position,I=G.index;for(let i=0;i<(I?I.count:P.count);i+=3){const ps=[0,1,2].map(k=>V().fromBufferAttribute(P,I?I.getX(i+k):i+k).applyMatrix4(m.matrixWorld));if(ps.every(p=>{const e=p.clone().sub(origin),a=e.dot(axis);return Math.abs(a-along)<.07&&e.addScaledVector(axis,-a).length()<.065;}))tris.push(new T.Triangle(...ps));}});
     let surfaceGap=Infinity;for(const p of points)for(const tri of tris)surfaceGap=Math.min(surfaceGap,tri.closestPointToPoint(p,V()).distanceTo(p));
     palms[side]={point:at.toArray(),gap:d.clone().addScaledVector(axis,-along).length(),along,surfaceGap:Number.isFinite(surfaceGap)?surfaceGap:null,handVertices:points.length,hiltTriangles:tris.length};
    }
    // Local-axis views of the complete, normally lit hand: no hidden arm, no
    // clipping plane tricks, no replacement materials or diagnostic fake grips.
    const shots={};cam.near=.01;cam.updateProjectionMatrix();
    for(const side of ['Right','Left'])for(const angle of [0,1,2,3]){
     const hand=bones[side+'Hand'],at=V().fromArray(palms[side].point),hq=hand.getWorldQuaternion(new T.Quaternion());
     const off=[new T.Vector3(.48,.04,.15),new T.Vector3(-.48,.04,.15),new T.Vector3(.12,.04,.48),new T.Vector3(.12,.04,-.48)][angle].applyQuaternion(hq);
     cam.position.copy(at).add(off);cam.lookAt(at);cam.updateMatrixWorld(true);shots[side+angle]=await capture();
    }
    const center=model.getWorldPosition(V());cam.position.copy(center).add(new T.Vector3(2.6,2.2,4.8));cam.lookAt(center.clone().add(new T.Vector3(0,1,0)));cam.updateMatrixWorld(true);shots.wide=await capture();
    return {client,clip,length,palms,weaponParent:w.parent.name,gripAmounts:(h?.handGrip||q.handGrip).amount,shots};
   },{client,clip});
   for(const [name,data]of Object.entries(r.shots))fs.writeFileSync(path.join(out,`${client}-${clip}-${name}.png`),Buffer.from(data.split(',')[1],'base64'));delete r.shots;
   report.poses.push(r);console.log(JSON.stringify(r));
   if(Math.abs(r.length-1.9)>.002)throw Error(`${client}: sword is ${r.length}m, expected 1.900m`);
   if(r.palms.Right.gap>.001)throw Error(`${client}: right socket detached`);
  }
  await p.close();
 }
 fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
 if(report.errors.length)throw Error(JSON.stringify(report.errors));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(ok=>app.close(ok));});
