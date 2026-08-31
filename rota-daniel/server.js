import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','geolocation=(self), microphone=(), camera=()');
  next();
});
app.use(express.static(path.join(__dirname,'dist'), { maxAge: '1h' }));
app.get('/health',(req,res)=>res.json({ok:true,service:'Rota Daniel',time:new Date().toISOString()}));
app.use((req,res)=>res.sendFile(path.join(__dirname,'dist','index.html')));

const server=createServer(app);
const wss=new WebSocketServer({server,path:'/ws'});
const rooms=new Map();
const getRoom=id=>{if(!rooms.has(id))rooms.set(id,{clients:new Set(),state:null,messages:[],gps:null,status:'planejando'});return rooms.get(id)};
const broadcast=(room,payload,except=null)=>{const data=JSON.stringify(payload);for(const c of room.clients){if(c!==except&&c.readyState===WebSocket.OPEN)c.send(data)}};
const presence=room=>broadcast(room,{type:'presence',count:room.clients.size});

wss.on('connection',(ws,req)=>{
  const u=new URL(req.url,'http://localhost');
  const roomId=(u.searchParams.get('room')||'geral').slice(0,80);
  const name=(u.searchParams.get('name')||'Passageiro').slice(0,40);
  const room=getRoom(roomId); ws.roomId=roomId;ws.name=name;room.clients.add(ws);
  ws.send(JSON.stringify({type:'snapshot',state:room.state,messages:room.messages.slice(-100),gps:room.gps,status:room.status,count:room.clients.size}));
  broadcast(room,{type:'system',text:`${name} entrou na viagem.`,at:Date.now()},ws); presence(room);
  ws.on('message',raw=>{
    try{
      const m=JSON.parse(raw.toString());
      if(m.type==='message'){
        const msg={id:String(m.id||Date.now()),name:String(m.name||name).slice(0,40),text:String(m.text||'').slice(0,1000),at:Date.now()};
        if(msg.text){room.messages.push(msg);room.messages=room.messages.slice(-100);broadcast(room,{type:'message',message:msg});}
      }
      if(m.type==='gps'&&Number.isFinite(m.lat)&&Number.isFinite(m.lon)){
        room.gps={lat:m.lat,lon:m.lon,accuracy:m.accuracy||null,speed:m.speed||null,heading:m.heading||null,at:Date.now(),name};
        broadcast(room,{type:'gps',gps:room.gps});
      }
      if(m.type==='state'&&m.state){room.state=m.state;broadcast(room,{type:'state',state:room.state},ws);}
      if(m.type==='status') {room.status=String(m.status||'planejando').slice(0,40);broadcast(room,{type:'status',status:room.status});}
      if(m.type==='ping') ws.send(JSON.stringify({type:'pong',at:Date.now()}));
    }catch{}
  });
  ws.on('close',()=>{room.clients.delete(ws);broadcast(room,{type:'system',text:`${name} saiu da viagem.`,at:Date.now()});presence(room);if(room.clients.size===0)setTimeout(()=>{if(room.clients.size===0)rooms.delete(roomId)},1000*60*60*3)});
});

const port=process.env.PORT||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Rota Daniel online na porta ${port}`));
