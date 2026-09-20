/* 화면이 설계 시트(1672x952) 한 장에 들어가는지 검사한다.
   시트가 한 화면인데 구현이 더 길어지면 fitStage 가 «화면 전체» 를 축소한다 —
   인력사무실이 0.81배까지 줄어 글씨가 시트보다 19% 작게 나오고 있었다 (docs/design/26).

     node tools/serve.cjs &            # 8777
     node tools/screen-fit.mjs         # 전 화면
     node tools/screen-fit.mjs office.html quest.html

   패널 안 스크롤은 정상이다. 스크롤 없는 조상 안에서 잘리는 것만 잡는다. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.HWANGHON_URL || 'http://127.0.0.1:8777';
const STAGE_H = 952;
const SCREENS = process.argv.slice(2).length ? process.argv.slice(2) : [
  'index.html','title.html','office.html','quest.html','inventory.html','forge.html',
  'craft.html','shop.html','profile.html','result.html','characters.html','skills.html',
  'story.html','battle.html','benchmark.html','arena.html','board.html','lobby.html','shelter.html','recruit.html'];

const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:1672,height:941}, hasTouch:true});
let bad = 0;

for (const name of SCREENS){
  const page = await ctx.newPage();
  await page.goto(BASE+'/'+name, {waitUntil:'networkidle'});
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const st = document.querySelector('.stage');
    if (!st) return {none:true};
    const clipped = [];
    for (const el of st.querySelectorAll('*')){
      const cs = getComputedStyle(el);
      if (cs.display==='none' || cs.position==='fixed' || cs.position==='absolute') continue;
      if (cs.overflowY==='auto' || cs.overflowY==='scroll') continue;
      const cut = el.scrollHeight - el.clientHeight;
      if (cut <= 3 || !el.clientHeight) continue;
      let a = el.parentElement, scrollable = false;
      while (a && a !== document.body){
        const c = getComputedStyle(a);
        if (c.overflowY==='auto' || c.overflowY==='scroll'){ scrollable = true; break; }
        a = a.parentElement;
      }
      if (!scrollable) clipped.push('-'+cut+'px '+el.tagName.toLowerCase()+'.'+
        String(el.className||'').split(' ').slice(0,2).join('.'));
    }
    return {h: st.offsetHeight, clipped};
  });
  await page.close();
  if (r.none){ console.log('—  '+name+'  (.stage 없음)'); continue; }
  const over = r.h - STAGE_H;
  if (over > 0){
    bad++;
    console.log('!! '+name.padEnd(18)+'스테이지 '+r.h+'px — 시트보다 '+over+'px 길다 '+
      '(화면이 '+(941/r.h).toFixed(3)+'배로 줄어든다)');
  } else {
    console.log('ok '+name.padEnd(18)+r.h+'px');
  }
  for (const c of r.clipped.slice(0,4)) console.log('     잘림: '+c);
}
await browser.close();
console.log(bad ? ('\n'+bad+'개 화면이 시트 높이를 넘긴다') : '\n전 화면이 시트 한 장(952px)에 들어간다');
process.exit(bad ? 1 : 0);
