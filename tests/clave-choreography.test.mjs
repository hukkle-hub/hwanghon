import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {
 CLAVE_MOTIONS,CLAVE_CHOREOGRAPHY,CLAVE_IDLE_CYCLE,
 claveSkillClipTime,claveShutterTravel,claveSlamShutterTime,claveCounterActive,claveStrikeActive,claveStormBias,claveStaggerPose,claveIdleClipTime,claveIdleCues
} from '../js/mmo/boss-motion.js';

const require=createRequire(import.meta.url),{SKILLS,inShape}=require('../server/field-boss-combat.cjs');
const hitView=h=>Object.fromEntries(['at','shape','range','width','back','angle','radius'].filter(k=>k in h).map(k=>[k,h[k]]));

test('클라이언트 모션 계약은 서버 판정의 시각·모양만 정확히 복제한다',()=>{
 for(const skill of ['shutter','storm','slam']){
  const client=CLAVE_MOTIONS[skill],server=SKILLS[skill];
  assert.equal(client.clip,server.clip);assert.equal(client.duration,server.duration);
  assert.deepEqual(client.hits.map(hitView),server.hits.map(hitView));
  assert.deepEqual(client.counter,server.counter);
  if(skill==='shutter'){assert.deepEqual(client.charge,server.charge);assert.equal(client.travel,server.travel);}
 }
 const presentation=JSON.stringify({CLAVE_MOTIONS,CLAVE_CHOREOGRAPHY});
 for(const forbidden of ['damage','knock','hp','maxHp','ratio'])assert.doesNotMatch(presentation,new RegExp('"'+forbidden+'"','i'));
});

test('셔터 늦은 입장도 서버 출발점·이동·뒤 0.5m 판정을 복원한다',()=>{
 const d=CLAVE_MOTIONS.shutter,yaw=.73,origin={x:11.25,z:-6.4};
 for(const elapsed of [0,1350,1600,1720,1850,9999]){const travel=claveShutterTravel(elapsed),x=origin.x+Math.sin(yaw)*travel,z=origin.z+Math.cos(yaw)*travel,recovered={x:x-Math.sin(yaw)*travel,z:z-Math.cos(yaw)*travel};assert.ok(Math.abs(recovered.x-origin.x)<1e-9&&Math.abs(recovered.z-origin.z)<1e-9,elapsed+'ms 출발점 역산');}
 assert.equal(claveShutterTravel(1350),0);assert.equal(claveShutterTravel(1850),d.travel);assert.equal(claveShutterTravel(9999),d.travel);
 const h=SKILLS.shutter.hits[0],o={x:0,z:0,yaw:0};assert.equal(inShape(o,{x:0,z:-.5},h),true);assert.equal(inShape(o,{x:0,z:-.501},h),false);assert.equal(h.back,.5);
});

test('서버 접점은 원본 GLB의 실제 타격 자세에 고정된다',()=>{
 const source={shutter:121/30,storm:157/30,slam:83/30};
 assert.ok(Math.abs(claveSkillClipTime('shutter',1720,source.shutter)-61/30)<1e-9);
 assert.ok(Math.abs(claveSkillClipTime('storm',1315,source.storm)-1.6)<1e-9);
 assert.ok(Math.abs(claveSkillClipTime('storm',2135,source.storm)-77/30)<1e-9);
 assert.ok(Math.abs(claveSkillClipTime('storm',2955,source.storm)-3.6)<1e-9);
 assert.ok(Math.abs(claveSlamShutterTime(1540)-61/30)<1e-9);
 assert.equal(claveSkillClipTime('shutter',-500,source.shutter),0);
 assert.ok(Math.abs(claveSkillClipTime('storm',99999,source.storm)-source.storm)<1e-9);
});

test('30·60·120fps와 긴 프레임에서도 클립 시각은 단조 증가하고 접점은 한 번씩 건넌다',()=>{
 for(const skill of ['shutter','storm','slam'])for(const fps of [30,60,120]){
  const def=CLAVE_MOTIONS[skill],clip=CLAVE_CHOREOGRAPHY[skill].source,seen=new Array(def.hits.length).fill(0);let prevT=0,prevSource=-1;
  for(let frame=1;;frame++){
   const t=Math.min(def.duration,frame*1000/fps),source=claveSkillClipTime(skill,t,clip);assert.ok(source+1e-9>=prevSource,skill+' '+fps+'fps 단조 증가');
   for(let i=0;i<def.hits.length;i++)if(prevT<def.hits[i].at&&t>=def.hits[i].at)seen[i]++;
   prevT=t;prevSource=source;if(t===def.duration)break;
  }
  assert.deepEqual(seen,new Array(def.hits.length).fill(1),skill+' '+fps+'fps 접점 1회');
 }
 const storm=CLAVE_MOTIONS.storm.hits,seen=[0,0,0];let before=0;for(const after of [1000,2200,4000]){for(let i=0;i<storm.length;i++)if(before<storm[i].at&&after>=storm[i].at)seen[i]++;before=after;}assert.deepEqual(seen,[1,1,1],'프레임 점프도 지난 접점을 중복하지 않는다');
});

