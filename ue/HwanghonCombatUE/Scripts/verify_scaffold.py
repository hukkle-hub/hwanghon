from pathlib import Path
import json
import re, sys

root = Path(__file__).resolve().parents[1]

required = [
    "HwanghonCombatUE.uproject",
    "Source/HwanghonCombatUE/HwanghonCombatUE.Build.cs",
    "Source/HwanghonCombatUE/Public/Combat/HWCombatTypes.h",
    "Source/HwanghonCombatUE/Public/Combat/HWCombatTuningAsset.h",
    "Source/HwanghonCombatUE/Private/Combat/HWCombatTuningAsset.cpp",
    "Source/HwanghonCombatUE/Public/Combat/HWCombatComponent.h",
    "Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp",
    "Source/HwanghonCombatUE/Public/Character/HWAinCharacter.h",
    "Source/HwanghonCombatUE/Private/Character/HWAinCharacter.cpp",
    "Source/HwanghonCombatUE/Public/Boss/HWBossCharacter.h",
    "Source/HwanghonCombatUE/Private/Boss/HWBossCharacter.cpp",
    "Source/HwanghonCombatUE/Public/Camera/HWLockOnComponent.h",
    "Source/HwanghonCombatUE/Private/Camera/HWLockOnComponent.cpp",
    "Source/HwanghonCombatUE/Public/World/HWGrayboxArena.h",
    "Source/HwanghonCombatUE/Private/World/HWGrayboxArena.cpp",
    "Source/HwanghonCombatUE/Public/Game/HWCombatGameMode.h",
    "Source/HwanghonCombatUE/Private/Game/HWCombatGameMode.cpp",
    "Config/DefaultEngine.ini",
    "Config/DefaultInput.ini",
    "Source/HwanghonCombatUE/Public/Animation/HWAinAnimInstance.h",
    "Source/HwanghonCombatUE/Private/Animation/HWAinAnimInstance.cpp",
    "Source/HwanghonCombatUE/Public/Animation/HWBossAnimInstance.h",
    "Source/HwanghonCombatUE/Private/Animation/HWBossAnimInstance.cpp",
    "Docs/ANIMATION_BLUEPRINT_CONTRACT_KR.md",
    "Docs/EDITOR_AUTOMATION_KR.md",
    "Scripts/ue_setup.py",
    "Scripts/asset_manifest.json",
    "Config/DefaultDeviceProfiles.ini",
    "Source/HwanghonCombatUE/Public/Audit/HWCombatAuditActor.h",
    "Source/HwanghonCombatUE/Private/Audit/HWCombatAuditActor.cpp",
    "Docs/COMBAT_AUDIT_KR.md",
    "Scripts/analyze_audit.py",
    "Docs/COMBAT_RULE_SYNC_KR.md",
    "Docs/WINDOWS_BUILD_PIPELINE_KR.md",
    "Scripts/build_setup_test_windows.ps1",
    "Scripts/build_validation.ps1",
    "Scripts/tests/test_build_validation.ps1",
    "Source/HwanghonCombatUE/Public/Animation/HWAnimationSetAsset.h",
    "Source/HwanghonCombatUE/Private/Animation/HWAnimationSetAsset.cpp",
    "Source/HwanghonCombatUE/Public/Animation/HWPlayerPresentationComponent.h",
    "Source/HwanghonCombatUE/Private/Animation/HWPlayerPresentationComponent.cpp",
    "Source/HwanghonCombatUE/Public/Animation/HWBossPresentationComponent.h",
    "Source/HwanghonCombatUE/Private/Animation/HWBossPresentationComponent.cpp",
    "Docs/ANIMATION_RUNTIME_SYNC_KR.md",
    "Scripts/animation_binding_template.json",
    "Source/HwanghonCombatUE/Public/Graphics/HWGraphicsQualitySubsystem.h",
    "Source/HwanghonCombatUE/Private/Graphics/HWGraphicsQualitySubsystem.cpp",
    "Source/HwanghonCombatUE/Public/World/HWSeohanLightingRig.h",
    "Source/HwanghonCombatUE/Private/World/HWSeohanLightingRig.cpp",
    "Docs/GRAPHICS_FOUNDATION_KR.md",
    "Docs/MATERIAL_TARGETS.csv",
    "Docs/HERO_ASSET_BUDGETS.json",
    "Docs/HERO_ASSET_QA_KR.md",
    "Scripts/ue_asset_audit.py",
    "Scripts/summarize_asset_audit.py",
    "Scripts/package_android.ps1",
    "Docs/ANDROID_BUILD_PERF_KR.md",
    "Scripts/ue_create_material_library.py",
    "Scripts/create_material_library.ps1",
    "Docs/MATERIAL_PREVIEW_LIBRARY_KR.md",
]

