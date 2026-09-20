/* 서비스워커의 프리캐시는 오랫동안 «한 개도» 안 채워지고 있었다.
   cache.addAll 은 전부 아니면 전무인데, 목록에 같은 주소가 두 번 있으면
   InvalidStateError 로 통째로 거절된다 — 그걸 .catch(){} 가 삼켰다.
   목록이 다시 더러워지면 여기서 걸린다. (docs/design/28 §3) */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');

function assets(){
  const src=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  const base=JSON.parse(src.match(/var ASSETS = (\[[\s\S]*?\]);/)[1]);
  /* ASSETS.push(...) / concat(...) 로 뒤에 붙는 것들도 같이 본다 */
  const extra=[];
  for(const m of src.matchAll(/ASSETS\.push\(([^)]*)\)/g))
    for(const q of m[1].matchAll(/'([^']+)'/g)) extra.push(q[1]);
  for(const m of src.matchAll(/ASSETS=ASSETS\.concat\(\[([^\]]*)\][^)]*'([^']*)'\+name\+'([^']*)'/g))
    for(const q of m[1].matchAll(/'([^']+)'/g)) extra.push(m[2]+q[1]+m[3]);
  return base.concat(extra);
}

test('프리캐시 목록에 중복이 없다 (addAll 이 통째로 거절된다)',()=>{
  const list=assets(), seen=new Set(), dup=[];
  for(const a of list){ if(seen.has(a)) dup.push(a); seen.add(a); }
  assert.deepEqual(dup,[], '중복: '+dup.join(', '));
});

test('프리캐시 목록의 파일이 전부 실제로 있다',()=>{
  const missing=assets().filter(a=>!fs.existsSync(path.join(ROOT,a)));
  assert.deepEqual(missing,[], '없는 파일: '+missing.join(', '));
});

test('오프라인 대체 화면이 목록과 fetch 처리 양쪽에 있다',()=>{
  const src=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  assert.ok(assets().includes('offline.html'),'offline.html 이 프리캐시에 있어야 한다');
  assert.match(src,/caches\.match\('offline\.html'\)/,'fetch 처리에서 대체 화면으로 써야 한다');
});
