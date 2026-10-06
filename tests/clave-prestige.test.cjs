/* 클레이브 명예 장비: 모든 고유 ID가 실제 3D 외형으로 해석되고, MMO가 서버 장착 정보를 잘라 버리지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
function looks(){global.window=global;delete global.TW_LOOKS;delete require.cache[require.resolve('../js/looks.js')];require('../js/looks.js');return global.TW_LOOKS;}

test('클레이브 고유 장비 6종은 대검·등 셔터·중갑 네 부위 외형으로 모두 이어진다',()=>{
 const L=looks();assert.equal(L.WEAPON.w_clave_blade.special,'claveBlade');assert.equal(L.WEAPON.w_clave_blade.hand2.length,2);
 assert.equal(typeof L.WEAPON.x_clave_shutter.build,'function');assert.equal(L.WEAPON.x_clave_shutter.bone,'Spine2');
 for(const [id,slot] of Object.entries({a_clave_helm:'head',a_clave_cuirass:'chest',a_clave_gauntlet:'gloves',a_clave_greaves:'legs'})){
  assert.equal(L.SLOT_OF[id],slot,id+' 슬롯');assert.ok(L.ARMOR[id].some(p=>p[1]==='glb'),id+' 판금');assert.ok(L.ARMOR[id].some(p=>p[5]==='claveGlow'),id+' 붉은 절개'); }
});

test('셔터 가로살과 레일은 인스턴싱해 모바일 원격 인원만큼 드로콜이 폭증하지 않는다',()=>{
 const src=fs.readFileSync(path.join(ROOT,'js/looks.js'),'utf8'),block=src.slice(src.indexOf('function buildClaveShutter'),src.indexOf('function cloneMats'));
 assert.match(block,/new THREE\.InstancedMesh/);assert.match(block,/instancedBoxes\(slats,dark\)/);assert.equal((block.match(/for\(var i=0;i<9;i\).*box\(/g)||[]).length,0);
});

test('장비 교체·AOI 이탈은 외형 전용 GPU 자원을 해제하고 늦은 로드도 버린다',()=>{
 const src=fs.readFileSync(path.join(ROOT,'js/looks.js'),'utf8'),mmo=fs.readFileSync(path.join(ROOT,'mmo.html'),'utf8');
 assert.match(src,/function disposeLook\(/);assert.match(src,/g\.dispose\(\)/);assert.match(src,/m\.dispose\(\)/);assert.match(src,/t\.dispose\(\)/);
 assert.match(src,/detach:detach/);assert.match(src,/!alive\(\)\)\{disposeLook\(scene\)/,'늦게 끝난 주무기 로드도 해제');
 assert.match(mmo,/TW_LOOKS\.detach&&TW_LOOKS\.detach\(h\.root\)/,'원격 영웅이 관심 반경을 벗어날 때 장비 해제');
 assert.match(mmo,/h\.mixer\.uncacheRoot\(h\.root\)/);assert.match(mmo,/h\.blob\.geometry\.dispose\(\)/,'원격 애니메이션·그림자 자원도 해제');
});

test('MMO 외형 연결은 본인·원격 모두 전체 장비와 강화·칭호를 보존한다',()=>{
 const h=fs.readFileSync(path.join(ROOT,'mmo.html'),'utf8');
 assert.match(h,/eq:net\?\{\.\.\.\(net\.profile\.equipment\|\|\{\}\)\}:null/,'본인 서버 장비');
 assert.match(h,/const eq=\{\.\.\.\(info\.eq\|\|\{\}\)\}/,'원격 전체 장비');
 assert.doesNotMatch(h,/for\(const k of \['main','sub','off'\]\)/,'세 슬롯 필터가 되살아나면 안 된다');
 assert.match(h,/enh=\{\.\.\.\(ni\.enh\|\|\{\}\)\}/,'원격 강화 정보를 복사한다');
 assert.match(h,/r\.enhNet=enh/,'원격 강화 갱신');
 assert.match(h,/r\.loading\)\{r\.info=m\.infos\[id\]/,'로딩 중 최신 공개 외형을 보존한다');
 assert.match(h,/lookKey\(eq,enh\)/,'원격 장비·강화 변경만 다시 그린다');
 assert.doesNotMatch(h,/lookKey\(eq,enh,ni\.look\)/,'옛 프리셋 패킷으로 같은 장비를 재생성하지 않는다');
 assert.match(h,/m\.type==='fieldInfo'/,'자기 칭호 즉시 갱신');
 assert.match(h,/applySelfProfile\(net\.profile\);applySelfInfo\(net\.selfInfo\|\|net\.joined\.info\)/,'로딩 중 본인 갱신도 모델 완성 뒤 재적용한다');
 assert.match(h,/nextSet\(\)\{ if\(!me\|\|me\.eqNet\) return/,'온라인 실제 장비를 데모 세트로 반복 재생성하지 않는다');
 assert.match(h,/gearBtn'\)\.hidden=!!net/,'온라인에서는 데모 장비 단추를 숨긴다');
 assert.match(h,/data-tier/,'이름표 칭호 계층');
});

test('로컬 클레이브 미리보기는 localhost에서만 열리고 저장 API를 호출하지 않는다',()=>{
 const js=fs.readFileSync(path.join(ROOT,'js/looks.js'),'utf8'),block=js.slice(js.indexOf('function attach('),js.indexOf('/* 장비가 실제로 붙는 자리'));
 assert.match(block,/\['localhost','127\.0\.0\.1'\]\.includes\(location\.hostname\)/);
 assert.match(block,/gearPreview'\)==='clave'/);assert.doesNotMatch(block,/\.equip\(|\.save\(|addGear|removeGear/);
});
