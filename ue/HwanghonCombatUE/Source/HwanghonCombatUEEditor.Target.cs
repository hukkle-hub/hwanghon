using UnrealBuildTool;
public class HwanghonCombatUEEditorTarget : TargetRules
{
	public HwanghonCombatUEEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
		ExtraModuleNames.Add("HwanghonCombat");
	}
}
