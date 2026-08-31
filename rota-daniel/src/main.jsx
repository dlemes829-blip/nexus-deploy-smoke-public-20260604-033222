import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import maplibregl from'maplibre-gl';
import'maplibre-gl/dist/maplibre-gl.css';
import'./style.css';

const FIXED=[
 {id:'luciane',label:'Luciane',address:'Rua Orlando Marcondes, Colônia Dona Luíza, Ponta Grossa - PR, 84046-245, Brasil',lat:-25.14309,lon:-50.18036,type:'start',confirmed:true,fixed:true},
 {id:'daniel',label:'Daniel',address:'Rua Tobias Moscoso, 38, Ronda, Ponta Grossa - PR, 84051-120, Brasil',lat:-25.1019501,lon:-50.1724167,type:'stop',confirmed:true,fixed:true},
 {id:'evelyn',label:'Evelyn',address:'Rua Abatiá, 140, Nova Rússia, Ponta Grossa - PR, 84070-220, Brasil',lat:-25.0738906,lon:-50.1755799,type:'stop',confirmed:true,fixed:true},
 {id:'empresa',label:'Odonto Excellence São Francisco',address:'Rua Antonil, 100, Uvaranas, Ponta Grossa - PR, 84032-190, Brasil',lat:-25.10550,lon:-50.09820,type:'end',confirmed:true,fixed:true}
];
const reverse=a=>[...a].reverse().map((x,i,z)=>({...x,type:i===0?'start':i===z.length-1?'end':'stop'}));
const defaults=()=>({ida:FIXED.map(x=>({...x})),volta:reverse(FIXED.map(x=>({...x})))});
const cleanVoice=t=>String(t||'').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/\s{2,}/g,' ').trim();
const km=m=>Number.isFinite(m)?`${(m/1000).toFixed(1)} km`:'—';
const minText=s=>Number.isFinite(s)?`${Math.max(1,Math.round(s/60))} min`:'—';
const clock=ms=>new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
const weatherLabel=c=>c===0?'Céu limpo':c<=3?'Poucas nuvens':c===45||c===48?'Neblina':c>=51&&c<=67?'Chuva':c>=80&&c<=82?'Pancadas':c>=95?'Temporal':'Tempo variável';
function speak(t){
 if(!('speechSynthesis'in window))return;
 const text=cleanVoice(t);if(!text)return;
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=.96;u.pitch=1;
 const vs=speechSynthesis.getVoices();
 u.voice=vs.find(v=>/google/i.test(v.name)&&/^pt/i.test(v.lang))||vs.find(v=>/pt-BR/i.test(v.lang))||vs.find(v=>/^pt/i.test(v.lang))||null;
 speechSynthesis.speak(u);
}
const meters=(a,b)=>{
 if(!a||!b)return Infinity;
 const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
 const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
 return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
};
const gpsQuality=a=>!Number.isFinite(a)?{key:'off',label:'GPS aguardando'}:a<=10?{key:'excellent',label:'GPS excelente'}:a<=25?{key:'good',label:'GPS bom'}:a<=55?{key:'fair',label:'GPS moderado'}:{key:'weak',label:'GPS fraco'};
const blend=(prev,next,a)=>{
 if(!prev)return next;
 const k=a<=8?.88:a<=18?.72:a<=35?.52:.32;
 return{...next,lat:prev.lat+(next.lat-prev.lat)*k,lon:prev.lon+(next.lon-prev.lon)*k};
};
const routeProgress=(point,geometry)=>{
 const cs=geometry?.coordinates;if(!point||!Array.isArray(cs)||cs.length<2)return{fraction:0,distance:Infinity};
 let total=0,best=Infinity,bestCum=0,cum=0;
 for(let i=1;i<cs.length;i++){
  const a={lat:cs[i-1][1],lon:cs[i-1][0]},b={lat:cs[i][1],lon:cs[i][0]};
  const seg=meters(a,b);total+=seg;
  const da=meters(point,a),db=meters(point,b);
  if(da<best){best=da;bestCum=cum}
  if(db<best){best=db;bestCum=cum+seg}
  cum+=seg;
 }
 return{fraction:total?Math.max(0,Math.min(1,bestCum/total)):0,distance:best};
};
const mapStyle={
 version:8,
 sources:{
  osm:{type:'raster',tiles:['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png','https://b.tile.openstreetmap.org/{z}/{x}/{y}.png','https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'},
  satellite:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Tiles © Esri'}
 },
 layers:[
  {id:'satellite',type:'raster',source:'satellite',layout:{visibility:'visible'}},
  {id:'osm',type:'raster',source:'osm',layout:{visibility:'none'}}
 ]
};

function App(){
 const room=new URLSearchParams(location.search).get('sala')||'trabalho-daniel';
 const initial=()=>{try{const v=JSON.parse(localStorage.getItem('rota-fixed-v9'));return v?.ida?.length?v:defaults()}catch{return defaults()}};
 const[trips,setTrips]=useState(initial);
 const[dir,setDir]=useState('ida');
 const[route,setRoute]=useState(null);
 const[routeStops,setRouteStops]=useState([]);
 const[busy,setBusy]=useState(true);
 const[status,setStatus]=useState('planejando');
 const[gps,setGps]=useState(null);
 const[online,setOnline]=useState(1);
 const[toast,setToast]=useState('');
 const[editing,setEditing]=useState(false);
 const[menu,setMenu]=useState(false);
 const[follow,setFollow]=useState(true);
 const[nextIndex,setNextIndex]=useState(1);
 const[weather,setWeather]=useState(null);
 const[satellite,setSatellite]=useState(true);
 const[tick,setTick]=useState(Date.now());
 const[routeFraction,setRouteFraction]=useState(0);
 const[rerouting,setRerouting]=useState(false);
 const[noticeOpen,setNoticeOpen]=useState(false);
 const[noticeText,setNoticeText]=useState('');
 const[lastNotice,setLastNotice]=useState(null);
 const map=useRef();
 const routeMarkers=useRef([]);
 const carMarker=useRef();
 const ws=useRef();
 const watch=useRef();
 const lastAccepted=useRef(null);
 const lastRaw=useRef(null);
 const arrived=useRef(new Set());
 const cameraAt=useRef(0);
 const offRouteCount=useRef(0);
 const lastRerouteAt=useRef(0);
 const stops=trips[dir]||[];
 const nextStop=routeStops[nextIndex]||routeStops.at(-1)||null;
 const quality=gpsQuality(gps?.accuracy);
 const speedKmh=Number.isFinite(gps?.speed)?Math.max(0,Math.round(gps.speed*3.6)):null;
 const remaining=route?.duration?Math.max(0,route.duration*(status==='em_rota'?(1-routeFraction):1)):0;
 const eta=route?clock(Date.now()+remaining*1000):'—';
 const progress=route?Math.round((status==='em_rota'?routeFraction:0)*100):0;
 const allFixed=stops.length>=2&&stops.every(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon));
 const flash=t=>{setToast(t);setTimeout(()=>setToast(''),2800)};
 const persist=t=>{setTrips(t);localStorage.setItem('rota-fixed-v9',JSON.stringify(t));return t};
 const send=x=>ws.current?.readyState===1&&ws.current.send(JSON.stringify(x));

 useEffect(()=>{const id=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{
  if(map.current)return;
  const m=new maplibregl.Map({
   container:'map',style:mapStyle,center:[-50.16,-25.095],zoom:13.2,pitch:0,bearing:0,
   dragRotate:true,touchZoomRotate:true,pitchWithRotate:true,touchPitch:true,bearingSnap:7,maxPitch:60,attributionControl:false
  });
  m.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true,visualizePitch:true}),'bottom-right');
  m.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');
  m.on('dragstart',()=>setFollow(false));
  m.on('rotatestart',()=>setFollow(false));
  m.on('pitchstart',()=>setFollow(false));
  m.on('zoomstart',e=>{if(e.originalEvent)setFollow(false)});
  map.current=m;
  return()=>{m.remove();map.current=null};
 },[]);
 useEffect(()=>{
  const m=map.current;if(!m)return;
  const apply=()=>{
   if(!m.getLayer('satellite')||!m.getLayer('osm'))return;
   m.setLayoutProperty('satellite','visibility',satellite?'visible':'none');
   m.setLayoutProperty('osm','visibility',satellite?'none':'visible');
  };
  if(m.isStyleLoaded())apply();else m.once('load',apply);
 },[satellite]);
 useEffect(()=>{
  let stop=false;
  const load=async()=>{try{const r=await fetch('/api/weather');if(!r.ok)return;const j=await r.json();if(!stop)setWeather(j)}catch{}};
  load();const id=setInterval(load,10*60*1000);
  return()=>{stop=true;clearInterval(id)};
 },[]);
 useEffect(()=>{
  let closed=false;
  const connect=()=>{
   const p=location.protocol==='https:'?'wss':'ws';
   const s=new WebSocket(`${p}://${location.host}/ws?room=${encodeURIComponent(room)}&name=Rotas%20Empresa`);ws.current=s;
   s.onmessage=e=>{try{
    const d=JSON.parse(e.data);
    if(d.type==='snapshot'){
     setOnline(d.count||1);if(d.gps)setGps(d.gps);if(d.status)setStatus(d.status);
    }
    if(d.type==='presence')setOnline(d.count||1);
    if(d.type==='gps'&&d.gps)setGps(d.gps);
    if(d.type==='status')setStatus(d.status);
    if(d.type==='state'&&d.state?.version==='5.2'&&d.state?.trips)persist(d.state.trips);
    if(d.type==='notification'&&d.notification?.text){
     setLastNotice(d.notification);flash(`Aviso: ${d.notification.text}`);if(d.notification.speak)speak(d.notification.text);
    }
   }catch{}};
   s.onclose=()=>!closed&&setTimeout(connect,2200);
  };
  connect();
  return()=>{closed=true;ws.current?.close();if(watch.current)navigator.geolocation?.clearWatch(watch.current)};
 },[room]);

 const clearRouteMarkers=()=>{routeMarkers.current.forEach(m=>m.remove());routeMarkers.current=[]};
 const draw=async(r,rs,fit=true)=>{
  const m=map.current;if(!m)return;
  const ready=()=>m.isStyleLoaded();
  if(!ready())await new Promise(resolve=>m.once('load',resolve));
  const data={type:'Feature',geometry:r.geometry,properties:{}};
  if(m.getSource('route'))m.getSource('route').setData(data);
  else{
   m.addSource('route',{type:'geojson',data});
   m.addLayer({id:'route-shadow',type:'line',source:'route',paint:{'line-color':'#04111c','line-width':12,'line-opacity':.38},layout:{'line-cap':'round','line-join':'round'}});
   m.addLayer({id:'route-line',type:'line',source:'route',paint:{'line-color':'#2f8fff','line-width':7,'line-opacity':.98},layout:{'line-cap':'round','line-join':'round'}});
  }
  clearRouteMarkers();
  rs.forEach((s,i)=>{
   const el=document.createElement('div');el.className='routePin';el.textContent=String(i+1);
   const marker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([s.lon,s.lat]).setPopup(new maplibregl.Popup({offset:22}).setHTML(`<b>${s.label}</b><br>${s.address}`)).addTo(m);
   routeMarkers.current.push(marker);
  });
  if(fit&&r.geometry?.coordinates?.length){
   const bounds=r.geometry.coordinates.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(r.geometry.coordinates[0],r.geometry.coordinates[0]));
   m.fitBounds(bounds,{padding:{top:120,bottom:115,left:55,right:55},maxZoom:15.8,duration:650});
  }
 };
 const buildLocalRoute=async list=>{
  const coords=list.map(s=>`${s.lon},${s.lat}`).join(';');
  const u=`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`;
  const r=await fetch(u),j=await r.json();
  if(j.code!=='Ok'||!j.routes?.[0])throw Error('Rota temporariamente indisponível.');
  return j.routes[0];
 };
 const loadRoute=async(silent=false)=>{
  setBusy(true);
  try{
   let r,rs=stops;
   const unchanged=stops.every(s=>s.fixed!==false&&Number.isFinite(s.lat)&&Number.isFinite(s.lon));
   if(unchanged){
    const q=await fetch(`/api/route/${dir}`);
    if(q.ok){const j=await q.json();r=j.route;rs=j.stops}
   }
   if(!r&&allFixed)r=await buildLocalRoute(rs);
   if(!r)throw Error('A rota precisa de pontos válidos.');
   await draw(r,rs,true);setRoute(r);setRouteStops(rs);setNextIndex(1);setRouteFraction(0);arrived.current=new Set();
   if(!silent)flash('Rota carregada e pronta');
   return r;
  }catch(e){flash(e.message||'Não foi possível carregar a rota.');return null}
  finally{setBusy(false)}
 };
 useEffect(()=>{
  setRoute(null);setRouteStops([]);setBusy(true);
  const id=setTimeout(()=>loadRoute(true),180);
  return()=>clearTimeout(id);
 },[dir]);

 const acceptGps=p=>{
  const raw={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed,heading:p.coords.heading,at:Date.now()};
  if(!Number.isFinite(raw.lat)||!Number.isFinite(raw.lon))return;
  if(lastRaw.current){
   const dt=Math.max(1,(raw.at-lastRaw.current.at)/1000),jump=meters(lastRaw.current,raw);
   if(raw.accuracy>100&&lastRaw.current.accuracy<45)return;
   if(jump/dt>70&&!Number.isFinite(raw.speed))return;
  }
  lastRaw.current=raw;
  const smooth=blend(lastAccepted.current,raw,raw.accuracy||99);lastAccepted.current=smooth;setGps(smooth);send({type:'gps',...smooth});
 };
 const enableGps=()=>{
  if(!navigator.geolocation){flash('GPS indisponível neste aparelho.');return false}
  if(watch.current)return true;
  watch.current=navigator.geolocation.watchPosition(acceptGps,()=>flash('Não foi possível acompanhar sua localização.'),{enableHighAccuracy:true,maximumAge:0,timeout:12000});
  return true;
 };
 const relocate=()=>{
  if(!navigator.geolocation)return flash('GPS indisponível neste aparelho.');
  setFollow(true);
  navigator.geolocation.getCurrentPosition(p=>{
   acceptGps(p);
   map.current?.easeTo({center:[p.coords.longitude,p.coords.latitude],zoom:17.2,pitch:status==='em_rota'?45:0,bearing:status==='em_rota'&&Number.isFinite(p.coords.heading)?p.coords.heading:0,duration:550,essential:true});
   flash('Você está centralizado no mapa');
  },()=>flash('Não consegui obter sua localização agora.'),{enableHighAccuracy:true,maximumAge:0,timeout:12000});
 };
 const rerouteFromGps=async current=>{
  if(rerouting||!current||Date.now()-lastRerouteAt.current<30000)return;
  const remainingStops=routeStops.slice(Math.min(nextIndex,routeStops.length-1));
  if(!remainingStops.length)return;
  try{
   setRerouting(true);lastRerouteAt.current=Date.now();
   const origin={id:'gps',label:'Posição atual',lat:current.lat,lon:current.lon,address:'Posição atual'};
   const r=await buildLocalRoute([origin,...remainingStops]);
   await draw(r,remainingStops,false);setRoute(r);setRouteStops(remainingStops);setNextIndex(0);setRouteFraction(0);offRouteCount.current=0;
   flash('Rota reajustada à sua posição');speak('Rota atualizada. Siga o novo trajeto.');
  }catch{flash('Não foi possível reajustar a rota agora.')}
  finally{setRerouting(false)}
 };
 useEffect(()=>{
  const m=map.current;if(!gps||!m)return;
  if(carMarker.current)carMarker.current.setLngLat([gps.lon,gps.lat]);
  else{
   const el=document.createElement('div');el.className='carMarker';el.innerHTML='<div class="carPulse"></div><div class="carArrow">▲</div>';
   carMarker.current=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([gps.lon,gps.lat]).addTo(m);
  }
  const arrow=carMarker.current.getElement().querySelector('.carArrow');
  if(arrow&&Number.isFinite(gps.heading))arrow.style.transform=`rotate(${gps.heading}deg)`;
  if(route?.geometry){
   const rp=routeProgress(gps,route.geometry);setRouteFraction(rp.fraction);
   if(status==='em_rota'){
    if(rp.distance>85)offRouteCount.current+=1;else offRouteCount.current=0;
    if(offRouteCount.current>=3)rerouteFromGps(gps);
   }
  }
  if(status==='em_rota'&&follow&&Date.now()-cameraAt.current>650){
   cameraAt.current=Date.now();
   const moving=(speedKmh||0)>=4&&Number.isFinite(gps.heading);
   m.easeTo({center:[gps.lon,gps.lat],zoom:17.4,pitch:48,bearing:moving?gps.heading:m.getBearing(),duration:500,essential:true});
  }
  if(status==='em_rota'&&nextStop&&meters(gps,nextStop)<105&&!arrived.current.has(nextStop.id)){
   arrived.current.add(nextStop.id);speak(`Chegando em ${nextStop.label}.`);setNextIndex(i=>Math.min(i+1,Math.max(0,routeStops.length-1)));
  }
 },[gps,status,follow,nextStop,routeStops.length,route,rerouting,speedKmh]);

 const start=async()=>{
  let r=route;if(!r)r=await loadRoute(true);if(!r)return;
  if(!enableGps())return;
  setStatus('em_rota');setFollow(true);setNextIndex(1);setRouteFraction(0);send({type:'status',status:'em_rota'});
  speak('Viagem iniciada. Navegação ao vivo ativa.');setTimeout(relocate,250);
 };
 const end=()=>{setStatus('concluida');setFollow(false);send({type:'status',status:'concluida'});speak('Viagem concluída.')};
 const switchDir=d=>{if(d===dir)return;setDir(d);setStatus('planejando');setEditing(false);setMenu(false);setFollow(false)};
 const editAddress=(id,v)=>persist({...trips,[dir]:stops.map(s=>s.id===id?{...s,address:v,lat:null,lon:null,confirmed:false,fixed:false}:s)});
 const removeStop=id=>{const next=stops.filter(s=>s.id!==id);if(next.length<2)return flash('A rota precisa de origem e destino.');persist({...trips,[dir]:next});setRoute(null);flash('Parada removida')};
 const saveChanges=async()=>{
  setBusy(true);
  try{
   const resolved=[];
   for(const s of stops){
    if(Number.isFinite(s.lat)&&Number.isFinite(s.lon)){resolved.push({...s,confirmed:true});continue}
    const r=await fetch(`/api/search?q=${encodeURIComponent(s.address)}`),j=await r.json();
    if(!j?.[0])throw Error(`Não localizei ${s.label}. Verifique o endereço.`);
    resolved.push({...s,lat:+j[0].lat,lon:+j[0].lon,confirmed:true,fixed:false});
   }
   const t=persist({...trips,[dir]:resolved});send({type:'state',state:{version:'5.2',trips:t}});setEditing(false);
   const r=await buildLocalRoute(resolved);await draw(r,resolved,true);setRoute(r);setRouteStops(resolved);setNextIndex(1);setRouteFraction(0);flash('Rota atualizada e salva');
  }catch(e){flash(e.message||'Não foi possível salvar a alteração.')}
  finally{setBusy(false)}
 };
 const restoreFixed=()=>{const t=defaults();persist(t);setEditing(false);setRoute(null);setDir('ida');setTimeout(()=>loadRoute(false),120)};
 const sendNotice=()=>{
  const text=cleanVoice(noticeText);if(!text)return flash('Digite a notificação.');
  const n={id:String(Date.now()),text,speak:true,at:Date.now(),from:'Central'};
  send({type:'notification',...n});setLastNotice(n);speak(text);flash('Notificação enviada e narrada');setNoticeText('');setNoticeOpen(false);
 };
 const resetNorth=()=>{setFollow(false);map.current?.easeTo({bearing:0,pitch:0,duration:450,essential:true})};
 const mapModeLabel=satellite?'Satélite':'Mapa';
 const routeStatus=rerouting?'Recalculando caminho':status==='em_rota'?'Navegação ao vivo':busy?'Carregando rota':'Rota pronta';
 const routeHeadline=status==='em_rota'?(nextStop?`Próxima: ${nextStop.label}`:'Destino final'):(route?'Tudo pronto para sair':'Preparando viagem');

 return <div className={'app '+(status==='em_rota'?'driving':'')}>
  {toast&&<div className="toast" role="status">{toast}</div>}
  <header>
   <div className="brand"><div className="brandMark">RE</div><div><b>Rotas Empresa</b><small>{online} online · sistema sincronizado</small></div></div>
   <button className="menuTrigger" aria-label="Abrir menu" onClick={()=>setMenu(true)}>☰</button>
  </header>
  <div className="tabs"><button className={dir==='ida'?'active':''} onClick={()=>switchDir('ida')}>IDA <small>Casa → Empresa</small></button><button className={dir==='volta'?'active':''} onClick={()=>switchDir('volta')}>VOLTA <small>Empresa → Casa</small></button></div>
  <main>
   <section className="mapWrap">
    <div id="map"/>
    <div className="routeHud"><div><small>{routeStatus.toUpperCase()}</small><strong>{routeHeadline}</strong><span>{route?`${minText(remaining)} · ${km(route.distance)} · chegada ${eta}`:'Usando rota interna salva'}</span></div><div className={'gpsPill '+quality.key}><b>{quality.label}</b><small>{Number.isFinite(gps?.accuracy)?`±${Math.round(gps.accuracy)} m`:'aguardando sinal'}</small></div></div>
    <div className="mapTools"><button onClick={relocate}>◎ <span>Minha posição</span></button><button onClick={()=>setFollow(v=>!v)} className={follow?'active':''}>⌖ <span>{follow?'Seguindo':'Seguir'}</span></button><button onClick={resetNorth}>N <span>Norte</span></button><button onClick={()=>setSatellite(v=>!v)}>▦ <span>{mapModeLabel}</span></button></div>
    <div className="gestureHint">Arraste, dê zoom e gire com dois dedos</div>
    {weather&&<div className="weatherMini"><small>AGORA</small><b>{Math.round(weather.temperature)}°</b><span>{weatherLabel(weather.code)}</span></div>}
    {status==='em_rota'&&<div className="driveHud"><div><small>CHEGADA</small><b>{eta}</b></div><div><small>FALTAM</small><b>{minText(remaining)}</b></div><div><small>VELOCIDADE</small><b>{speedKmh==null?'—':speedKmh}<span> km/h</span></b></div><div><small>PROGRESSO</small><b>{progress}%</b></div></div>}
   </section>
   <aside>
    {editing?<div className="editor"><div className="sectionTitle"><div><small>CONFIGURAÇÃO</small><h2>Editar rota</h2></div><span className="statusOk">Salvo</span></div><p>A rota padrão já vem pronta. Altere somente quando precisar.</p>{stops.map((s,i)=><div className="address" key={s.id}><div className="addressTop"><b>{s.label}</b><span className="ok">✓ Salvo</span></div><input value={s.address} onChange={e=>editAddress(s.id,e.target.value)}/>{i>0&&i<stops.length-1&&<button className="remove" onClick={()=>removeStop(s.id)}>Remover desta viagem</button>}</div>)}<button className="primary" disabled={busy} onClick={saveChanges}>Salvar e atualizar rota</button><button className="secondary" onClick={restoreFixed}>Restaurar rota padrão</button></div>:<div className="summary"><div className="summaryHead"><div><small>{dir==='ida'?'IDA · ROTA PADRÃO':'VOLTA · ROTA PADRÃO'}</small><h1>{route?'Pronto para iniciar':'Preparando rota'}</h1><p>{route?'Endereços fixos reconhecidos e caminho carregado.':'Carregando a rota interna.'}</p></div><span className={'ready '+(route?'done':'')}>{route?'✓':'…'}</span></div><div className="stops">{stops.map((s,i)=><div className="stop" key={s.id}><span>{i+1}</span><div><b>{s.label}</b><small>{s.address}</small></div><i className="confirmed">✓</i></div>)}</div>{route&&<div className="metrics"><div><small>Chegada estimada</small><b>{eta}</b></div><div><small>Duração</small><b>{minText(remaining)}</b></div><div><small>Distância</small><b>{km(route.distance)}</b></div></div>}{lastNotice&&<div className="lastNotice"><small>ÚLTIMO AVISO</small><b>{lastNotice.text}</b></div>}{status==='em_rota'?<><div className="navStatus"><span className={'signal '+quality.key}></span><div><b>{rerouting?'Reajustando rota':quality.label}</b><small>{Number.isFinite(gps?.accuracy)?`Precisão aproximada ±${Math.round(gps.accuracy)} m`:'Obtendo localização'}</small></div></div><button className="danger" onClick={end}>Encerrar viagem</button></>:<button className="start" disabled={busy||!route} onClick={start}>{busy?'Preparando…':'Iniciar viagem'}</button>}<button className="secondary" disabled={busy} onClick={()=>loadRoute(false)}>Atualizar rota</button></div>}
   </aside>
  </main>
  {menu&&<div className="drawerBackdrop" onClick={()=>setMenu(false)}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerHead"><div><b>Rotas Empresa</b><small>Central da viagem</small></div><button onClick={()=>setMenu(false)}>×</button></div><nav><button onClick={()=>{setEditing(false);setMenu(false)}}><span className="navIcon">⌖</span><span>Rota<small>Mapa e viagem pronta</small></span></button><button onClick={()=>{setEditing(true);setMenu(false)}}><span className="navIcon">✎</span><span>Editar rota<small>Alterar ou remover paradas</small></span></button><button onClick={()=>{setMenu(false);relocate()}}><span className="navIcon">◎</span><span>Minha posição<small>Centralizar no GPS atual</small></span></button><button onClick={()=>{setMenu(false);setNoticeOpen(true)}}><span className="navIcon">◖</span><span>Enviar notificação<small>Mensagem narrada para os conectados</small></span></button><button onClick={()=>{setMenu(false);setSatellite(v=>!v)}}><span className="navIcon">▦</span><span>Alternar mapa<small>Mapa ou satélite</small></span></button><button onClick={()=>{setMenu(false);loadRoute(false)}}><span className="navIcon">↻</span><span>Atualizar rota<small>Recarregar caminho</small></span></button></nav><div className="drawerTrips"><b>VIAGEM</b><button className={dir==='ida'?'active':''} onClick={()=>switchDir('ida')}>Ida · Casa → Empresa</button><button className={dir==='volta'?'active':''} onClick={()=>switchDir('volta')}>Volta · Empresa → Casa</button></div><div className="devCredit">Em desenvolvimento por Daniel</div></aside></div>}
  {noticeOpen&&<div className="modalBackdrop" onClick={()=>setNoticeOpen(false)}><div className="noticeModal" onClick={e=>e.stopPropagation()}><div className="modalHead"><div><small>COMUNICAÇÃO</small><h2>Notificação narrada</h2></div><button onClick={()=>setNoticeOpen(false)}>×</button></div><p>A mensagem será exibida e narrada nos dispositivos conectados com o site ativo.</p><textarea value={noticeText} onChange={e=>setNoticeText(e.target.value)} maxLength={240} placeholder="Ex.: Aguarde na entrada, estou chegando."/><div className="charCount">{noticeText.length}/240</div><button className="primary" onClick={sendNotice}>Enviar e narrar</button></div></div>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
