/* 거점 규칙 두 구현(UE C++ HWNodeRules.h · 서버 server/node-rules.cjs)을 같은 벡터로 시험한다 (docs/design/201).
   JS 는 바로, C++ 는 벡터에서 시험 소스를 만들어 g++ 로 굽고 돌린다 — 한쪽만 바꾸면 여기서 깨진다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const R=require('../server/node-rules.cjs'), V=require('./vectors/node-rules.json');
const near=(a,b)=>Math.abs(a-b)<0.01;
test('서버 규칙: 카운터 판정·점령 단계·정책·권한',()=>{
 for(const [e,g] of V.grade) assert.equal(R.gradeCounter(e),g,'grade '+e);
 for(const [h,t] of V.occupation) assert.equal(R.occupationTier(h),t,'tier '+h);
 for(const p of V.policies) assert.equal(R.validPolicies(p.picks),p.valid,'policies '+p.picks);
 for(const role of R.ROLES) for(const perm of R.PERMS) assert.equal(R.hasPermission(role,perm),V.permissions[role].includes(perm),role+' '+perm);
});
test('서버 규칙: 공헌도(보스 딜 1위가 1등이 아니다)·관리권',()=>{
 const P=V.contribution.players; P.forEach((p,i)=>assert.ok(near(R.contributionScore(p,P),V.contribution.scores[i]),'score '+i+' '+R.contributionScore(p,P)));
 for(const s of V.steward) assert.equal(R.stewardGuild(s.scores,s.guild_of,s.guilds),s.expect);
});
test('서버 규칙: 상태 기계 (안정→침공→방어/함락→점령→탈환→복구)',()=>{
 for(const c of V.machine){ const m=R.machine(); c.steps.forEach((st,i)=>{ const [op,...a]=st;
  if(op==='threat') R.setThreat(m,a[0]); if(op==='invade') R.startInvasion(m); if(op==='held') R.defenceHeld(m); if(op==='recover') R.addRecovery(m,a[0]);
  if(op==='tick') R.tickInvasion(m,a[0],a[1],a[2]); if(op==='occupy') R.tickOccupation(m,a[0]); if(op==='retake') R.startRetake(m); if(op==='retake_end') R.retakeEnded(m,a[0]);
  assert.equal(m.state,c.expect[i],'step '+i+' '+JSON.stringify(st)); }); }
});
/* 같은 벡터 → C++ 시험 소스 */
function cpp(){ const E={stable:'Stable',uneasy:'Uneasy',alert:'Alert',invasion:'Invasion',recovering:'Recovering',fallen:'Fallen',retakeable:'Retakeable',retaking:'Retaking'};
 const T={initial:'Initial',basic:'Basic',elite_up:'EliteUp',fortress:'Fortress',infection_core:'InfectionCore'}, G={perfect:'Perfect',normal:'Normal',none:'None'};
 const P={gate_reinforce:'GateReinforce',generator_reinforce:'GeneratorReinforce',arm_npcs:'ArmNpcs',scouting:'Scouting',medical_stock:'MedicalStock',reserve_power:'ReservePower'};
 const RO={leader:'Leader',vice:'Vice',combat:'CombatCaptain',supply:'SupplyCaptain',craft:'CraftCaptain',member:'Member'};
 const PE={ping:'Ping',rally:'Rally',order_npc:'OrderNpc',allocate_supply:'AllocateSupply',invest_facility:'InvestFacility',select_policy:'SelectPolicy',assign_roles:'AssignRoles'};
 const C={kill:'Kill',defense:'Defense',repair:'Repair',npc_rescue:'NpcRescue',boss:'Boss',supply:'Supply',command:'Command'};
 const f=x=>Number(x).toFixed(4)+'f', L=[];
 L.push('#include "HWNodeRules.h"','#include <cstdio>','#include <cmath>','using namespace HWNodeRules;','static int Fails=0;','#define CHECK(c,msg) do{ if(!(c)){ std::printf("FAIL %s\\n", msg); ++Fails; } }while(0)','int main(){');
 V.grade.forEach(([e,g],i)=>L.push(`CHECK(GradeCounter(${f(e)},0.10f,0.25f)==ECounterGrade::${G[g]},"grade ${i}");`));
 V.occupation.forEach(([h,t],i)=>L.push(`CHECK(OccupationTier(${f(h)})==EOccupationTier::${T[t]},"tier ${i}");`));
 V.policies.forEach((p,i)=>L.push(`{ EPolicy A[8]={${p.picks.map(x=>'EPolicy::'+P[x]).join(',')||'EPolicy::GateReinforce'}}; CHECK(ValidPolicies(A,${p.picks.length})==${p.valid},"policies ${i}"); }`));
 for(const [role,perms] of Object.entries(V.permissions)) for(const pe of Object.keys(PE)) L.push(`CHECK(HasPermission(EGuildRole::${RO[role]},EGuildPerm::${PE[pe]})==${perms.includes(pe)},"perm ${role} ${pe}");`);
 L.push(`{ FContribution All[${V.contribution.players.length}];`);
 V.contribution.players.forEach((p,i)=>{ for(const [k,v] of Object.entries(p)) L.push(`All[${i}].Raw[static_cast<int>(EContribution::${C[k]})]=${f(v)};`); });
 V.contribution.scores.forEach((s,i)=>L.push(`CHECK(std::fabs(ContributionScore(All[${i}],All,${V.contribution.players.length})-${f(s)})<0.01f,"score ${i}");`));
 L.push('}');
 V.steward.forEach((s,i)=>L.push(`{ const float S[]={${s.scores.map(f).join(',')}}; const int G[]={${s.guild_of.join(',')}}; CHECK(StewardGuild(S,G,${s.scores.length},${s.guilds})==${s.expect},"steward ${i}"); }`));
 V.machine.forEach((c,ci)=>{ L.push('{ FNodeStateMachine M;'); c.steps.forEach((st,i)=>{ const [op,...a]=st;
  L.push(op==='threat'?`M.SetThreat(${f(a[0])});`:op==='invade'?'M.StartInvasion();':op==='held'?'M.DefenceHeld();':op==='recover'?`M.AddRecovery(${f(a[0])});`:
   op==='tick'?`M.TickInvasion(${f(a[0])},${a[1]},${a[2]});`:op==='occupy'?`M.TickOccupation(${f(a[0])});`:op==='retake'?'M.StartRetake();':`M.RetakeEnded(${a[0]});`);
  L.push(`CHECK(M.State==ENodeState::${E[c.expect[i]]},"machine ${ci} step ${i}");`); }); L.push('}'); });
 L.push('if(Fails){ std::printf("%d failed\\n",Fails); return 1; } std::printf("vectors ok\\n"); return 0; }');
 return L.join('\n'); }
const has=c=>{ try{ execFileSync(c,['--version'],{stdio:'ignore'}); return true; }catch{ return false; } };
test('UE 규칙: 같은 벡터를 C++ 로 굽고 돌린다',{skip:!has('g++')&&'g++ 없음'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hwvec-')), src=path.join(dir,'v.cpp'), exe=path.join(dir,'v');
 fs.writeFileSync(src,cpp());
 execFileSync('g++',['-std=c++17','-Wall','-Werror','-I',path.join(__dirname,'..','ue','HwanghonCombatUE','Source','HwanghonCombatUE','Public','Node'),'-o',exe,src],{stdio:'pipe'});
 let out; try{ out=execFileSync(exe,{encoding:'utf8'}); }catch(e){ assert.fail(String(e.stdout)); }
 assert.match(out,/vectors ok/);
});
