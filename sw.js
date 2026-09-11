const CACHE='nexus-x-v5';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./inventory.json'];
const APP_PATH=/\/app\.js(?:\?.*)?$/i;

const GITHUB_UPLOAD_PATCH = String.raw`
/* NEXUS-X HOTFIX: GitHub upload + repo detection */
if(typeof githubUploadDocument!=='function'){
  async function githubUploadDocument(file){
    if(!file || typeof file.arrayBuffer!=='function'){
      throw new Error('No se recibió un archivo válido.');
    }

    const maxBytes=(typeof DOC_MAX_BYTES==='number'&&DOC_MAX_BYTES>0)
      ? DOC_MAX_BYTES : 6*1024*1024;
    if(Number(file.size||0)>maxBytes){
      throw new Error(
        'Archivo demasiado grande ('+
        Math.round(Number(file.size||0)/1048576)+' MB). Límite '+
        (maxBytes/1048576)+' MB por documento.'
      );
    }

    const token=(typeof GITHUB_TOKEN_KEY!=='undefined'
      ? localStorage.getItem(GITHUB_TOKEN_KEY) : '') || '';

    if(!token){
      return {ok:false,needsToken:true,path:null,message:'No hay token de escritura de GitHub configurado.'};
    }

    const rawName=String(file.name||'documento').trim();
    const safeName=rawName
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g,'_')
      .replace(/\s+/g,' ')
      .replace(/^\.+/,'')
      .trim();

    if(!safeName)throw new Error('El archivo no tiene un nombre válido.');

    const path='documentos/'+safeName;
    const encodedPath=path.split('/').map(encodeURIComponent).join('/');
    const apiUrl='https://api.github.com/repos/'+encodeURIComponent(REPO_OWNER)+'/'+encodeURIComponent(REPO_NAME)+'/contents/'+encodedPath;
    const headers={
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json'
    };

    const toBase64=async blob=>{
      const bytes=new Uint8Array(await blob.arrayBuffer());
      const chunk=0x8000;
      let binary='';
      for(let i=0;i<bytes.length;i+=chunk){
        const part=bytes.subarray(i,Math.min(i+chunk,bytes.length));
        binary+=String.fromCharCode.apply(null,part);
      }
      return btoa(binary);
    };

    const content=await toBase64(file);
    let existingSha=null;

    try{
      const check=await fetchTimeout(
        apiUrl+'?ref='+encodeURIComponent(REPO_BRANCH),
        {headers},
        12000
      );

      if(check.ok){
        const data=await check.json().catch(()=>({}));
        existingSha=data?.sha||null;
      }else if(check.status!==404){
        const data=await check.json().catch(()=>({}));
        throw new Error(
          'GitHub HTTP '+check.status+
          (data?.message?' · '+data.message:'')
        );
      }
    }catch(e){
      throw new Error('No se pudo comprobar el archivo en GitHub: '+(e?.message||e));
    }

    const body={
      message:existingSha?'Actualizar documento: '+safeName:'Agregar documento: '+safeName,
      content,
      branch:REPO_BRANCH
    };
    if(existingSha)body.sha=existingSha;

    const response=await fetchTimeout(
      apiUrl,
      {method:'PUT',headers,body:JSON.stringify(body)},
      30000
    );
    const data=await response.json().catch(()=>({}));

    if(!response.ok){
      const message=String(data?.message||'');
      if(response.status===401)throw new Error('Token de GitHub inválido o vencido.');
      if(response.status===403)throw new Error('GitHub rechazó la escritura (403). Verificá que el token tenga permiso Contents: Read and write sobre el repositorio.');
      if(response.status===404)throw new Error('Repositorio no encontrado: '+REPO_OWNER+'/'+REPO_NAME+'.');
      if(response.status===409)throw new Error('Conflicto con GitHub. El archivo cambió mientras se intentaba guardar. Reintentá.');
      if(response.status===422)throw new Error('GitHub rechazó los datos enviados'+(message?' · '+message:'.'));
      throw new Error('GitHub HTTP '+response.status+(message?' · '+message:''));
    }

    return {
      ok:true,
      path,
      sha:data?.content?.sha||null,
      commitSha:data?.commit?.sha||null,
      url:'https://raw.githubusercontent.com/'+REPO_OWNER+'/'+REPO_NAME+'/'+REPO_BRANCH+'/'+encodedPath
    };
  }
}
`;

function patchApp(source){
  let text=source;
  if(!/function githubUploadDocument\s*\(/.test(text)){
    const marker="'use strict';";
    if(text.includes(marker)) text=text.replace(marker,marker+'\n'+GITHUB_UPLOAD_PATCH);
    else text=GITHUB_UPLOAD_PATCH+'\n'+text;
  }

  // The original fallback pointed at NEXUS-X-. On GitHub Pages the path is
  // detected correctly; elsewhere the real repository must remain usable.
  text=text.replace(
    "(path[0]||'NEXUS-X-'):'NEXUS-X-'",
    "(path[0]||'laboratorio-escolar'):'laboratorio-escolar'"
  );

  return text;
}

async function networkResponse(request){
  const response=await fetch(request,{cache:'no-store'});
  if(!response.ok)return response;
  const source=await response.text();
  const patched=patchApp(source);
  return new Response(patched,{
    status:response.status,
    statusText:response.statusText,
    headers:new Headers(response.headers)
  });
}

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);

  // Never interfere with APIs/CDNs/GitHub itself.
  if(url.origin!==location.origin)return;

  if(APP_PATH.test(url.pathname)){
    event.respondWith(
      networkResponse(event.request).catch(()=>
        caches.match('./app.js').then(cached=>cached||fetch(event.request))
      )
    );
    return;
  }

  if(url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match(event.request).then(c=>c||caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached)return cached;
      return fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
        return response;
      }).catch(()=>caches.match('./index.html'));
    })
  );
});
