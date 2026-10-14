// Service worker source. Served at /sw.js by api/sw.js with VERSION = the deploy's git commit sha,
// so every deploy gets a new cache name and old caches are deleted on activate.
module.exports = (VERSION) => `const VERSION=${JSON.stringify(VERSION)};const SHELL='cd-shell-'+VERSION,API='cd-api-v1';
const ASSETS=['/','/index.html','/alcohol.js','/match.js','/meals.js','/conditions.js','/manifest.webmanifest','/data/recipes.json','/data/price_estimates.json','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png','/icons/apple-touch-icon.png','/icons/favicon-32.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(SHELL).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'}))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('cd-shell-')&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/_vercel/'))return; // never cache or intercept Vercel analytics
  if(u.pathname==='/api/deals'){ // network-first; cached copy is flagged so the page never presents it as fresh
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(API).then(x=>x.put('/api/deals',c))}return r})
      .catch(()=>caches.open(API).then(x=>x.match('/api/deals')).then(r=>{if(!r)return new Response(JSON.stringify({error:'offline'}),{status:503,headers:{'Content-Type':'application/json'}});
        return r.blob().then(b=>new Response(b,{status:200,headers:{'Content-Type':'application/json','X-CD-Cache':'offline'}}))})));return}
  if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(SHELL).then(x=>x.put('/index.html',c));return r}).catch(()=>caches.match('/index.html',{ignoreSearch:true})));return}
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(c=>c||fetch(e.request).then(r=>{if(r.ok&&u.pathname.startsWith('/data/')){const cl=r.clone();caches.open(SHELL).then(x=>x.put(e.request,cl))}return r})));});
`;
