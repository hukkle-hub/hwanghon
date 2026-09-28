// Clean UI v1: ui_theme.json and UHWUIThemeLibrary must carry the same tokens (docs/design/123 §9, 126).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const CPP = 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/UI/HWUIThemeLibrary.cpp';
const JSON_PATH = 'ue/HwanghonCombatUE/Content/Data/ui_theme.json';

const cpp = fs.readFileSync(CPP, 'utf8');
const theme = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const hex = (n) => n.toString(16).toUpperCase().padStart(2, '0');

function cppColors() {
  const out = {};
  const re = /EHWUIColorToken::(\w+):\s*return FLinearColor\(FColor\(0x([0-9A-F]{2}),\s*0x([0-9A-F]{2}),\s*0x([0-9A-F]{2}),\s*0x([0-9A-F]{2})\)\)/gi;
  for (const m of cpp.matchAll(re)) out[m[1]] = `#${m[2]}${m[3]}${m[4]}${m[5]}`.toUpperCase();
  return out;
}

function cppNumbers(enumName) {
  const out = {};
  const re = new RegExp(`${enumName}::(\\w+):\\s*return ([0-9.]+)f?;`, 'g');
  for (const m of cpp.matchAll(re)) out[m[1]] = Number(m[2]);
  return out;
}

test('every theme color is in C++ with the same sRGB hex and alpha', () => {
  const colors = cppColors();
  for (const [name, value] of Object.entries(theme.colors)) {
    const want = (value.length === 7 ? `${value}FF` : value).toUpperCase();
    assert.equal(colors[name], want, `${name}: C++ ${colors[name]} vs JSON ${want}`);
  }
  assert.equal(Object.keys(colors).length, Object.keys(theme.colors).length);
});

test('colors go through FColor (sRGB -> linear), never hex/255 into FLinearColor', () => {
  // FLinearColor(0.816f, ...) would render every token lighter in UMG (CLAUDE.md §2, docs/design/25 §4).
  assert.doesNotMatch(cpp, /return FLinearColor\(\s*0\.\d+f/);
  assert.match(cpp, /FLinearColor\(FColor\(/);
  assert.equal(hex(0xd0), 'D0');
});

test('layout metrics and type sizes match ui_theme.json', () => {
  assert.deepEqual(cppNumbers('EHWUIMetricToken'), theme.layout1080p);
  assert.deepEqual(cppNumbers('EHWUITextToken'), theme.typography1080p);
});