test('클레이브는 각 접점 전에 읽을 수 있는 정지 뒤 짧게 snap한다',()=>{
 const t=(s,ms)=>claveSkillClipTime(s,ms,CLAVE_CHOREOGRAPHY[s].source);
 assert.equal(t('shutter',1350),t('shutter',1470));assert.ok(t('shutter',1720)>t('shutter',1470));
 assert.equal(t('storm',900),t('storm',1150));assert.equal(t('storm',1830),t('storm',1980));assert.equal(t('storm',2600),t('storm',2800));
 assert.ok(t('storm',1315)>t('storm',1150));assert.ok(t('storm',2135)>t('storm',1980));assert.ok(t('storm',2955)>t('storm',2800));
 assert.equal(t('slam',1190),t('slam',1390));assert.ok(claveSlamShutterTime(1540)>claveSlamShutterTime(1390));
});

test('counter 색 의미는 패킷의 inclusive 창만 따르고, 궤적은 snap 구간에만 켜진다',()=>{
 const a={motion:'skill',counterOpen:2600,counterClose:2955};
 assert.equal(claveCounterActive(a,2599),false);assert.equal(claveCounterActive(a,2600),true);assert.equal(claveCounterActive(a,2955),true);assert.equal(claveCounterActive(a,2956),false);
 assert.equal(claveStrikeActive('storm',2700),false,'cyan hold에는 궤적을 내지 않는다');assert.equal(claveStrikeActive('storm',2800),true);assert.equal(claveStrikeActive('slam',1389),false);assert.equal(claveStrikeActive('slam',1390),true);
  assert.equal(claveStormBias(1050),-1,'1타는 왼쪽 사선');assert.equal(claveStormBias(1900),1,'2타는 오른쪽 사선');assert.equal(claveStormBias(2700),0,'마지막은 정중앙');
  assert.equal(claveStaggerPose(0),0);assert.equal(claveStaggerPose(180),1);assert.equal(claveStaggerPose(420),1);assert.equal(claveStaggerPose(1350),0);
});

test('4.8초 보초 idle은 결정적이고 긴 정지·매끄러운 주기 이음새를 가진다',()=>{
 const out={};assert.equal(claveIdleCues(1500,out),out,'호출자가 준 객체를 재사용');const at1500={...out};claveIdleCues(1500,out);assert.deepEqual(out,at1500);
 claveIdleCues(3000,out);assert.equal(out.breath,0);assert.equal(out.turn,1);assert.equal(out.brace,1);assert.equal(out.guard,1);
 const a={},b={};claveIdleCues(0,a);claveIdleCues(CLAVE_IDLE_CYCLE,b);assert.deepEqual(a,b);
 claveIdleCues(CLAVE_IDLE_CYCLE-1,b);assert.ok(Math.abs(b.turn)<1e-4&&Math.abs(b.guard)<1e-4,'주기 끝에서 중립으로 돌아온다');
 const dur=5/6;assert.equal(claveIdleClipTime(2200,dur),claveIdleClipTime(3000,dur),'긴 보초 구간은 원본 자세도 멈춘다');assert.equal(claveIdleClipTime(0,dur),claveIdleClipTime(CLAVE_IDLE_CYCLE,dur));assert.ok(Math.abs(claveIdleClipTime(CLAVE_IDLE_CYCLE-1,dur)-dur)<1e-5,'끝 자세가 루프 시작과 맞닿는다');
});

test('서버 시각 pose 준비는 mixer 평가보다 먼저 배선된다',async()=>{
 const html=await readFile(new URL('../mmo.html',import.meta.url),'utf8'),motion=await readFile(new URL('../js/mmo/boss-motion.js',import.meta.url),'utf8'),line=html.match(/if\(o\.mixer&&[^\n]+/u)?.[0]||'';
 assert.ok(line.includes('prepareBossMotion(o,bossNow())'));assert.ok(line.indexOf('prepareBossMotion')<line.indexOf('o.mixer.update(dt)'));
 assert.match(html,/viewW=VIEW_H\*\(a<\.75\?1\.14:1\)/,'좁은 세로 화면은 짧은 변을 조금 넓힌다');
 assert.match(html,/function portraitBossFocus\([^\n]+safeX[^\n]+safeY[^\n]+Math\.min\(k,safeX\/sx\)[^\n]+Math\.min\(k,safeY\/sy\)/,'세로 구역 가장자리에서도 플레이어 안전영역을 지킨다');
 assert.match(html,/counterCue\?\.12:threat\?\.28:\.58/,'반격·예고 중 던전 암전을 제한한다');
 assert.match(html,/clockSamples[^\n]+-Infinity[\s\S]+const bossNow=\(\)=>\{const n=Date\.now\(\)\+serverClock;if\(n>lastBossNow\)lastBossNow=n;return lastBossNow;/,'서버 시계는 최소 지연 표본을 고르고 역행하지 않는다');
 assert.match(motion,/trailOn=attacking&&!fx\.reduced/,'감소 모션은 공격 잔상을 만들지 않는다');assert.match(motion,/fx\.reduced\?r\.r:ease\(/,'감소 모션 접점 고리는 확대하지 않는다');
 assert.match(motion,/o\.motionSeq=Number\.NaN;o\.motionState=''/,'사망 정리 뒤 같은 seq idle도 다시 재생한다');
});
