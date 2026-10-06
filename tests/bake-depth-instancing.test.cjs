/* 굽기 깊이 셰이더는 인스턴스를 제자리에 그린다 (docs/design/192 §9)
   깊이 패스는 scene.overrideMaterial 하나로 모든 물체를 그린다. 그 셰이더가 instanceMatrix 를 안 곱하면
   나무·바위·덤불(InstancedMesh)이 전부 월드 원점에 겹쳐 «보이지 않는 1.7~10 m 덩이» 가 굽히고, 제자리의 나무는 높이가 없다.
   (해운대 출발점에서 인물이 파란 실루엣 — 고흥·남태령·계룡·남행 국도·남산 원점에도 같은 덩이가 있었다) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function depthVertex(html){ const m=html.match(/const depthMat=new THREE\.ShaderMaterial\(\{[\s\S]*?vertexShader:'([^']*)'/); assert.ok(m,'depthMat vertexShader 를 못 찾았다'); return m[1].replace(/\\n/g,'\n'); }
function appliesInstancing(vs){ const body=vs.replace(/\s+/g,' '); return /#ifdef USE_INSTANCING[^#]*instanceMatrix\s*\*[^#]*#endif/.test(body) && /modelMatrix\s*\*\s*p\b/.test(body); }
test('굽기 깊이 셰이더: USE_INSTANCING 이면 instanceMatrix 를 곱한 뒤 modelMatrix',()=>{
 const vs=depthVertex(fs.readFileSync(path.join(__dirname,'..','tools','2d','bake-map.html'),'utf8'));
 assert.ok(appliesInstancing(vs),'깊이 셰이더가 인스턴스를 무시한다:\n'+vs);
});
module.exports={ depthVertex, appliesInstancing };
