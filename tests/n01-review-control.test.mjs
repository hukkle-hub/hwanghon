import test from 'node:test';import assert from 'node:assert/strict';
import {reviewTarget,reviewStand,mountReviewControl} from '../js/mmo/n01-review-control.js';
test('QA cycles only existing living N01 mobs; no synthetic spawns',()=>{
 const ids=new Set(['G5_WALKER','G5_RUNNER']),a={id:'a',catalogId:'G5_WALKER',alive:true},b={id:'b',catalogId:'G5_RUNNER',alive:true};
 const mobs=new Map([['a',a],['b',b],['dead',{id:'dead',catalogId:'G5_RUNNER',alive:false}],['other',{id:'other',catalogId:'G5_ECHO',alive:true}]]);
 assert.equal(reviewTarget(mobs,ids),b);assert.equal(reviewTarget(mobs,ids,'b'),a);assert.equal(reviewTarget(mobs,ids,'a'),b);assert.equal(mobs.size,4);
 assert.equal(reviewTarget(new Map(),ids),null);
});
test('review stand must be terrain-legal AND traversable; blocked terrain fails',()=>{
 const m={x:0,z:0,group:{area:{id:'a'}}};
 assert.deepEqual(reviewStand(m,{legal:()=>true,canTraverse:()=>true}),{x:0,z:2});
 assert.equal(reviewStand(m,{legal:()=>false,canTraverse:()=>true}),null);
 assert.equal(reviewStand(m,{legal:()=>true,canTraverse:()=>false}),null);
 // Mutation control: skipping traversal would incorrectly accept this point.
 assert.throws(()=>assert.notEqual(reviewStand(m,{legal:()=>true,canTraverse:()=>false}),null));
});
test('QA navigation never mounts online or without explicit enablement',()=>{
 const document={createElement(){throw Error('must not touch UI')}};
 assert.equal(mountReviewControl({enabled:true,online:true,ecology:{},document}),null);
 assert.equal(mountReviewControl({enabled:false,online:false,ecology:{},document}),null);
 assert.equal(mountReviewControl({enabled:true,online:false,ecology:null,document}),null);
});
