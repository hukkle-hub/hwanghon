using UnrealBuildTool;

public class HwanghonCombatUE : ModuleRules
{
    public HwanghonCombatUE(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",
            "EnhancedInput",
            "UMG",
            "Slate",
            "SlateCore"
        });

        PrivateDependencyModuleNames.AddRange(new string[] { "Json", "WebSockets", "LevelSequence", "MovieScene", "HwanghonShelter", "ApplicationCore", "HTTP", "IKRig", "HairStrandsCore" });

        // editor-only tools driven from Python (UHWEditorAnimTools: insert a full-body slot into an AnimBP, doc 170)
        if (Target.bBuildEditor)
        {
            PrivateDependencyModuleNames.AddRange(new string[] { "UnrealEd", "AnimGraph", "BlueprintGraph", "Kismet" });
        }
    }
}
