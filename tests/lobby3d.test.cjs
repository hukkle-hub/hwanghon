/* 로비 3D — 배경 그림 안의 «자리» 를 화면 좌표로 옮기는 셈 (docs/design/36).
   여기서 틀리면 캐릭터가 화면 밖으로 날아가거나 메뉴 위에 겹친다. 실제로 둘 다 겪었다. */
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'js/lobby3d.js'),'utf8');

/* lobby3d.js 는 ESM 이고 DOM 을 쓴다 — 셈만 떼어 내 같은 식으로 검증한다.
   (파일이 바뀌면 이 재현이 낡는다. 그래서 상수는 파일에서 읽어 맞춘다.) */
const BG_W=1920, BG_H=1080;
function mapOf(size, pos, boxW, boxH){
  let s;
  if(size==='cover') s=Math.max(boxW/BG_W, boxH/BG_H);
  else if(size==='contain') s=Math.min(boxW/BG_W, boxH/BG_H);
  else { const [a,b]=size.split(/\s+/);
    const num=(v,base)=>v.endsWith('%')?parseFloat(v)/100*base:parseFloat(v);
    if(b&&b!=='auto') s=num(b,boxH)/BG_H; else if(a&&a!=='auto') s=num(a,boxW)/BG_W; else s=1; }
  const p=pos.split(/\s+/), pn=v=>v&&v.endsWith('%')?parseFloat(v)/100:0.5;
  const px=pn(p[0]), py=pn(p[1]!=null?p[1]:p[0]);
  const ox=(boxW-BG_W*s)*px, oy=(boxH-BG_H*s)*py;
  return { s, x:v=>ox+v*s, y:v=>oy+v*s };
}

test('파일이 쓰는 상수와 검사가 쓰는 값이 같다',()=>{
 assert.match(SRC,/BG_W=1920, BG_H=1080/,'배경 그림 크기');
 assert.match(SRC,/FIG=\{ cx:555, feet:930, top:300 \}/,'그려진 인물의 자리(눈금으로 실측)');
 assert.match(SRC,/backgroundSize/,'background-size 를 «읽는다» — 짐작하지 않는다');
});

test('cover 화면: 그려진 인물 자리로 정확히 옮겨진다',()=>{
 const m=mapOf('cover','50% 50%',1600,900);
 assert.equal(Math.round(m.x(555)),463);
 assert.equal(Math.round(m.y(930)),775);
 assert.equal(Math.round(m.y(300)),250);
 /* 가로 1600 에서 화면비 28.9% — 배경 그림의 비율과 같아야 한다 */
 assert.ok(Math.abs(m.x(555)/1600-0.289)<0.005);
});

test('휴대폰은 cover 가 아니다 — auto 62% / 32% 20% 를 그대로 반영한다',()=>{
 /* 이 값을 «cover 겠거니» 하고 계산했다가 캐릭터가 두 명으로 보였다 */
 const m=mapOf('auto 62%','32% 20%',412,915);
 const s=915*0.62/1080;
 assert.ok(Math.abs(m.s-s)<1e-9, '세로 62% 가 배율을 정한다');
 const cover=mapOf('cover','50% 50%',412,915);
 assert.ok(Math.abs(m.x(555)-cover.x(555))>100, 'cover 로 계산하면 100px 넘게 어긋난다');
});

test('세로 화면에서도 캐릭터가 화면 안에 남는다',()=>{
 const m=mapOf('auto 62%','32% 20%',412,915);
 const raw=m.x(555);
 /* lobby3d 는 메뉴 오른쪽과 화면 62% 사이로 당긴다 */
 const mr=398, half=120, vw=412;
 const lo=Math.min(mr+half+10, vw*0.52), hi=vw*0.62;
 const cx=Math.max(lo, Math.min(hi, raw));
 assert.ok(cx>0&&cx<vw, `화면 안 (${cx.toFixed(0)} / ${vw})`);
 assert.ok(cx>=lo-0.01&&cx<=hi+0.01,'당김 범위 안');
});

test('낫까지 화면에 들어오도록 키를 줄인다',()=>{
 /* 몸 키만 보고 맞추면 좁은 화면에서 낫날이 잘린다 */
 const feet=392, vh=412, ratio=1.42;           /* 무기 포함 / 몸 */
 const topGap=Math.max(10, vh*0.035);
 const maxBody=(feet-topGap)/Math.max(1.02, ratio);
 const want=Math.min((392-92)*1.12, maxBody);
 assert.ok(feet-want*ratio>=topGap-0.5, '낫 끝이 위 여백 안에 들어온다');
 assert.ok(want>60,'그렇다고 캐릭터가 사라질 만큼 줄지는 않는다');
});

test('약한 기기에서는 정지 화면으로 내려간다',()=>{
 /* «덜덜거리며 계속 그리기» 보다 한 장 그려 두고 멈추는 편이 낫다 — 옷은 그대로 보인다 */
 assert.match(SRC,/frozen=true/,'정지 전환이 있다');
 assert.match(SRC,/const raw=clock\.getDelta\(\)/,'자르기 «전» 간격으로 잰다');
 assert.match(SRC,/if\(raw>0\.055\) slow\+\+/,'0.05 로 자른 dt 로 재면 영원히 안 걸린다');
 /* 자른 값으로 재는 실수가 되돌아오지 않게 */
 assert.ok(!/if\(dt>0\.05/.test(SRC),'자른 dt 로 느림을 재지 않는다');
});

test('메뉴 화면답게 아낀다',()=>{
 assert.match(SRC,/STEP=1\/30/,'30fps 로 충분하다');
 assert.match(SRC,/small\?1\.25:1\.6/,'좁은 화면은 화소를 덜 쓴다');
 assert.match(SRC,/hidden\)\{ clock\.getDelta\(\); return; \}/,'가려지면 그리지 않고 시계만 비운다');
});
