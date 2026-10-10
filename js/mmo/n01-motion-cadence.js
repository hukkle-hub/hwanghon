// Measured support-foot backward velocity in native GLB m/s. Jog is stride
// warped (0.5 forward travel, 0.25 pelvis bounce), not played in slow motion.
// Presentation only; never changes authoritative movement/damage.
const NATIVE_MPS=Object.freeze({walk:0.9853266924619675,jog:2.8743157535791395});
const RUNNER_MPS=Object.freeze({walk:1.0245833319786346,run:5.282531773583857});
function cadence(table,clip,worldSpeed,modelScale){
 if(!Object.hasOwn(table,clip)||!Number.isFinite(worldSpeed)||worldSpeed<0||!Number.isFinite(modelScale)||modelScale<=0)return 1;
 return Math.max(.25,Math.min(2.3,worldSpeed/(table[clip]*modelScale)));
}
export function walkerCadence(clip,worldSpeed,modelScale=1){return cadence(NATIVE_MPS,clip,worldSpeed,modelScale);}
export function runnerCadence(clip,worldSpeed,modelScale=1){return cadence(RUNNER_MPS,clip,worldSpeed,modelScale);}
