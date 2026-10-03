const CACHE_NAME="rl-replay-viewer-shell-v1";

self.addEventListener("install",()=>self.skipWaiting());

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;

  if(request.mode==="navigate"){
    event.respondWith(
      fetch(new Request(request,{cache:"no-store"}))
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached||Response.error()))
    );
    return;
  }

  if(request.destination==="script"||request.destination==="style"||request.destination==="font"||request.destination==="image"){
    event.respondWith(
      caches.match(request).then(cached=>cached||fetch(request).then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
        }
        return response;
      }))
    );
  }
});
