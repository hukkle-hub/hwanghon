using UnrealBuildTool;
using System.Collections.Generic;

public class HwanghonCombatUETarget : TargetRules
{
    public HwanghonCombatUETarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("HwanghonCombatUE");
    }
}
