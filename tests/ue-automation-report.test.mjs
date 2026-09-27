import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scripts = join(root, 'ue', 'HwanghonCombatUE', 'Scripts');
const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const available = !spawnSync(shell, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']).error;
const options = { skip: available ? false : 'PowerShell is required for Windows pipeline validation' };
function run(script, args = []) {
  return spawnSync(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], {
    encoding: 'utf8', timeout: 30000, cwd: root,
  });
}
function fixture(action) {
  const parent = resolve(tmpdir());
  const dir = mkdtempSync(join(parent, 'hwanghon-build-node-'));
  try { return action(dir); }
  finally {
    assert.equal(dirname(resolve(dir)), parent);
    rmSync(dir, { recursive: true, force: true });
  }
}

test('UE reports and engine preflight reject false PASS conditions', options, () => {
  const result = run(join(scripts, 'tests', 'test_build_validation.ps1'));
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS: \d+ build validation checks/);
});

test('report validation tests detect a deliberately disabled test-state check', options, () => {
  fixture(dir => {
    const original = readFileSync(join(scripts, 'build_validation.ps1'), 'utf8');
    const mutant = original.replace("if ($Test.state -cne 'Success')", 'if ($false)');
    assert.notEqual(mutant, original, 'mutation must alter the production validator');
    const mutantPath = join(dir, 'mutant.ps1');
    writeFileSync(mutantPath, mutant);
    const result = run(join(scripts, 'tests', 'test_build_validation.ps1'), ['-ValidatorPath', mutantPath]);
    assert.notEqual(result.status, 0, 'disabled state validation must make the suite fail');
    assert.match(result.stdout + result.stderr, /Expected rejection: failed row masked by green summary/);
  });
});

test('whole build script rejects a 5.8 engine before trying Build.bat or Editor', options, () => {
  fixture(dir => {
    mkdirSync(join(dir, 'Engine', 'Build'), { recursive: true });
    writeFileSync(join(dir, 'Engine', 'Build', 'Build.version'), JSON.stringify({ MajorVersion: 5, MinorVersion: 8, PatchVersion: 1 }));
    const result = run(join(scripts, 'build_setup_test_windows.ps1'), ['-UERoot', dir, '-SkipImport']);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /requires 5.5, selected engine is 5.8.1/);
    assert.doesNotMatch(result.stdout + result.stderr, /Build.bat not found|\[1\/4\]/);
  });
});
