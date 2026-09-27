using UnrealBuildTool;
using System.Collections.Generic;

public class HwanghonCombatUEEditorTarget : TargetRules
{
    public HwanghonCombatUEEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("HwanghonCombatUE");
    }
}
