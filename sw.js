const C='screenshot-tool-v4';
const A=["./","index.html","app.css","app.js","icon.svg","manifest.webmanifest","img/monitor.png","img/laptop.png","img/tablet.png","img/tablet-quer.png","img/phone.png","img/phone-quer.png","fonts/Metropolis-Regular.woff2","fonts/Metropolis-Bold.woff2","fonts/josefin-sans-v32-latin-regular.woff2","fonts/josefin-sans-v32-latin-700.woff2"];
self.addEventListener('install',(e)=>{e.waitUntil(caches.open(C).then((c)=>c.addAll(A)));self.skipWaiting();});
self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then((k)=>Promise.all(k.filter((x)=>x!==C).map((x)=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',(e)=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;e.respondWith(caches.match(e.request).then((r)=>r||fetch(e.request)));});