missing = [p for p in required if not (root / p).exists()]
if missing:
    raise SystemExit("missing files: " + ", ".join(missing))

tuning = (root / "Source/HwanghonCombatUE/Private/Combat/HWCombatTuningAsset.cpp").read_text(encoding="utf-8")
for token in [
    "Attack1 = {0.66f, 0.24f",
    "Attack2 = {0.66f, 0.24f",
    "Attack3 = {0.66f, 0.24f",
    'Pattern("Charge"',
    'Pattern("GroundWave"',
]:
    assert token in tuning, token

combat = (root / "Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp").read_text(encoding="utf-8")
assert "StartAction(Next);" in combat
assert "OnContact.Broadcast" in combat

boss = (root / "Source/HwanghonCombatUE/Private/Boss/HWBossCharacter.cpp").read_text(encoding="utf-8")
assert "CurrentPattern.bJumpOnly" in boss
assert "PlayerCombat->IsCounterActive()" in boss
assert "TickLunge" in boss

engine = (root / "Config/DefaultEngine.ini").read_text(encoding="utf-8")
assert "r.Mobile.ShadingPath=1" in engine
assert "bSupportsVulkan=True" in engine

# Structural smoke check only; JSON test fixtures and comments can contain braces.
# C++ compilation remains authoritative. Strip ordinary/raw literals and comments
# before counting so malformed JSON regression fixtures do not look like C++ errors.
cpp_literals = re.compile(
    r'R"(?P<delimiter>[^ ()\\\t\r\n]{0,16})\(.*?\)(?P=delimiter)"'
    r'|"(?:\\.|[^"\\])*"'
    r"|'(?:\\.|[^'\\])*'"
    r'|//[^\n]*|/\*.*?\*/',
    re.DOTALL,
)

for rel in root.glob("Source/**/*.cpp"):
    text = cpp_literals.sub("", rel.read_text(encoding="utf-8"))
    assert text.count("{") == text.count("}"), f"brace mismatch: {rel}"

for rel in root.glob("Source/**/*.h"):
    text = cpp_literals.sub("", rel.read_text(encoding="utf-8"))
    assert text.count("{") == text.count("}"), f"brace mismatch: {rel}"

ain_anim = (root / "Source/HwanghonCombatUE/Private/Animation/HWAinAnimInstance.cpp").read_text(encoding="utf-8")
assert "Attack1" in ain_anim and "Attack2" in ain_anim and "Attack3" in ain_anim
assert "bContactWindow" in ain_anim

boss_anim = (root / "Source/HwanghonCombatUE/Private/Animation/HWBossAnimInstance.cpp").read_text(encoding="utf-8")
assert "GetBossStateNormalized" in boss_anim
assert "bBigPattern" in boss_anim


uproject = json.loads((root / "HwanghonCombatUE.uproject").read_text(encoding="utf-8"))
plugin_names = {p["Name"] for p in uproject.get("Plugins", []) if p.get("Enabled")}
assert {"EnhancedInput", "PythonScriptPlugin", "EditorScriptingUtilities"} <= plugin_names

