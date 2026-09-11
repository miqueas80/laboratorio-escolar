/*
 NEXUS-X — GitHub upload hotfix

Este archivo contiene la misma función que el service worker inyecta en app.js.
No hace falta cargarlo si usás el sw.js incluido; queda como respaldo/diagnóstico.
*/
async function githubUploadDocument(file){
  if(!file || typeof file.arrayBuffer!=='function') throw new Error('No se recibió un archivo válido.');
  const maxBytes=(typeof DOC_MAX_BYTES==='number'&&DOC_MAX_BYTES>0)?DOC_MAX_BYTES:6*1024*1024;
  if(Number(file.size||0)>maxBytes) throw new Error(`Archivo demasiado grande (${Math.round(file.size/1048576)} MB). Límite ${maxBytes/1048576} MB.`);
  const token=(typeof GITHUB_TOKEN_KEY!=='undefined'?localStorage.getItem(GITHUB_TOKEN_KEY):'')||'';
  if(!token)return {ok:false,needsToken:true,path:null,message:'No hay token de escritura de GitHub configurado.'};
  const safeName=String(file.name||'documento').trim().replace(/[\\/:*?"<>|\u0000-\u001F]/g,'_').replace(/\s+/g,' ').replace(/^\.+/,'').trim();
  if(!safeName)throw new Error('El archivo no tiene un nombre válido.');
  const path='documentos/'+safeName;
  const encodedPath=path.split('/').map(encodeURIComponent).join('/');
  const apiUrl=`https://api.github.com/repos/${encodeURIComponent(REPO_OWNER)}/${encodeURIComponent(REPO_NAME)}/contents/${encodedPath}`;
  const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
  const bytes=new Uint8Array(await file.arrayBuffer());
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
  const content=btoa(binary);
  let existingSha=null;
  const check=await fetchTimeout(apiUrl+'?ref='+encodeURIComponent(REPO_BRANCH),{headers},12000);
  if(check.ok)existingSha=(await check.json().catch(()=>({})))?.sha||null;
  else if(check.status!==404){const d=await check.json().catch(()=>({}));throw new Error(`GitHub HTTP ${check.status}${d?.message?' · '+d.message:''}`)}
  const body={message:existingSha?`Actualizar documento: ${safeName}`:`Agregar documento: ${safeName}`,content,branch:REPO_BRANCH};
  if(existingSha)body.sha=existingSha;
  const response=await fetchTimeout(apiUrl,{method:'PUT',headers,body:JSON.stringify(body)},30000);
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401)throw new Error('Token de GitHub inválido o vencido.');if(response.status===403)throw new Error('GitHub rechazó la escritura (403). Verificá Contents: Read and write.');throw new Error(`GitHub HTTP ${response.status}${data?.message?' · '+data.message:''}`)}
  return {ok:true,path,sha:data?.content?.sha||null,commitSha:data?.commit?.sha||null};
}
