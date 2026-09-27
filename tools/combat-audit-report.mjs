import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const attackName=x=>/^attack[123]$/.test(x||'')?x:'';
const finite=x=>Number.isFinite(Number(x))?Number(x):null;

export function analyzeAudit(data={}){
  const events=Array.isArray(data.events)?data.events:[], samples=Array.isArray(data.samples)?data.samples:[];
  const out={
    duration:0,minGapM:null,minClearanceM:null,maxPenetrationM:0,maxLungePenetrationM:0,worstOverlap:null,worstLungeOverlap:null,maxPlantErrorM:null,maxPlantWeight:0,
    handoffs:[],idleLeaks:[],hitDeltasMs:[],reactionLagMs:[],
    performance:data.frameMetrics||{},sampleCount:samples.length,eventCount:events.length
  };
  for(const s of samples){
    const t=finite(s.t);if(t!=null)out.duration=Math.max(out.duration,t);
    const g=finite(s.gapM);if(g!=null)out.minGapM=out.minGapM==null?g:Math.min(out.minGapM,g);
    const body=finite(s.bodyRadiusM), clearance=finite(s.clearanceM),
          pen=finite(s.penetrationM)!=null?finite(s.penetrationM):(g!=null&&body!=null?Math.max(0,body-g):null);
    if(!s.bossLunge){
      if(clearance!=null)out.minClearanceM=out.minClearanceM==null?clearance:Math.min(out.minClearanceM,clearance);
      if(pen!=null&&pen>=out.maxPenetrationM){out.maxPenetrationM=pen;out.worstOverlap={t,clip:s.clip||'',bossState:s.bossState||'',gapM:g,bodyRadiusM:body,penetrationM:pen};}
    }else if(pen!=null&&pen>=out.maxLungePenetrationM){out.maxLungePenetrationM=pen;out.worstLungeOverlap={t,clip:s.clip||'',bossState:s.bossState||'',gapM:g,bodyRadiusM:body,penetrationM:pen};}
    const pe=finite(s.plantError);if(pe!=null)out.maxPlantErrorM=out.maxPlantErrorM==null?pe:Math.max(out.maxPlantErrorM,pe);
    const pw=finite(s.plantWeight);if(pw!=null)out.maxPlantWeight=Math.max(out.maxPlantWeight,pw);
  }
  for(let i=0;i<events.length;i++){
    const e=events[i], t=finite(e.t);if(t==null)continue;
    if(e.event==='hit'&&finite(e.elapsed)!=null&&finite(e.hitAt)!=null)
      out.hitDeltasMs.push({clip:e.clip||e.eventClip||'',ms:+((Number(e.elapsed)-Number(e.hitAt))*1000).toFixed(1)});
    if(e.event==='actionend'&&attackName(e.clip||e.eventClip)){
      const from=attackName(e.clip||e.eventClip);
      const next=events.slice(i+1).find(x=>x.event==='actionstart'&&finite(x.t)!=null&&Number(x.t)-t<=.20);
      if(next&&attackName(next.clip||next.eventClip)){
        const to=attackName(next.clip||next.eventClip),gap=Number(next.t)-t;
        out.handoffs.push({from,to,ms:+(gap*1000).toFixed(1)});
        const leaks=samples.filter(s=>finite(s.t)!=null&&Number(s.t)>t&&Number(s.t)<Number(next.t)&&!s.clip&&/^(idle|run)$/.test(s.base||''));
        if(leaks.length)out.idleLeaks.push({from,to,count:leaks.length,first:+Number(leaks[0].t).toFixed(3)});
      }
    }
    if(e.event==='hit'){
      const reaction=samples.find(s=>finite(s.t)!=null&&Number(s.t)>=t&&Number(s.t)<=t+.12&&s.bossReaction);
      if(reaction)out.reactionLagMs.push({clip:e.clip||e.eventClip||'',ms:+((Number(reaction.t)-t)*1000).toFixed(1)});
      else out.reactionLagMs.push({clip:e.clip||e.eventClip||'',ms:null});
    }
  }
  return out;
}

