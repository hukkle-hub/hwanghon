"""Seohan_Combat_VS01 — 첫 맵을 UE 편집기 파이썬으로 만든다 (.umap 은 이진이라 저장소에 못 넣는다).
편집기 콘솔: py "Scripts/build_seohan_vs01.py"   (PythonScriptPlugin · EditorScriptingUtilities 켜짐)
  1. 빈 레벨 /Game/Maps/Seohan_Combat_VS01 생성
  2. AHwSeohanGraybox(전투방) · PlayerStart · AHwBossGraybox 배치 (보스는 방 중심에서 +4 m, 플레이어는 −4 m 마주 봄)
  3. 저장
"""
import unreal

MAP_PATH = "/Game/Maps/Seohan_Combat_VS01"
els = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

if not unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    els.new_level(MAP_PATH)
else:
    els.load_level(MAP_PATH)

for a in eas.get_all_level_actors():
    if a.get_class().get_name() in ("HwSeohanGraybox", "HwBossGraybox", "PlayerStart"):
        eas.destroy_actor(a)

room = eas.spawn_actor_from_class(unreal.load_class(None, "/Script/HwanghonCombat.HwSeohanGraybox"), unreal.Vector(0, 0, 0))
room.set_actor_label("Seohan_Room")
boss = eas.spawn_actor_from_class(unreal.load_class(None, "/Script/HwanghonCombat.HwBossGraybox"), unreal.Vector(400, 0, 170), unreal.Rotator(0, 180, 0))
boss.set_actor_label("Boss_d01_Graybox")
start = eas.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(-400, 0, 95), unreal.Rotator(0, 0, 0))
start.set_actor_label("PlayerStart_Ain")

els.save_current_level()
unreal.log("Seohan_Combat_VS01 저장 — 플레이: 아인 −4 m, 보스 +4 m (안전 간격 1.76 m 정렬은 P6 «정렬» 로)")
