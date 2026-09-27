from __future__ import annotations
import json, sys
from collections import Counter
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else "Saved/AssetAudit/asset_audit.json")
data = json.loads(path.read_text(encoding="utf-8"))

rows = data["rows"]
print(f"assets: {data['asset_count']}")
print(f"PASS: {data['pass']}")
print(f"CHECK/FAIL: {data['check_or_fail']}")

by_role = Counter(r["role"] for r in rows)
print("roles:")
for role, n in sorted(by_role.items()):
    print(f"  {role}: {n}")

issues = [r for r in rows if r["status"] != "PASS"]
if issues:
    print("issues:")
    for r in issues:
        print(f"  {r['status']}: {r['path']}")
else:
    print("issues: none")
