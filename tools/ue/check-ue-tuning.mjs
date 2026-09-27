/* UE Vertical Slice 튜닝(HWCombatTuningAsset.h/.cpp) ↔ three.js 규칙(js/dungeons.js → combat_rules.json) 대조.
   UE 쪽은 GPT 패키지(HwanghonCombatUE 1.2)가 C++ 기본값으로 수치를 갖는다. 이 도구는 «같아야 하는 값» 이
   어긋났는지만 본다 — 수치를 고치지 않는다(판정·피해는 디렉터 승인 사항).
   사용: node tools/ue/check-ue-tuning.mjs   → 표 출력, 필수 항목이 어긋나면 exit 1 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCombatRulesExport} from './export-combat-rules.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const UE=path.join(ROOT,'ue','HwanghonCombatUE','Source','HwanghonCombatUE');

export function parseUeTuning(){
  const h=fs.readFileSync(path.join(UE,'Public','Combat','HWCombatTuningAsset.h'),'utf8');
  const cpp=fs.readFileSync(path.join(UE,'Private','Combat','HWCombatTuningAsset.cpp'),'utf8');
  const hv=name=>{ const m=h.match(new RegExp('float\\s+'+name+'\\s*=\\s*([-\\d.]+)f?')); return m?+m[1]:null; };
  /* FHWActionSpec 초기화 순서: {Duration, HitAt, CancelAt, StaminaCost, Damage, Tier, Name, DefCancelAt} */
  const action=name=>{ const m=cpp.match(new RegExp(name+'\\s*=\\s*\\{([^}]*)\\}')); if(!m) return null;
    const p=m[1].split(',').map(s=>s.trim()); const f=i=>parseFloat(p[i]);
    return {duration:f(0),hitAt:f(1),cancel:f(2),stamina:f(3),damage:f(4),tier:p[5],defCancel:f(7)}; };
  const patterns=[]; const re=/Pattern\("(\w+)",\s*([\d.]+)f,\s*([\d.]+)f,\s*([\d.]+)f,\s*\{([\s\S]*?)\}\s*,\s*([^)]*)\)/g; let m;
  while((m=re.exec(cpp))){ const beats=[...m[5].matchAll(/Beat\(([\d.]+)f,\s*([\d.]+)f,\s*([\d.]+)f(?:,\s*(true|false))?\)/g)].map(b=>({at:+b[1],dmg:+b[2],rangeCm:+b[3],counterable:b[4]==='true'}));
    const flags=m[6].split(',').map(s=>s.trim().replace(/f$/,''));
    patterns.push({id:m[1],tell:+m[2],strike:+m[3],recovery:+m[4],beats,counterable:flags[0]==='true',unblockable:flags[1]==='true',jumpOnly:flags[2]==='true',big:flags[3]==='true',lungeCm:flags[4]?parseFloat(flags[4]):0,lungeDur:flags[5]?parseFloat(flags[5]):0}); }
  return {maxStamina:hv('MaxStamina'),regen:hv('StaminaRegenPerSecond'),regenDelay:hv('StaminaRegenDelay'),dodgeIFrames:hv('DodgeIFrames'),dodgeCooldown:hv('DodgeCooldown'),
    jumpDuration:hv('JumpDuration'),jumpCooldown:hv('JumpCooldown'),counterWindow:hv('CounterWindow'),perfectCounter:hv('PerfectCounterWindow'),midCounter:hv('MidCounterWindow'),
    attack1:action('Attack1'),attack2:action('Attack2'),attack3:action('Attack3'),smash:action('Smash'),dodge:action('Dodge'),jump:action('Jump'),counter:action('Counter'),patterns};
}

/* UE 패턴 id ↔ d01 awake 패턴 이름 */
export const PATTERN_MAP={HookCombo:'훅 연타 내려찍기',Charge:'돌진',Slam:'도약 내려찍기',Spin:'회전 후려치기',GroundWave:'지면 충격파'};

