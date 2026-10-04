#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "MHLabDNALibrary.generated.h"

UCLASS()
class UMHLabDNALibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * The plugin archetype DNA, one mesh (0 = head): position count, and per vertex layout its position index and
	 * UV (V already flipped to the UE skel-mesh convention, as MetaHumanCharacterSkelMeshUtils does).
	 */
	UFUNCTION(BlueprintCallable, Category = "MHLab")
	static bool GetArchetypeMeshLayout(int32 MeshIndex, int32& OutNumPositions, TArray<int32>& OutLayoutPositions, TArray<FVector2D>& OutLayoutUVs);

	/** Vertex positions of one mesh (LOD0 numbering) of a .dna file, in the DNA's own space. */
	UFUNCTION(BlueprintCallable, Category = "MHLab")
	static bool ReadDNAMeshPositions(const FString& DNAPath, int32 MeshIndex, TArray<FVector>& OutPositions);

	/**
	 * Writes InPath -> OutPath with one mesh's vertices moved by Deltas (DNA space, DNACalib "Add"), lower LODs
	 * recalculated from it when bRecalcLODs. Used to put an exact template shape into a whole-rig DNA (doc 177 ¡×7).
	 */
	UFUNCTION(BlueprintCallable, Category = "MHLab")
	static bool AddDNAMeshDeltas(const FString& InPath, const FString& OutPath, int32 MeshIndex, const TArray<FVector>& Deltas, bool bRecalcLODs);
};
