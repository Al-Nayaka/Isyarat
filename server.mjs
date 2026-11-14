import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.map':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.wasm':'application/wasm', '.task':'application/octet-stream', '.tflite':'application/octet-stream', '.ndjson':'application/x-ndjson', '.webmanifest':'application/manifest+json' };
const requested = Number(process.env.PORT || 5500);
function makeServer(port){
  const server=http.createServer((req,res)=>{
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400); res.end('Bad request'); return;}
    const target=path.resolve(root, '.'+pathname, pathname.endsWith('/')?'index.html':'');
    if(!(target===root || target.startsWith(root+path.sep))){res.writeHead(403);res.end('Forbidden');return;}
    let file=target;
    if (file===root) file=path.join(root,'index.html');
    fs.stat(file,(err,stat)=>{
      if(err||!stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('404: File tidak ditemukan');return;}
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      fs.createReadStream(file).pipe(res);
    });
  });
  server.on('error',err=>{
    if(err.code==='EADDRINUSE')return makeServer(port+1);
    console.error(err); process.exitCode=1;
  });
  server.listen(port,'0.0.0.0',()=>{
    const ips=Object.values(os.networkInterfaces()).flat().filter(item=>item&&item.family==='IPv4'&&!item.internal).map(item=>item.address);
    console.log(`\nIsyarat Frontend A siap: http://localhost:${port}\nSimulasi UI: http://localhost:${port}/?mock=1`);
    if(ips.length){console.log('\nBuka dari HP (Wi-Fi sama):');for(const ip of [...new Set(ips)])console.log(`  http://${ip}:${port}`);}
    else console.log('\nAlamat HP belum terdeteksi; jalankan ipconfig untuk melihat IPv4 Wi-Fi.');
    console.log('PENTING: URL IP Wi-Fi HTTP = uji TAMPILAN saja; akses kamera HP membutuhkan localhost HP (USB port forwarding) atau HTTPS tepercaya.');
    console.log(`Untuk kamera HP lewat USB, buka http://localhost:${port} pada Chrome HP setelah port forwarding. Baca PANDUAN-KAMERA-HP.md.`);
    console.log('Tekan Ctrl+C untuk menghentikan server.\n');
  });
}
makeServer(requested);
