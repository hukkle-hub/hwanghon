import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {prepareArmSurface,armSurfaceNow} from '../tools/3d/arm-surface-audit.mjs';

test('arm surface audit includes chest-to-arm boundary and detects unilateral collapse',()=>{
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0, 3,0,0,4,0,0,3,1,0],3));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,0,0,0,1,0,0,0,1,0,0,0, 2,0,0,0,2,0,0,0,2,0,0,0],4));
 g.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0,1,0,0,0],4));
 const bones=['RightArm','Spine2','LeftArm'].map(name=>{const b=new T.Bone();b.name=name;return b;});
 const m=new T.SkinnedMesh(g,new T.MeshBasicMaterial());for(const b of bones)m.add(b);m.bind(new T.Skeleton(bones));
 const right=prepareArmSurface(m,{side:'Right',boundary:true}),left=prepareArmSurface(m,{side:'Left',boundary:true});
 assert.equal(right[0].triangles.length,1,'one arm-weighted vertex must include the shoulder seam');
 assert.equal(armSurfaceNow(right).collapsedFraction,0);
 bones[0].position.set(0,1,0);m.updateMatrixWorld(true);
 assert.equal(armSurfaceNow(right).collapsedFraction,1,'right shoulder triangle folds to a line');
 assert.equal(armSurfaceNow(left).collapsedFraction,0,'healthy other arm must not dilute the bad side');
});
