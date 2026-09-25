#!/bin/sh
# MPFB2(MakeHuman 의 Blender 판, 코드 GPL · 에셋 CC0) 를 pip bpy 에 확장으로 깔고 기본 에셋(CC0, 267 MB)을 잇는다. docs/design/81
set -e
W=${1:-/tmp/mpfb}; mkdir -p $W && cd $W
[ -d mpfb2 ] || git clone -q --depth 1 https://github.com/makehumancommunity/mpfb2.git
[ -f mpfb_ext.zip ] || (cd mpfb2/src/mpfb && zip -qr $W/mpfb_ext.zip . -x "*.pyc")
python3 -c "import bpy;bpy.ops.extensions.package_install_files(filepath='$W/mpfb_ext.zip',repo='user_default',enable_on_install=True);bpy.ops.wm.save_userpref()"
[ -f mh_sys.zip ] || curl -sSL -o mh_sys.zip https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
mkdir -p mhdata && (cd mhdata && unzip -q -o ../mh_sys.zip)
D=$(python3 -c "import bpy;print(bpy.utils.user_resource('EXTENSIONS'))")/.user/user_default/mpfb/data; mkdir -p $D
for x in mhdata/*; do ln -sfn $W/$x $D/$(basename $x); done
echo "MPFB 준비됨: $D"
