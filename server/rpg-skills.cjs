/* 황혼 온라인 — 스킬 성장 (서버 권위).
   계산식은 js/skill-math.js 를 솔로와 공유한다. 여기서는 온라인 프로필의 포인트 경제와 검증만 맡는다.
   · 포인트 = 4 + (레벨−1)×2 + 클리어 합계 (최대 30)
   · 쓴 포인트 = Σ(lv−1) + 분기 선택 1
   · 분기는 3레벨부터. 한 번 고르면 초기화 전까지 유지 (초기화는 골드 비용) */
const SM=require('../js/skill-math.js'), C=require('./content.cjs');
const BASE_PTS=4, PER_LEVEL=2, PER_CLEAR=1, PTS_CAP=30, RESET_COST=1500;
const charOf=p=>C.skills[p&&p.character]?p.character:'ain';
const tableOf=c=>C.skills[c], ultOf=c=>C.skills[c+'Ult'];
const defsOf=c=>[...tableOf(c), ultOf(c)];

const levelOf=p=>1+Math.floor((p.xp||0)/1200);
const clearsOf=p=>Object.values(p.clears||{}).reduce((n,v)=>n+(v||0),0);
const entry=(p,id)=>{const s=(p.skills||{})[id]||{};return {lv:Math.max(1,Math.min(SM.MAX,s.lv||1)),br:s.br==='A'||s.br==='B'?s.br:null};};
const spent=p=>defsOf(charOf(p)).reduce((n,k)=>{const s=entry(p,k.id);return n+(s.lv-1)+(s.br?1:0);},0);
const total=p=>Math.min(PTS_CAP,BASE_PTS+(levelOf(p)-1)*PER_LEVEL+clearsOf(p)*PER_CLEAR);
const points=p=>{const t=total(p),s=spent(p);return {total:t,spent:s,free:Math.max(0,t-s)};};

/* 레이드에 넘길 실제 수치 */
function resolve(p){
  const c=charOf(p),levels={};for(const k of defsOf(c))levels[k.id]=entry(p,k.id);
  return SM.applyAll(tableOf(c),ultOf(c),levels);
}
/* 화면용: 정의 + 현재/다음 레벨 수치 */
function view(p){
  const c=charOf(p),pts=points(p);
  return {
    character:c, characterName:(C.characters[c]||{}).nm||c, max:SM.MAX, branchLevel:SM.BR_LV, resetCost:RESET_COST, points:pts,
    skills:defsOf(c).map(k=>{
      const s=entry(p,k.id),now=SM.scaled(k,s.lv,s.br);
      return {
        id:k.id, key:k.key, name:k.name, icon:k.icon, desc:k.desc, ult:k.key==='R',
        lv:s.lv, br:s.br, kind:SM.kindOf(k),
        summary:SM.describe(now),
        next:s.lv<SM.MAX?SM.describe(SM.scaled(k,s.lv+1,s.br)):null,
        branches:SM.branches(k)
      };
    })
  };
}
function up(p,id){
  const k=defsOf(charOf(p)).find(k=>k.id===id);if(!k)throw Error('기술을 확인하세요.');
  const s=entry(p,id);if(s.lv>=SM.MAX)throw Error('이미 최대 단계입니다.');
  if(points(p).free<1)throw Error('기술 포인트가 부족합니다.');
  p.skills={...p.skills,[id]:{lv:s.lv+1,br:s.br}};
  return {skill:id,lv:s.lv+1};
}
function branch(p,id,br){
  const k=defsOf(charOf(p)).find(k=>k.id===id);if(!k)throw Error('기술을 확인하세요.');
  if(br!=='A'&&br!=='B')throw Error('분기를 선택하세요.');
  const s=entry(p,id);
  if(s.lv<SM.BR_LV)throw Error(SM.BR_LV+'단계부터 분기를 고를 수 있습니다.');
  if(s.br===br)return {skill:id,br};
  if(s.br)throw Error('분기를 바꾸려면 기술을 초기화하세요.');
  if(points(p).free<1)throw Error('기술 포인트가 부족합니다.');
  p.skills={...p.skills,[id]:{lv:s.lv,br}};
  return {skill:id,br};
}
function reset(p){
  if(!spent(p))throw Error('초기화할 기술이 없습니다.');
  if((p.gold||0)<RESET_COST)throw Error('초기화 비용 '+RESET_COST.toLocaleString()+' G 가 필요합니다.');
  p.gold-=RESET_COST;p.skills={};
  return {cost:RESET_COST};
}
module.exports={resolve,view,up,branch,reset,points,entry,RESET_COST,charOf};
