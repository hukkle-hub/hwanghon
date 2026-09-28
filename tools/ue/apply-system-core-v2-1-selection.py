#!/usr/bin/env python3
from pathlib import Path

ROOT=Path.cwd()
def P(p): return ROOT/p
def read(p): return P(p).read_text(encoding='utf-8')
def write(p,s): P(p).write_text(s,encoding='utf-8')
def once(p,old,new,label):
    s=read(p)
    if new in s:
        print('OK',label); return
    if old not in s:
        raise SystemExit(f'context changed: {label} ({p})')
    write(p,s.replace(old,new,1)); print('APPLY',label)

# ------------------------------------------------------------------
# Save v3: persist one selected character. Existing v1/v2 migrate to Ain.
# ------------------------------------------------------------------
h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Progression/HWSaveGame.h'
s=read(h)
s=s.replace('static constexpr int32 CurrentVersion = 2;','static constexpr int32 CurrentVersion = 3;',1)
if 'FName SelectedCharacter = TEXT("ain");' not in s:
    anchor='''    UPROPERTY(SaveGame)
    TArray<FHWQuestClaimReceipt> Claims;'''
    extra='''

    // One player controls one character per sortie. This is not a combat-party slot.
    UPROPERTY(SaveGame)
    FName SelectedCharacter = TEXT("ain");'''
    if anchor not in s: raise SystemExit('HWSaveGame Claims context changed')
    s=s.replace(anchor,anchor+extra,1)
write(h,s); print('APPLY save v3 character field')

cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Progression/HWSaveGame.cpp'
s=read(cpp)
old='''bool UHWSaveGame::IsValidProfile() const
{
    if (bDeserializationFailed || Version != CurrentVersion || !ValidClears(Clears) || Gold < 0 || Experience < 0) return false;'''
new='''bool UHWSaveGame::IsValidProfile() const
{
    const bool bValidCharacter =
        SelectedCharacter == TEXT("ain") || SelectedCharacter == TEXT("kain")
        || SelectedCharacter == TEXT("ryu") || SelectedCharacter == TEXT("sera");
    if (bDeserializationFailed || Version != CurrentVersion || !bValidCharacter
        || !ValidClears(Clears) || Gold < 0 || Experience < 0) return false;'''
if old in s: s=s.replace(old,new,1)
elif new not in s: raise SystemExit('HWSaveGame IsValidProfile context changed')

start=s.find('bool UHWSaveGame::MigrateToCurrentVersion()')
end=s.find('\nbool UHWSaveGame::ValidateAgainstCatalog',start)
if start<0 or end<0: raise SystemExit('HWSaveGame migration function not found')
current=s[start:end]
if 'Version == 2' not in current or 'SelectedCharacter = TEXT("ain")' not in current:
    replacement='''bool UHWSaveGame::MigrateToCurrentVersion()
{
    if (Version == CurrentVersion) return IsValidProfile();
    if (bDeserializationFailed) return false;

    if (Version == 1)
    {
        // v1 contained only clear receipts. Do not silently discard unexpected data.
        if (!ValidClears(Clears) || Gold != 0 || Experience != 0
            || !Inventory.IsEmpty() || !Claims.IsEmpty()) return false;
        SelectedCharacter = TEXT("ain");
        Version = CurrentVersion;
        return IsValidProfile();
    }

    if (Version == 2)
    {
        // v2 already validates clears/rewards through IsValidProfile after the version lift.
        SelectedCharacter = TEXT("ain");
        Version = CurrentVersion;
        return IsValidProfile();
    }

    return false;
}
'''
    s=s[:start]+replacement+s[end:]
write(cpp,s); print('APPLY save v1/v2 -> v3 migration')

