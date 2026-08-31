import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import L from'leaflet';
import'leaflet/dist/leaflet.css';
import'./style.css';

const uid=()=>Math.random().toString(36).slice(2,10);
const city='Ponta Grossa - PR, Brasil';
const BASE_STOPS=[
 {id:'luciane',name:'Luciane',label:'Luciane',address:'Rua Orlando Marcondes, Ponta Grossa - PR, Brasil',type:'start',confirmed:false},
 {id:'daniel',name:'Daniel',label:'Daniel',address:'Rua Tobias Moscoso, 38, Ponta Grossa - PR, Brasil',type:'stop',confirmed:false},
 {id:'evelyn',name:'Evelyn',label:'Evelyn',address:'Rua Abatia, 140, Ponta Grossa - PR, Brasil',type:'stop',confirmed:false},
 {id:'empresa',name:'Empresa',label:'Odonto Excellence São Francisco',address:'Rua Eusébio de Queirós, 1120, Ponta Grossa - PR, Brasil',type:'end',confirmed:false}
];
const HUMOR=[
 'Atenção: o carro está em movimento e a preguiça ficou oficialmente para trás 😂',
 'Seguimos firmes. O GPS está trabalhando mais que muita gente numa segunda-feira 😄',
 'Próxima parada chegando. Embarque executivo em instantes 😎',
 'Tudo certo na rota. Quem trouxe café sobe automaticamente no ranking da carona ☕',
 'Rota sob controle. Drama só depois do expediente 😂'
];
const fmtTime=s=>s?`${Math.max(1,Math.round(s/60))} min`:'—';
const fmtKm=m=>m?`${(m/1000).toFixed(1)} km`:'—';
const cloneStops=()=>BASE_STOPS.map(x=>({...x}));

function pickVoice(){
 if(!('speechSynthesis'in window))return null;
 const voices=speechSynthesis.getVoices();
 return voices.find(v=>/google/i.test(v.name)&&/pt[-_ ]?br|portugu/i.test(`${v.lang} ${v.name}`))
  ||voices.find(v=>/pt[-_]?br/i.test(v.lang))
  ||voices.find(v=>/^pt/i.test(v.lang))||null;
}
function speak(text,rate=.98){
 if(!('speechSynthesis'in window))return;
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=rate;const v=pickVoice();if(v)u.voice=v;speechSynthesis.speak(u);
}
function notify(title,body){
 try{if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body,tag:'rota-daniel'})}catch{}
 if(navigator.vibrate)navigator.vibrate([80,45,80]);
}
function instructionPt(step,d){
 const m=step.maneuver||{},mod=m.modifier||'';let dir='siga em frente';
 if(m.type==='turn'||m.type==='continue'){if(mod.includes('left'))dir='vire à esquerda';else if(mod.includes('right'))dir='vire à direita'}
 if(m.type==='fork')dir=mod.includes('left')?'mantenha-se à esquerda':'mantenha-se à direita';
 if(m.type==='roundabout'||m.type==='rotary')dir='entre na rotatória e siga pela saída indicada';
 if(m.type==='arrive')dir='você chegou ao destino';
 return d>45?`Em ${Math.max(50,Math.round(d/50)*50)} metros, ${dir}.`:`Agora, ${dir}.`;
}

