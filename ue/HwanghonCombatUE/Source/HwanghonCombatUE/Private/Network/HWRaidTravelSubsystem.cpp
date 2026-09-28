#include "Network/HWRaidTravelSubsystem.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/PackageName.h"

void UHWRaidTravelSubsystem::Initialize(FSubsystemCollectionBase& C)
{
    Super::Initialize(C);
    C.InitializeDependency<UHWRaidNetworkSubsystem>();
    Network=GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>();
    if(Network)
    {
        Network->OnRoomStateChanged.AddDynamic(this,&UHWRaidTravelSubsystem::HandleRoomState);
        bLastHadRaid=Network->GetRoom().bHasRaid;
    }
}
void UHWRaidTravelSubsystem::Deinitialize()
{
    if(Network)Network->OnRoomStateChanged.RemoveDynamic(this,&UHWRaidTravelSubsystem::HandleRoomState);
    Super::Deinitialize();
}
bool UHWRaidTravelSubsystem::IsCurrentPackage(const FString& P)const
{
    return GetWorld()&&GetWorld()->GetOutermost()->GetName()==P;
}
bool UHWRaidTravelSubsystem::TravelToPackage(const FString& P)
{
    if(P.IsEmpty())return false;
    if(!FPackageName::IsValidLongPackageName(P)){OnTravelError.Broadcast(TEXT("Invalid raid map: ")+P);return false;}
    if(!FPackageName::DoesPackageExist(P)){OnTravelError.Broadcast(TEXT("Raid map not installed/cooked: ")+P);return false;}
    if(IsCurrentPackage(P))return true;
    UGameplayStatics::OpenLevel(this,FName(*P),true);
    return true;
}
void UHWRaidTravelSubsystem::HandleRoomState(FHWPartyNetSnapshot R)
{
    if(bAutoTravelToRaid&&R.bHasRaid&&!bLastHadRaid)TravelToPackage(OnlineRaidMapPackage);
    else if(bAutoReturnWhenRaidRemoved&&!R.bHasRaid&&bLastHadRaid&&!ReturnMapPackage.IsEmpty())TravelToPackage(ReturnMapPackage);
    bLastHadRaid=R.bHasRaid;
}
