import unreal
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
eal = unreal.EditorAssetLibrary
out = []
for a in eal.list_assets("/MetaHumanCharacter/Optional/Presets", recursive=False):
    c = unreal.load_asset(a)
    if not isinstance(c, unreal.MetaHumanCharacter):
        continue
    try:
        sub.try_add_object_to_edit(c)
        cons = {str(x.name): round(x.target_measurement, 2) for x in sub.get_body_constraints(c)}
        out.append(f"{a.split('/')[-1].split('.')[0]:10s} MF {cons.get('Masculine/Feminine')} H {cons.get('Height')} Bust {cons.get('Bust Span')} Chest {cons.get('Chest')} Waist {cons.get('Waist')} Hip {cons.get('Hip')} fixed {c.get_editor_property('fixed_body_type')}")
        sub.remove_object_to_edit(c)
    except Exception as e:
        out.append(a + " ERR " + str(e)[:200])
open(r"C:/w/mhlab/presets.txt", "w").write("\n".join(out))
