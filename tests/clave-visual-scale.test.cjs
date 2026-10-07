/* 클레이브 보스 존재감 — 시각 크기와 서버 판정 크기를 분리한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const map=n=>JSON.parse(fs.readFileSync(path.join(ROOT,'maps','2d',n,'map.json'),'utf8'));
test('클레이브 두 전투는 판정 3.2m를 유지하고 시각 높이만 4.2m다',()=>{
 for(const [zone,id] of [['gangnam_b1','clave'],['gangnam_b2','clave2']]){const b=map(zone).bosses.find(x=>x.id===id);assert.ok(b);assert.equal(b.h,3.2);assert.equal(b.visualH,4.2);}
});
test('MMO는 visualH로만 모델을 키우고 근접 판정은 h를 계속 쓴다',()=>{
 const h=fs.readFileSync(path.join(ROOT,'mmo.html'),'utf8');
 assert.match(h,/displayH=b\.visualH\|\|b\.h/);assert.match(h,/k=displayH\?displayH\/h/);
 assert.match(h,/const reachOf=b=>2\.5\+Math\.min\(4,\(b\.h\|\|3\)\*0\.4\)/,'시각 크기가 서버 근접 판정에 섞이면 안 된다');
 assert.match(h,/const hitY=Math\.min\(2\.1,Math\.max\(1\.4,\(o\.h\|\|o\.b\.visualH\|\|o\.b\.h\|\|3\)\*\.46\)\)/);
});
