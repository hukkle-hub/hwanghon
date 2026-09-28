#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path.cwd()
REQUIRED = [
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/HwanghonCombatUE.Build.cs',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Combat/HWCombatComponent.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Character/HWAinCharacter.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Character/HWAinCharacter.cpp',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Boss/HWBossCharacter.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Boss/HWBossCharacter.cpp',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Game/HWCombatGameMode.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Game/HWCombatGameMode.cpp',
    'ue/HwanghonCombatUE/Config/DefaultInput.ini',
    'ue/HwanghonCombatUE/Config/DefaultGame.ini',
    'server/raid.cjs',
    'server/index.cjs',
    'server/store.cjs',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Progression/HWSaveGame.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Progression/HWSaveGame.cpp',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Progression/HWProfileSubsystem.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Progression/HWProfileSubsystem.cpp',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/UI/HWFrontendRootWidget.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/UI/HWFrontendRootWidget.cpp',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/UI/HWFrontendScreens.cpp',
]

PRESERVE = {
    'player death lifecycle': [
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Combat/HWCombatComponent.h', 'FHWPlayerDiedSignature'),
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Combat/HWCombatComponent.h', 'OnDied'),
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp', 'CommitDeath()'),
    ],
    'boss death lifecycle': [
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Boss/HWBossCharacter.h', 'OnBossDied'),
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Boss/HWBossCharacter.cpp', 'OnBossDied.Broadcast(this)'),
    ],
    'quest-run lifecycle': [
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Game/HWCombatGameMode.h', 'UHWQuestRunSubsystem'),
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Game/HWCombatGameMode.cpp', 'CompleteEncounter'),
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Game/HWCombatGameMode.cpp', 'FailEncounter'),
        ('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Game/HWCombatGameMode.cpp', 'LeaveEncounter'),
    ],
    'initial character creation': [
        ('server/index.cjs', "msg.type==='character'"),
        ('server/store.cjs', 'chooseName(id,name,character)'),
    ],
    'one-player-one-character': [
        ('server/raid.cjs', 'One world, one boss, independent players'),
        ('server/index.cjs', 'room.members.size>=4'),
    ],
}

COPY_DIRS = [
    'ue/HwanghonCombatUE/Source',
    'ue/HwanghonCombatUE/Config',
    'ue/HwanghonCombatUE/Scripts',
    'tools/ue',
    'tests',
    'scripts',
    'server',
    'js',
]
COPY_FILES = ['package.json', 'package-lock.json']


def die(msg: str) -> None:
    raise SystemExit('PRECHECK FAIL: ' + msg)


def run(cmd: list[str], cwd: Path, optional=False) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    except FileNotFoundError:
        if optional:
            return 127, f'{cmd[0]} unavailable'
        raise
    out = (p.stdout or '') + (p.stderr or '')
    return p.returncode, out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--skip-node', action='store_true')
    args = ap.parse_args()

    missing = [p for p in REQUIRED if not (ROOT / p).exists()]
    if missing:
        die('missing repository files: ' + ', '.join(missing))

    for label, checks in PRESERVE.items():
        for rel, needle in checks:
            text = (ROOT / rel).read_text(encoding='utf-8')
            if needle not in text:
                die(f'{label}: expected {needle!r} in {rel}')

    # Do not apply on top of an unknown partial system-core merge.
    char_h = (ROOT / 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Character/HWAinCharacter.h').read_text(encoding='utf-8')
    if 'SwitchToIndex' in char_h or 'LinkGauge' in char_h:
        die('forbidden character-switching grammar already exists')

    head = 'unknown'
    rc, out = run(['git', 'rev-parse', 'HEAD'], ROOT, optional=True)
    if rc == 0:
        head = out.strip()

    with tempfile.TemporaryDirectory(prefix='hwanghon-system-v2-preflight-') as td:
        dst = Path(td)
        for rel in COPY_DIRS:
            src = ROOT / rel
            if not src.exists():
                continue
            shutil.copytree(src, dst / rel, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns('node_modules','Binaries','Intermediate','Saved','DerivedDataCache','__pycache__','*.uasset','*.umap'))
        for rel in COPY_FILES:
            src = ROOT / rel
            if src.exists():
                (dst / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst / rel)

        steps = [
            [sys.executable, 'tools/ue/apply-system-core-v1.py'],
            [sys.executable, 'tools/ue/apply-system-core-v1-part2.py'],
            [sys.executable, 'tools/ue/apply-system-core-v2-current.py'],
            [sys.executable, 'tools/ue/apply-system-core-v2-1-selection.py'],
            [sys.executable, 'scripts/verify_system_core_v1.py'],
            [sys.executable, 'scripts/verify_system_core_v2.py'],
        ]
        for cmd in steps:
            rc, out = run(cmd, dst)
            print(f'[{"PASS" if rc == 0 else "FAIL"}]', ' '.join(cmd))
            if rc != 0:
                print(out[-5000:])
                die('dry-run integration failed')

        if not args.skip_node:
            tests = [
                'tests/system-core-v1.test.mjs',
                'tests/system-core-v2-network.test.mjs',
                'tests/system-core-v2-selection.test.mjs',
                'tests/system-core-v3-server-snapshot.test.cjs',
                'tests/system-core-v2-server-smoke.test.cjs',
            ]
            tests = [t for t in tests if (dst / t).exists()]
            rc, out = run(['node','--test',*tests], dst, optional=True)
            if rc == 127:
                print('[SKIP] node unavailable')
            elif rc != 0:
                print(out[-7000:])
                die('node regression tests failed in dry run')
            else:
                print('[PASS] node regression tests')

    print(json.dumps({
        'ok': True,
        'head': head,
        'preserved_contracts': list(PRESERVE),
        'dry_run': True,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
