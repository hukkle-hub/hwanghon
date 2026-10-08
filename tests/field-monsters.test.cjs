/* 필드 몬스터 표 (docs/design/204) — 등급·외형 기준·자리가 실제 지도와 어긋나지 않는지.
   1·2급은 필드 전용, 거점 웨이브는 5급(문서 203) — 둘이 겹치면 안 된다. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { FIELD_MONSTERS, FIELD_GRADES } = require('../server/field-monsters.cjs');
const C = require('../tools/ue/node-combat-rules.cjs');
const ROOT = path.join(__dirname, '..');
const map = zone => JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', '2d', zone, 'map.json'), 'utf8'));
test('필드 몬스터: 1·2급 두 개체 — 필드 등급, 웨이브(5급)와 안 겹침, 승인 시트가 있다', () => {
  const list = Object.values(FIELD_MONSTERS);
  assert.deepEqual(list.map(m => m.grade).sort(), [1, 2]);
  assert.ok(!FIELD_GRADES.includes(C.THREAT_GRADE), '거점 웨이브 등급이 필드 등급과 겹친다');
  for (const [id, m] of Object.entries(FIELD_MONSTERS)) {
    assert.ok(FIELD_GRADES.includes(m.grade), id + ' 등급 ' + m.grade);
    assert.ok(fs.existsSync(path.join(ROOT, m.ref)) && fs.statSync(path.join(ROOT, m.ref)).size > 100000, id + ' 승인 시트가 없다: ' + m.ref);
  }
});
test('필드 몬스터: 자리는 실제 사냥터(안전 지대 아님)이고 레벨대가 그 사냥터와 겹친다', () => {
  for (const [id, m] of Object.entries(FIELD_MONSTERS)) {
    assert.ok(m.zones.length > 0, id + ' 자리가 없다');
    for (const [zone, area] of m.zones) {
      const a = (map(zone).areas || []).find(x => x.id === area && x.kind === 'hunt');
      assert.ok(a, id + ': ' + zone + '/' + area + ' 는 사냥터가 아니다');
      assert.ok(m.lv[0] <= a.lv[1] && a.lv[0] <= m.lv[1], id + ' 레벨 ' + m.lv + ' ↔ ' + zone + '/' + area + ' ' + a.lv);
    }
  }
});
