(()=>{
'use strict';
const STYLE_ID='rotas-premium-v6';
const installStyle=()=>{
 if(document.getElementById(STYLE_ID))return;
 const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
:root{--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px);--premium:#1689ff;--premium-green:#57dfa0}
body{overscroll-behavior:none;-webkit-tap-highlight-color:transparent}
.app{padding-top:var(--safe-top);padding-bottom:var(--safe-bottom)}
header{min-height:64px;height:64px;background:linear-gradient(180deg,#08151f 0%,#07121b 100%);box-shadow:0 8px 28px #0003}
.brandMark{background:linear-gradient(145deg,#fff,#cfe9ff)!important;box-shadow:0 8px 22px #0005,0 0 0 1px #ffffff16}
.menuTrigger{border-color:#385264!important;background:#10202c!important;box-shadow:0 8px 24px #0004}
.tabs{background:#07121b!important;padding:8px 10px!important}.tabs button{transition:transform .14s ease,background .14s ease}.tabs button:active{transform:scale(.98)}
.routeHud{border-color:#355063!important;background:linear-gradient(145deg,#07131df2,#0b1c28ed)!important;box-shadow:0 18px 50px #0008!important}
.gpsPill{background:#0c1c27!important}.gpsLivePanel{border-color:#315267!important;background:#06131df2!important}
.maneuverCard{border:1px solid #4a7591!important;background:linear-gradient(145deg,#071823f7,#0b2230f5)!important;box-shadow:0 20px 55px #000a!important}
.maneuverArrow{background:linear-gradient(145deg,#fff,#d9efff)!important;box-shadow:0 8px 24px #0006}
.mapTools button{min-width:44px;min-height:44px;border-color:#355062!important;background:#071722ed!important;box-shadow:0 10px 26px #0006!important}.mapTools button.active{background:#f3f8fb!important;color:#071018!important}
.driveHud>div{border-color:#304958!important;background:#071823ef!important;box-shadow:0 10px 28px #0005}.driveHud b{font-variant-numeric:tabular-nums}
.summary,.editor{background:linear-gradient(180deg,#0b1721,#09131c)}
.summaryHead h1,.sectionTitle h2{letter-spacing:-.045em}.start,.primary{background:linear-gradient(135deg,#f8fbfd,#dcebf4)!important;box-shadow:0 12px 30px #0005}.danger{box-shadow:0 10px 24px #0004}.secondary{background:#0f1e29!important}
.stop>span{background:linear-gradient(145deg,#183344,#11232e)!important;border-color:#436476!important}.confirmed{color:#62e1a2!important}
.premiumRouteBadge{display:inline-flex;align-items:center;gap:6px;margin-top:9px;padding:6px 9px;border:1px solid #285e47;border-radius:999px;background:#0c2a1d;color:#8de7b6;font-size:9px;font-weight:900;letter-spacing:.02em}.premiumRouteBadge:before{content:'✓';font-size:10px}
.premiumDriveState{position:absolute;z-index:680;right:14px;top:157px;display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid #2f5668;border-radius:999px;background:#071722e8;color:#bfe0ef;font-size:9px;font-weight:850;box-shadow:0 10px 30px #0005;backdrop-filter:blur(14px)}.premiumDriveState:before{content:'';width:8px;height:8px;border-radius:50%;background:#57dfa0;box-shadow:0 0 0 4px #57dfa01c}
.offline .premiumDriveState:before{background:#f2b95e}.offline .premiumDriveState{color:#f6d596}
@media(max-width:800px){header{height:calc(58px + var(--safe-top));padding-top:var(--safe-top)}.app{padding-top:0}.driving header{height:calc(58px + var(--safe-top))!important;padding-top:var(--safe-top)!important}.driving .routeHud{top:calc(66px + var(--safe-top))!important;left:8px!important;right:8px!important}.driving .gpsLivePanel{top:calc(140px + var(--safe-top))!important;left:8px!important;right:8px!important}.driving .maneuverCard{top:calc(195px + var(--safe-top))!important;left:8px!important;right:8px!important}.premiumDriveState{top:auto;right:8px;bottom:calc(204px + var(--safe-bottom));font-size:8px}.driving .mapTools{left:8px!important;bottom:calc(148px + var(--safe-bottom))!important}.driving .driveHud{left:8px!important;right:8px!important;bottom:calc(88px + var(--safe-bottom))!important}.driving aside:not(.drawer){left:8px!important;right:8px!important;bottom:calc(8px + var(--safe-bottom))!important}.mapTools button{width:44px!important;height:44px!important;border-radius:14px!important}.maneuverCard strong{font-size:15px!important}.maneuverCard span{font-size:11px!important}.driveHud>div{padding:9px!important}}
@media(max-width:430px){.routeHud strong{font-size:14px!important}.routeHud span{font-size:8px!important}.gpsPill{min-width:74px!important}.premiumDriveState{bottom:calc(198px + var(--safe-bottom))}.driveHud{grid-template-columns:1.15fr 1fr 1fr 1fr!important}}
`;
 document.head.appendChild(s);
};
const parseDistance=txt=>{const t=String(txt||'').toLowerCase().trim();const n=parseFloat(t.replace(',','.'));if(!Number.isFinite(n))return null;return /km/.test(t)?n*1000:n};
const patchVoice=()=>{
 if(!window.speechSynthesis||speechSynthesis.__rotasPremiumPatched)return;
 const native=speechSynthesis.speak.bind(speechSynthesis);
 try{speechSynthesis.speak=u=>{
   try{
     const d=parseDistance(document.querySelector('.maneuverCard span')?.textContent);
     if(Number.isFinite(d)&&u&&typeof u.text==='string'){
       if(d<=35&&/^Em 300 metros,?\s*/i.test(u.text))u.text=u.text.replace(/^Em 300 metros,?\s*/i,'Agora, ');
       else if(d<=120&&/^Em 300 metros,?\s*/i.test(u.text))u.text=u.text.replace(/^Em 300 metros,?\s*/i,'Em 100 metros, ');
     }
   }catch{}
   return native(u);
 };speechSynthesis.__rotasPremiumPatched=true}catch{}
};
const syncBadges=()=>{
 const summary=document.querySelector('.summaryHead>div');
 if(summary&&!summary.querySelector('.premiumRouteBadge')&&document.querySelector('.start:not(:disabled)')){
   const b=document.createElement('div');b.className='premiumRouteBadge';b.textContent='Rota mais rápida otimizada';summary.appendChild(b);
 }
 const wrap=document.querySelector('.mapWrap');
 if(document.querySelector('.app.driving')){
   if(wrap&&!wrap.querySelector('.premiumDriveState')){const d=document.createElement('div');d.className='premiumDriveState';d.textContent='Acompanhamento automático';wrap.appendChild(d)}
 }else wrap?.querySelector('.premiumDriveState')?.remove();
};
installStyle();patchVoice();syncBadges();
new MutationObserver(syncBadges).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
})();