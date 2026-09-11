const CACHE='nexus-x-v4';
const CORE=['./','./index.html','./app.js','./manifest.webmanifest','./icon.svg','./inventory.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached) return cached;
      return fetch(e.request).then(response=>{
        if(new URL(e.request.url).origin===location.origin){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(e.request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>caches.match('./index.html'));
    })
  );
});