export function auditVerdict(a){
  const maxHandoff=a.handoffs.length?Math.max(...a.handoffs.map(x=>x.ms)):null;
  const maxHit=a.hitDeltasMs.length?Math.max(...a.hitDeltasMs.map(x=>Math.abs(x.ms))):null;
  const reactionKnown=a.reactionLagMs.filter(x=>x.ms!=null);
  const maxReaction=reactionKnown.length?Math.max(...reactionKnown.map(x=>x.ms)):null;
  const p95=finite(a.performance?.p95Ms);
  return {
    combo:maxHandoff==null?'NO_DATA':maxHandoff<=35&&!a.idleLeaks.length?'PASS':'CHECK',
    contact:maxHit==null?'NO_DATA':maxHit<=25?'PASS':'CHECK',
    plant:a.maxPlantErrorM==null?'NO_DATA':a.maxPlantErrorM<=.02?'PASS':'CHECK',
    overlap:a.minGapM==null?'NO_DATA':a.maxPenetrationM<=.08?'PASS':a.maxPenetrationM<=.20?'CHECK':'FAIL',
    reaction:maxReaction==null?'NO_DATA':maxReaction<=50?'PASS':'CHECK',
    frame:p95==null?'NO_DATA':p95<=20?'PASS':p95<=25?'CHECK':'FAIL'
  };
}

export function markdownReport(data){
  const a=analyzeAudit(data),v=auditVerdict(a),fmt=(x,d=2)=>x==null?'—':Number(x).toFixed(d);
  const hand=a.handoffs.length?a.handoffs.map(x=>`${x.from}→${x.to} ${x.ms}ms`).join(', '):'—';
  const hit=a.hitDeltasMs.length?a.hitDeltasMs.map(x=>`${x.clip||'?'} ${x.ms}ms`).join(', '):'—';
  const react=a.reactionLagMs.length?a.reactionLagMs.map(x=>`${x.clip||'?'} ${x.ms==null?'없음':x.ms+'ms'}`).join(', '):'—';
  const wo=a.worstOverlap?`${fmt(a.worstOverlap.t,2)}s · ${a.worstOverlap.clip||'neutral'} · boss ${a.worstOverlap.bossState||'?'} · ${fmt(a.worstOverlap.penetrationM*100,1)}cm`:'—';
  return `# 황혼 전투 감사 보고

| 항목 | 값 | 판정 |
|---|---:|---|
| 기록 길이 | ${fmt(a.duration,1)}s | — |
| 콤보 handoff | ${hand} | ${v.combo} |
| idle 경유 | ${a.idleLeaks.length}회 | ${a.idleLeaks.length?'CHECK':'PASS'} |
| hit 시각 오차 | ${hit} | ${v.contact} |
| 최대 지지발 오차 | ${a.maxPlantErrorM==null?'—':fmt(a.maxPlantErrorM*100,1)+'cm'} | ${v.plant} |
| 최소 중심 간격 | ${a.minGapM==null?'—':fmt(a.minGapM,2)+'m'} | — |
| 일반 전투 최대 body penetration | ${fmt(a.maxPenetrationM*100,1)}cm | ${v.overlap} |
| 최악 일반 overlap 순간 | ${wo} | — |
| 관통 돌진 중 최대 penetration | ${fmt(a.maxLungePenetrationM*100,1)}cm | 의도된 관통 |
| 보스 반응 지연 | ${react} | ${v.reaction} |
| FPS | ${a.performance?.fps??'—'} | — |
| p95 frame | ${a.performance?.p95Ms??'—'}ms | ${v.frame} |
| p99 frame | ${a.performance?.p99Ms??'—'}ms | — |
| 50ms 초과 | ${a.performance?.over50ms??'—'} | — |

## 해석
- combo CHECK: P4 뒤에도 1→2→3 사이 base 자세가 끼거나 handoff가 35ms를 넘는다.
- contact CHECK: visual hit 이벤트가 action hitAt에서 ±25ms보다 멀다.
- plant CHECK: P5 지지발 목표 오차가 2cm를 넘는다.
- overlap PASS: 보스 관통 돌진을 제외한 body penetration이 8cm 이하.
- overlap CHECK: 8~20cm. 영상에서 실제 메시 관통이 보이는지 확인한다.
- overlap FAIL: 일반 전투에서 20cm 초과. P7 body separation 우선 후보.
- bossLunge=true 표본은 의도된 관통이므로 일반 overlap 판정에서 제외한다.
- reaction CHECK: hit 뒤 50ms 안에 boss additive reaction이 관측되지 않는다.
`;
}

function main(){
  const file=process.argv[2];if(!file){console.error('usage: node tools/combat-audit-report.mjs <audit.json> [report.md]');process.exitCode=2;return;}
  const data=JSON.parse(fs.readFileSync(file,'utf8')),md=markdownReport(data),out=process.argv[3];
  if(out)fs.writeFileSync(out,md);else process.stdout.write(md);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