export function compareTuning(){
  const X=buildCombatRulesExport(), U=parseUeTuning(), rows=[];
  const eq=(a,b)=>a!=null&&b!=null&&Math.abs(a-b)<1e-6;
  const row=(item,ref,ue,required,note='')=>rows.push({item,ref,ue,ok:eq(ref,ue),required,note});
  for(const k of ['attack1','attack2','attack3','smash','counter']){
    const R=X.actions[k], A=U[k];
    row(k+' duration',R.duration,A&&A.duration,true); row(k+' hitAt',R.hit,A&&A.hitAt,true); row(k+' cancel',R.cancel,A&&A.cancel,true);
    if(k!=='counter') row(k+' defCancel (hit+active+defCancel)',+(R.hit+R.active+X.defCancel).toFixed(3),A&&A.defCancel,true);
  }
  row('stamina max',X.stamina.max,U.maxStamina,true); row('stamina regen',X.stamina.regen,U.regen,true); row('stamina delay',X.stamina.delay,U.regenDelay,true);
  row('dodge stamina',X.stamina.dodge,U.dodge&&U.dodge.stamina,true); row('dodge iframes',X.dodge.iframes,U.dodgeIFrames,true); row('dodge cooldown',X.dodge.cooldown,U.dodgeCooldown,true);
  row('jump stamina',X.jump.st,U.jump&&U.jump.stamina,true); row('jump duration',X.jump.dur,U.jumpDuration,true); row('jump cooldown',X.jump.cooldown,U.jumpCooldown,true);
  row('counter window',X.counter.window,U.counterWindow,true); row('counter perfect',X.counter.perfect,U.perfectCounter,true); row('counter mid',X.counter.mid,U.midCounter,true);
  row('smash stamina (tier 3)',X.combo.smashSt[3],U.smash&&U.smash.stamina,false,'three.js 는 타수별 10/12/14/18, UE 는 단일값');
  const awake=X.boss.stages.find(s=>s.id==='awake');
  for(const [id,name] of Object.entries(PATTERN_MAP)){
    const R=awake.patterns.find(p=>p.name===name), P=U.patterns.find(p=>p.id===id);
    if(!R||!P){ rows.push({item:id+' 존재',ref:!!R,ue:!!P,ok:false,required:true,note:''}); continue; }
    row(id+' tell(tele)',R.tele,P.tell,true);
    rows.push({item:id+' counterable',ref:R.counterable,ue:P.counterable,ok:R.counterable===P.counterable,required:true,note:''});
    rows.push({item:id+' jumpOnly',ref:R.jumpOnly,ue:P.jumpOnly,ok:R.jumpOnly===P.jumpOnly,required:true,note:''});
    const dmg=P.beats.reduce((s,b)=>s+b.dmg,0), refDmg=R.dmg+(R.chain||[]).reduce((s,c)=>s+c.dmg,0);
    row(id+' 피해 합계',refDmg,dmg,false,R.chain?'연계 포함':'');
    if(R.lunge||P.lungeCm) row(id+' 돌진 거리 (cm)',R.motion?Math.round(R.motion.distanceM*100):null,P.lungeCm,false,'three.js attackMotion px÷50 = m');
  }
  const missing=awake.patterns.filter(p=>!Object.values(PATTERN_MAP).includes(p.name)).map(p=>p.name);
  if(missing.length) rows.push({item:'UE 에 없는 d01 패턴',ref:missing.join(', '),ue:'—',ok:false,required:false,note:'Vertical Slice 범위(5 패턴)'});
  return rows;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const rows=compareTuning(); let bad=0;
  console.log('| 항목 | three.js | UE 1.2 | 판정 | 비고 |\n|---|---|---|---|---|');
  for(const r of rows){ const v=r.ok?'같음':(r.required?'**다름(필수)**':'다름'); if(!r.ok&&r.required) bad++; console.log(`| ${r.item} | ${r.ref} | ${r.ue} | ${v} | ${r.note||''} |`); }
  process.exit(bad?1:0);
}
