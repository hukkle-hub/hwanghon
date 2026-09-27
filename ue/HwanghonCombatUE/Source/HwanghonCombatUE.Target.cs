using UnrealBuildTool;
public class HwanghonCombatUETarget : TargetRules
{
	public HwanghonCombatUETarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
		ExtraModuleNames.Add("HwanghonCombat");
	}
}
