#!/bin/bash
# 정적 사이트를 www/ 로 복사 (Capacitor webDir). 개발 전용 파일·소스 원본은 제외
set -e
cd "$(dirname "$0")/.."
rm -rf www && mkdir -p www
# design-sheets 도 넣는다 — compare.html(설계 시트 대조)·characters.html(캐릭터 시트)·
# board.html(컨셉 시트) 이 전부 이걸 가리키는데 빠져 있어서 앱에서 404 였다. +2.3MB.
cp -r index.html *.html css js art design-sheets vendor maps manifest.json sw.js www/ 2>/dev/null || true
rm -f www/art/3d/ain_tex_lo.glb www/art/3d/props/scarecrow.glb
# 모캡은 «굽는 입력» 이다 — 런타임은 art/3d/mocap 을 한 번도 읽지 않는다.
# (src/ 는 .gitignore 라 git 엔 없지만 cp -r 이 작업 트리째 퍼 온다: 28MB)
rm -rf www/art/3d/mocap
B=$(git rev-parse --short HEAD 2>/dev/null || echo local)
sed -i "s/__BUILD__/$B/g" www/sw.js www/js/ui.js
echo '{"build":"'$B'","at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > www/version.json
du -sh www
