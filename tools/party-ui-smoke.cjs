// DOM interaction check with real server requests. Requires jsdom (only for this tool).
// Does not simulate CSS layout, WebGL, mobile touch or internet conditions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom'),{WebSocket}=require('ws');
const {Store}=require('../server/store.cjs'),{createPartyServer}=require('../server/index.cjs');
const root=path.resolve(__dirname,'..');
async function wait(test){for(let i=0;i<160;i++){if(test())return;await new Promise(r=>setTimeout(r,25));}throw Error('DOM condition timeout');}
async function main(){const store=new Store(null),app=createPartyServer({store}),address=await app.listen(0,'127.0.0.1'),errors=[],sockets=[];
 const dom=new JSDOM(fs.readFileSync(path.join(root,'party.html'),'utf8'),{url:'http://static.example/party.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id);
 w.localStorage.setItem('tw:party-server',`http://127.0.0.1:${address.port}`);
 w.addEventListener('error',e=>errors.push(e.error||e.message));w.WebSocket=class extends WebSocket{constructor(...a){super(...a);sockets.push(this);}};w.requestAnimationFrame=()=>0;w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const click=async(text,scope=w.document)=>{await new Promise(r=>setTimeout(r,150));const target=[...scope.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(target,'button '+text);assert.ok(!target.disabled,'enabled '+text);target.click();};
 try{
  for(const file of ['world','items','dungeons','dungeon','dungeon-content','world-sim','looks','sfx','party-wire'])w.eval(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'js/party-rpg.js'),'utf8').replace('export function createRpgUI','function createRpgUI')+'\nwindow.createRpgUI=createRpgUI;');
  const mainCode=fs.readFileSync(path.join(root,'js/party-online.js'),'utf8').replace(/^import .*;\n/gm,'');
  w.eval('const T={}; class GLTFLoader {loadAsync(){return Promise.resolve({});}}\n'+mainCode);
  $('account-id').value='dom_player';$('password').value='dom-password-2026';$('account-register').click();await wait(()=>$('character-create').hidden===false&&$('login').hidden);assert.ok(w.document.querySelector('code').textContent.length>20);await click('보관했습니다');$('character-name').value='화면검증아인';
  const enter=(id,composing=false)=>$(id).dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:composing,bubbles:true,cancelable:true}));
  enter('character-name',true);assert.equal($('hub-tools').hidden,true);enter('character-name');await wait(()=>$('hub-tools').hidden===false);const id=store.playerNamed('화면검증아인');
  // Real acknowledgements clear only the sent draft; rejected/offline messages stay editable.
  const submitChat=()=>$('chat-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),chatButton=$('chat-form').querySelector('button'),log=$('chat-log');
  Object.defineProperties(log,{scrollHeight:{get:()=>1000},clientHeight:{get:()=>200}});log.scrollTop=120;
  $('chat-text').value='첫 전송 확인';submitChat();assert.equal($('chat-text').value,'첫 전송 확인');assert.equal(chatButton.disabled,true);await wait(()=>!chatButton.disabled);assert.equal($('chat-text').value,'');assert.equal(log.scrollTop,120);
  app.sessions.get(id).lastChat=Date.now();$('chat-text').value='제한되어도 남을 문장';submitChat();await wait(()=>!chatButton.disabled);assert.equal($('chat-text').value,'제한되어도 남을 문장');assert.match($('notice').textContent,/1초/);
  app.sessions.get(id).lastChat=0;log.scrollTop=790;$('chat-text').value='전송할 문장';submitChat();$('chat-text').value='다음 문장 작성 중';await wait(()=>!chatButton.disabled);assert.equal($('chat-text').value,'다음 문장 작성 중');assert.equal(log.scrollTop,1000);
  $('create').click();await wait(()=>$('room').hidden===false);let copied='';w.navigator.clipboard={writeText:async value=>{copied=value;}};await $('invite').onclick();const link=new URL(copied);assert.equal(link.searchParams.get('server'),`http://127.0.0.1:${address.port}`);assert.equal(link.searchParams.get('room'),$('code').textContent);$('leave').click();await wait(()=>$('room').hidden);
  sockets.at(-1).terminate();await wait(()=>$('connection').textContent==='연결 끊김');$('chat-text').value='연결 복구 후 전송';submitChat();assert.equal($('chat-text').value,'연결 복구 후 전송');assert.match($('notice').textContent,/전송하지 못했습니다/);await wait(()=>$('connection').textContent==='연결됨');
  await click('의뢰');await wait(()=>$('rpg-dialog').textContent.includes('첫 계약'));await click('의뢰 수락',$('rpg-dialog'));await wait(()=>store.get(id).quests.training==='accepted');
  // Fixture grants a completed fight, then the real UI claims the quest reward.
  store.award('dom-clear',[id],'tutorial',{gold:1500,items:[['m_fiber',6],['m_dew',2]]});await click('닫기',$('rpg-dialog'));await click('의뢰');await wait(()=>$('rpg-dialog').textContent.includes('보수 수령 가능'));await click('보수 수령',$('rpg-dialog'));await wait(()=>store.get(id).quests.training==='claimed');await wait(()=>$('dungeon').querySelector('[value=d02]').disabled===false);
  await click('가방',$('rpg-dialog'));assert.ok($('rpg-dialog').textContent.includes('메마른 갈대밭 정찰'));const search=$('rpg-dialog').querySelector('input[type=search]');search.value='갈대 섬유';search.dispatchEvent(new w.Event('input'));assert.ok(!$('rpg-dialog').textContent.includes('메마른 갈대밭 정찰'));await click('보관',$('rpg-dialog'));await wait(()=>store.get(id).vault.m_fiber===1);
  await click('제작·강화',$('rpg-dialog'));const potion=[...$('rpg-dialog').querySelectorAll('.rpg-card')].find(c=>c.querySelector('h3')?.textContent==='회복약 제작');await click('제작',potion);await wait(()=>store.get(id).items.c_potion===6);
  await click('기술·출정',$('rpg-dialog'));const trait=[...$('rpg-dialog').querySelectorAll('button')].find(b=>b.textContent.startsWith('반격 집중'));await new Promise(r=>setTimeout(r,150));trait.click();await wait(()=>store.stats(id).counterMult===1.1);
  await click('설정',$('rpg-dialog'));const volume=$('rpg-dialog').querySelector('input[type=range]');volume.value='.2';volume.dispatchEvent(new w.Event('input'));assert.equal(w.TW_SFX.volume,.2);assert.equal(JSON.parse(w.localStorage.getItem('tw:online-settings')).volume,.2);
  await click('동료',$('rpg-dialog'));assert.ok($('rpg-dialog').textContent.includes('신고 접수'));await click('계정',$('rpg-dialog'));assert.ok($('rpg-dialog').textContent.includes(id));assert.deepEqual(errors,[]);
  await click('닫기',$('rpg-dialog'));$('logout').click();await wait(()=>!$('login').hidden&&$('connection').textContent==='연결 끊김');$('password').value='dom-password-2026';enter('password');await wait(()=>$('connection').textContent==='연결됨');assert.equal($('profile-name').textContent,'화면검증아인');
  console.log(JSON.stringify({passed:true,checks:['registration and one-time recovery code','Korean IME-safe character name Enter','chat acknowledgement and rejected/offline draft preservation','new draft survives previous acknowledgement','chat reading position and bottom following','remote server retained in party invite link','password Enter login','quest accept and claim','dungeon unlock','inventory filter and vault deposit','crafting ingredient debit','trait applied on server','volume setting persistence','social and account menus'],limitations:['DOM only; no CSS layout, WebGL or mobile visual verification']},null,2));
 }finally{for(const ws of sockets){ws.removeAllListeners();ws.on('error',()=>{});ws.terminate();}dom.window.close();await app.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
