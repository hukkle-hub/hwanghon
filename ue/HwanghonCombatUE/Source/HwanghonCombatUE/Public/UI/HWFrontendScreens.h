#pragma once

#include "CoreMinimal.h"
#include "UI/HWScreenWidget.h"
#include "HWFrontendScreens.generated.h"

// Clean UI v1 screens. Each is the native parent of a WBP_* of the same role
// (Scripts/ue_ui_setup.py creates the WBPs under /Game/UI/Screens).

UCLASS()
class HWANGHONCOMBATUE_API UHWTitleScreen : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    virtual bool ShowsChrome() const override { return false; }
    virtual FString GetBackgroundArt() const override { return TEXT("title-ain"); }
    virtual float GetBackgroundDim() const override { return 0.15f; }
protected:
    virtual void Build(UCanvasPanel* Root) override;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWLobbyScreen : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    virtual float GetBackgroundDim() const override { return 0.25f; }
protected:
    virtual void Build(UCanvasPanel* Root) override;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWOfficeQuestScreen : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    virtual FText GetScreenTitle() const override;
    virtual FString GetBackgroundArt() const override { return TEXT("office-brief"); }
    virtual float GetBackgroundDim() const override { return 0.55f; }
protected:
    virtual void Build(UCanvasPanel* Root) override;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWCharacterScreen : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    virtual FText GetScreenTitle() const override;
    virtual float GetBackgroundDim() const override { return 0.45f; }
protected:
    virtual void Build(UCanvasPanel* Root) override;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWSkillsScreen : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    virtual FText GetScreenTitle() const override;
    virtual float GetBackgroundDim() const override { return 0.6f; }
protected:
    virtual void Build(UCanvasPanel* Root) override;
    int32 Selected = 0;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWLooksScreen : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    virtual FText GetScreenTitle() const override;
    virtual float GetBackgroundDim() const override { return 0.45f; }
protected:
    virtual void Build(UCanvasPanel* Root) override;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWProfileScreen : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    virtual FText GetScreenTitle() const override;
    virtual float GetBackgroundDim() const override { return 0.6f; }
protected:
    virtual void Build(UCanvasPanel* Root) override;
};

// Inventory / Forge / Shop share one skeleton: slim category rail, grid, right detail (spec §6).
UCLASS(Abstract)
class HWANGHONCOMBATUE_API UHWGridScreen : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    virtual float GetBackgroundDim() const override { return 0.7f; }
protected:
    virtual void Build(UCanvasPanel* Root) override;
    virtual TArray<FText> Categories() const { return {}; }
    virtual int32 CountEntries() const { return 0; }
    virtual bool EntryInCategory(int32 Entry) const { return true; }
    virtual UWidget* BuildCard(int32 Entry, bool bSelected) { return nullptr; }
    virtual UWidget* BuildDetail(int32 Entry) { return nullptr; }
    virtual FText GridCaption(int32 Visible) const { return FText::GetEmpty(); }
    virtual int32 GridColumns() const { return 5; }
    virtual FVector2D CardSize() const { return FVector2D(214.f, 132.f); }
    virtual UWidget* BuildFooter() { return nullptr; }

    int32 Category = 0;
    int32 Selected = INDEX_NONE;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWInventoryScreen : public UHWGridScreen
{
    GENERATED_BODY()
public:
    virtual FText GetScreenTitle() const override;
protected:
    virtual TArray<FText> Categories() const override;
    virtual int32 CountEntries() const override;
    virtual bool EntryInCategory(int32 Entry) const override;
    virtual UWidget* BuildCard(int32 Entry, bool bSelected) override;
    virtual UWidget* BuildDetail(int32 Entry) override;
    virtual FText GridCaption(int32 Visible) const override;
    int64 Owned(int32 Entry) const;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWForgeScreen : public UHWGridScreen
{
    GENERATED_BODY()
public:
    virtual FText GetScreenTitle() const override;
    virtual FString GetBackgroundArt() const override { return TEXT("forge-kain"); }
protected:
    virtual TArray<FText> Categories() const override;
    virtual int32 CountEntries() const override;
    virtual bool EntryInCategory(int32 Entry) const override;
    virtual UWidget* BuildCard(int32 Entry, bool bSelected) override;
    virtual UWidget* BuildDetail(int32 Entry) override;
    virtual FText GridCaption(int32 Visible) const override;
    virtual int32 GridColumns() const override { return 2; }
    virtual FVector2D CardSize() const override { return FVector2D(440.f, 104.f); }
};

UCLASS()
class HWANGHONCOMBATUE_API UHWShopScreen : public UHWGridScreen
{
    GENERATED_BODY()
public:
    virtual FText GetScreenTitle() const override;
protected:
    virtual TArray<FText> Categories() const override;
    virtual int32 CountEntries() const override;
    virtual bool EntryInCategory(int32 Entry) const override;
    virtual UWidget* BuildCard(int32 Entry, bool bSelected) override;
    virtual UWidget* BuildDetail(int32 Entry) override;
    virtual FText GridCaption(int32 Visible) const override;
    virtual UWidget* BuildFooter() override;
    int32 Tag = 0;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWRecruitDrawer : public UHWScreenWidget
{
    GENERATED_BODY()
protected:
    virtual void Build(UCanvasPanel* Root) override;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWResultModal : public UHWScreenWidget
{
    GENERATED_BODY()
public:
    // Set by the combat HUD when a real run ended; otherwise the modal previews the selected quest.
    bool bFromCombat = false;
    bool bVictory = false;
protected:
    virtual void Build(UCanvasPanel* Root) override;
    int32 Tab = 0;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWStoryModal : public UHWScreenWidget
{
    GENERATED_BODY()
protected:
    virtual void Build(UCanvasPanel* Root) override;
};
