/* 5급 6종 몸 — 처음엔 검수 후보(?n01Candidates=1 에서만)였다. 디렉터 승인(2026-10-11 «6종 다 켜기»)으로 실제 게임에 쓴다(문서 229 §26).
   여기 없는 종(갈고리손·포획자·등반자 …)은 계속 임시 몸. 다른 생성 에셋을 더할 때도 디렉터가 보고 승인한 뒤에만 approved:true. */
export const N01_BODIES=Object.freeze(Object.fromEntries(['walker','runner','breaker','stalker','armored','resonator'].map(k=>['G5_'+k.toUpperCase(),Object.freeze({url:'art/3d/monsters/n01-candidates/g5_'+k+'_mobile.glb',highUrl:'art/3d/monsters/n01-candidates/g5_'+k+'.glb',height:1.85,approved:true,reviewCandidate:false})])));
export function bodyFor(id,{review=false,detail='mobile'}={}){const a=N01_BODIES[id];return a&&(a.approved||review)?detail==='high'?{...a,url:a.highUrl}:a:null;}
export function motionFor(state,action,available,catalogId){
 if(state==='support')return available.includes('aura_cast')?'aura_cast':'idle';
 if(state==='attack'){const name=action?.clip||action?.key;if(name&&available.includes(name))return name;return available.includes('attack1')?'attack1':'attack';}
 if(state==='walk'&&catalogId==='G5_RUNNER'&&available.includes('run'))return action?.locomotion==='walk'&&available.includes('walk')?'walk':'run';
 if(state==='walk'&&['G5_WALKER','G5_BREAKER'].includes(catalogId)&&action?.locomotion==='run'&&available.includes('jog'))return 'jog';
 if(state==='die')return available.includes('death')?'death':'die';
 return state;
}