function AddressField({stop,index,onChange,onConfirm,onUseGps,onClear}){
 const[query,setQuery]=useState(stop.address||''),[items,setItems]=useState([]),[loading,setLoading]=useState(false),[open,setOpen]=useState(false),timer=useRef();
 useEffect(()=>setQuery(stop.address||''),[stop.address]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const search=v=>{
  setQuery(v);onChange(v);setOpen(true);clearTimeout(timer.current);
  if(v.trim().length<3){setItems([]);return}
  timer.current=setTimeout(async()=>{try{setLoading(true);const r=await fetch(`/api/search?q=${encodeURIComponent(v)}`);const j=await r.json();setItems(Array.isArray(j)?j:[])}catch{setItems([])}finally{setLoading(false)}},240)
 };
 return <div className="addressWrap">
  <div className={'addressBox '+(stop.confirmed?'confirmed':'')}>
   <span className="searchIcon">⌕</span>
   <input value={query} onFocus={()=>setOpen(true)} onChange={e=>search(e.target.value)} placeholder="Rua, número ou local" autoComplete="off"/>
   {query&&<button className="clearAddress" onClick={()=>{setQuery('');setItems([]);onClear()}} aria-label="Limpar endereço">×</button>}
   {stop.confirmed&&<span className="check">✓</span>}
  </div>
  {open&&<div className="suggestions">
   {loading&&<div className="suggestState">Buscando em Ponta Grossa…</div>}
   {!loading&&items.map((x,i)=><button key={`${x.lat}-${x.lon}-${i}`} onMouseDown={e=>e.preventDefault()} onClick={()=>{onConfirm(x);setQuery(x.display);setOpen(false);setItems([])}}><span className="pinSm">⌖</span><div><b>{x.title||x.display}</b><small>{x.subtitle||city}{x.approximate?' • número não obrigatório':''}</small></div></button>)}
   {!loading&&query.trim().length>=3&&items.length===0&&<div className="suggestState"><b>Não achei exatamente esse texto.</b><br/>Você pode continuar digitando ou usar a rua sem número.</div>}
   {index===0&&<button className="gpsSuggestion" onClick={()=>{onUseGps();setOpen(false)}}><span>◎</span><div><b>Usar localização atual</b><small>Ideal para a motorista</small></div></button>}
  </div>}
 </div>
}

function App(){
 const params=new URLSearchParams(location.search),initialRoom=params.get('sala')||'trabalho-daniel';
 const savedTrips=()=>{try{return JSON.parse(localStorage.getItem('rota-trips-v4'))||null}catch{return null}};
 const initial=savedTrips()||{ida:cloneStops(),volta:[...cloneStops()].reverse().map((x,i,a)=>({...x,type:i===0?'start':i===a.length-1?'end':'stop'}))};
 const[room]=useState(initialRoom),[name,setName]=useState(()=>localStorage.getItem('rota-name')||'Daniel'),[trips,setTrips]=useState(initial),[direction,setDirection]=useState('ida'),[route,setRoute]=useState(null),[busy,setBusy]=useState(false),[online,setOnline]=useState(1),[gps,setGps]=useState(null),[gpsOn,setGpsOn]=useState(false),[voice,setVoice]=useState(()=>localStorage.getItem('rota-voice')!=='0'),[status,setStatus]=useState('planejando'),[view,setView]=useState('rota'),[menuOpen,setMenuOpen]=useState(false),[messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[toast,setToast]=useState(''),[optimized,setOptimized]=useState(false),[lastSpoken,setLastSpoken]=useState(''),[customNotice,setCustomNotice]=useState(''),[customSpeak,setCustomSpeak]=useState(true),[humorOn,setHumorOn]=useState(()=>localStorage.getItem('rota-humor')!=='0'),[conn,setConn]=useState('conectando'),[permissionGate,setPermissionGate]=useState(()=>localStorage.getItem('rota-permissions-v4')!=='done'),[followCar,setFollowCar]=useState(true),[nextStopIndex,setNextStopIndex]=useState(0),[routeStops,setRouteStops]=useState([]),[permissionState,setPermissionState]=useState({location:'pendente',notification:'pendente',voice:'disponível'});
 const mapRef=useRef(),routeLayer=useRef(),gpsMarker=useRef(),wsRef=useRef(),watchRef=useRef(),msgEnd=useRef(),reconnectRef=useRef(0),humorTimer=useRef(),lastGpsRef=useRef(null),arrivedRef=useRef(new Set());
 const stops=trips[direction]||[];
 const currentNext=routeStops[nextStopIndex]||null;
 const flash=t=>{setToast(t);setTimeout(()=>setToast(''),3600)};
 const sendWS=data=>{if(wsRef.current?.readyState===1)wsRef.current.send(JSON.stringify(data))};
 const announce=(text,{fun=false,forceSpeak=false}={})=>{const body=fun&&humorOn?`${text} ${HUMOR[Math.floor(Math.random()*HUMOR.length)]}`:text;flash(body);notify('Rota Daniel',body);if(voice||forceSpeak)speak(body)};
 const saveTrips=t=>{setTrips(t);localStorage.setItem('rota-trips-v4',JSON.stringify(t))};
 const setStops=updater=>{const next=typeof updater==='function'?updater(stops):updater;saveTrips({...trips,[direction]:next});sendWS({type:'state',state:{trips:{...trips,[direction]:next},direction}})};

 useEffect(()=>{history.replaceState(null,'',`?sala=${room}`);if(!mapRef.current){mapRef.current=L.map('map',{zoomControl:false,attributionControl:true,preferCanvas:true}).setView([-25.095,-50.161],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(mapRef.current);L.control.zoom({position:'bottomright'}).addTo(mapRef.current)}},[]);
 useEffect(()=>{localStorage.setItem('rota-name',name);localStorage.setItem('rota-voice',voice?'1':'0');localStorage.setItem('rota-humor',humorOn?'1':'0')},[name,voice,humorOn]);
 useEffect(()=>{let closed=false;const connect=()=>{setConn('conectando');const proto=location.protocol==='https:'?'wss':'ws',ws=new WebSocket(`${proto}://${location.host}/ws?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}`);wsRef.current=ws;ws.onopen=()=>{reconnectRef.current=0;setConn('online')};ws.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch{return}if(d.type==='snapshot'){setOnline(d.count||1);setMessages(d.messages||[]);if(d.gps)setGps(d.gps);setStatus(d.status||'planejando');if(d.state?.trips)setTrips(d.state.trips);else if(d.state?.stops)setTrips(t=>({...t,[d.state.direction||'ida']:d.state.stops}))}if(d.type==='presence')setOnline(d.count||1);if(d.type==='message')setMessages(m=>m.some(x=>x.id===d.message.id)?m:[...m,d.message]);if(d.type==='gps')setGps(d.gps);if(d.type==='state'&&d.state?.trips)setTrips(d.state.trips);if(d.type==='status')setStatus(d.status);if(d.type==='notification')announce(d.notification.text,{forceSpeak:d.notification.speak});};ws.onclose=()=>{if(closed)return;setConn('reconectando');setTimeout(connect,Math.min(10000,1000*2**Math.min(reconnectRef.current++,3)))}};connect();return()=>{closed=true;wsRef.current?.close()}},[room,name]);
 useEffect(()=>{msgEnd.current?.scrollIntoView({behavior:'smooth'})},[messages,view]);
 useEffect(()=>{if(!gps||!mapRef.current)return;const ll=[gps.lat,gps.lon],heading=Number.isFinite(gps.heading)?gps.heading:0;if(gpsMarker.current){gpsMarker.current.setLatLng(ll);gpsMarker.current.setIcon(carIcon(heading))}else gpsMarker.current=L.marker(ll,{icon:carIcon(heading),zIndexOffset:1200}).addTo(mapRef.current).bindTooltip('Motorista • ao vivo',{direction:'top'});if(status==='em_rota'&&followCar)mapRef.current.setView(ll,Math.max(mapRef.current.getZoom(),16),{animate:true});lastGpsRef.current=gps},[gps,status,followCar]);
 useEffect(()=>{if(!voice||!route||!gps)return;const steps=route.legs.flatMap(l=>l.steps||[]).filter(s=>s.maneuver?.location);let best=null;for(const s of steps){const[lon,lat]=s.maneuver.location,d=mapRef.current.distance([gps.lat,gps.lon],[lat,lon]);if(!best||d<best.d)best={s,d}}if(best&&best.d<230){const text=instructionPt(best.s,best.d);if(text!==lastSpoken){setLastSpoken(text);speak(text)}}},[gps,voice,route,lastSpoken]);
 useEffect(()=>{if(status!=='em_rota'||!gps||routeStops.length<2)return;let candidate=nextStopIndex||1;candidate=Math.max(1,candidate);const target=routeStops[candidate];if(!target)return;const d=mapRef.current.distance([gps.lat,gps.lon],[target.lat,target.lon]);if(d<130&&!arrivedRef.current.has(target.id)){arrivedRef.current.add(target.id);announce(`Chegando em ${target.label}.`,{fun:true});setNextStopIndex(i=>Math.min(i+1,routeStops.length-1));sendWS({type:'notification',text:`Chegando em ${target.label}.`,speak:true})}},[gps,status,routeStops,nextStopIndex]);
 useEffect(()=>{clearInterval(humorTimer.current);if(status==='em_rota'&&voice&&humorOn)humorTimer.current=setInterval(()=>announce(HUMOR[Math.floor(Math.random()*HUMOR.length)],{forceSpeak:true}),8*60*1000);return()=>clearInterval(humorTimer.current)},[status,voice,humorOn]);

 const carIcon=heading=>L.divIcon({className:'carMarker',html:`<div class="carPulse"></div><div class="carCore" style="transform:rotate(${heading||0}deg)"><span>▲</span></div>`,iconSize:[58,58],iconAnchor:[29,29]});
 const setStop=(id,patch)=>setStops(a=>a.map(x=>x.id===id?{...x,...patch}:x));
 const confirmAddress=(id,x)=>{setStop(id,{address:x.display,lat:+x.lat,lon:+x.lon,display:x.display,confirmed:true,approximate:Boolean(x.approximate)});flash(x.approximate?'Rua selecionada sem número ✓':'Endereço confirmado ✓')};
 const useCurrentLocation=id=>{if(!navigator.geolocation)return flash('GPS indisponível neste navegador.');navigator.geolocation.getCurrentPosition(p=>{const g={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};setStop(id,{address:'Localização atual da motorista',lat:g.lat,lon:g.lon,display:`GPS atual • precisão ±${Math.round(g.accuracy)} m`,confirmed:true});setGps(g);mapRef.current?.setView([g.lat,g.lon],17);flash('Localização atual selecionada ✓')},e=>flash(`Localização: ${e.message}`),{enableHighAccuracy:true,timeout:15000,maximumAge:1000})};
 const resolveStop=async s=>{if(s.confirmed&&Number.isFinite(s.lat)&&Number.isFinite(s.lon))return s;if(!s.address?.trim())throw new Error(`Preencha o local de ${s.label}.`);const r=await fetch(`/api/search?q=${encodeURIComponent(s.address)}`),j=await r.json();if(!j[0])throw new Error(`Não encontrei “${s.address}”. Se não houver número, digite somente a rua e selecione a sugestão.`);return{...s,address:j[0].display,display:j[0].display,lat:+j[0].lat,lon:+j[0].lon,confirmed:true,approximate:Boolean(j[0].approximate)}};
 const calculate=async(opt=true)=>{try{setBusy(true);if(stops.length<2)throw new Error('A rota precisa de pelo menos dois locais.');let resolved=[];for(const s of stops)resolved.push(await resolveStop(s));const coords=resolved.map(s=>`${s.lon},${s.lat}`).join(';');const url=opt&&resolved.length>3?`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=true`:`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,r=await fetch(url),data=await r.json();if(data.code!=='Ok')throw new Error('Não foi possível calcular o trajeto agora. Tente novamente.');const chosen=data.trips?.[0]||data.routes?.[0];if(data.trips?.[0]){resolved=data.waypoints.map((w,i)=>({i,order:w.waypoint_index})).sort((a,b)=>a.order-b.order).map(x=>resolved[x.i]);setOptimized(true)}else setOptimized(false);draw(chosen,resolved);setRoute(chosen);setRouteStops(resolved);setNextStopIndex(1);saveTrips({...trips,[direction]:resolved});sendWS({type:'state',state:{trips:{...trips,[direction]:resolved},direction}});announce(`${direction==='ida'?'Ida':'Volta'} pronta: ${fmtKm(chosen.distance)}, aproximadamente ${fmtTime(chosen.duration)}.`)}catch(e){flash(e.message||'Falha ao calcular rota.')}finally{setBusy(false)}};
 const draw=(r,rs)=>{routeLayer.current?.remove();const g=L.layerGroup().addTo(mapRef.current);L.geoJSON(r.geometry,{style:{weight:8,opacity:.92,color:'#2563eb'}}).addTo(g);rs.forEach((s,i)=>L.marker([s.lat,s.lon],{icon:L.divIcon({className:'routePin',html:`<span>${i+1}</span>`,iconSize:[34,34],iconAnchor:[17,17]})}).addTo(g).bindPopup(`<b>${s.label}</b><br>${s.display||s.address}`));routeLayer.current=g;mapRef.current.fitBounds(L.geoJSON(r.geometry).getBounds(),{padding:[55,55]})};
 const swap=(i,j)=>{if(j<0||j>=stops.length)return;const n=[...stops];[n[i],n[j]]=[n[j],n[i]];n.forEach((x,k)=>x.type=k===0?'start':k===n.length-1?'end':'stop');setStops(n)};
 const add=()=>setStops(s=>[...s,{id:uid(),name:'Nova parada',label:'Nova parada',address:'',type:'end',confirmed:false}].map((x,i,a)=>({...x,type:i===0?'start':i===a.length-1?'end':'stop'})));
 const del=id=>{if(stops.length<=2)return flash('Mantenha pelo menos dois locais na viagem.');setStops(s=>s.filter(x=>x.id!==id).map((x,i,a)=>({...x,type:i===0?'start':i===a.length-1?'end':'stop'}))};
 const startGPS=async()=>{if(!navigator.geolocation)return flash('Seu navegador não oferece localização.');if(gpsOn){navigator.geolocation.clearWatch(watchRef.current);setGpsOn(false);announce('GPS ao vivo pausado.');return}watchRef.current=navigator.geolocation.watchPosition(p=>{const g={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed,heading:p.coords.heading};setGps(g);sendWS({type:'gps',...g})},e=>flash(`GPS: ${e.message}`),{enableHighAccuracy:true,maximumAge:700,timeout:15000});setGpsOn(true);setFollowCar(true);announce('GPS ao vivo ativado.')};
 const activatePermissions=async()=>{let loc='indisponível',noti='indisponível';try{if(navigator.geolocation){await new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>{const g={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed,heading:p.coords.heading};setGps(g);loc='permitida';resolve()},()=>{loc='negada';resolve()},{enableHighAccuracy:true,timeout:12000,maximumAge:1000}))}}catch{loc='negada'}try{if('Notification'in window){const p=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;noti=p==='granted'?'permitida':p==='denied'?'negada':'pendente'}}catch{noti='indisponível'}setVoice(true);setPermissionState({location:loc,notification:noti,voice:'ativa'});localStorage.setItem('rota-permissions-v4','done');setPermissionGate(false);if(gps)mapRef.current?.setView([gps.lat,gps.lon],16);speak('Rota Daniel pronto para a viagem.')};
 const startTrip=async()=>{if(!route)await calculate(true);if(!gpsOn)await startGPS();setStatus('em_rota');setFollowCar(true);sendWS({type:'status',status:'em_rota'});arrivedRef.current=new Set();announce('Viagem iniciada. Navegação ao vivo ativa.',{fun:true})};
 const stopTrip=()=>{setStatus('concluida');sendWS({type:'status',status:'concluida'});announce('Viagem concluída. Até a próxima.')};
 const share=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:'Rota Daniel',text:'Acompanhe a viagem em tempo real.',url});else{await navigator.clipboard.writeText(url);flash('Link copiado ✓')}}catch{}};
 const send=()=>{if(!draft.trim())return;const m={id:uid(),name,text:draft.trim()};sendWS({type:'message',...m});setMessages(x=>[...x,{...m,at:Date.now()}]);setDraft('')};
 const sendCustom=()=>{const text=customNotice.trim();if(!text)return flash('Digite uma notificação.');sendWS({type:'notification',text,speak:customSpeak});announce(text,{forceSpeak:customSpeak});setCustomNotice('')};
 const switchDirection=d=>{setDirection(d);setRoute(null);setRouteStops([]);setNextStopIndex(0);routeLayer.current?.remove();setView('rota');setMenuOpen(false)};
 const resetTrip=()=>{const t={...trips,[direction]:direction==='ida'?cloneStops():[...cloneStops()].reverse().map((x,i,a)=>({...x,type:i===0?'start':i===a.length-1?'end':'stop'}))};saveTrips(t);setRoute(null);routeLayer.current?.remove();flash('Rota restaurada para o padrão.')};
 const accuracy=gps?.accuracy?`±${Math.round(gps.accuracy)} m`:'—';

 return <div className="shell">
  {toast&&<div className="toast">{toast}</div>}
  {permissionGate&&<div className="permissionGate"><div className="permissionCard"><div className="permissionLogo">RD</div><h1>Preparar a viagem</h1><p>Ative os recursos essenciais para acompanhar o carro, receber avisos e ouvir a navegação.</p><div className="permissionList"><div>⌖ <span><b>Localização</b><small>GPS em tempo real durante a viagem</small></span></div><div>🔔 <span><b>Notificações</b><small>Avisos da sala quando o navegador permitir</small></span></div><div>🔊 <span><b>Voz</b><small>Navegação e avisos falados em português</small></span></div></div><button onClick={activatePermissions}>Ativar recursos da viagem</button><button className="skip" onClick={()=>setPermissionGate(false)}>Agora não</button></div></div>}
  <header><div className="brand"><div className="mark">RD</div><div><b>Rota Daniel</b><small>Sistema Rotas</small></div></div><div className="headerActions"><span className={'connDot '+conn}></span><button className="online">{online} online</button><button className="menuBtn" onClick={()=>setMenuOpen(true)}>☰</button></div></header>
  <div className="tripTabs"><button className={direction==='ida'?'active':''} onClick={()=>switchDirection('ida')}><span>IDA</span><small>Casa → Empresa</small></button><button className={direction==='volta'?'active':''} onClick={()=>switchDirection('volta')}><span>VOLTA</span><small>Empresa → Casa</small></button></div>
  <main>
   <section className={'mapArea '+(status==='em_rota'?'navigating':'')}>
    <div id="map"></div>
    <div className="mapHud"><div className="hudMain"><small>{status==='em_rota'?'EM VIAGEM':direction==='ida'?'IDA • TRABALHO':'VOLTA • CASA'}</small><strong>{status==='em_rota'&&currentNext?`Próxima: ${currentNext.label}`:route?'Rota pronta':'Planejamento da viagem'}</strong><span>{route?`${fmtTime(route.duration)} • ${fmtKm(route.distance)}`:'Ponta Grossa • PR'} {optimized?'• otimizada':''}</span></div>{status==='em_rota'&&<button className={'follow '+(followCar?'on':'')} onClick={()=>setFollowCar(v=>!v)}>◎</button>}</div>
    {status==='em_rota'&&gps&&<div className="liveBadge"><span>● AO VIVO</span><b>{accuracy}</b></div>}
    {status!=='em_rota'&&<button className="locate" onClick={()=>gps&&mapRef.current?.setView([gps.lat,gps.lon],17)}>◎</button>}
   </section>
   <section className={'sheet '+(status==='em_rota'?'compact':'')}>
    {view==='rota'&&<div className="panel routePanel">
     <div className="panelHead"><div><h1>{direction==='ida'?'Rota de ida':'Rota de volta'}</h1><p>{direction==='ida'?'Luciane → Daniel → Evelyn → Empresa':'Empresa → Evelyn → Daniel → Luciane'}</p></div><button className="shareBtn" onClick={share}>↗</button></div>
     {status==='em_rota'?<div className="navigationCard"><div className="navArrow">▲</div><div><small>PRÓXIMA PARADA</small><h2>{currentNext?.label||'Destino'}</h2><p>{currentNext?.address||'Acompanhe o carro no mapa em tempo real.'}</p></div><button onClick={()=>setView('avisos')}>Avisar</button></div>:<>
      <div className="stops">{stops.map((s,i)=><div className="stop" key={s.id}><div className={`dot ${s.type}`}>{i+1}</div><div className="stopBody"><div className="stopTop"><input className="nameInput" value={s.label} onChange={e=>setStop(s.id,{label:e.target.value,name:e.target.value})}/><div className="moves"><button onClick={()=>swap(i,i-1)}>↑</button><button onClick={()=>swap(i,i+1)}>↓</button><button className="danger" onClick={()=>del(s.id)}>×</button></div></div><AddressField stop={s} index={i} onChange={v=>setStop(s.id,{address:v,confirmed:false,lat:null,lon:null})} onConfirm={x=>confirmAddress(s.id,x)} onUseGps={()=>useCurrentLocation(s.id)} onClear={()=>setStop(s.id,{address:'',confirmed:false,lat:null,lon:null})}/>{s.approximate&&<small className="approx">Ponto aproximado da rua • número não informado</small>}</div></div>)}</div>
      <div className="routeTools"><button className="ghost" onClick={add}>＋ Adicionar parada</button><button className="ghost" onClick={resetTrip}>↺ Restaurar padrão</button></div>
      <div className="actions"><button className="primary" disabled={busy} onClick={()=>calculate(true)}>{busy?'Calculando…':'Calcular melhor rota'}</button><button className="secondary" disabled={busy} onClick={()=>calculate(false)}>Manter esta ordem</button></div>
      <button className="startMain" onClick={startTrip}>▶ Iniciar viagem</button>
     </>}
     {status==='em_rota'&&<div className="driveActions"><button onClick={()=>setView('chat')}>Chat</button><button onClick={()=>setView('avisos')}>Avisos</button><button onClick={stopTrip}>Encerrar</button></div>}
    </div>}
    {view==='chat'&&<div className="panel chat"><div className="subHead"><button onClick={()=>setView('rota')}>‹</button><div><h2>Chat da viagem</h2><p>{online} conectado{online!==1?'s':''} agora</p></div></div><div className="messages">{messages.length===0&&<div className="empty">Nenhuma mensagem ainda.</div>}{messages.map(m=><div key={m.id} className={'bubble '+(m.name===name?'me':'')}><b>{m.name}</b><div>{m.text}</div><small>{new Date(m.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} ✓✓</small></div>)}<div ref={msgEnd}/></div><div className="compose"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Mensagem…"/><button onClick={send}>➤</button></div></div>}
    {view==='avisos'&&<div className="panel notices"><div className="subHead"><button onClick={()=>setView('rota')}>‹</button><div><h2>Avisos da viagem</h2><p>Envie para todos e fale pelo sistema</p></div></div><textarea value={customNotice} onChange={e=>setCustomNotice(e.target.value)} placeholder="Ex.: Daniel, estamos chegando. Pode descer."/><label className="toggle"><input type="checkbox" checked={customSpeak} onChange={e=>setCustomSpeak(e.target.checked)}/><span>Falar este aviso nos celulares conectados</span></label><button className="primary" onClick={sendCustom}>Enviar aviso agora</button><div className="presetGrid">{['Estamos chegando. Pode se preparar.','Aguardando no local combinado.','Rota alterada. Confira o mapa.','Já estamos a caminho da empresa.'].map(t=><button key={t} onClick={()=>{setCustomNotice(t);setCustomSpeak(true)}}>{t}</button>)}</div></div>}
    {view==='ao-vivo'&&<div className="panel live"><div className="subHead"><button onClick={()=>setView('rota')}>‹</button><div><h2>Central ao vivo</h2><p>Conexão e recursos da viagem</p></div></div><div className="liveGrid"><div><small>Status</small><b>{status.replace('_',' ')}</b></div><div><small>GPS</small><b>{accuracy}</b></div><div><small>Conexão</small><b>{conn}</b></div><div><small>Online</small><b>{online}</b></div></div><label className="profile">Seu nome neste celular<input value={name} onChange={e=>setName(e.target.value)}/></label><div className="settingsRows"><button className={voice?'on':''} onClick={()=>{setVoice(v=>!v);if(!voice)speak('Voz ativada.')}}>🔊 Voz {voice?'ativa':'desativada'}</button><button className={humorOn?'on':''} onClick={()=>setHumorOn(v=>!v)}>😄 Humor {humorOn?'ativo':'desativado'}</button><button className={gpsOn?'on':''} onClick={startGPS}>⌖ GPS {gpsOn?'ao vivo':'desligado'}</button><button onClick={()=>setPermissionGate(true)}>🔐 Permissões</button></div><div className="permissionStatus"><span>Localização: {permissionState.location}</span><span>Notificação: {permissionState.notification}</span><span>Voz: {permissionState.voice}</span></div></div>}
   </section>
  </main>
  {menuOpen&&<div className="drawerBackdrop" onClick={()=>setMenuOpen(false)}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerHead"><div><b>Rota Daniel</b><small>Central da viagem</small></div><button onClick={()=>setMenuOpen(false)}>×</button></div><nav><button onClick={()=>{setView('rota');setMenuOpen(false)}}>⌖ <span>Rota</span><small>Planejamento e navegação</small></button><button onClick={()=>{setView('chat');setMenuOpen(false)}}>◉ <span>Chat</span><small>Mensagens em tempo real</small></button><button onClick={()=>{setView('avisos');setMenuOpen(false)}}>🔔 <span>Avisos</span><small>Notificações faladas</small></button><button onClick={()=>{setView('ao-vivo');setMenuOpen(false)}}>● <span>Ao vivo</span><small>GPS, voz e conexão</small></button></nav><div className="drawerTrips"><b>Viagem</b><button className={direction==='ida'?'active':''} onClick={()=>switchDirection('ida')}>Ida • Casa → Empresa</button><button className={direction==='volta'?'active':''} onClick={()=>switchDirection('volta')}>Volta • Empresa → Casa</button></div><button className="drawerShare" onClick={share}>Compartilhar sala</button></aside></div>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