# ------------------------------------------------------------------
# Profile subsystem owns selection and transactional save.
# ------------------------------------------------------------------
h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Progression/HWProfileSubsystem.h'
s=read(h)
if 'GetSelectedCharacter() const' not in s:
    anchor='''    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    int64 GetExperience() const;'''
    extra='''

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    FName GetSelectedCharacter() const;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Progression")
    bool SelectCharacter(FName CharacterId);'''
    if anchor not in s: raise SystemExit('Profile GetExperience context changed')
    s=s.replace(anchor,anchor+extra,1)
write(h,s); print('APPLY profile character API')

cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Progression/HWProfileSubsystem.cpp'
s=read(cpp)
if 'bool UHWProfileSubsystem::SelectCharacter(' not in s:
    marker='''int64 UHWProfileSubsystem::GetGold() const { return Profile ? Profile->Gold : 0; }'''
    if marker not in s: raise SystemExit('Profile getter tail changed')
    impl='''FName UHWProfileSubsystem::GetSelectedCharacter() const
{
    return Profile ? Profile->SelectedCharacter : FName(TEXT("ain"));
}

bool UHWProfileSubsystem::SelectCharacter(FName CharacterId)
{
    if (!Profile) return Fail(TEXT("Profile unavailable; character selection was not saved."));
    const bool bAllowed =
        CharacterId == TEXT("ain") || CharacterId == TEXT("kain")
        || CharacterId == TEXT("ryu") || CharacterId == TEXT("sera");
    if (!bAllowed) return Fail(TEXT("Unknown playable character."));

    const UHWSaveGame* Source = PendingProfile ? PendingProfile.Get() : Profile.Get();
    if (Source->SelectedCharacter == CharacterId && !PendingProfile) return true;

    UHWSaveGame* Candidate = DuplicateObject<UHWSaveGame>(Source, this);
    Candidate->SelectedCharacter = CharacterId;
    if (!Candidate->IsValidProfile()) return Fail(TEXT("Selected character produced an invalid profile candidate."));
    PendingProfile = Candidate;
    return RetryPendingSave();
}

'''
    s=s.replace(marker,impl+marker,1)
write(cpp,s); print('APPLY profile character persistence')

# ------------------------------------------------------------------
# Frontend selection is system state, not a cosmetic SelectedCharacter only.
# ------------------------------------------------------------------
h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/UI/HWFrontendRootWidget.h'
s=read(h)
if 'bool SelectCharacter(FName CharacterId);' not in s:
    anchor='''    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    void Sortie(FName QuestId);'''
    extra='''

    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    bool SelectCharacter(FName CharacterId);'''
    if anchor not in s: raise SystemExit('Frontend Sortie declaration changed')
    s=s.replace(anchor,anchor+extra,1)
write(h,s); print('APPLY frontend character selection API')

cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/UI/HWFrontendRootWidget.cpp'
s=read(cpp)
if '#include "Network/HWRaidNetworkSubsystem.h"' not in s:
    s=s.replace('#include "Progression/HWProfileSubsystem.h"',
                '#include "Progression/HWProfileSubsystem.h"\n#include "Network/HWRaidNetworkSubsystem.h"',1)
old='''void UHWFrontendRootWidget::NativeConstruct()
{
    Super::NativeConstruct();
    GActiveRoot = this;
    SetIsFocusable(true);'''
new='''void UHWFrontendRootWidget::NativeConstruct()
{
    Super::NativeConstruct();
    GActiveRoot = this;
    SetIsFocusable(true);
    if (UHWProfileSubsystem* Profile = ProfileSystem())
    {
        if (Profile->IsProfileAvailable()) SelectedCharacter = Profile->GetSelectedCharacter();
    }'''
