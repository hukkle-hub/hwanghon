import test from 'node:test';import assert from 'node:assert/strict';
import {graphicsProfile as profile} from '../js/graphics-profile.js';
test('graphics tiers respect pixel budgets across portrait, landscape and high DPI',()=>{
 for(const [width,height] of [[360,800],[800,360],[1440,3120],[3840,2160]])for(const quality of ['low','medium','high','auto']){
  const p=profile({width,height,dpr:3,quality,mobile:true});assert.ok(width*height*p.pixelRatio**2<=p.maxPixels+1);assert.ok(p.pixelRatio<=3);
 }
 assert.equal(profile({quality:'high',degraded:true}).tier,'high');
 assert.equal(profile({quality:'auto',degraded:true}).tier,'low');
 assert.equal(profile({quality:'high',safe:true}).shadowSize,0);
 assert.ok(profile({quality:'high'}).shadowSize>profile({quality:'low'}).shadowSize);
});
