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

test('강화 광휘는 직교 카메라에서 보이는 고정 픽셀로 +0·+7·+9·+10 위계를 만든다',()=>{
 const L=looks(),expected=[
  [0,{tier:0,count:4,size:1.2,color:0xd6652f,opacity:.48}],
  [7,{tier:1,count:6,size:1.6,color:0xd6652f,opacity:.74}],
  [9,{tier:2,count:9,size:2,color:0xff3b24,opacity:.78}],
  [10,{tier:3,count:12,size:2.6,color:0xffead8,opacity:.82}]
 ];
 for(const [enh,spec] of expected)assert.deepEqual(L.prestigeSpec(enh,true),spec,'+'+enh);
 assert.equal(L.prestigeSpec(0,false),null,'세트·셔터·+7 없는 일반 장비에는 광휘 없음');
 const src=fs.readFileSync(path.join(ROOT,'js/looks.js'),'utf8'),block=src.slice(src.indexOf('function addPrestigeAura'),src.indexOf('/* 다시 리깅한 캐릭터'));
 assert.match(block,/size:spec\.size/);assert.match(block,/sizeAttenuation:false/);assert.equal((block.match(/new THREE\.Points\(/g)||[]).length,1,'불티 전체는 한 draw call');
 assert.doesNotMatch(block,/PointLight|RingGeometry/,'장비 과시는 공격 예고용 바닥 고리·점광원을 만들지 않는다');
});

test('이름 옆 명예 표식은 장착한 클레이브 장비 +7부터 숫자로 위계를 공개한다',()=>{
 const L=looks(),badge=(id,enh)=>L.prestigeBadge({main:id},{main:enh});
 assert.equal(L.prestigeBadge({},{}),null);assert.equal(badge('w_kain_greatsword',10),null,'일반 +10은 클레이브 명예가 아니다');
 assert.equal(badge('w_clave_blade',0),null);assert.equal(badge('w_clave_blade',6),null);
 for(const [enh,tier] of [[7,1],[8,1],[9,2],[10,3]])assert.deepEqual(badge('w_clave_blade',enh),{boss:'clave',tier,enh,label:'클레이브 +'+enh});
 const mixed=L.prestigeBadge({main:'w_clave_blade',off:'x_clave_shutter',head:'a_sluice_helm'},{main:7,off:9,head:10});assert.equal(mixed.enh,9,'일반 장비 강화값은 섞지 않는다');
 const h=fs.readFileSync(path.join(ROOT,'mmo.html'),'utf8');assert.match(h,/prestigeBadge\(h\.eqNet,h\.enhNet\)/);assert.match(h,/class="prestige" data-boss="clave" data-tier=/);assert.match(h,/aria-label="클레이브 장비 \+/);
 assert.match(h,/if\(renamed\|\|visual\)heroTag\(me\)/,'본인 장비·강화가 바뀌어도 표식을 즉시 갱신');
 const css=h.slice(h.indexOf('.tag .prestige{'),h.indexOf('.tag .hp{'));assert.doesNotMatch(css,/animation|transition|keyframes/,'명예 표식은 전투 중 움직이지 않는다');
});

test('감소 모션은 명예 장비 색·수량을 남기고 회전·부유·펄스만 고정한다',()=>{
 const src=fs.readFileSync(path.join(ROOT,'js/looks.js'),'utf8'),mmo=fs.readFileSync(path.join(ROOT,'mmo.html'),'utf8');
 assert.match(src,/if\(reduced\)mat\.opacity=[^;]+;else core\.onBeforeRender=/,'장검 코어 펄스 고정');
 assert.match(src,/if\(reduced\)crestMat\.opacity=[^;]+;else crest\.onBeforeRender=/,'등 문장 회전·펄스 고정');
 assert.match(src,/if\(!reduced\)pts\.onBeforeRender=/,'불티 회전·부유 고정');
 assert.match(mmo,/reduced:REDUCED/,'MMO 사용자 선호를 외형 모듈로 전달');
 assert.match(mmo,/if\(!REDUCED\)\{L\.gem\.rotation/,'바닥 전리품 결정도 감소 모션에서 고정');
});

test('바닥 전리품 반복 스냅숏은 새 색·DOM을 만들지 않고 제거할 때 GPU 자원을 해제한다',()=>{
 const h=fs.readFileSync(path.join(ROOT,'mmo.html'),'utf8'),add=h.slice(h.indexOf('function lootAdd'),h.indexOf('function onBossMsg'));
 assert.match(add,/if\(!L\)\{ const d=[^\n]+new THREE\.Color/,'색·geometry는 최초 등장에만 생성');
 assert.match(add,/if\(L\.mine!==mine\)/,'우선권이 바뀔 때만 이름표를 다시 쓴다');
 assert.match(add,/L\.grp\.traverse\([^\n]+geometry\?\.dispose\(\)[^\n]+material[^\n]+dispose/,'제거 시 geometry/material 해제');
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
