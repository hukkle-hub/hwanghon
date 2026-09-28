import unreal

FOLDERS = [
    "/Game/Hwanghon/Animation",
    "/Game/Hwanghon/Animation/Donors",
    "/Game/Hwanghon/Animation/Donors/Epic",
    "/Game/Hwanghon/Animation/Donors/Paragon",
    "/Game/Hwanghon/Animation/Donors/Quaternius",
    "/Game/Hwanghon/Animation/Donors/Mixamo",
    "/Game/Hwanghon/Animation/Donors/Rokoko",
    "/Game/Hwanghon/Animation/Retarget",
    "/Game/Hwanghon/Animation/Retarget/Ain",
    "/Game/Hwanghon/Animation/Retarget/Kain",
    "/Game/Hwanghon/Animation/Retarget/Ryu",
    "/Game/Hwanghon/Animation/Retarget/Sera",
    "/Game/Hwanghon/Animation/Retarget/Boss",
    "/Game/Hwanghon/Animation/Edited",
    "/Game/Hwanghon/Animation/Edited/Ain",
    "/Game/Hwanghon/Animation/Edited/Kain",
    "/Game/Hwanghon/Animation/Edited/Ryu",
    "/Game/Hwanghon/Animation/Edited/Sera",
    "/Game/Hwanghon/Animation/Edited/Boss",
    "/Game/Hwanghon/Animation/Final",
    "/Game/Hwanghon/Animation/Final/Ain",
    "/Game/Hwanghon/Animation/Final/Kain",
    "/Game/Hwanghon/Animation/Final/Ryu",
    "/Game/Hwanghon/Animation/Final/Sera",
    "/Game/Hwanghon/Animation/Final/Boss",
]

def main():
    for folder in FOLDERS:
        if not unreal.EditorAssetLibrary.does_directory_exist(folder):
            unreal.EditorAssetLibrary.make_directory(folder)
            unreal.log("[HwanghonAnim] created " + folder)
        else:
            unreal.log("[HwanghonAnim] exists " + folder)

    unreal.log("[HwanghonAnim] donor workspace ready")

if __name__ == "__main__":
    main()
