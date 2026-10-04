using UnrealBuildTool;

// The lab's primary game module (empty): the Android test package needs one (doc 177 §5).
public class MHLab : ModuleRules
{
    public MHLab(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "RenderCore", "RHI" });
    }
}
