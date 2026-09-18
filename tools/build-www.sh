#!/bin/bash
# 정적 사이트를 www/ 로 복사 (Capacitor webDir). 개발 전용 파일·소스 원본은 제외
set -e
cd "$(dirname "$0")/.."
rm -rf www && mkdir -p www
cp -r index.html *.html css js art vendor maps manifest.json sw.js www/ 2>/dev/null || true
rm -f www/art/3d/ain_tex_lo.glb www/art/3d/props/scarecrow.glb
find www/art -name "*.png" -path "*design-sheets*" -delete 2>/dev/null || true
B=$(git rev-parse --short HEAD 2>/dev/null || echo local)
sed -i "s/__BUILD__/$B/g" www/sw.js www/js/ui.js
echo '{"build":"'$B'","at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > www/version.json
du -sh www
