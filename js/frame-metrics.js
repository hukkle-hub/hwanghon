// rAF intervals, not GPU timings or touch latency. Never identifies a phone by guess.
export function createFrameMetrics({warmup=120,windowMs=60000}={}) {
 const bins=new Uint32Array(1001),windows=[];
 let skipped=0,count=0,total=0,max=0,slow=0,windowTotal=0,windowCount=0,skipNext=true;
 function add(ms,active=true){
  if(!active){skipNext=true;return;}
  if(!Number.isFinite(ms)||ms<=0)return;
  if(skipNext){skipNext=false;return;}
  if(skipped<warmup){skipped++;return;}
  count++;total+=ms;max=Math.max(max,ms);if(ms>50)slow++;
  bins[Math.min(1000,Math.round(ms))]++;
  windowTotal+=ms;windowCount++;
  if(windowTotal>=windowMs){
   windows.push({seconds:Math.round(total/1000),fps:Math.round(10000*windowCount/windowTotal)/10});
   if(windows.length>30)windows.shift();windowTotal=0;windowCount=0;
  }
 }
 function percentile(p){if(!count)return null;const n=Math.ceil(count*p);let seen=0;for(let i=0;i<bins.length;i++){seen+=bins[i];if(seen>=n)return i;}return 1000;}
 function report(){return {samples:count,warmupRemaining:Math.max(0,warmup-skipped),
  activeSeconds:Math.round(total/100)/10,fps:count?Math.round(10000*count/total)/10:null,
  p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:Math.round(max*10)/10,
  over50ms:slow,windows:windows.map(w=>({...w})),note:'rAF interval; percentiles rounded to 1ms and capped at 1000ms; not GPU or input latency'};}
 return {add,report};
}
