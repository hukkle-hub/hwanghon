/* UE5 Vertical Slice(ue/HwanghonCombatUE) 로 «전투 규칙» 을 옮긴다 — 코드 포팅이 아니라 데이터 포팅.
   js/dungeons.js RULES(판정 시각·연계·회피·점프·카운터·경직·히트스톱·자세·기력) 와
   d01(훈련장) 보스 패턴·공격 이동(js/dungeon-content.js) 을 한 JSON 으로 뽑는다.
   UE 쪽은 UHwCombatRulesAsset 이 이 JSON 을 읽는다(Source/HwanghonCombat/HwCombatRules.*).
   사용: node tools/ue/export-combat-rules.mjs [출력 경로]
   판정값 자체는 여기서 바꾸지 않는다 — tests/ue-combat-rules-export.test.mjs 가 원본과 대조한다. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');

export function buildCombatRulesExport(){
  globalThis.window=globalThis.window||globalThis;
  const DG=require(path.join(ROOT,'js','dungeons.js'));
  const R=DG.RULES, T=DG.ARENAS.tutorial;
  /* js/dungeon-content.js 는 levels 를 요구한다 — d01 attackMotion 만 필요하므로 최소 흉내 */
  let attackMotion={};
  try{
    const src=fs.readFileSync(path.join(ROOT,'js','dungeon-content.js'),'utf8');
    const m=src.match(/levels\.d01\.attackMotion=(\{[^;]*\});/);
    if(m) attackMotion=Function('"use strict";return ('+m[1]+')')();
  }catch(e){ attackMotion={}; }
  const M=R.motion, prof=(M.characterProfiles&&M.characterProfiles.ain)||{};
  const timing=(name,base)=>{ const P=prof[name]||{}; return {hit:P.hit!=null?P.hit:base.hit, active:P.active!=null?P.active:base.active, duration:P.duration!=null?P.duration:base.duration, cancel:P.cancel!=null?P.cancel:base.cancel}; };
  const out={
    schema:'hwanghon.combat-rules/1', source:'js/dungeons.js RULES + ARENAS.tutorial + js/dungeon-content.js levels.d01.attackMotion',
    units:{time:'s', distance:'m (원본 px ÷ 50)', damage:'HP'}, worldScalePxPerM:50,
    /* 행동 시간표 — 아인 기준(rhythm.ain = 1.0). UE 쪽 speed = clamp(aspd/100,0.7,1.6)/rhythm.dur 로 나눈다(combat.js action()) */
    actions:{ attack1:timing('attack1',M.light), attack2:timing('attack2',M.light), attack3:timing('attack3',M.light),
              smash:timing('smash',M.smash), counter:timing('counter',M.counter), ult:timing('ult',M.ult), exec:timing('exec',M.exec),
              skill1:timing('skill1',M.skill), skill2:timing('skill2',M.skill), skill3:timing('skill3',M.skill), skill4:timing('skill4',M.skill) },
    inputBuffer:M.buffer, defCancel:M.defCancel,
    combo:R.combo, dodge:R.dodge, jump:R.jump, guard:R.guard, counter:R.counter, opening:R.opening, stamina:R.stamina,
    hitstop:R.hitstop, stagger:R.stagger, posture:R.posture, ult:R.ult, weak:R.weak, bleed:R.bleed, execute:R.execute, rhythm:R.rhythm,
    /* d01 보스(허수아비) — 3 단계 패턴. tele = 예고 초, window = 판정 창, counterable 기본 true */
    boss:{ id:T.id, name:T.hudName, model:T.model, parts3d:T.parts3d, atkClips:T.atk,
      stages:T.stages.map(s=>({ id:s.id, name:s.name, hp:s.hp, timeLimit:s.timeLimit, counterWindow:s.counterWindow||null, patternGap:s.patternGap||null,
        parts:(s.parts||[]).map(p=>({id:p.id,name:p.name,hp:p.hp,weak:!!p.weak,breakable:!!p.breakable,guardedBy:p.guardedBy||null,guardReduce:p.guardReduce||null})),
        patterns:(s.patterns||[]).map(p=>Object.assign({ icon:p.icon, name:p.name, rank:p.rank, tele:p.tele, window:p.window, dmg:p.dmg, posture:p.posture, guardCost:p.guardCost, every:p.every||null, counterable:p.counterable!==false, jumpOnly:!!p.jumpOnly, lunge:!!p.lunge, chain:p.chain||null },
          attackMotion[p.name]?{motion:{distanceM:+(attackMotion[p.name].distance/50).toFixed(2), stopM:+(attackMotion[p.name].stop/50).toFixed(2), at:attackMotion[p.name].at, curve:attackMotion[p.name].curve||'linear'}}:{})) })) }
  };
  return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const outPath=process.argv[2]||path.join(ROOT,'ue','HwanghonCombatUE','Content','Data','combat_rules.json');
  const data=buildCombatRulesExport();
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,JSON.stringify(data,null,1)+'\n');
  console.log('wrote',path.relative(ROOT,outPath),'actions',Object.keys(data.actions).length,'boss stages',data.boss.stages.length);
}
