(()=>{
  'use strict';
  const originalFetch=window.fetch.bind(window);
  const isRouteRequest=input=>{
    const u=typeof input==='string'?input:input?.url||'';
    return /router\.project-osrm\.org\/route\/v1\/driving\//.test(u);
  };
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  window.fetch=async function(input,init){
    if(!isRouteRequest(input)) return originalFetch(input,init);
    let lastError;
    for(let attempt=0;attempt<3;attempt++){
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),7000+attempt*1500);
      try{
        const r=await originalFetch(input,{...init,signal:ctrl.signal});
        clearTimeout(timer);
        if(r.ok) return r;
        lastError=new Error(`route_http_${r.status}`);
      }catch(e){
        clearTimeout(timer);
        lastError=e;
      }
      if(attempt<2) await sleep(300+attempt*450);
    }
    throw lastError||new Error('route_unavailable');
  };

  const ensureStatus=()=>{
    let el=document.getElementById('network-health');
    if(el)return el;
    el=document.createElement('div');
    el.id='network-health';
    el.setAttribute('role','status');
    el.style.cssText='position:fixed;z-index:8500;left:50%;top:8px;transform:translateX(-50%);padding:7px 11px;border-radius:999px;background:#0b1822e8;color:#fff;border:1px solid #345064;font:800 10px Inter,system-ui;box-shadow:0 8px 24px #0005;display:none;pointer-events:none';
    document.body.appendChild(el);
    return el;
  };
  const updateNetwork=()=>{
    const el=ensureStatus();
    if(navigator.onLine){el.style.display='none';document.documentElement.classList.remove('offline')}else{el.textContent='Sem internet · GPS continua localmente';el.style.display='block';document.documentElement.classList.add('offline')}
  };
  addEventListener('online',updateNetwork,{passive:true});
  addEventListener('offline',updateNetwork,{passive:true});
  addEventListener('pageshow',updateNetwork,{passive:true});

  if('serviceWorker'in navigator){
    addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}),{once:true});
  }

  document.addEventListener('visibilitychange',()=>{
    document.documentElement.classList.toggle('app-hidden',document.hidden);
  },{passive:true});

  window.addEventListener('unhandledrejection',e=>{
    const msg=String(e?.reason?.message||e?.reason||'');
    if(/AbortError|route_unavailable|Failed to fetch/i.test(msg)) e.preventDefault();
  });

  updateNetwork();
})();
