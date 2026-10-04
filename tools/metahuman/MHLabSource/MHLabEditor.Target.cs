using UnrealBuildTool;

public class MHLabEditorTarget : TargetRules
{
    public MHLabEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("MHLab");
        ExtraModuleNames.Add("MHLabTools");
    }
}
