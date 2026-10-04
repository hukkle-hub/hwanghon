using UnrealBuildTool;

// Editor helpers for the MetaHuman lab (docs/design/177): read the archetype DNA head layout so Python can
// hand fit_state_to_target_vertices a template in DNA vertex order with the high-frequency delta kept.
public class MHLabTools : ModuleRules
{
    public MHLabTools(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine" });
        PrivateDependencyModuleNames.AddRange(new[] { "RigLogicModule", "MetaHumanIdentity", "DNACalibModule" });
    }
}
