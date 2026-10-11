/* 5급 6종 몸 — 처음엔 검수 후보(?n01Candidates=1 에서만)였다. 디렉터 승인(2026-10-11 «6종 다 켜기»)으로 실제 게임에 쓴다(문서 229 §26).
   여기 없는 종(갈고리손·포획자·등반자 …)은 계속 임시 몸. 다른 생성 에셋을 더할 때도 디렉터가 보고 승인한 뒤에만 approved:true. */
export const N01_BODIES=Object.freeze(Object.fromEntries(['walker','runner','breaker','stalker','armored','resonator'].map(k=>['G5_'+k.toUpperCase(),Object.freeze({url:'art/3d/monsters/n01-candidates/g5_'+k+'_mobile.glb',highUrl:'art/3d/monsters/n01-candidates/g5_'+k+'.glb',height:1.85,approved:true,reviewCandidate:false})])));
/* 몸 없는 5급은 역할이 가까운 몸을 빌린다 (디렉터 2026-10-11 «몸 없는 5급도 비슷한 몸 빌려 써», 문서 229 §27).
   이름·능력·판정은 제 것 그대로 — 몸(모양·기본 클립)만 빌린다. 제 고유 기술 클립이 없으면 motionFor 가 attack1/death 로 내린다.
   공진자 오라 고리는 G5_RESONATOR 본인만(field-mobs). 진짜 몸이 생기면 N01_BODIES 에 넣고 여기서 빼면 된다 */
export const BORROW=Object.freeze({
 G5_CLIMBER:'G5_RUNNER', G5_SLASHER:'G5_RUNNER',           /* 벽 타는 기동형 · 긁어 찢는 연속타 — 마르고 빠른 몸 */
 G5_LURKER:'G5_STALKER', G5_WATCHER:'G5_STALKER',          /* 잠복·감시 — 웅크린 추적자 */
 G5_HOOKHAND:'G5_BREAKER', G5_SHOVER:'G5_BREAKER',         /* 갈고리 휘두르기 · 어깨박치기 — 무거운 팔·어깨 */
 G5_SHIELDER:'G5_ARMORED',                                 /* 방패벽 — 방패 든 철갑 */
 G5_CALLER:'G5_RESONATOR', G5_JAMMER:'G5_RESONATOR', G5_ECHO:'G5_RESONATOR',   /* 신호·노이즈·잔향 — 팔 벌린 공진형 */
 G5_CAPTOR:'G5_WALKER', G5_CARRIER:'G5_WALKER', G5_THROWER:'G5_WALKER', G5_PARASITE:'G5_WALKER'   /* 붙잡기·나르기·던지기·흡수 — 기본 사람 몸 */
});
export function bodyFor(id,{review=false,detail='mobile'}={}){const own=N01_BODIES[id],src=own||(BORROW[id]&&N01_BODIES[BORROW[id]]);const a=src&&(src.approved||review)?(own?src:{...src,borrowedFrom:BORROW[id]}):null;return a?detail==='high'?{...a,url:a.highUrl}:a:null;}
export function motionFor(state,action,available,catalogId){
 if(state==='support')return available.includes('aura_cast')?'aura_cast':'idle';
 if(state==='attack'){const name=action?.clip||action?.key;if(name&&available.includes(name))return name;return available.includes('attack1')?'attack1':'attack';}
 if(state==='walk'&&catalogId==='G5_RUNNER'&&available.includes('run'))return action?.locomotion==='walk'&&available.includes('walk')?'walk':'run';
 if(state==='walk'&&['G5_WALKER','G5_BREAKER'].includes(catalogId)&&action?.locomotion==='run'&&available.includes('jog'))return 'jog';
 if(state==='die')return available.includes('death')?'death':'die';
 return state;
}
