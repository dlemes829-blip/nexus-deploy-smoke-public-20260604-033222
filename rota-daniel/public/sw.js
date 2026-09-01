const SHELL_CACHE='rotas-empresa-shell-v2';
const TILE_CACHE='rotas-empresa-tiles-v2';
const SHELL=['/','/index.html','/history.js','/stability.js','/gps-roadmatch.js','/trip-companion.js','/premium-v6.js','/nav-live.css'];
const MAX_TILES=180;

async function trimCache(name,max){
  try{const c=await caches.open(name),keys=await c.keys();if(keys.length<=max)return;await Promise.all(keys.slice(0,keys.length-max).map(k=>c.delete(k)))}catch{}
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const c=await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL.map(async u=>{try{const r=await fetch(u,{cache:'reload'});if(r.ok)await c.put(u,r.clone())}catch{}}));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>(k.startsWith('rotas-empresa-shell-')&&k!==SHELL_CACHE)||(k.startsWith('rotas-empresa-tiles-')&&k!==TILE_CACHE)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.pathname==='/ws'||url.pathname.startsWith('/api/'))return;

  if(url.origin===self.location.origin){
    if(req.mode==='navigate'){
      event.respondWith((async()=>{
        try{const r=await fetch(req);if(r.ok){const c=await caches.open(SHELL_CACHE);c.put('/index.html',r.clone()).catch(()=>{})}return r}
        catch{return(await caches.match('/index.html'))||Response.error()}
      })());
      return;
    }
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      try{
        const fresh=await fetch(req);
        if(fresh.ok){const c=await caches.open(SHELL_CACHE);c.put(req,fresh.clone()).catch(()=>{})}
        return fresh;
      }catch{return cached||Response.error()}
    })());
    return;
  }

  if(/tile\.openstreetmap\.org|server\.arcgisonline\.com/.test(url.hostname)){
    event.respondWith((async()=>{
      const c=await caches.open(TILE_CACHE),hit=await c.match(req);
      if(hit)return hit;
      try{const r=await fetch(req);if(r.ok){c.put(req,r.clone()).then(()=>trimCache(TILE_CACHE,MAX_TILES)).catch(()=>{})}return r}catch{return Response.error()}
    })());
  }
});
