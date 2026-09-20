// Rendering only: combat timing, geometry and rig fidelity never change by tier.
export function graphicsProfile({quality='auto',mobile=false,safe=false,degraded=false,width=1,height=1,dpr=1}={}){
 const tier=safe?'low':quality==='auto'?(degraded?'low':mobile?'medium':'high'):['low','medium','high'].includes(quality)?quality:'medium';
 const config={low:{ratio:.9,pixels:1000000,shadow:0},medium:{ratio:1.25,pixels:1800000,shadow:1024},high:{ratio:2,pixels:3200000,shadow:2048}}[tier];
 const pixelRatio=Math.min(safe?.75:config.ratio,Math.max(.1,dpr),Math.sqrt(config.pixels/Math.max(1,width*height)));
 return {tier,pixelRatio,shadowSize:config.shadow,maxPixels:config.pixels};
}
