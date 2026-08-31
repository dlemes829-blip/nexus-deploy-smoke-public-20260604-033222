import React,{useEffect,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import L from'leaflet';
import'leaflet/dist/leaflet.css';
import'./style.css';

const BASE=[
{id:'luciane',label:'Luciane',address:'Rua Orlando Marcondes, Ponta Grossa - PR, Brasil',type:'start'},
{id:'daniel',label:'Daniel',address:'Rua Tobias Moscoso, 38, Ponta Grossa - PR, Brasil',type:'stop'},
{id:'evelyn',label:'Evelyn',address:'Rua Abatia, 140, Ponta Grossa - PR, Brasil',type:'stop'},
{id:'empresa',label:'Odonto Excellence São Francisco',address:'Rua Antonil, 100 - São Francisco, Ponta Grossa - PR, 84032-190, Brasil',type:'end'}
];
const cleanVoice=t=>String(t||'').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/\s{2,}/g,' ').trim();
const km=m=>Number.isFinite(m)?`${(m/1000).toFixed(1)} km`:'—';
const mins=s=>Number.isFinite(s)?`${Math.max(1,Math.round(s/60))} min`:'—';
const reverse=a=>[...a].reverse().map((x,i,z)=>({...x,type:i===0?'start':i===z.length-1?'end':'stop'}));
const defaults=()=>({ida:BASE.map(x=>({...x,confirmed:false})),volta:reverse(BASE.map(x=>({...x,confirmed:false})))});
const canonicalById=Object.fromEntries(BASE.map(x=>[x.id,x]));
const normalize=t=>{
 const d=defaults();
 if(!t?.ida?.length)return d;
 const fix=(arr,fallback)=>arr.map((s,i)=>{
  const base=canonicalById[s.id]||fallback[i]||s;
  const isCompany=s.id==='empresa';
  const companyChanged=isCompany&&s.address!==canonicalById.empresa.address;
  return{...base,...s,address:companyChanged?canonicalById.empresa.address:(s.address||base.address),lat:companyChanged?null:s.lat,lon:companyChanged?null:s.lon,confirmed:companyChanged?false:Boolean(s.confirmed&&Number.isFinite(s.lat)&&Number.isFinite(s.lon))};
 });
 return{ida:fix(t.ida,d.ida),volta:fix(t.volta?.length?t.volta:d.volta,d.volta)};
};
function speak(t){
 if(!('speechSynthesis'in window))return;
 const text=cleanVoice(t);if(!text)return;
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=.96;u.pitch=1;
 const vs=speechSynthesis.getVoices();
 u.voice=vs.find(v=>/google/i.test(v.name)&&/^pt/i.test(v.lang))||vs.find(v=>/pt-BR/i.test(v.lang))||vs.find(v=>/^pt/i.test(v.lang))||null;
 speechSynthesis.speak(u);
}
const gpsQuality=a=>!Number.isFinite(a)?{key:'off',label:'GPS aguardando'}:a<=12?{key:'excellent',label:'GPS preciso'}:a<=30?{key:'good',label:'GPS bom'}:a<=60?{key:'fair',label:'GPS moderado'}:{key:'weak',label:'GPS fraco'};
const blend=(prev,next,accuracy)=>{
 if(!prev)return next;
 const alpha=accuracy<=10?.82:accuracy<=25?.62:accuracy<=50?.42:.25;
 return{...next,lat:prev.lat+(next.lat-prev.lat)*alpha,lon:prev.lon+(next.lon-prev.lon)*alpha};
};
const meters=(a,b)=>{
 if(!a||!b)return Infinity;
 const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
 const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
 return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
};

