import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {prepareFootSurface,footSurfaceNow} from '../js/skinned-sole.js';
test('skinned sole follows whole-model translations exactly once without render-time bind inverse drift',()=>{
 const root=new T.Group(),model=new T.Group();root.add(model);const bone=new T.Bone();bone.name='mixamorigLeftFoot';model.add(bone);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));g.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
 const mesh=new T.SkinnedMesh(g,new T.MeshBasicMaterial());model.add(mesh);mesh.bind(new T.Skeleton([bone]));root.updateMatrixWorld(true);const feet=prepareFootSurface(model);
 model.position.y=.1;model.updateWorldMatrix(true,true);mesh.skeleton.update();
 const stale=mesh.getVertexPosition(0,new T.Vector3()).applyMatrix4(mesh.matrixWorld).y;
 assert.ok(Math.abs(stale-.1)>.05,'negative control reproduces the old doubled translation');
 for(const y of [.1,.027,3,.001,0]){model.position.y=y;model.updateWorldMatrix(true,true);assert.ok(Math.abs(footSurfaceNow(feet).Left-y)<1e-6,'stale bind inverse at '+y);}
});
