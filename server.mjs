import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFile} from 'node:child_process';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url))),port=Number(process.env.WILDWOOD_PORT)||4173;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.woff2':'font/woff2'};
const openBrowser=()=>{if(process.argv.includes('--open')&&process.platform==='win32')execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process -FilePath 'http://localhost:${port}'`],{windowsHide:true},error=>{if(error)console.log(`Open http://localhost:${port} in Edge or Chrome.`);});};
try{await stat(path.join(root,'index.html'));}catch{console.error('Build the game first: npm run build');process.exit(1);}
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(pathname==='/__wildwood'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'wildwood',version:'1.0.0'}));return;}
    if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',async error=>{if(error.code==='EADDRINUSE'){try{const running=await fetch(`http://127.0.0.1:${port}/__wildwood`,{signal:AbortSignal.timeout(2000)});if((await running.json()).app==='wildwood'){console.log(`Wildwood is already running at http://localhost:${port}`);openBrowser();return;}}catch{}console.error(`Port ${port} is already in use. Close the other application or set WILDWOOD_PORT to another port.`);}else console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{console.log(`Wildwood is ready: http://localhost:${port}\nKeep this window open while playing. Press Ctrl+C to stop.`);openBrowser();});
