/* Separate review candidates: never silently approve generated assets. The
   director can inspect them with ?n01Candidates=1 before live adoption. */
export const N01_BODIES=Object.freeze(Object.fromEntries(['walker','runner','breaker','stalker','armored','resonator'].map(k=>['G5_'+k.toUpperCase(),Object.freeze({url:'art/3d/monsters/n01-candidates/g5_'+k+'_mobile.glb',highUrl:'art/3d/monsters/n01-candidates/g5_'+k+'.glb',height:1.85,approved:false,reviewCandidate:true})])));
export function bodyFor(id,{review=false,detail='mobile'}={}){const a=N01_BODIES[id];return a&&(a.approved||review)?detail==='high'?{...a,url:a.highUrl}:a:null;}
export function motionFor(state,action,available,catalogId){
 if(state==='support')return available.includes('aura_cast')?'aura_cast':'idle';
 if(state==='attack'){const name=action?.clip||action?.key;if(name&&available.includes(name))return name;return available.includes('attack1')?'attack1':'attack';}
 if(state==='walk'&&catalogId==='G5_RUNNER'&&available.includes('run'))return action?.locomotion==='walk'&&available.includes('walk')?'walk':'run';
 if(state==='walk'&&catalogId==='G5_WALKER'&&action?.locomotion==='run'&&available.includes('jog'))return 'jog';
 if(state==='die')return available.includes('death')?'death':'die';
 return state;
}
