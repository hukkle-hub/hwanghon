// Exact skinned sole support, including interleaved attributes. An ankle-bone
// height is not a sole height. QA and the final Kain pose use the same geometry.
import * as T from '../vendor/three/three.module.js';
export function prepareFootSurface(model){const surfaces=[];model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {position:p,skinIndex:si,skinWeight:sw}=mesh.geometry.attributes,ids={Left:[],Right:[]};for(let i=0;i<p.count;i++){let weight=-1,bone=0;for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>weight){weight=w;bone=si.getComponent(i,k);}}const name=mesh.skeleton.bones[bone].name,side=/Left(Foot|ToeBase)$/.test(name)?'Left':/Right(Foot|ToeBase)$/.test(name)?'Right':null;if(side)ids[side].push(i);}if(ids.Left.length||ids.Right.length)surfaces.push({mesh,ids});});return surfaces;}
export function footSurfaceNow(surfaces){const out={Left:Infinity,Right:Infinity},v=new T.Vector3();for(const{mesh,ids}of surfaces){
 // SkinnedMesh overrides updateMatrixWorld to refresh bindMatrixInverse.
 // updateWorldMatrix alone leaves it from the previous rendered frame: moving
 // the whole model then counts its translation twice and causes upward drift.
 mesh.updateMatrixWorld(true);mesh.skeleton.update();
 for(const side of ['Left','Right'])for(const i of ids[side]){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);out[side]=Math.min(out[side],v.y);}}return out;}
