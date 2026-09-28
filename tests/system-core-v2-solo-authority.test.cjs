const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const hasRaid=fs.existsSync('server/raid.cjs')&&fs.existsSync('server/content.cjs');
const Raid=hasRaid?require('../server/raid.cjs').Raid:null;
const Content=hasRaid?require('../server/content.cjs'):null;

(hasRaid?test:test.skip)('one-player authoritative Raid uses scale 1 and one independent character',()=>{
  const ids=Object.keys(Content.levels||{});
  const level=ids.includes('d01')?'d01':ids[0];
  assert.ok(level);
  const raid=new Raid(level,[{id:'solo',name:'SOLO',character:'ain'}]);
  assert.equal(raid.scale,1);
  assert.equal(raid.players.size,1);
  assert.equal(raid.players.get('solo').character,'ain');
  assert.ok(['explore','fight'].includes(raid.state));
});

test('integration changes server party start contract from 2+ to 1~4',()=>{
  const patch=fs.readFileSync('tools/ue/apply-system-core-v2-current.py','utf8');
  assert.match(patch,/members\.length<1/);
  assert.match(patch,/1명 이상이 연결되어 모두 준비해야 합니다/);
  assert.match(patch,/authoritative 1~4 player Raid start/);

  if(fs.existsSync('server/index.cjs')){
    const server=fs.readFileSync('server/index.cjs','utf8');
    assert.match(server,/members\.length<1/);
    assert.doesNotMatch(server,/members\.length<2/);
  }
});