profiles = (root / "Config/DefaultDeviceProfiles.ini").read_text(encoding="utf-8")
assert "[Android_High DeviceProfile]" in profiles
assert "[Android_Mid DeviceProfile]" in profiles
assert "[Android_Low DeviceProfile]" in profiles

setup = (root / "Scripts/ue_setup.py").read_text(encoding="utf-8")
assert "AssetImportTask" in setup
assert "Seohan_Combat_VS01" in setup
assert "HWGrayboxArena" in setup


audit = (root / "Source/HwanghonCombatUE/Private/Audit/HWCombatAuditActor.cpp").read_text(encoding="utf-8")
assert "penetration_cm" in audit
assert "player_contact" in audit
assert "SaveNow()" in audit

input_cfg = (root / "Config/DefaultInput.ini").read_text(encoding="utf-8")
def has_mapping(action, key):
    # The editor may insert modifier fields between ActionName and Key.
    return any(
        f'ActionName="{action}"' in mapping
        and re.search(r'(?:^|,)\s*Key=' + re.escape(key) + r'(?:,|$)', mapping)
        for mapping in re.findall(r'^\+ActionMappings=\(([^)]*)\)', input_cfg, re.MULTILINE)
    )

assert has_mapping("SaveAudit", "F9")


rules = (root / "Source/HwanghonCombatUE/Private/Combat/HWCombatTuningAsset.cpp").read_text(encoding="utf-8")
assert '"Attack1", 0.39f' in rules
assert '"Smash", 0.68f' in rules

combat_impl = (root / "Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp").read_text(encoding="utf-8")
assert "RequestDefensiveAction" in combat_impl
assert "DodgeCooldownRemaining" in combat_impl
assert "JumpCooldownRemaining" in combat_impl
assert "CurrentSpec.DefenseCancelAt - ActionElapsed <= BufferWindow" in combat_impl

boss_impl = (root / "Source/HwanghonCombatUE/Private/Boss/HWBossCharacter.cpp").read_text(encoding="utf-8")
assert "HitStopRemaining" in boss_impl
assert "void AHWBossCharacter::ApplyHitStop" in boss_impl


build_ps = (root / "Scripts/build_setup_test_windows.ps1").read_text(encoding="utf-8")
assert "Build.bat" in build_ps
assert "-ExecutePythonScript" in build_ps
assert "Automation RunTest Hwanghon.;Quit" in build_ps
assert "ReportExportPath" in build_ps
assert "Assert-HWEngineVersion" in build_ps
assert "Assert-HWAutomationReport" in build_ps
assert build_ps.index("Assert-HWEngineVersion") < build_ps.index("& $BuildBat")
assert build_ps.index("Assert-HWAutomationReport") < build_ps.index('Write-Host "`nPASS:')


tuning_h = (root / "Source/HwanghonCombatUE/Public/Combat/HWCombatTuningAsset.h").read_text(encoding="utf-8")
assert "UFUNCTION(BlueprintPure)\n    const FHWActionSpec& GetActionSpec" not in tuning_h

ain_cpp = (root / "Source/HwanghonCombatUE/Private/Character/HWAinCharacter.cpp").read_text(encoding="utf-8")
jump_press = ain_cpp.split("void AHWAinCharacter::CombatJumpPressed()", 1)[1].split("}", 1)[0]
assert "\n        Jump();" not in jump_press
assert "else if (Action == EHWActionType::Jump)" in ain_cpp

targets = (root / "Source/HwanghonCombatUE.Target.cs").read_text(encoding="utf-8") + (root / "Source/HwanghonCombatUEEditor.Target.cs").read_text(encoding="utf-8")
assert "BuildSettingsVersion.Latest" in targets


player_pres = (root / "Source/HwanghonCombatUE/Private/Animation/HWPlayerPresentationComponent.cpp").read_text(encoding="utf-8")
assert "MapCombatTimeToSourceTime" in player_pres
assert "Montage_SetPlayRate(ActiveMontage, 0.f)" in player_pres
assert "Montage_SetPosition" in player_pres
assert "OnVisualContact.Broadcast" in player_pres
assert "bPendingStop" in player_pres

