import unreal

FOLDERS = [
    "/Game/Hwanghon/Story",
    "/Game/Hwanghon/Story/Scenes",
    "/Game/Hwanghon/Dungeons",
    "/Game/Hwanghon/Dungeons/Arenas",
    "/Game/Hwanghon/Dungeons/Graybox",
    "/Game/Hwanghon/Dungeons/DataLayers",
    "/Game/Hwanghon/Dungeons/Sequencer",
    "/Game/Hwanghon/Dungeons/Chaos",
    "/Game/Hwanghon/Environment",
    "/Game/Hwanghon/Environment/Shared",
    "/Game/Hwanghon/Environment/KoreaProps",
    "/Game/Hwanghon/Environment/PCG",
]

def main():
    for folder in FOLDERS:
        if not unreal.EditorAssetLibrary.does_directory_exist(folder):
            unreal.EditorAssetLibrary.make_directory(folder)
            unreal.log("[HwanghonDungeon] created " + folder)
        else:
            unreal.log("[HwanghonDungeon] exists " + folder)
    unreal.log("[HwanghonDungeon] story dungeon workspace ready")

if __name__ == "__main__":
    main()
