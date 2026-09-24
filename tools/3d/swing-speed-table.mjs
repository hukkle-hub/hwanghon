/* js/swing-point.js 의 SPEED 표를 다시 뽑는다.
 * 세 박자 템포(js/swing-body.js TEMPO)나 스매시 키 경로를 바꾸면 이걸 돌려
 * 나온 줄로 SPEED.smash 를 갈아 끼운다 (tests/swing-point.test.mjs 가 어긋남을 잡는다).
 * 사용: node tools/3d/swing-speed-table.mjs [clip] */
import '../../js/swing-body.js';
globalThis.TW_COMBAT_QUALITY=globalThis.TW_COMBAT_QUALITY||{phase:a=>a};
const {ainPathDir}=await import('../../js/ain-two-hand.js');
const name=process.argv[2]||'smash';
const rate=u=>{const h=.002,a=ainPathDir(name,Math.max(0,u-h)),b=ainPathDir(name,Math.min(1,u+h));
  return Math.acos(Math.max(-1,Math.min(1,a.dot(b))))/(2*h);};
const us=[];for(let u=.25;u<=.5501;u+=.01)us.push(+u.toFixed(2));
const vs=us.map(rate), mx=Math.max(...vs);
console.log(JSON.stringify(us.map((u,i)=>[u,+(vs[i]/mx).toFixed(3)])));
