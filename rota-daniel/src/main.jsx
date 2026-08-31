import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';import L from'leaflet';import'leaflet/dist/leaflet.css';import'./style.css';

const uid=()=>Math.random().toString(36).slice(2,10);
const city=', Ponta Grossa - PR, Brasil';
const defaults=[
 {id:'luciane',name:'Luciane',label:'Partida • Luciane',address:'Rua Orlando Marcondes'+city,type:'start'},
 {id:'daniel',name:'Daniel',label:'Buscar Daniel',address:'Rua Tobias Moscoso, 38'+city,type:'stop'},
 {id:'evelyn',name:'Evelyn',label:'Buscar Evelyn',address:'Rua Abatia, 140'+city,type:'stop'},
 {id:'empresa',name:'Empresa',label:'Odonto Excellence São Francisco',address:'Rua Eusébio de Queirós, Odonto Excellence São Francisco'+city,type:'end'}
];
const jokes=[
 'Cintos colocados? O transporte VIP mais exclusivo de Ponta Grossa vai sair 😎',
 'Rota recalculada. Até o GPS ficou impressionado com a organização 😂',
 'Passageiro a bordo! Agora só falta escolher quem paga o café ☕',
 'GPS ligado. Big Brother versão carona ativado — com consentimento, claro 😅',
 'Todo mundo online. Se alguém sumir, a gente culpa o sinal 📡',
 'Partiu trabalho! Alegria limitada, pontualidade ilimitada 😂'
];
const speak=text=>{if(!('speechSynthesis'in window))return; speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=1.02;speechSynthesis.speak(u)};
const notify=(title,body)=>{if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body});if(navigator.vibrate)navigator.vibrate([90,50,90]);};
const fmtTime=s=>s?`${Math.round(s/60)} min`:'—';
const fmtKm=m=>m?`${(m/1000).toFixed(1)} km`:'—';

