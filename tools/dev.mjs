import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bowlingRoot='/Users/jurek/Downloads/Claude/Projects/Gzowo Bowling/v1.9';
const bowlingHost='127.0.0.1';
const bowlingPort=8099;
const bowlingUrl=`http://${bowlingHost}:${bowlingPort}/`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};

if(!fs.existsSync(path.join(bowlingRoot,'index.html')))throw new Error(`Bowling v1.9 not found at ${bowlingRoot}`);

const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://local').pathname);
  const requested=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  const target=path.resolve(bowlingRoot,requested);
  if(!target.startsWith(`${path.resolve(bowlingRoot)}${path.sep}`)&&target!==path.resolve(bowlingRoot,'index.html')){response.writeHead(403);response.end('Forbidden');return;}
  fs.stat(target,(error,stats)=>{
    const file=!error&&stats.isDirectory()?path.join(target,'index.html'):target;
    fs.stat(file,(fileError,fileStats)=>{
      if(fileError||!fileStats.isFile()){response.writeHead(404);response.end('Not found');return;}
      response.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','Cross-Origin-Resource-Policy':'cross-origin'});
      if(request.method==='HEAD'){response.end();return;}
      fs.createReadStream(file).pipe(response);
    });
  });
});

await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(bowlingPort,bowlingHost,resolve);});
console.log(`Bowling v1.9: ${bowlingUrl}`);
const viteBin=path.join(projectRoot,'node_modules','vite','bin','vite.js');
const vite=spawn(process.execPath,[viteBin,'--host','127.0.0.1'],{cwd:projectRoot,env:{...process.env,VITE_BOWLING_URL:bowlingUrl},stdio:'inherit'});
let closing=false;
function shutdown(code=0){if(closing)return;closing=true;vite.kill('SIGTERM');server.close(()=>process.exit(code));setTimeout(()=>process.exit(code),1500).unref();}
process.on('SIGINT',()=>shutdown(0));
process.on('SIGTERM',()=>shutdown(0));
vite.on('exit',(code,signal)=>{if(!closing)shutdown(signal?1:(code??0));});
vite.on('error',error=>{console.error(error);shutdown(1);});