if old in s: s=s.replace(old,new,1)
elif new not in s: raise SystemExit('Frontend NativeConstruct context changed')
if 'bool UHWFrontendRootWidget::SelectCharacter(' not in s:
    marker='''void UHWFrontendRootWidget::Sortie(FName QuestId)
{'''
    if marker not in s: raise SystemExit('Frontend Sortie definition changed')
    impl='''bool UHWFrontendRootWidget::SelectCharacter(FName CharacterId)
{
    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHWRaidNetworkSubsystem* Network = GI->GetSubsystem<UHWRaidNetworkSubsystem>())
        {
            const FHWNetProfile NetProfile = Network->GetProfile();
            if (Network->IsConnected() && NetProfile.bCharacterCreated
                && NetProfile.Character != CharacterId)
            {
                Toast(NSLOCTEXT("HWUI", "OnlineCharacterLocked",
                    "온라인 캐릭터는 서버 프로필에 고정되어 있습니다."));
                return false;
            }
        }
    }

    UHWProfileSubsystem* Profile = ProfileSystem();
    if (!Profile || !Profile->IsProfileAvailable())
    {
        Toast(NSLOCTEXT("HWUI", "NoProfileForCharacter", "캐릭터 선택을 저장할 프로필이 없습니다."));
        return false;
    }
    if (!Profile->SelectCharacter(CharacterId))
    {
        Toast(FText::FromString(Profile->GetLastError()));
        return false;
    }
    SelectedCharacter = CharacterId;
    return true;
}

'''
    s=s.replace(marker,impl+marker,1)
write(cpp,s); print('APPLY frontend selected-character restore/save')

screens='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/UI/HWFrontendScreens.cpp'
s=read(screens)
count=s.count('F->SelectedCharacter = Id;')
if count:
    s=s.replace('F->SelectedCharacter = Id;','F->SelectCharacter(Id);')
    print('APPLY frontend character tabs:',count)
write(screens,s)

# ------------------------------------------------------------------
# Combat GameMode chooses exactly one pawn. Online server profile wins online.
# ------------------------------------------------------------------
h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Game/HWCombatGameMode.h'
s=read(h)
if 'GetDefaultPawnClassForController_Implementation' not in s:
    s=s.replace('    virtual void BeginPlay() override;',
                '    virtual void BeginPlay() override;\n    virtual UClass* GetDefaultPawnClassForController_Implementation(AController* InController) override;',1)
write(h,s); print('APPLY GameMode pawn selector declaration')

cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Game/HWCombatGameMode.cpp'
s=read(cpp)
if '#include "System/HWPlayableCharacterVariants.h"' not in s:
    s=s.replace('#include "Character/HWAinCharacter.h"',
                '#include "Character/HWAinCharacter.h"\n#include "System/HWPlayableCharacterVariants.h"',1)
if 'GetDefaultPawnClassForController_Implementation' not in s:
    marker='''void AHWCombatGameMode::BeginPlay()
{'''
    if marker not in s: raise SystemExit('GameMode BeginPlay definition changed')
    impl='''UClass* AHWCombatGameMode::GetDefaultPawnClassForController_Implementation(AController* InController)
{
    FName CharacterId = TEXT("ain");
    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHWRaidNetworkSubsystem* Network = GI->GetSubsystem<UHWRaidNetworkSubsystem>())
        {
            const FHWNetProfile NetProfile = Network->GetProfile();
            if (Network->GetRoom().bHasRaid && NetProfile.bCharacterCreated)
                CharacterId = NetProfile.Character;
            else if (UHWProfileSubsystem* Profile = GI->GetSubsystem<UHWProfileSubsystem>())
                CharacterId = Profile->GetSelectedCharacter();
        }
        else if (UHWProfileSubsystem* Profile = GI->GetSubsystem<UHWProfileSubsystem>())
        {
            CharacterId = Profile->GetSelectedCharacter();
        }
    }

    if (CharacterId == TEXT("kain")) return AHWKainCharacter::StaticClass();
    if (CharacterId == TEXT("ryu")) return AHWRyuCharacter::StaticClass();
    if (CharacterId == TEXT("sera")) return AHWSeraCharacter::StaticClass();
    return AHWAinCharacter::StaticClass();
}

'''
    s=s.replace(marker,impl+marker,1)
write(cpp,s); print('APPLY GameMode selected-character pawn')

print('SYSTEM CORE V2.1 CHARACTER SELECTION applied')
