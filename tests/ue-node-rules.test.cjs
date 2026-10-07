/* UE 거점 규칙(ue/.../Public/Node/HWNodeRules.h)을 엔진 없이 g++ 로 굽고 돌린다 (docs/design/200).
   이 컨테이너·CI 에는 Unreal 이 없다 — 규칙만이라도 매번 컴파일·검사한다. UE MSVC 가 오류로 보는
   그림자 이름·암묵 변환도 -Werror 로 막는다. g++ 이 없으면 건너뛴다. */
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const SRC=path.join(__dirname,'..','ue','HwanghonCombatUE','Scripts','tests','node_rules_test.cpp');
const has=c=>{ try{ execFileSync(c,['--version'],{stdio:'ignore'}); return true; }catch{ return false; } };
test('UE 거점 규칙: 엄격 경고로 컴파일되고 모든 검사를 통과한다',{skip:!has('g++')&&'g++ 없음'},()=>{
 const out=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'hwnode-')),'t');
 execFileSync('g++',['-std=c++17','-Wall','-Wextra','-Wshadow','-Wconversion','-Werror','-o',out,SRC],{stdio:'pipe'});
 const r=execFileSync(out,{encoding:'utf8'}); assert.match(r,/all checks passed/);
});
