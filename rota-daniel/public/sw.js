const CACHE='rotas-empresa-shell-v1';
const SHELL=['/','/index.html','/history.js','/stability.js'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rotas-empresa-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.pathname==='/ws'||url.pathname.startsWith('/api/'))return;
  if(url.origin===self.location.origin){
    event.respondWith(fetch(req).then(r=>{
      const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});return r;
    }).catch(()=>caches.match(req).then(r=>r||caches.match('/index.html'))));
    return;
  }
  if(/tile\.openstreetmap\.org|server\.arcgisonline\.com/.test(url.hostname)){
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{
      const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});return r;
    })));
  }
});
