(()=>{
'use strict';
const geo=navigator.geolocation;
const nativeWatch=geo?.watchPosition?.bind(geo),nativeClear=geo?.clearWatch?.bind(geo);
if(!nativeWatch||!nativeClear)return;
const tracks=new Map();let seq=0;
const meters=(a,b)=>{const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
const bearing=(a,b)=>{const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180,y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(Math.atan2(y,x)*180/Math.PI+360)%360};
const angle=(a,b)=>Math.abs(((a-b+540)%360)-180);
const mkPosition=(raw,point,heading,accuracy)=>({coords:{latitude:point.lat,longitude:point.lon,accuracy:Number.isFinite(accuracy)?accuracy:raw.coords.accuracy,altitude:raw.coords.altitude,altitudeAccuracy:raw.coords.altitudeAccuracy,heading:Number.isFinite(heading)?heading:raw.coords.heading,speed:raw.coords.speed},timestamp:raw.timestamp});
const timeoutFetch=async(url,ms=4500)=>{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),ms);try{const r=await fetch(url,{signal:ctrl.signal,cache:'no-store'});if(!r.ok)throw Error(`http_${r.status}`);return await r.json()}finally{clearTimeout(timer)}};
async function nearest(point){const j=await timeoutFetch(`https://router.project-osrm.org/nearest/v1/driving/${point.lon},${point.lat}?number=1`),w=j.waypoints?.[0];if(!w?.location)return null;return{point:{lat:w.location[1],lon:w.location[0]},distance:+w.distance||0,source:'nearest'}}
async function match(samples){
 if(samples.length<3)return null;
 const coords=samples.map(x=>`${x.lon},${x.lat}`).join(';');
 const radiuses=samples.map(x=>Math.max(8,Math.min(45,Math.round((x.accuracy||20)*1.2)))).join(';');
 const j=await timeoutFetch(`https://router.project-osrm.org/match/v1/driving/${coords}?overview=false&steps=false&tidy=true&radiuses=${radiuses}`);
 const points=(j.tracepoints||[]).filter(Boolean),last=points.at(-1);
 if(!last?.location)return null;
 const raw=samples.at(-1),p={lat:last.location[1],lon:last.location[0]};
 return{point:p,distance:meters(raw,p),source:'match',confidence:Number(j.matchings?.[0]?.confidence||0)};
}
function start(success,error,options){
 const id=++seq,state={last:null,lastDelivered:null,lastSnap:null,lastSnapAt:0,inflight:false,samples:[]};tracks.set(id,state);
 const nativeId=nativeWatch(async raw=>{
   if(!tracks.has(id))return;
   const now=Date.now(),point={lat:raw.coords.latitude,lon:raw.coords.longitude},acc=Number.isFinite(raw.coords.accuracy)?raw.coords.accuracy:999;
   if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return;
   let heading=raw.coords.heading,derivedSpeed=null;
   if(state.last){
     const dt=Math.max(.25,(now-state.last.at)/1000),d=meters(state.last,point);derivedSpeed=d/dt;
     if(!Number.isFinite(heading)&&d>=3)heading=bearing(state.last,point);
     if(d<1.5&&Number.isFinite(state.last.heading))heading=state.last.heading;
     if(acc>120&&state.last.accuracy<45)return;
     if(derivedSpeed>80&&!Number.isFinite(raw.coords.speed))return;
   }
   state.last={...point,heading,accuracy:acc,at:now};
   state.lastDelivered=point;
   success(mkPosition(raw,point,heading,acc));

   if(acc<=60){state.samples.push({...point,accuracy:acc,heading,at:now});state.samples=state.samples.filter(x=>now-x.at<14000).slice(-6)}
   const speed=Number.isFinite(raw.coords.speed)?raw.coords.speed:(Number.isFinite(derivedSpeed)?derivedSpeed:0);
   const moving=speed>1.0||(state.samples.length>=2&&meters(state.samples.at(-2),point)>3);
   if(!moving||acc>55||state.inflight||now-state.lastSnapAt<2600)return;
   state.lastSnapAt=now;state.inflight=true;
   try{
     let result=null;
     if(state.samples.length>=3){try{result=await match(state.samples)}catch{}}
     if(!result)result=await nearest(point);
     if(!result||!tracks.has(id))return;
     const max=Math.max(16,Math.min(38,acc*1.15));
     if(result.distance>max)return;
     if(result.source==='match'&&Number.isFinite(result.confidence)&&result.confidence<.35)return;
     let snapHeading=heading;
     if(state.lastSnap){
       const sd=meters(state.lastSnap,result.point);
       if(sd>=2.5)snapHeading=bearing(state.lastSnap,result.point);
       if(Number.isFinite(heading)&&Number.isFinite(snapHeading)&&speed>2&&angle(heading,snapHeading)>70&&sd<22)return;
     }
     if(meters(point,result.point)<2.5){state.lastSnap=result.point;return}
     state.lastSnap=result.point;
     const effectiveAccuracy=Math.min(acc,Math.max(7,Math.round(result.distance+5)));
     success(mkPosition(raw,result.point,snapHeading,effectiveAccuracy));
     document.documentElement.dataset.roadMatched=result.source;
   }catch{}finally{state.inflight=false}
 },error,{...options,enableHighAccuracy:true,maximumAge:0,timeout:Math.max(8000,Number(options?.timeout)||0)});
 state.nativeId=nativeId;return id;
}
try{
 geo.watchPosition=start;
 geo.clearWatch=id=>{const s=tracks.get(id);if(s){nativeClear(s.nativeId);tracks.delete(id)}else nativeClear(id)};
}catch{}
})();
