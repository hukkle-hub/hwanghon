/* State deltas over an ordered reliable WebSocket. Full snapshots recover skipped sends. */
(function(){
 const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
 function diff(before,after){
  if(Object.is(before,after))return undefined;
  if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){const patch={$array:true};for(let i=0;i<after.length;i++){const d=diff(before[i],after[i]);if(d!==undefined)patch[i]=d;}return Object.keys(patch).length>1?patch:undefined;}
  if(plain(before)&&plain(after)){const patch={};for(const key of Object.keys(after)){const d=diff(before[key],after[key]);if(d!==undefined)patch[key]=d;}const removed=Object.keys(before).filter(key=>!Object.hasOwn(after,key));if(removed.length)patch.$unset=removed;return Object.keys(patch).length?patch:undefined;}
  return after;
 }
 function apply(before,patch){
  if(patch===undefined)return before;
  if(plain(patch)&&patch.$array===true){const out=Array.isArray(before)?before.slice():[];for(const key of Object.keys(patch))if(key!=='$array')out[Number(key)]=apply(out[Number(key)],patch[key]);return out;}
  if(plain(patch)){const out=plain(before)?{...before}:{};for(const key of patch.$unset||[])delete out[key];for(const key of Object.keys(patch))if(key!=='$unset'&&!['__proto__','constructor','prototype'].includes(key))out[key]=apply(out[key],patch[key]);return out;}
  return patch;
 }
 const api={diff,apply};if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.TW_PARTY_WIRE=api;
})();