function App(){
 const params=new URLSearchParams(location.search); const initialRoom=params.get('sala')||'trabalho-daniel';
 const [room]=useState(initialRoom),[name,setName]=useState(()=>localStorage.getItem('rota-name')||'Daniel'),[stops,setStops]=useState(defaults),[direction,setDirection]=useState('ida'),[route,setRoute]=useState(null),[busy,setBusy]=useState(false),[online,setOnline]=useState(1),[gps,setGps]=useState(null),[gpsOn,setGpsOn]=useState(false),[voice,setVoice]=useState(false),[status,setStatus]=useState('planejando'),[tab,setTab]=useState('rota'),[messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[toast,setToast]=useState(''),[optimized,setOptimized]=useState(false),[lastSpoken,setLastSpoken]=useState('');
 const mapRef=useRef(),routeLayer=useRef(),gpsMarker=useRef(),wsRef=useRef(),watchRef=useRef(),msgEnd=useRef();
 const activeStops=useMemo(()=>direction==='ida'?stops:[...stops].reverse().map((x,i,a)=>({...x,label:i===0?'Partida • Empresa':i===a.length-1?'Final • Luciane':`Retorno • ${x.name}`})),[stops,direction]);
 const flash=t=>{setToast(t);setTimeout(()=>setToast(''),3500)};
 const event=(text,fun=true)=>{const body=fun?`${text} ${jokes[Math.floor(Math.random()*jokes.length)]}`:text;flash(body);notify('Rota Daniel',body);if(voice)speak(body)};
 const sendWS=data=>{if(wsRef.current?.readyState===1)wsRef.current.send(JSON.stringify(data))};

 useEffect(()=>{history.replaceState(null,'',`?sala=${room}`);if(!mapRef.current){mapRef.current=L.map('map',{zoomControl:false,attributionControl:true}).setView([-25.095,-50.161],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(mapRef.current);L.control.zoom({position:'bottomright'}).addTo(mapRef.current)}},[]);
 useEffect(()=>{localStorage.setItem('rota-name',name);const proto=location.protocol==='https:'?'wss':'ws';const ws=new WebSocket(`${proto}://${location.host}/ws?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}`);wsRef.current=ws;ws.onopen=()=>flash('Conectado à sala em tempo real ✓');ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='snapshot'){setOnline(d.count||1);setMessages(d.messages||[]);setGps(d.gps||null);setStatus(d.status||'planejando');if(d.state?.stops)setStops(d.state.stops);}
  if(d.type==='presence'){setOnline(d.count);if(d.count>1)event(`${d.count} pessoas estão conectadas.`,false)}
  if(d.type==='message'){setMessages(m=>m.some(x=>x.id===d.message.id)?m:[...m,d.message]);if(d.message.name!==name)event(`${d.message.name}: ${d.message.text}`,false)}
  if(d.type==='gps')setGps(d.gps); if(d.type==='state'&&d.state?.stops)setStops(d.state.stops); if(d.type==='status')setStatus(d.status); if(d.type==='system')flash(d.text);
 };ws.onclose=()=>flash('Conexão em tempo real interrompida. Recarregue para reconectar.');return()=>ws.close()},[room,name]);
 useEffect(()=>{msgEnd.current?.scrollIntoView({behavior:'smooth'})},[messages,tab]);
 useEffect(()=>{if(gps&&mapRef.current){const ll=[gps.lat,gps.lon];if(gpsMarker.current)gpsMarker.current.setLatLng(ll);else gpsMarker.current=L.marker(ll,{icon:L.divIcon({className:'carPin',html:'🚗',iconSize:[42,42],iconAnchor:[21,21]})}).addTo(mapRef.current).bindTooltip('Motorista • ao vivo');}},[gps]);
 useEffect(()=>{if(!voice||!route||!gps)return;const steps=route.legs.flatMap(l=>l.steps||[]).filter(s=>s.maneuver?.location);let best=null;for(const s of steps){const [lon,lat]=s.maneuver.location;const d=mapRef.current.distance([gps.lat,gps.lon],[lat,lon]);if(!best||d<best.d)best={s,d};}if(best&&best.d<180){const instruction=instructionPt(best.s,best.d);if(instruction&&instruction!==lastSpoken){setLastSpoken(instruction);speak(instruction)}}},[gps,voice,route,lastSpoken]);

 const geocode=async address=>{const q=address.includes('Ponta Grossa')?address:`${address}${city}`;const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(q)}`,{headers:{'Accept-Language':'pt-BR'}});const j=await r.json();if(!j[0])throw new Error(`Não encontrei: ${address}`);return{lat:+j[0].lat,lon:+j[0].lon,display:j[0].display_name};};
 const instructionPt=(s,d)=>{const type=s.maneuver?.type,mod=s.maneuver?.modifier;let dir='siga em frente';if(type==='turn'){dir=mod?.includes('left')?'vire à esquerda':mod?.includes('right')?'vire à direita':'faça a conversão';}if(type==='roundabout')dir='entre na rotatória';if(type==='arrive')dir='você chegou ao destino';return d>35?`Em ${Math.round(d/10)*10} metros, ${dir}.`:`Agora, ${dir}.`;};
 const calculate=async(opt=true)=>{try{setBusy(true);let resolved=[];for(const s of activeStops)resolved.push({...s,...await geocode(s.address)});let data;
   if(opt&&resolved.length>3){const coords=resolved.map(s=>`${s.lon},${s.lat}`).join(';');const r=await fetch(`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=true`);data=await r.json();if(data.code!=='Ok')throw new Error('Não consegui otimizar a rota.');const order=data.waypoints.map((w,i)=>({i,order:w.waypoint_index})).sort((a,b)=>a.order-b.order).map(x=>resolved[x.i]);resolved=order;setOptimized(true);draw(data.trips[0],resolved);setRoute(data.trips[0]);}
   else{const coords=resolved.map(s=>`${s.lon},${s.lat}`).join(';');const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`);data=await r.json();if(data.code!=='Ok')throw new Error('Não consegui calcular a rota.');setOptimized(false);draw(data.routes[0],resolved);setRoute(data.routes[0]);}
   const chosen=data.trips?.[0]||data.routes?.[0];event(`Rota ${direction==='ida'?'de ida':'de volta'} calculada: ${fmtKm(chosen.distance)}, ${fmtTime(chosen.duration)}.`);sendWS({type:'state',state:{stops,direction}});
  }catch(e){flash(e.message)}finally{setBusy(false)}};
 const draw=(r,rs)=>{routeLayer.current?.remove();const g=L.layerGroup().addTo(mapRef.current);L.geoJSON(r.geometry,{style:{weight:7,opacity:.95,color:'#1877f2'}}).addTo(g);rs.forEach((s,i)=>L.marker([s.lat,s.lon],{icon:L.divIcon({className:'routePin',html:`<span>${i+1}</span>`,iconSize:[34,34],iconAnchor:[17,17]})}).addTo(g).bindPopup(`<b>${s.label}</b><br>${s.display||s.address}`));routeLayer.current=g;mapRef.current.fitBounds(L.geoJSON(r.geometry).getBounds(),{padding:[45,45]});};
 const swap=(i,j)=>{if(j<0||j>=stops.length)return;const n=[...stops];[n[i],n[j]]=[n[j],n[i]];setStops(n);sendWS({type:'state',state:{stops:n,direction}})};
 const add=()=>setStops(s=>[...s.slice(0,-1),{id:uid(),name:'Nova parada',label:'Nova parada',address:'',type:'stop'},s.at(-1)]);
 const del=id=>setStops(s=>s.filter(x=>x.id!==id));
 const startGPS=async()=>{if(!navigator.geolocation)return flash('Seu navegador não oferece GPS.');if('Notification'in window&&Notification.permission==='default')await Notification.requestPermission();if(gpsOn){navigator.geolocation.clearWatch(watchRef.current);setGpsOn(false);event('Compartilhamento de GPS pausado.',false);return;}watchRef.current=navigator.geolocation.watchPosition(p=>{const g={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed,heading:p.coords.heading};setGps(g);sendWS({type:'gps',...g})},e=>flash(`GPS: ${e.message}`),{enableHighAccuracy:true,maximumAge:1000,timeout:15000});setGpsOn(true);event('GPS ao vivo ativado.');};
 const share=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:'Rota Daniel',text:'Acompanhe nossa rota e fale no chat ao vivo 🚗',url});else{await navigator.clipboard.writeText(url);flash('Link copiado!')}}catch{}};
 const send=()=>{if(!draft.trim())return;const m={id:uid(),name,text:draft.trim()};sendWS({type:'message',...m});setMessages(x=>[...x,{...m,at:Date.now()}]);setDraft('')};
 const tripStatus=next=>{setStatus(next);sendWS({type:'status',status:next});const txt=next==='em_rota'?'Viagem iniciada! Partiu buscar a tropa.':next==='concluida'?'Viagem concluída. Missão trabalho cumprida!':'Viagem pausada.';event(txt)};
 const toggleDirection=()=>{setDirection(d=>d==='ida'?'volta':'ida');setRoute(null);routeLayer.current?.remove();setOptimized(false)};
 const enableVoice=()=>{setVoice(v=>!v);if(!voice)speak('Voz do Rota Daniel ativada. Prometo não discutir com a motorista.');};
 const accuracy=gps?.accuracy?`±${Math.round(gps.accuracy)} m`:'—';
 return <div className="shell">
  {toast&&<div className="toast">{toast}</div>}
  <header><div className="brand"><div className="mark">R</div><div><b>Rota Daniel</b><small>Sistema Rotas • desenvolvido por Daniel</small></div></div><button className="online">● {online} online</button></header>
  <main>
   <section className="mapArea"><div id="map"></div><div className="tripCard"><div><small>{direction==='ida'?'IDA • TRABALHO':'VOLTA • CASA'}</small><strong>{route?fmtTime(route.duration):'Pronto para calcular'}</strong><span>{route?fmtKm(route.distance):'Ponta Grossa • PR'} {optimized?'• rota otimizada':''}</span></div><button onClick={toggleDirection}>⇄ {direction==='ida'?'Volta':'Ida'}</button></div><button className="locate" onClick={()=>gps&&mapRef.current.setView([gps.lat,gps.lon],17)}>◎</button></section>
   <section className="sheet">
    <div className="navtabs"><button className={tab==='rota'?'active':''} onClick={()=>setTab('rota')}>Rota</button><button className={tab==='chat'?'active':''} onClick={()=>setTab('chat')}>Chat <i>{messages.length}</i></button><button className={tab==='ao-vivo'?'active':''} onClick={()=>setTab('ao-vivo')}>Ao vivo</button></div>
    {tab==='rota'&&<div className="panel"><div className="hero"><div><h1>{direction==='ida'?'Bom trabalho! 👋':'Bora pra casa! 🏠'}</h1><p>Edite, mova ou adicione paradas. O sistema pode escolher a melhor ordem entre os passageiros.</p></div><button className="shareBtn" onClick={share}>↗</button></div>
      <div className="stops">{stops.map((s,i)=><div className="stop" key={s.id}><div className={`dot ${s.type}`}>{i+1}</div><div className="stopBody"><div className="stopTop"><input className="nameInput" value={s.label} onChange={e=>setStops(a=>a.map(x=>x.id===s.id?{...x,label:e.target.value,name:e.target.value}:x))}/><div className="moves"><button onClick={()=>swap(i,i-1)}>↑</button><button onClick={()=>swap(i,i+1)}>↓</button>{s.type==='stop'&&<button onClick={()=>del(s.id)}>×</button>}</div></div><input className="address" value={s.address} onChange={e=>setStops(a=>a.map(x=>x.id===s.id?{...x,address:e.target.value}:x))}/></div></div>)}</div>
      <button className="ghost" onClick={add}>＋ Adicionar outra parada</button><div className="actions"><button className="primary" disabled={busy} onClick={()=>calculate(true)}>{busy?'Calculando…':'✨ Calcular melhor rota'}</button><button className="secondary" disabled={busy} onClick={()=>calculate(false)}>Manter esta ordem</button></div>
      <div className="quick"><button onClick={startGPS} className={gpsOn?'on':''}>📍 {gpsOn?'GPS ao vivo ON':'Compartilhar GPS'}</button><button onClick={enableVoice} className={voice?'on':''}>🔊 {voice?'Voz ON':'Ativar voz'}</button><button onClick={()=>Notification.requestPermission().then(()=>flash('Notificações configuradas ✓'))}>🔔 Notificações</button></div>
      {route&&<div className="tripActions"><button onClick={()=>tripStatus('em_rota')}>▶ Iniciar viagem</button><button onClick={()=>tripStatus('concluida')}>✓ Encerrar</button></div>}
    </div>}
    {tab==='chat'&&<div className="chat panel"><div className="chatHead"><div><h2>Chat da viagem</h2><p>{online} conectado{online!==1?'s':''} • mensagens instantâneas</p></div><span>🔒 sala por link</span></div><div className="messages">{messages.length===0&&<div className="empty">Manda um “tô pronta” aí 😄</div>}{messages.map(m=><div key={m.id} className={'bubble '+(m.name===name?'me':'')}><b>{m.name}</b><div>{m.text}</div><small>{new Date(m.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} ✓✓</small></div>)}<div ref={msgEnd}/></div><div className="compose"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Mensagem…"/><button onClick={send}>➤</button></div></div>}
    {tab==='ao-vivo'&&<div className="panel live"><h2>Central ao vivo</h2><p>A localização aparece para todos nesta sala enquanto o GPS estiver ligado.</p><div className="liveGrid"><div><small>Status</small><b>{status.replace('_',' ')}</b></div><div><small>Precisão GPS</small><b>{accuracy}</b></div><div><small>Pessoas online</small><b>{online}</b></div><div><small>Sala</small><b>{room}</b></div></div><label className="profile">Seu nome neste celular<input value={name} onChange={e=>setName(e.target.value)}/></label><button className="primary" onClick={share}>Compartilhar sala</button><div className="privacy">📍 A localização só é transmitida quando você toca em <b>Compartilhar GPS</b>. Ao pausar, o navegador deixa de enviar novas posições.</div></div>}
   </section>
  </main>
  <footer><button className={tab==='rota'?'active':''} onClick={()=>setTab('rota')}>⌖<span>Rota</span></button><button className={tab==='chat'?'active':''} onClick={()=>setTab('chat')}>◉<span>Chat</span></button><button className={tab==='ao-vivo'?'active':''} onClick={()=>setTab('ao-vivo')}>●<span>Ao vivo</span></button></footer>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