function App(){
 const room=new URLSearchParams(location.search).get('sala')||'trabalho-daniel';
 const initial=()=>{try{return normalize(JSON.parse(localStorage.getItem('rota-fixed-v7'))||JSON.parse(localStorage.getItem('rota-fixed-v6')))}catch{return defaults()}};
 const[trips,setTrips]=useState(initial),[dir,setDir]=useState('ida'),[route,setRoute]=useState(null),[routeStops,setRouteStops]=useState([]),[busy,setBusy]=useState(false),[status,setStatus]=useState('planejando'),[gps,setGps]=useState(null),[online,setOnline]=useState(1),[toast,setToast]=useState(''),[editing,setEditing]=useState(false),[menu,setMenu]=useState(false),[follow,setFollow]=useState(true),[nextIndex,setNextIndex]=useState(1),[lastFixAt,setLastFixAt]=useState(null);
 const map=useRef(),layer=useRef(),car=useRef(),accuracyCircle=useRef(),ws=useRef(),watch=useRef(),auto=useRef(false),lastAccepted=useRef(null),lastRaw=useRef(null),arrived=useRef(new Set());
 const stops=trips[dir]||[];
 const nextStop=routeStops[nextIndex]||null;
 const quality=gpsQuality(gps?.accuracy);
 const speedKmh=Number.isFinite(gps?.speed)?Math.max(0,Math.round(gps.speed*3.6)):null;
 const progress=routeStops.length>1?Math.min(100,Math.round((nextIndex/Math.max(1,routeStops.length-1))*100)):0;
 const allConfirmed=stops.length>0&&stops.every(s=>s.confirmed&&Number.isFinite(s.lat)&&Number.isFinite(s.lon));
 const flash=t=>{setToast(t);setTimeout(()=>setToast(''),2800)};
 const save=t=>{const n=normalize(t);setTrips(n);localStorage.setItem('rota-fixed-v7',JSON.stringify(n));return n};
 const send=x=>ws.current?.readyState===1&&ws.current.send(JSON.stringify(x));

 const acceptGps=p=>{
  const raw={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed,heading:p.coords.heading,at:Date.now()};
  if(!Number.isFinite(raw.lat)||!Number.isFinite(raw.lon))return;
  if(lastRaw.current){
   const dt=Math.max(1,(raw.at-lastRaw.current.at)/1000),jump=meters(lastRaw.current,raw),derived=jump/dt;
   if(raw.accuracy>120&&lastRaw.current.accuracy<60)return;
   if(derived>75&&!Number.isFinite(raw.speed))return;
  }
  lastRaw.current=raw;
  const smoothed=blend(lastAccepted.current,raw,raw.accuracy||99);
  lastAccepted.current=smoothed;
  setGps(smoothed);setLastFixAt(Date.now());send({type:'gps',...smoothed});
 };

 useEffect(()=>{
  const n=normalize(trips);localStorage.setItem('rota-fixed-v7',JSON.stringify(n));
  if(map.current)return;
  map.current=L.map('map',{zoomControl:false,preferCanvas:true,zoomSnap:.5}).setView([-25.095,-50.161],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap',updateWhenIdle:true,keepBuffer:3}).addTo(map.current);
  L.control.zoom({position:'bottomright'}).addTo(map.current);
 },[]);

 useEffect(()=>{
  let closed=false;
  const connect=()=>{
   const p=location.protocol==='https:'?'wss':'ws',s=new WebSocket(`${p}://${location.host}/ws?room=${encodeURIComponent(room)}&name=Rota`);ws.current=s;
   s.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.type==='snapshot'){setOnline(d.count||1);if(d.gps)setGps(d.gps);if(d.status)setStatus(d.status);if(d.state?.trips){save(d.state.trips);auto.current=false}}if(d.type==='presence')setOnline(d.count||1);if(d.type==='gps'&&d.gps)setGps(d.gps);if(d.type==='status')setStatus(d.status);if(d.type==='state'&&d.state?.trips){save(d.state.trips);setRoute(null);auto.current=false}}catch{}};
   s.onclose=()=>!closed&&setTimeout(connect,2500);
  };
  connect();
  return()=>{closed=true;ws.current?.close();if(watch.current)navigator.geolocation?.clearWatch(watch.current)};
 },[room]);

 useEffect(()=>{
  if(!gps||!map.current)return;
  const ll=[gps.lat,gps.lon],heading=Number.isFinite(gps.heading)?gps.heading:0;
  const ic=L.divIcon({className:'carMarker',html:`<div class="carHalo"></div><div class="carCore" style="transform:rotate(${heading}deg)"><span>▲</span></div>`,iconSize:[54,54],iconAnchor:[27,27]});
  if(car.current){car.current.setLatLng(ll);car.current.setIcon(ic)}else car.current=L.marker(ll,{icon:ic,zIndexOffset:1200}).addTo(map.current).bindTooltip('Motorista ao vivo',{direction:'top'});
  const radius=Math.min(120,Math.max(8,gps.accuracy||30));
  if(accuracyCircle.current){accuracyCircle.current.setLatLng(ll);accuracyCircle.current.setRadius(radius)}else accuracyCircle.current=L.circle(ll,{radius,weight:1,opacity:.45,fillOpacity:.08,color:'#1769e0'}).addTo(map.current);
  if(status==='em_rota'&&follow)map.current.setView(ll,17,{animate:false});
  if(status==='em_rota'&&nextStop){
   const d=meters(gps,nextStop);
   if(d<120&&!arrived.current.has(nextStop.id)){
    arrived.current.add(nextStop.id);speak(`Chegando em ${nextStop.label}.`);
    setNextIndex(i=>Math.min(i+1,Math.max(1,routeStops.length-1)));
   }
  }
 },[gps,status,follow,nextStop,routeStops.length]);

 const geocode=async s=>{
  if(Number.isFinite(s.lat)&&Number.isFinite(s.lon))return{...s,confirmed:true};
  const r=await fetch(`/api/search?q=${encodeURIComponent(s.address)}`),j=await r.json();
  if(!j?.[0])throw Error(`Não localizei ${s.label}. Abra Endereços para confirmar.`);
  return{...s,lat:+j[0].lat,lon:+j[0].lon,confirmed:true,display:s.address,approximate:!!j[0].approximate};
 };
 const draw=(r,rs)=>{
  layer.current?.remove();
  const g=L.layerGroup().addTo(map.current);
  L.geoJSON(r.geometry,{style:{weight:12,opacity:.28,color:'#071018',lineCap:'round',lineJoin:'round'}}).addTo(g);
  L.geoJSON(r.geometry,{style:{weight:7,opacity:.96,color:'#1769e0',lineCap:'round',lineJoin:'round'}}).addTo(g);
  rs.forEach((s,i)=>L.marker([s.lat,s.lon],{icon:L.divIcon({className:'routePin',html:`<span>${i+1}</span>`,iconSize:[36,36],iconAnchor:[18,18]})}).addTo(g).bindPopup(`<b>${s.label}</b><br>${s.address}`));
  layer.current=g;
  map.current.fitBounds(L.geoJSON(r.geometry).getBounds(),{padding:[55,55],maxZoom:16});
 };
 const calculate=async(silent=false)=>{
  if(busy)return null;
  try{
   setBusy(true);let rs=[];
   for(const s of stops)rs.push(await geocode(s));
   const coords=rs.map(s=>`${s.lon},${s.lat}`).join(';');
   const u=`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=true`;
   const d=await(await fetch(u)).json();if(d.code!=='Ok'||!d.trips?.[0])throw Error('Rota indisponível agora. Tente novamente em instantes.');
   const r=d.trips[0];
   rs=d.waypoints.map((w,i)=>({i,o:w.waypoint_index})).sort((a,b)=>a.o-b.o).map(x=>rs[x.i]);
   draw(r,rs);setRoute(r);setRouteStops(rs);setNextIndex(1);arrived.current=new Set();
   const t=save({...trips,[dir]:rs});send({type:'state',state:{trips:t,direction:dir}});
   if(!silent)flash('Melhor rota pronta para iniciar');
   return r;
  }catch(e){flash(e.message||'Não foi possível preparar a rota.');return null}finally{setBusy(false)}
 };
 useEffect(()=>{if(!map.current||auto.current||editing)return;auto.current=true;const id=setTimeout(()=>calculate(true),650);return()=>clearTimeout(id)},[dir,editing]);

 const switchDir=d=>{setDir(d);setRoute(null);setRouteStops([]);setNextIndex(1);auto.current=false;layer.current?.remove();setMenu(false);setEditing(false)};
 const change=(id,v)=>{const n=stops.map(s=>s.id===id?{...s,address:v,lat:null,lon:null,confirmed:false}:s);save({...trips,[dir]:n})};
 const confirmGps=id=>{
  if(!navigator.geolocation)return flash('GPS indisponível neste aparelho.');
  navigator.geolocation.getCurrentPosition(p=>{
   const patch={lat:p.coords.latitude,lon:p.coords.longitude,confirmed:true,display:'Local confirmado por GPS'};
   const syncBoth=id==='luciane';
   let next={...trips,[dir]:stops.map(s=>s.id===id?{...s,...patch}:s)};
   if(syncBoth)next={...next,ida:next.ida.map(s=>s.id===id?{...s,...patch}:s),volta:next.volta.map(s=>s.id===id?{...s,...patch}:s)};
   save(next);flash('Localização exata salva');auto.current=false;
  },()=>flash('Não foi possível obter localização precisa.'),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 };
 const finishEdit=async()=>{setEditing(false);auto.current=false;setRoute(null);await calculate(false)};
 const enableGps=()=>{
  if(!navigator.geolocation){flash('GPS indisponível neste aparelho.');return false}
  if(watch.current)return true;
  watch.current=navigator.geolocation.watchPosition(acceptGps,()=>flash('Sinal de GPS indisponível. Verifique a permissão de localização.'),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  setFollow(true);return true;
 };
 const start=async()=>{
  let r=route;if(!r)r=await calculate(true);if(!r)return;
  if(!enableGps())return;
  setStatus('em_rota');send({type:'status',status:'em_rota'});arrived.current=new Set();setNextIndex(1);speak('Viagem iniciada. Navegação ao vivo ativa.');
 };
 const end=()=>{setStatus('concluida');send({type:'status',status:'concluida'});speak('Viagem concluída. Até a próxima.')};
 const centerGps=()=>{if(gps&&map.current){setFollow(true);map.current.setView([gps.lat,gps.lon],17,{animate:false})}else flash('Aguardando posição do GPS.')};
 const routeTitle=status==='em_rota'?(nextStop?`Próxima parada: ${nextStop.label}`:'Destino final'):(route?'Rota pronta':'Preparando rota');
 const stale=lastFixAt&&Date.now()-lastFixAt>15000;

 return <div className={'app '+(status==='em_rota'?'driving':'')}>
  {toast&&<div className="toast">{toast}</div>}
  <header><div className="brand"><div className="brandMark">RD</div><div><b>Rota Daniel</b><small>{online} online · Ponta Grossa</small></div></div><div className="topActions"><button className="addressBtn" onClick={()=>setEditing(v=>!v)}>{editing?'Fechar':'Endereços'}</button><button className="menuTrigger" aria-label="Abrir menu" onClick={()=>setMenu(true)}>☰</button></div></header>
  <div className="tabs"><button className={dir==='ida'?'active':''} onClick={()=>switchDir('ida')}>IDA <small>Casa → Empresa</small></button><button className={dir==='volta'?'active':''} onClick={()=>switchDir('volta')}>VOLTA <small>Empresa → Casa</small></button></div>
  <main>
   <section className="mapWrap"><div id="map"/><div className="routeHud"><div><small>{status==='em_rota'?'NAVEGAÇÃO ATIVA':busy?'PREPARANDO':'VIAGEM'}</small><strong>{routeTitle}</strong><span>{route?`${mins(route.duration)} · ${km(route.distance)}`:'Localizando endereços salvos'}</span></div><div className={'gpsPill '+quality.key}><b>{quality.label}</b><small>{Number.isFinite(gps?.accuracy)?`±${Math.round(gps.accuracy)} m`:'sem leitura'}</small></div></div>
   {status==='em_rota'&&<><button className={'followBtn '+(follow?'on':'')} onClick={()=>setFollow(v=>!v)}>{follow?'Seguindo':'Mapa livre'}</button><button className="locateBtn" onClick={centerGps}>◎</button><div className="driveHud"><div><small>VELOCIDADE</small><b>{speedKmh==null?'—':speedKmh}<span> km/h</span></b></div><div><small>PRÓXIMO</small><b>{nextStop?.label||'Destino'}</b></div><div><small>PROGRESSO</small><b>{progress}%</b></div></div></>}
   </section>
   <aside>{editing?<div className="editor"><div className="sectionTitle"><div><small>LOCAIS DA VIAGEM</small><h2>Endereços salvos</h2></div><span className={allConfirmed?'statusOk':'statusWarn'}>{allConfirmed?'Todos localizados':'Revisar pontos'}</span></div><p>Os pontos com check verde já têm coordenadas salvas e serão reutilizados sem nova busca.</p>{stops.map(s=><div className="address" key={s.id}><div className="addressTop"><b>{s.label}</b><span className={s.confirmed?'ok':'pending'}>{s.confirmed?'✓ Confirmado':'A localizar'}</span></div><input value={s.address} onChange={e=>change(s.id,e.target.value)}/><button onClick={()=>confirmGps(s.id)}>Usar minha localização atual</button></div>)}<button className="primary" onClick={finishEdit}>Salvar e preparar rota</button></div>:<div className="summary"><div className="summaryHead"><div><small>{dir==='ida'?'IDA · CASA → EMPRESA':'VOLTA · EMPRESA → CASA'}</small><h1>{route?'Pronto para sair':'Preparando sua viagem'}</h1><p>{route?'A rota já está desenhada no mapa.':'Estamos reconhecendo os endereços salvos.'}</p></div><span className={'ready '+(route?'done':'')}>{route?'✓':'…'}</span></div><div className="stops">{stops.map((s,i)=><div className="stop" key={s.id}><span>{i+1}</span><div><b>{s.label}</b><small>{s.address}</small></div><i className={s.confirmed?'confirmed':''}>{s.confirmed?'✓':''}</i></div>)}</div>{route&&<div className="metrics"><div><small>Tempo estimado</small><b>{mins(route.duration)}</b></div><div><small>Distância</small><b>{km(route.distance)}</b></div></div>}{status==='em_rota'?<><div className="navStatus"><span className={'signal '+quality.key}></span><div><b>{stale?'Atualizando sinal GPS':quality.label}</b><small>{Number.isFinite(gps?.accuracy)?`Precisão aproximada de ${Math.round(gps.accuracy)} metros`:'Aguardando primeira posição'}</small></div></div><button className="danger" onClick={end}>Encerrar viagem</button></>:<button className="start" disabled={busy} onClick={start}>{busy?'Preparando rota…':'Iniciar viagem'}</button>}<button className="secondary" disabled={busy} onClick={()=>calculate(false)}>Recalcular melhor rota</button></div>}</aside>
  </main>
  {menu&&<div className="drawerBackdrop" onClick={()=>setMenu(false)}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerHead"><div><b>Rota Daniel</b><small>Central da viagem</small></div><button onClick={()=>setMenu(false)}>×</button></div><nav><button onClick={()=>{setEditing(false);setMenu(false)}}><span className="navIcon">⌖</span><span>Rota<small>Mapa e viagem preparada</small></span></button><button onClick={()=>{setEditing(true);setMenu(false)}}><span className="navIcon">✓</span><span>Endereços<small>Locais salvos e coordenadas</small></span></button><button onClick={()=>{setMenu(false);calculate(false)}}><span className="navIcon">↻</span><span>Recalcular<small>Atualizar a melhor rota</small></span></button><button onClick={()=>{setMenu(false);enableGps();centerGps()}}><span className="navIcon">◎</span><span>Centralizar GPS<small>Voltar para a posição atual</small></span></button><button onClick={()=>{setMenu(false);speak('Teste de voz. Navegação pronta.')}}><span className="navIcon">◖</span><span>Testar voz<small>Narração limpa e sem emojis</small></span></button></nav><div className="drawerTrips"><b>VIAGEM</b><button className={dir==='ida'?'active':''} onClick={()=>switchDir('ida')}>Ida · Casa → Empresa</button><button className={dir==='volta'?'active':''} onClick={()=>switchDir('volta')}>Volta · Empresa → Casa</button></div></aside></div>}
 </div>
}

createRoot(document.getElementById('root')).render(<App/>);
