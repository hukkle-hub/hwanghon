#include "MHLabDNALibrary.h"

#include "DNAReader.h"
#include "MetaHumanIdentityParts.h"
#include "DNAUtils.h"
#include "DNACalibDNAReader.h"
#include "Commands/DNACalibSetVertexPositionsCommand.h"
#include "Commands/DNACalibCalculateMeshLowerLODsCommand.h"

bool UMHLabDNALibrary::GetArchetypeMeshLayout(int32 MeshIndex, int32& OutNumPositions, TArray<int32>& OutLayoutPositions, TArray<FVector2D>& OutLayoutUVs)
{
	OutNumPositions = 0;
	OutLayoutPositions.Reset();
	OutLayoutUVs.Reset();
	TSharedPtr<IDNAReader> Reader = UMetaHumanIdentityFace::GetPluginArchetypeDNAReader();
	if (!Reader || MeshIndex < 0 || MeshIndex >= Reader->GetMeshCount())
	{
		return false;
	}
	const uint16 Mesh = static_cast<uint16>(MeshIndex);
	OutNumPositions = static_cast<int32>(Reader->GetVertexPositionCount(Mesh));
	const uint32 NumLayouts = Reader->GetVertexLayoutCount(Mesh);
	OutLayoutPositions.Reserve(NumLayouts);
	OutLayoutUVs.Reserve(NumLayouts);
	for (uint32 i = 0; i < NumLayouts; ++i)
	{
		const FVertexLayout Layout = Reader->GetVertexLayout(Mesh, i);
		const FTextureCoordinate UV = Reader->GetVertexTextureCoordinate(Mesh, Layout.TextureCoordinate);
		OutLayoutPositions.Add(static_cast<int32>(Layout.Position));
		OutLayoutUVs.Add(FVector2D(UV.U, 1.0 - UV.V));
	}
	return true;
}

bool UMHLabDNALibrary::ReadDNAMeshPositions(const FString& DNAPath, int32 MeshIndex, TArray<FVector>& OutPositions)
{
	OutPositions.Reset();
	TSharedPtr<IDNAReader> Reader = ReadDNAFromFile(DNAPath, EDNADataLayer::All);
	if (!Reader || MeshIndex < 0 || MeshIndex >= Reader->GetMeshCount())
	{
		return false;
	}
	const uint16 Mesh = static_cast<uint16>(MeshIndex);
	const uint32 N = Reader->GetVertexPositionCount(Mesh);
	OutPositions.Reserve(N);
	for (uint32 i = 0; i < N; ++i)
	{
		OutPositions.Add(Reader->GetVertexPosition(Mesh, i));
	}
	return true;
}

bool UMHLabDNALibrary::AddDNAMeshDeltas(const FString& InPath, const FString& OutPath, int32 MeshIndex, const TArray<FVector>& Deltas, bool bRecalcLODs)
{
	TSharedPtr<IDNAReader> Reader = ReadDNAFromFile(InPath, EDNADataLayer::All);
	if (!Reader || MeshIndex < 0 || MeshIndex >= Reader->GetMeshCount() || Deltas.Num() != static_cast<int32>(Reader->GetVertexPositionCount(static_cast<uint16>(MeshIndex))))
	{
		return false;
	}
	FDNACalibDNAReader Calib(Reader.Get());
	// The file reader may be the legacy adapter, which hands positions back as (x, z, y); DNACalib writes raw (x, y, z).
	// Deltas computed in the reader's frame must be swapped back, or "down" lands as "back" (doc 177 ¡×16, measured:
	// the written head was 1.27 cm off the template, the size of the whole move)
	const uint16 Mesh = static_cast<uint16>(MeshIndex);
	const FVector R0 = Reader->GetVertexPosition(Mesh, 0);
	const FVector C0 = Calib.GetVertexPosition(Mesh, 0);
	const bool bSwapYZ = !R0.Equals(C0, 1e-4) && FMath::IsNearlyEqual(R0.Y, C0.Z, 1e-4) && FMath::IsNearlyEqual(R0.Z, C0.Y, 1e-4);
	TArray<FVector> Raw;
	Raw.Reserve(Deltas.Num());
	for (const FVector& D : Deltas)
	{
		Raw.Add(bSwapYZ ? FVector(D.X, D.Z, D.Y) : D);
	}
	UE_LOG(LogTemp, Display, TEXT("MHLab AddDNAMeshDeltas mesh %d reader %s calib %s swapYZ %d"), MeshIndex, *R0.ToString(), *C0.ToString(), bSwapYZ ? 1 : 0);
	FDNACalibSetVertexPositionsCommand Set(Mesh, TArrayView<const FVector>(Raw), EDNACalibVectorOperation::Add);
	Set.Run(&Calib);
	if (bRecalcLODs)
	{
		FDNACalibCalculateMeshLowerLODsCommand Lods(static_cast<uint16>(MeshIndex));
		Lods.Run(&Calib);
	}
	WriteDNAToFile(&Calib, EDNADataLayer::All, OutPath);
	return true;
}
