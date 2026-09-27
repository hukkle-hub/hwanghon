using UnrealBuildTool;
public class HwanghonCombat : ModuleRules
{
	public HwanghonCombat(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput", "Json", "JsonUtilities" });
		PrivateDependencyModuleNames.AddRange(new string[] { });
	}
}
