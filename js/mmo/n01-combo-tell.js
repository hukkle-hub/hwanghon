// Read-only presentation of host-authored multi-hit points. No damage decision.
export function comboTell(action,elapsedMs){
 if(!Array.isArray(action?.strikes)||action.strikes.length<2||!Number.isFinite(elapsedMs))return null;
 const windup=Number.isFinite(action.windupMs)?action.windupMs:600;
 const point=action.strikes.find(p=>Number.isFinite(p.offsetMs)&&elapsedMs>=p.offsetMs-windup&&elapsedMs<=p.offsetMs+250);
 return point?{visible:true,remainingSeconds:(point.offsetMs-elapsedMs)/1000,durationSeconds:windup/1000}:{visible:false};
}
