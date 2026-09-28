import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('clean UI theme exposes stable Hwanghon tokens',()=>{
  const h=fs.readFileSync('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/UI/HWUIThemeLibrary.h','utf8');
  for(const x of ['PanelStrong','OverlayDim','Gold','Danger','BottomNavHeight','DrawerWidth','PrimaryCTA','PageTitle'])
    assert.match(h,new RegExp(x));
});

test('ui theme JSON matches uploaded-video reference resolution',()=>{
  const j=JSON.parse(fs.readFileSync('ue/HwanghonCombatUE/Content/Data/ui_theme.json','utf8'));
  assert.equal(j.referenceResolution.width,2340);
  assert.equal(j.referenceResolution.height,1080);
  assert.equal(j.layout1080p.DrawerWidth,820);
  assert.equal(j.layout1080p.BottomNavHeight,88);
  assert.equal(j.colors.Gold,'#D0AE5A');
});

test('design spec keeps center open and uses drawer/modal grammar',()=>{
  const s=fs.readFileSync('docs/design/123-clean-mobile-ui-v1.md','utf8');
  assert.match(s,/중앙.*비워/);
  assert.match(s,/Right Drawer/);
  assert.match(s,/Modal/);
  assert.match(s,/빨강.*일반 메뉴/);
});
