const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const files={'/':'index.html','/index.html':'index.html','/app.css':'app.css','/app.js':'app.js','/core.js':'core.js','/ChatNote-demo.html':'ChatNote-demo.html','/CodexAnnotation-demo.html':'CodexAnnotation-demo.html','/recording.html':'recording.html'};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer((req,res)=>{let url;try{url=new URL(req.url,'http://127.0.0.1');}catch{res.writeHead(400);res.end();return;}
  const name=files[url.pathname];if(!name){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname,name),(error,data)=>{if(error){res.writeHead(500);res.end('Read error');return;}res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
});
server.listen(4173,'127.0.0.1',()=>process.stdout.write('Prototype ready: http://127.0.0.1:4173\n'));
server.on('error',error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
