// Local QA artifact receiver, never part of the production service. Only the
// visible Save button's generated canvas recording is accepted.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(process.argv[2]||'../../output/ain-fullbody-skills-2026-10-10');
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:8796');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 const match=/^\/capture\/((?:ain|kain)-(?:fullbody|details|mobile|dungeon|field)-skills\.webm)$/.exec(req.url);
 if(req.method!=='POST'||!match){res.writeHead(404).end();return;}
 const chunks=[];let size=0;try{for await(const c of req){size+=c.length;if(size>200e6)throw Error('Recording too large');chunks.push(c);}await fs.mkdir(root,{recursive:true});await fs.writeFile(path.join(root,match[1]),Buffer.concat(chunks));res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({saved:match[1],bytes:size}));console.log(match[1],size);}catch(e){res.writeHead(400).end(e.message);}
}).listen(8797,'127.0.0.1',()=>console.log('Local generated-video receiver on 8797; output',root));
