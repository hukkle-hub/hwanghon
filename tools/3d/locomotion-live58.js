// Visible localhost-only controls, driving the game's ordinary input path.
export function mountLocomotionLive58({character,canvas,input,read,kind}){
 if(!['127.0.0.1','localhost'].includes(location.hostname))return;
 const box=document.createElement('section');box.style.cssText='position:fixed;left:12px;top:12px;z-index:99999;padding:10px;background:#15212eee;color:white;font:13px monospace;max-width:440px';
 box.innerHTML='<b>실제 '+kind+' 이동 검수 58</b><div><button data-mode="stop">정지</button><button data-mode="walk">걷기</button><button data-mode="run">달리기</button><button data-mode="attack">공격 연결</button><button data-mode="dodge">회피 연결</button><button data-save>화면 저장</button><button data-sequence>전체 녹화</button></div><pre style="white-space:pre-wrap;max-height:115px;overflow:auto"></pre>';document.body.append(box);
 const out=box.querySelector('pre'),prefix=character+'-mobile-'+kind;let recording=false;
 for(const button of box.querySelectorAll('[data-mode]'))button.onclick=()=>input(button.dataset.mode);
 const post=(ext,body)=>fetch('http://127.0.0.1:8799/'+prefix+'.'+ext,{method:'POST',body});
 box.querySelector('[data-save]').onclick=async()=>{await post('png',await new Promise(r=>canvas.toBlob(r)));out.textContent='저장 완료 '+prefix;};
 box.querySelector('[data-sequence]').onclick=()=>{if(recording)return;recording=true;const chunks=[],rec=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm;codecs=vp9'}),samples=[],steps=[['stop',1000],['walk',2500],['run',3000],['stop',1000],['attack',2500],['walk',2000],['dodge',1000],['run',2500],['stop',1000]];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onstop=async()=>{await post('webm',new Blob(chunks,{type:'video/webm'}));await post('json',JSON.stringify(samples,null,2));recording=false;out.textContent='전체 영상 저장 완료 '+prefix;};rec.start();let index=0;function next(){if(index===steps.length){input('stop');rec.stop();return;}const[m,ms]=steps[index++];input(m);setTimeout(next,ms);}const timer=setInterval(()=>samples.push(read()),100);rec.addEventListener('stop',()=>clearInterval(timer));next();};
 setInterval(()=>{if(!recording)out.textContent=JSON.stringify(read(),null,1);},250);
}
