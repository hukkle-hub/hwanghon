#include "Graphics/HWGraphicsQualitySubsystem.h"

#include "Engine/Engine.h"
#include "GameFramework/GameUserSettings.h"
#include "HAL/IConsoleManager.h"

namespace
{
    void SetIntCVar(const TCHAR* Name, int32 Value)
    {
        if (IConsoleVariable* Var = IConsoleManager::Get().FindConsoleVariable(Name))
        {
            Var->Set(Value, ECVF_SetByGameSetting);
        }
    }

    void SetFloatCVar(const TCHAR* Name, float Value)
    {
        if (IConsoleVariable* Var = IConsoleManager::Get().FindConsoleVariable(Name))
        {
            Var->Set(Value, ECVF_SetByGameSetting);
        }
    }
}

void UHWGraphicsQualitySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);

#if PLATFORM_ANDROID
    CurrentTier = EHWGraphicsTier::High;
#else
    CurrentTier = EHWGraphicsTier::High;
#endif

    ApplyTier(CurrentTier, false);
}

void UHWGraphicsQualitySubsystem::ApplyTier(EHWGraphicsTier Tier, bool bSaveSettings)
{
    CurrentTier = Tier;

    UGameUserSettings* Settings = GEngine ? GEngine->GetGameUserSettings() : nullptr;
    if (Settings)
    {
        switch (Tier)
        {
            case EHWGraphicsTier::High:
                Settings->SetResolutionScaleValueEx(100.f);
                Settings->SetViewDistanceQuality(3);
                Settings->SetShadowQuality(3);
                Settings->SetPostProcessingQuality(3);
                Settings->SetTextureQuality(3);
                Settings->SetVisualEffectQuality(3);
                Settings->SetShadingQuality(3);
                Settings->SetReflectionQuality(2);
                Settings->SetAntiAliasingQuality(3);
                break;

            case EHWGraphicsTier::Mid:
                Settings->SetResolutionScaleValueEx(90.f);
                Settings->SetViewDistanceQuality(2);
                Settings->SetShadowQuality(2);
                Settings->SetPostProcessingQuality(2);
                Settings->SetTextureQuality(2);
                Settings->SetVisualEffectQuality(2);
                Settings->SetShadingQuality(2);
                Settings->SetReflectionQuality(1);
                Settings->SetAntiAliasingQuality(2);
                break;

            case EHWGraphicsTier::Low:
                Settings->SetResolutionScaleValueEx(75.f);
                Settings->SetViewDistanceQuality(1);
                Settings->SetShadowQuality(1);
                Settings->SetPostProcessingQuality(0);
                Settings->SetTextureQuality(1);
                Settings->SetVisualEffectQuality(1);
                Settings->SetShadingQuality(1);
                Settings->SetReflectionQuality(0);
                Settings->SetAntiAliasingQuality(1);
                break;
        }

        Settings->SetDynamicResolutionEnabled(false);
        // A quality tier changes rendering cost, never the window size or mode.
        // ApplySettings also reapplies saved resolution and discards launch overrides.
        Settings->ApplyNonResolutionSettings();

        if (bSaveSettings)
        {
            Settings->SaveSettings();
        }
    }

    ApplyCVars(Tier);
    OnTierChanged.Broadcast(Tier);
}

void UHWGraphicsQualitySubsystem::ApplyCVars(EHWGraphicsTier Tier)
{
    // r.Mobile.ShadingPath is selected by device profile / startup config.
    // Do not switch shading paths mid-session.
    SetIntCVar(TEXT("r.MotionBlurQuality"), 0);

    switch (Tier)
    {
        case EHWGraphicsTier::High:
            SetIntCVar(TEXT("r.BloomQuality"), 4);
            SetIntCVar(TEXT("r.ShadowQuality"), 3);
            SetIntCVar(TEXT("r.Mobile.AmbientOcclusionQuality"), 1);
            SetFloatCVar(TEXT("r.ViewDistanceScale"), 1.0f);
            break;

        case EHWGraphicsTier::Mid:
            SetIntCVar(TEXT("r.BloomQuality"), 2);
            SetIntCVar(TEXT("r.ShadowQuality"), 2);
            SetIntCVar(TEXT("r.Mobile.AmbientOcclusionQuality"), 0);
            SetFloatCVar(TEXT("r.ViewDistanceScale"), 0.85f);
            break;

        case EHWGraphicsTier::Low:
            SetIntCVar(TEXT("r.BloomQuality"), 0);
            SetIntCVar(TEXT("r.ShadowQuality"), 1);
            SetIntCVar(TEXT("r.Mobile.AmbientOcclusionQuality"), 0);
            SetFloatCVar(TEXT("r.ViewDistanceScale"), 0.65f);
            break;
    }
}

float UHWGraphicsQualitySubsystem::GetContactLightScale() const
{
    switch (CurrentTier)
    {
        case EHWGraphicsTier::High: return 1.f;
        case EHWGraphicsTier::Mid: return 0.55f;
        case EHWGraphicsTier::Low: return 0.f;
        default: return 1.f;
    }
}
