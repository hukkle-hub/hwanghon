import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const g=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');

test('actionend는 즉시 idle로 돌아가지 않고 한 tick 이상 마지막 자세를 잡는다',()=>{
  assert.match(g,/var pendingContacts=\[\], actionReturn=null/);
  assert.match(g,/function deferActionReturn\(id\)/);
  assert.match(g,/\},20\);/);
  const end=g.match(/case 'actionend':[^]*?break;/)?.[0]||'';
  assert.match(end,/ain\.timed=null;deferActionReturn\(e\.id\)/);
  assert.ok(!end.includes("ain.act.reset().fadeIn"),'actionend에서 즉시 base fadeIn 금지');
});

test('같은 tick의 다음 actionstart는 예약된 base 복귀를 취소한다',()=>{
  const start=g.match(/case 'actionstart':[^]*?break;/)?.[0]||'';
  assert.match(start,/actionReturn\.cancelled=true/);
  assert.match(start,/playOnce\(e\.clip\)/);
});

test('다음 공격이 없을 때만 0.12초로 base 자세에 복귀한다',()=>{
  const i=g.indexOf('function deferActionReturn(id)');
  const block=g.slice(i,i+850);
  assert.match(block,/if\(ain\.timed \|\| !ain\.oneshot\) return/);
  assert.match(block,/ain\.oneshot\.fadeOut\(0\.12\)/);
  assert.match(block,/ain\.act\.reset\(\); ain\.act\.fadeIn\(0\.12\); ain\.act\.play\(\)/);
});

test('취소는 콤보 이음매가 아니라 즉시 복귀 — 방어/회피 반응 지연 금지',()=>{
  const cancel=g.match(/case 'actioncancel':[^]*?break;/)?.[0]||'';
  assert.match(cancel,/actionReturn\.cancelled=true/);
  assert.match(cancel,/fadeOut\(0\.06\)/);
  assert.match(cancel,/fadeIn\(0\.08\)/);
});