boss_pres = (root / "Source/HwanghonCombatUE/Private/Animation/HWBossPresentationComponent.cpp").read_text(encoding="utf-8")
assert "MapStrikePhaseToSourcePhase" in boss_pres
assert "SourceBeatNormalized" in boss_pres
assert "OnVisualBossBeat.Broadcast" in boss_pres
assert "UpperBodyReaction" in boss_pres

boss_h = (root / "Source/HwanghonCombatUE/Public/Boss/HWBossCharacter.h").read_text(encoding="utf-8")
assert "FHWBossStateChangedSignature" in boss_h
assert "FHWBossReactionSignature" in boss_h

audit_impl = (root / "Source/HwanghonCombatUE/Private/Audit/HWCombatAuditActor.cpp").read_text(encoding="utf-8")
assert "visual_player_contact" in audit_impl


graphics = (root / "Source/HwanghonCombatUE/Private/Graphics/HWGraphicsQualitySubsystem.cpp").read_text(encoding="utf-8")
assert "SetResolutionScaleValueEx(100.f)" in graphics
assert "SetResolutionScaleValueEx(90.f)" in graphics
assert "SetResolutionScaleValueEx(75.f)" in graphics
assert 'TEXT("r.Mobile.ShadingPath")' not in graphics
assert "GetContactLightScale" in graphics

lighting = (root / "Source/HwanghonCombatUE/Private/World/HWSeohanLightingRig.cpp").read_text(encoding="utf-8")
assert "WarmKey" in lighting
assert "CoolRim" in lighting
assert "RedAccent" in lighting
assert "ContactLight" in lighting
assert "GetContactLightScale" in lighting

input_cfg = (root / "Config/DefaultInput.ini").read_text(encoding="utf-8")
assert has_mapping("GraphicsLow", "F6")
assert has_mapping("GraphicsMid", "F7")
assert has_mapping("GraphicsHigh", "F8")


asset_audit = (root / "Scripts/ue_asset_audit.py").read_text(encoding="utf-8")
assert "SkeletalMeshEditorSubsystem" in asset_audit
assert "asset_audit.csv" in asset_audit
assert "asset_audit.json" in asset_audit
assert "FAIL_LOD" in asset_audit
assert "CHECK_TEXTURE" in asset_audit

build_ps = (root / "Scripts/build_setup_test_windows.ps1").read_text(encoding="utf-8")
assert "[3/4] Asset quality audit" in build_ps
assert "ue_asset_audit.py" in build_ps
assert "[4/4] Hwanghon combat / progression automation tests" in build_ps


android_ps = (root / "Scripts/package_android.ps1").read_text(encoding="utf-8")
assert "BuildCookRun" in android_ps
assert "-platform=Android" in android_ps
assert "Turnkey" in android_ps
assert "-Command=InstallSDK" in android_ps

ain_cpp = (root / "Source/HwanghonCombatUE/Private/Character/HWAinCharacter.cpp").read_text(encoding="utf-8")
assert 'TEXT("csvprofile frames=1800")' in ain_cpp

input_cfg = (root / "Config/DefaultInput.ini").read_text(encoding="utf-8")
assert has_mapping("PerfCapture", "F10")


material_script = (root / "Scripts/ue_create_material_library.py").read_text(encoding="utf-8")
assert "MaterialEditingLibrary" in material_script
assert "MaterialExpressionVectorParameter" in material_script
assert "MaterialExpressionScalarParameter" in material_script
assert "MP_BASE_COLOR" in material_script
assert "MP_ROUGHNESS" in material_script
assert "MI_HW_WeaponMetal" in material_script
assert "MI_HW_WetConcrete" in material_script

print("HwanghonCombatUE scaffold structural checks: PASS (not an Unreal build or runtime test)")
