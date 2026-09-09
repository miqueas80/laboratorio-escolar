(() => {
"use strict";

const REMOTE = {
  owner:"miqueas80",
  repo:"laboratorio-escolar",
  branch:"main",
  catalogCandidates:["nexus-x-catalog.json","nexus-x-data.json","data/nexus-x-data.json","data/nexus-x.json","data/catalog.json","data/inventory.json"]
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const LS = {
  data:"nexusx_data_v6",
  key:"nexusx_gemini_key_v1",
  model:"nexusx_gemini_model_v2"
};

const defaultData = {
  nodes:[
    {id:"doc-001",type:"document",name:"NEXUS:H2SO4-001",desc:"Ficha técnica: ácido sulfúrico y seguridad."},
    {id:"doc-002",type:"document",name:"Estructuras atómicas",desc:"Manual de estructuras atómicas."},
    {id:"doc-003",type:"document",name:"Polaridad del enlace",desc:"Manual de polaridad y enlaces químicos."},
    {id:"p-001",type:"protocol",name:"Protocolo de dilución",desc:"Agregar ácido al agua lentamente y con protección adecuada."},
    {id:"p-002",type:"protocol",name:"Control de pH",desc:"Medición y registro de pH con indicador/equipo disponible."},
    {id:"f-001",type:"formula",name:"H2SO4",desc:"Ácido sulfúrico."},
    {id:"f-002",type:"formula",name:"pH = -log10[H+]",desc:"Relación básica entre concentración de H+ y pH."},
    {id:"c-001",type:"concept",name:"Ácidos y bases",desc:"Clasificación y comportamiento ácido-base."},
    {id:"c-002",type:"concept",name:"Polaridad",desc:"Distribución desigual de carga en un enlace."},
    {id:"c-003",type:"concept",name:"Estructura atómica",desc:"Organización de protones, neutrones y electrones."}
  ],
  edges:[
    {from:"doc-001",to:"f-001",label:"identifica"},
    {from:"doc-001",to:"p-001",label:"usa"},
    {from:"doc-001",to:"c-001",label:"explica"},
    {from:"doc-002",to:"c-003",label:"explica"},
    {from:"doc-003",to:"c-002",label:"explica"},
    {from:"p-002",to:"f-002",label:"aplica"},
    {from:"c-001",to:"f-002",label:"relacionado con"},
    {from:"c-002",to:"doc-001",label:"relacionado con"}
  ]
};

let data = loadData();
let stream = null;
let scanTimer = null;
let deferredInstall = null;

// Almacenamiento local de PDFs: IndexedDB evita depender de descargas WebView y permite conservar documentos en el teléfono.
const PDF_DB={name:"nexusx-pdfs-v1",store:"files"};
function openPdfDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(PDF_DB.name,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PDF_DB.store))r.result.createObjectStore(PDF_DB.store,{keyPath:"key"});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function putLocalPdf(file){const db=await openPdfDB();const key=`pdf-${crypto.randomUUID?.()||Date.now()+"-"+Math.random().toString(16).slice(2)}`;await new Promise((res,rej)=>{const tx=db.transaction(PDF_DB.store,"readwrite");tx.objectStore(PDF_DB.store).put({key,name:file.name,blob:file,type:file.type||"application/pdf",size:file.size,createdAt:new Date().toISOString()});tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});db.close();return key;}
async function getLocalPdf(key){const db=await openPdfDB();const out=await new Promise((res,rej)=>{const tx=db.transaction(PDF_DB.store,"readonly");const r=tx.objectStore(PDF_DB.store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});db.close();return out;}
async function deleteLocalPdf(key){const db=await openPdfDB();await new Promise((res,rej)=>{const tx=db.transaction(PDF_DB.store,"readwrite");tx.objectStore(PDF_DB.store).delete(key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});db.close();}
function localPdfNode(file,key){const base=file.name.replace(/\.pdf$/i,"");const id=`local-pdf-${slug(base)}-${Date.now()}`;return {id,type:"document",name:base,desc:`PDF local: ${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`,localKey:key,localFileName:file.name,localSize:file.size,createdAt:new Date().toISOString()};}

function log(msg){
  const el=$("#eventLog"); if(!el) return;
  const d=document.createElement("div");
  d.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;
  el.prepend(d);
}

function loadData(){
  try {
    const saved=JSON.parse(localStorage.getItem(LS.data));
    if(saved && Array.isArray(saved.nodes) && Array.isArray(saved.edges)) return normalizeData(saved);
  } catch {}
  return structuredClone(defaultData);
}
function normalizeData(obj){
  const nodes=Array.isArray(obj?.nodes)?obj.nodes:[];
  const edges=Array.isArray(obj?.edges)?obj.edges:[];
  return {nodes:nodes.filter(n=>n&&n.id&&n.name&&n.type).map(n=>({...n,type:String(n.type).toLowerCase()})),edges:edges.filter(e=>e&&e.from&&e.to).map(e=>({...e,label:e.label||"relacionado con"}))};
}
function mergeData(remote){
  const incoming=normalizeData(remote);
  const nodeById=new Map(data.nodes.map(n=>[n.id,n]));
  const nodeByName=new Map(data.nodes.map(n=>[String(n.name).toUpperCase(),n]));
  let added=0,updated=0;
  for(const n of incoming.nodes){
    const sameId=nodeById.get(n.id), sameName=nodeByName.get(String(n.name).toUpperCase());
    const target=sameId||sameName;
    if(target){ Object.assign(target,n); updated++; }
    else { data.nodes.push(n); nodeById.set(n.id,n); nodeByName.set(String(n.name).toUpperCase(),n); added++; }
  }
  const keys=new Set(data.edges.map(e=>`${e.from}|${e.to}|${e.label}`));
  let edgesAdded=0;
  for(const e of incoming.edges){
    if(!data.nodes.some(n=>n.id===e.from)||!data.nodes.some(n=>n.id===e.to)) continue;
    const k=`${e.from}|${e.to}|${e.label}`;
    if(!keys.has(k)){data.edges.push(e);keys.add(k);edgesAdded++;}
  }
  return {added,updated,edgesAdded};
}
function saveData(){ localStorage.setItem(LS.data, JSON.stringify(data)); updateStats(); refreshEdgeSelectors(); renderGraph(); }
function updateStats(){
  const count=t=>data.nodes.filter(n=>n.type===t).length;
  $("#statDocs").textContent=count("document");
  $("#statProtocols").textContent=count("protocol");
  $("#statFormulas").textContent=count("formula");
  $("#statConcepts").textContent=count("concept");
}

function boot(){
  setTimeout(()=>{$("#bootText").textContent="Cargando módulos documentales…"},250);
  setTimeout(()=>{$("#bootText").textContent=`Núcleo listo · ${data.nodes.length} nodos · ${data.edges.length} relaciones`},550);
  setTimeout(()=>{$("#boot").classList.add("hide")},850);
  updateStats(); refreshEdgeSelectors(); renderGraph();
  const key=localStorage.getItem(LS.key); if(key) $("#apiKey").value=key;
  const model=localStorage.getItem(LS.model)||"gemini-3.8-flash"; $("#modelSelect").value=model; $("#aiModelBadge").textContent=model;
  $("#systemStatus").textContent="● SISTEMA LISTO";
  log("Núcleo iniciado.");
  log("Mapa documental cargado.");
  log("Escáner QR preparado.");
  setTimeout(syncRemote, 950);
}

async function githubJSON(path){
  const u=`https://raw.githubusercontent.com/${REMOTE.owner}/${REMOTE.repo}/${REMOTE.branch}/${path}`;
  const r=await fetch(u,{cache:"no-store"});
  if(!r.ok) throw new Error(`HTTP ${r.status} · ${path}`);
  return {json:await r.json(),url:u};
}
function githubRaw(path){return `https://raw.githubusercontent.com/${REMOTE.owner}/${REMOTE.repo}/${REMOTE.branch}/${path}`}
function githubBlob(path){return `https://github.com/${REMOTE.owner}/${REMOTE.repo}/blob/${REMOTE.branch}/${path}`}
async function discoverRemoteFiles(){
  const api=`https://api.github.com/repos/${REMOTE.owner}/${REMOTE.repo}/git/trees/${encodeURIComponent(REMOTE.branch)}?recursive=1`;
  const r=await fetch(api,{headers:{Accept:"application/vnd.github+json"},cache:"no-store"});
  if(!r.ok) throw new Error(`GitHub Tree HTTP ${r.status}`);
  const body=await r.json();
  return Array.isArray(body.tree)?body.tree.filter(x=>x.type==="blob").map(x=>x.path):[];
}
function fileNode(path){
  const name=path.split("/").pop().replace(/\.[^.]+$/,""), lower=path.toLowerCase();
  const type=lower.endsWith(".pdf")?"document":(lower.includes("protocol")||lower.includes("protocolo"))?"protocol":(lower.includes("formula")||lower.includes("fórmula"))?"formula":(lower.includes("concept")||lower.includes("concepto"))?"concept":"document";
  const idMatch=(path.match(/NEXUS[:_-]([A-Za-z0-9._-]+)/i)||[])[1];
  const id=idMatch?`NEXUS:${idMatch.toUpperCase()}`:`remote-${slug(path)}`;
  return {id,type,name:idMatch?`NEXUS:${idMatch.toUpperCase()}`:name,desc:`Archivo remoto sincronizado: ${path}`,source:githubRaw(path),repositoryPath:path};
}
async function syncRemote(opts={silent:false}){
  const btn=$("#syncRemote"); if(btn) btn.disabled=true;
  if(!opts.silent) log("Sincronización con GitHub iniciada…");
  try{
    let remote=null, source="";
    for(const path of REMOTE.catalogCandidates){
      try{ const got=await githubJSON(path); if(got.json?.nodes && got.json?.edges){remote=got.json;source=path;break;} }catch{}
    }
    const result=remote?mergeData(remote):{added:0,updated:0,edgesAdded:0};
    const files=await discoverRemoteFiles();
    const supported=files.filter(p=>/\.(pdf|md|txt)$/i.test(p) && !/(node_modules|dist|vendor|\.github)/i.test(p));
    const existing=new Set(data.nodes.map(n=>n.id)); let filesAdded=0;
    for(const path of supported){
      const n=fileNode(path); if(!existing.has(n.id)){data.nodes.push(n);existing.add(n.id);filesAdded++;}
    }
    saveData();
    localStorage.setItem("nexusx_remote_sync_v1",new Date().toISOString());
    $("#syncStatus").textContent=`GitHub ✓ ${data.nodes.length} nodos · ${data.edges.length} relaciones`;
    if(remote) log(`Catálogo remoto ${source}: +${result.added} nodos, ${result.edgesAdded} relaciones, ${result.updated} actualizados.`);
    log(`Archivos remotos detectados: ${supported.length}; nuevos incorporados: ${filesAdded}.`);
    if(!remote && !supported.length) log("No se encontró catálogo NEXUS-X ni documentos compatibles en el repositorio.");
  }catch(err){
    $("#syncStatus").textContent="GitHub · sin conexión (modo local)";
    if(!opts.silent) log(`Sincronización no disponible: ${err.message}`); else log("GitHub no disponible; NEXUS-X continúa en modo local.");
  }finally{if(btn) btn.disabled=false;}
}
$("#syncRemote")?.addEventListener("click",()=>syncRemote());
setInterval(()=>{ if(document.visibilityState==="visible") syncRemote({silent:true}); }, 10*60*1000);

$$(".tab").forEach(btn=>btn.addEventListener("click",()=>showTab(btn.dataset.tab)));
$$("[data-go]").forEach(btn=>btn.addEventListener("click",()=>showTab(btn.dataset.go)));
function showTab(id){
  $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
  $$(".panel").forEach(p=>p.classList.toggle("active",p.id===id));
  if(id==="map") renderGraph();
}

function normalizeId(raw){
  let s=String(raw||"").trim().replace(/\r?\n/g,"");
  if(!s) return "";
  // Permite QR con prefijos frecuentes, pero conserva el texto original para trazabilidad.
  const m=s.match(/NEXUS\s*:\s*([A-Za-z0-9._-]+)/i);
  if(m) return "NEXUS:"+m[1].toUpperCase();
  return s;
}
function resolveNode(raw){
  const id=normalizeId(raw);
  return data.nodes.find(n => n.name.toUpperCase()===id.toUpperCase() || n.id.toUpperCase()===id.toUpperCase());
}
function handleQR(raw, source){
  const value=String(raw||"").trim();
  if(!value) return showQR("No se obtuvo contenido del código.","error");
  const node=resolveNode(value);
  if(node){
    const related=data.edges.filter(e=>e.from===node.id||e.to===node.id);
    showQR(`<b>IDENTIFICADO</b><br><strong>${escapeHtml(node.name)}</strong><br><span>${escapeHtml(node.desc)}</span><hr><b>Relaciones:</b> ${related.length}<br>${related.map(e=>edgeText(e,node.id)).join("<br>")||"Sin relaciones registradas."}`,"success");
    log(`QR leído: ${node.name} (${source}).`);
    selectNode(node.id);
  } else {
    showQR(`<b>QR LEÍDO</b><br><strong>${escapeHtml(value)}</strong><hr><span>No existe todavía un registro exacto en el inventario. Podés añadirlo en DATOS para que quede conectado al mapa.</span>`,"error");
    log(`QR leído sin registro: ${value}.`);
  }
}
function edgeText(e,nodeId){
  const other=data.nodes.find(n=>n.id===(e.from===nodeId?e.to:e.from));
  return `• ${escapeHtml(e.label)} → ${escapeHtml(other?.name||"nodo desconocido")}`;
}
function showQR(html, cls=""){
  const el=$("#qrResult"); el.className="result-box "+cls; el.innerHTML=html;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

async function startCamera(){
  stopCamera();
  if(!navigator.mediaDevices?.getUserMedia){
    $("#cameraStatus").textContent="Este entorno no expone getUserMedia. Usá CARGAR IMAGEN QR o ENTRADA MANUAL.";
    return;
  }
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
    const v=$("#qrVideo"); v.srcObject=stream; await v.play();
    $("#cameraOverlay").style.display="none";
    $("#cameraStatus").textContent="Cámara activa. Apuntá al QR.";
    log("Cámara QR activa.");
    scanTimer=requestAnimationFrame(scanFrame);
  }catch(err){
    console.error(err);
    $("#cameraStatus").textContent="No se pudo abrir la cámara. Verificá el permiso del APK o usá la carga de imagen/entrada manual.";
    $("#cameraOverlay").textContent="Permiso de cámara no disponible";
    log("Cámara no disponible; fallback activado.");
  }
}
function stopCamera(){
  if(scanTimer) cancelAnimationFrame(scanTimer); scanTimer=null;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  const v=$("#qrVideo"); if(v) v.srcObject=null;
  const ov=$("#cameraOverlay"); if(ov){ov.style.display="grid";ov.textContent="Cámara detenida"}
}
function scanFrame(){
  const v=$("#qrVideo"), c=$("#qrCanvas");
  if(!stream || v.readyState<2){scanTimer=requestAnimationFrame(scanFrame);return}
  const max=900, scale=Math.min(1,max/v.videoWidth||1);
  c.width=Math.floor(v.videoWidth*scale); c.height=Math.floor(v.videoHeight*scale);
  const ctx=c.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(v,0,0,c.width,c.height);
  const img=ctx.getImageData(0,0,c.width,c.height);
  if(window.jsQR){
    const code=window.jsQR(img.data,img.width,img.height,{inversionAttempts:"attemptBoth"});
    if(code?.data){ handleQR(code.data,"cámara"); stopCamera(); return; }
  } else if("BarcodeDetector" in window){
    // Algunos WebView modernos ofrecen BarcodeDetector nativo.
    new BarcodeDetector({formats:["qr_code"]}).detect(c).then(r=>{
      if(r?.[0]?.rawValue){handleQR(r[0].rawValue,"cámara");stopCamera();}
    }).catch(()=>{});
  }
  scanTimer=requestAnimationFrame(scanFrame);
}
$("#startCamera").addEventListener("click",startCamera);
$("#stopCamera").addEventListener("click",stopCamera);
$("#readManual").addEventListener("click",()=>handleQR($("#manualId").value,"entrada manual"));
$("#manualId").addEventListener("keydown",e=>{if(e.key==="Enter")handleQR($("#manualId").value,"entrada manual")});

$("#qrImage").addEventListener("change",async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    const bmp=await createImageBitmap(file);
    const c=$("#qrCanvas"), max=1400, scale=Math.min(1,max/bmp.width);
    c.width=Math.max(1,Math.floor(bmp.width*scale)); c.height=Math.max(1,Math.floor(bmp.height*scale));
    const ctx=c.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(bmp,0,0,c.width,c.height);
    let result=null;
    if(window.jsQR) result=window.jsQR(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height,{inversionAttempts:"attemptBoth"});
    if(!result && "BarcodeDetector" in window){
      try{ const r=await new BarcodeDetector({formats:["qr_code"]}).detect(c); if(r?.[0]) result={data:r[0].rawValue}; }catch{}
    }
    if(result?.data) handleQR(result.data,"imagen");
    else showQR("No pude detectar un QR en esa imagen. Probá una foto más nítida, con el código completo y buen contraste.","error");
  }catch(err){showQR("No se pudo procesar la imagen QR.","error")}
});

function renderGraph(filter=""){
  const el=$("#graph"); if(!el)return;
  const w=Math.max(el.clientWidth||900,700), h=580;
  const filtered=data.nodes.filter(n=>!filter||`${n.name} ${n.desc}`.toLowerCase().includes(filter.toLowerCase()));
  const ids=new Set(filtered.map(n=>n.id));
  const edges=data.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
  const pos={};
  const typeOrder=["document","protocol","formula","concept"];
  const groups=typeOrder.map(t=>filtered.filter(n=>n.type===t));
  groups.forEach((g,gi)=>{
    const x=(gi+0.5)*w/4;
    g.forEach((n,i)=>pos[n.id]={x,y:90+i*Math.min(110,(h-140)/Math.max(1,g.length))});
  });
  const color={document:"#62eaff",protocol:"#a58cff",formula:"#ffcf5a",concept:"#6fffc0"};
  const shape=(n)=>{
    if(n.type==="formula") return `<circle cx="${pos[n.id].x}" cy="${pos[n.id].y}" r="25" fill="#061521" stroke="${color[n.type]}" stroke-width="2"/>`;
    if(n.type==="concept") return `<polygon points="${diamond(pos[n.id].x,pos[n.id].y,31)}" fill="#061521" stroke="${color[n.type]}" stroke-width="2"/>`;
    return `<rect x="${pos[n.id].x-75}" y="${pos[n.id].y-27}" width="150" height="54" rx="10" fill="#061521" stroke="${color[n.type]}" stroke-width="2"/>`;
  };
  let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Mapa documental">`;
  edges.forEach(e=>{
    const a=pos[e.from],b=pos[e.to]; if(!a||!b)return;
    svg+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#2b708c" stroke-width="1.5"/>`;
    svg+=`<text x="${(a.x+b.x)/2}" y="${(a.y+b.y)/2-5}" fill="#648b9b" font-size="9" text-anchor="middle">${escapeHtml(e.label)}</text>`;
  });
  filtered.forEach(n=>{
    const p=pos[n.id];
    svg+=`<g class="map-node" data-id="${n.id}" tabindex="0">${shape(n)}<text x="${p.x}" y="${p.y+4}" fill="#e6fbff" font-size="10" font-weight="700" text-anchor="middle">${escapeHtml(short(n.name,22))}</text></g>`;
  });
  svg+="</svg>"; el.innerHTML=svg;
  $$("#graph .map-node").forEach(n=>{n.addEventListener("click",()=>selectNode(n.dataset.id));n.addEventListener("keydown",e=>{if(e.key==="Enter")selectNode(n.dataset.id)})});
}
function diamond(x,y,r){return `${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`}
function short(s,n){return s.length>n?s.slice(0,n-1)+"…":s}
function isPdfNode(n){
  return !!(n?.localKey || (n?.source && /\.pdf(?:$|[?#])/i.test(n.source)) || /\.pdf$/i.test(String(n?.repositoryPath||"")));
}
function pdfFilename(n){
  const raw=String(n?.repositoryPath||n?.name||"NEXUS-X-documento").split("/").pop().replace(/[#?].*$/," ").trim();
  let name=raw.replace(/[^a-zA-Z0-9._ -]/g,"_").replace(/\s+/g," ");
  if(!/\.pdf$/i.test(name)) name += ".pdf";
  return name || "NEXUS-X-documento.pdf";
}
function pdfUrl(n){
  if(n?.source) return n.source;
  if(n?.repositoryPath) return githubRaw(n.repositoryPath);
  return "";
}
async function getPdfBlob(n){
  if(n?.localKey){
    const local=await getLocalPdf(n.localKey);
    if(local?.blob) return local.blob;
    throw new Error("El PDF local ya no está disponible en este dispositivo.");
  }
  const url=pdfUrl(n);
  if(!url) throw new Error("Este nodo no tiene un PDF asociado.");
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob=await r.blob();
  const head=new Uint8Array(await blob.slice(0,5).arrayBuffer());
  if(String.fromCharCode(...head)!=="%PDF-") throw new Error("El recurso no es un PDF válido");
  return new Blob([blob],{type:"application/pdf"});
}
async function downloadPdfNode(id){
  const n=data.nodes.find(x=>x.id===id); if(!n)return;
  try{
    const blob=await getPdfBlob(n);
    const fileName=pdfFilename(n);
    if(navigator.share){
      const file=new File([blob],fileName,{type:"application/pdf"});
      if(!navigator.canShare || navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:fileName,text:"Documento NEXUS-X"});log(`PDF compartido: ${fileName}.`);return;}catch(e){if(e?.name==='AbortError')return;}
      }
    }
    const u=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=u; a.download=fileName; a.rel="noopener"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),30000);
    showQR(`<b>PDF LISTO</b><br><strong>${escapeHtml(fileName)}</strong><br><span>Android debería mostrarlo en Descargas. Si no, usá COMPARTIR / GUARDAR desde el visor.</span>`,`success`);
    log(`PDF preparado: ${fileName}.`);
  }catch(err){
    console.warn("Descarga PDF",err);
    const url=pdfUrl(n);
    if(url) try{window.open(url,"_blank","noopener,noreferrer");}catch{}
    showQR(`<b>NO SE PUDO PREPARAR EL PDF</b><br><span>${escapeHtml(err.message||"Error desconocido")}</span>`,`error`);
  }
}

let pdfState={doc:null,page:1,scale:1,fit:true,url:"",blob:null,name:"documento.pdf"};
function setPdfStatus(msg,kind=""){const el=$("#pdfStatus");if(el){el.textContent=msg;el.className="pdf-status "+kind}}
function setPdfViewer(open){const el=$("#pdfViewer");if(!el)return;el.hidden=!open;el.setAttribute("aria-hidden",String(!open));document.body.style.overflow=open?"hidden":""}
async function openPdfViewer(id){
  const n=data.nodes.find(x=>x.id===id); if(!n)return;
  const viewer=$("#pdfViewer"); if(!viewer)return;
  pdfState={doc:null,page:1,scale:1,fit:true,url:pdfUrl(n),blob:null,name:pdfFilename(n),local:!!n.localKey};
  $("#pdfViewerTitle").textContent=pdfState.name;
  $("#pdfLoading").style.display="grid"; $("#pdfLoading").textContent="Cargando PDF…"; $("#pdfCanvas").style.display="none";
  $("#pdfPageInfo").textContent="Cargando…"; $("#pdfZoomInfo").textContent="FIT"; setPdfStatus("Preparando visor móvil…");
  const ext=$("#pdfExternal");
  if(pdfState.url){ext.href=pdfState.url;ext.hidden=false;}else{ext.hidden=true;}
  setPdfViewer(true);
  try{
    const blob=await getPdfBlob(n); pdfState.blob=blob;
    if(!window.pdfjsLib) throw new Error("Motor PDF no disponible; abrilo en el navegador.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    pdfState.doc=await window.pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
    await renderPdfPage();
    setPdfStatus("Visor móvil activo · ajustado al ancho de tu pantalla.","ok");
  }catch(err){
    console.warn("Visor PDF",err);
    $("#pdfLoading").textContent="No se pudo renderizar este PDF.";
    setPdfStatus(err.message||"Error al abrir PDF.","error");
  }
}

async function renderPdfPage(){
  const doc=pdfState.doc;if(!doc)return; const page=await doc.getPage(pdfState.page);
  const viewport1=page.getViewport({scale:1}); const box=$("#pdfViewport");
  let scale=pdfState.scale;
  if(pdfState.fit){const available=Math.max(260,box.clientWidth-24);scale=Math.max(.25,Math.min(3,available/viewport1.width));pdfState.scale=scale;}
  const viewport=page.getViewport({scale}); const canvas=$("#pdfCanvas"); const ctx=canvas.getContext("2d");
  const dpr=Math.min(window.devicePixelRatio||1,2); canvas.width=Math.ceil(viewport.width*dpr);canvas.height=Math.ceil(viewport.height*dpr);canvas.style.width=viewport.width+"px";canvas.style.height=viewport.height+"px";canvas.style.display="block";
  await page.render({canvasContext:ctx,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise;
  $("#pdfLoading").style.display="none"; $("#pdfPageInfo").textContent=`Pág. ${pdfState.page} / ${doc.numPages}`; $("#pdfZoomInfo").textContent=`${Math.round(scale*100)}%`;
}
function closePdfViewer(){setPdfViewer(false);pdfState.doc=null;pdfState.blob=null;}
async function pdfDownloadOrShare(share=false){
  const b=pdfState.blob;if(!b)return window.open(pdfState.url,"_blank","noopener");
  const file=new File([b],pdfState.name,{type:"application/pdf"});
  if(share && navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){try{await navigator.share({files:[file],title:pdfState.name});setPdfStatus("Archivo enviado al menú de compartir/guardar.","ok");return;}catch(e){if(e?.name==="AbortError")return;}}
  const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=pdfState.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),20000);setPdfStatus("Descarga solicitada. Si Android pregunta, elegí una app de PDF o Archivos.","ok");
}
$("#pdfClose")?.addEventListener("click",closePdfViewer);
$("#pdfPrev")?.addEventListener("click",async()=>{if(pdfState.doc&&pdfState.page>1){pdfState.page--;await renderPdfPage();}});
$("#pdfNext")?.addEventListener("click",async()=>{if(pdfState.doc&&pdfState.page<pdfState.doc.numPages){pdfState.page++;await renderPdfPage();}});
$("#pdfFit")?.addEventListener("click",async()=>{pdfState.fit=true;await renderPdfPage();});
$("#pdfZoomIn")?.addEventListener("click",async()=>{pdfState.fit=false;pdfState.scale=Math.min(3,pdfState.scale*1.2);await renderPdfPage();});
$("#pdfZoomOut")?.addEventListener("click",async()=>{pdfState.fit=false;pdfState.scale=Math.max(.35,pdfState.scale/1.2);await renderPdfPage();});
$("#pdfDownload")?.addEventListener("click",()=>pdfDownloadOrShare(false));
$("#pdfShare")?.addEventListener("click",()=>pdfDownloadOrShare(true));
window.addEventListener("resize",()=>{if(!$("#pdfViewer")?.hidden&&pdfState.doc&&pdfState.fit)renderPdfPage();});

function selectNode(id){
  const n=data.nodes.find(x=>x.id===id); if(!n)return;
  const rel=data.edges.filter(e=>e.from===id||e.to===id);
  const source=n.localKey?`<br><span class="source-link">📱 Guardado en este dispositivo</span>`:(n.source?`<br><a class="source-link" href="${escapeHtml(n.source)}" target="_blank" rel="noopener">↗ Abrir PDF remoto</a>`:"");
  const pdfActions=isPdfNode(n)?`<div class="pdf-actions"><button class="primary" type="button" data-pdf-open="${escapeHtml(id)}">📄 ABRIR PDF</button><button class="secondary" type="button" data-pdf-download="${escapeHtml(id)}">⬇ DESCARGAR PDF</button></div>`:"";
  $("#nodeDetails").innerHTML=`<strong style="color:#72f6ff">${escapeHtml(n.name)}</strong> · ${escapeHtml(n.type)}<br>${escapeHtml(n.desc)}${source}${pdfActions}<br><span class="small">${rel.map(e=>edgeText(e,id)).join("<br>")||"Sin relaciones."}</span>`;
  $("[data-pdf-download]")?.addEventListener("click",()=>downloadPdfNode(id));
  $("[data-pdf-open]")?.addEventListener("click",()=>openPdfViewer(id));
}
$("#mapSearch").addEventListener("input",e=>renderGraph(e.target.value));
$("#resetMap").addEventListener("click",()=>{$("#mapSearch").value="";renderGraph()});

function refreshEdgeSelectors(){
  const opts=data.nodes.map(n=>`<option value="${n.id}">${escapeHtml(n.name)}</option>`).join("");
  $("#edgeFrom").innerHTML=opts; $("#edgeTo").innerHTML=opts;
}
$("#addNode").addEventListener("click",()=>{
  const type=$("#newType").value,name=$("#newName").value.trim(),desc=$("#newDesc").value.trim();
  if(!name){alert("Escribí un ID o nombre.");return}
  const id=slug(type+"-"+name+"-"+Date.now());
  data.nodes.push({id,type,name,desc:desc||"Sin descripción."}); saveData();
  $("#newName").value="";$("#newDesc").value="";
  log(`Nodo añadido: ${name}`); showTab("map"); selectNode(id);
});
$("#addEdge").addEventListener("click",()=>{
  const from=$("#edgeFrom").value,to=$("#edgeTo").value,label=$("#edgeLabel").value.trim()||"relacionado con";
  if(from===to){alert("Elegí dos nodos distintos.");return}
  data.edges.push({from,to,label});saveData();$("#edgeLabel").value="";log("Relación documental creada.");
});
function slug(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)}

$("#saveKey").addEventListener("click",()=>{
  const key=$("#apiKey").value.trim();
  if(key)localStorage.setItem(LS.key,key); else localStorage.removeItem(LS.key);
  log(key?"API key guardada localmente.":"API key eliminada.");
});
$("#modelSelect").addEventListener("change",()=>{
  localStorage.setItem(LS.model,$("#modelSelect").value);
  $("#aiModelBadge").textContent=$("#modelSelect").value;
});
$("#askAI").addEventListener("click",askAI);
$("#aiInput").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")askAI()});
async function askAI(){
  const input=$("#aiInput"), q=input.value.trim(); if(!q)return;
  const key=input.value?($("#apiKey").value.trim()||localStorage.getItem(LS.key)||""):( $("#apiKey").value.trim()||localStorage.getItem(LS.key)||"");
  if(!key){appendChat("ai","Primero cargá tu Gemini API Key en CONFIGURACIÓN.");return}
  appendChat("user",q); input.value="";
  const selected=$("#modelSelect").value||"gemini-3.8-flash";
  const models=[...new Set([selected,"gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash"])];
  const context=buildContext(); appendChat("ai","⏳ Consultando Gemini…","pending"); const pending=$("#chat .pending:last-child");
  const payload={systemInstruction:{parts:[{text:"Sos NEXUS-X, asistente de laboratorio escolar. Respondé en español claro. Usá únicamente el contexto documental proporcionado para afirmar datos sobre los documentos. Si falta información, decilo. Para seguridad química, priorizá prácticas de laboratorio y supervisión docente."}]},contents:[{role:"user",parts:[{text:`CONTEXTO NEXUS-X:\n${context}\n\nPREGUNTA:\n${q}`}]}]};
  let lastError=null;
  for(const model of models){
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify(payload)});
      const body=await res.json();
      if(!res.ok) throw new Error(body?.error?.message||`HTTP ${res.status}`);
      const text=body?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
      if(!text) throw new Error("Gemini devolvió una respuesta vacía.");
      pending.classList.remove("pending");pending.textContent=text;$("#aiModelBadge").textContent=model;localStorage.setItem(LS.model,model);log(`Gemini respondió con ${model}.`);return;
    }catch(err){lastError=err;log(`Gemini ${model} no disponible: ${err.message}`);}
  }
  pending.classList.remove("pending");pending.textContent=`⚠️ No se pudo consultar Gemini.\n\n${lastError?.message||"Error desconocido"}\n\nProbá verificar la API key y la conexión a Internet.`;
}

function appendChat(role,text,cls=""){
  const d=document.createElement("div");d.className=`msg ${role} ${cls}`;d.textContent=text;$("#chat").appendChild(d);$("#chat").scrollTop=$("#chat").scrollHeight;
}
function buildContext(){
  return [
    "NODOS:",
    ...data.nodes.map(n=>`- [${n.type}] ${n.name}: ${n.desc}${n.repositoryPath?` (archivo: ${n.repositoryPath})`:""}`),
    "RELACIONES:",
    ...data.edges.map(e=>`- ${data.nodes.find(n=>n.id===e.from)?.name||e.from} --${e.label}--> ${data.nodes.find(n=>n.id===e.to)?.name||e.to}`)
  ].join("\n");
}

$("#exportData").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="nexus-x-inventario.json";a.click();URL.revokeObjectURL(a.href);
});
$("#importData").addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
    const obj=JSON.parse(await f.text());
    if(!Array.isArray(obj.nodes)||!Array.isArray(obj.edges))throw new Error("Formato inválido");
    data=obj;saveData();log("Inventario JSON importado.");
  }catch(err){alert("No se pudo importar: "+err.message)}
});

$("#importPdf")?.addEventListener("change",async e=>{
  const files=[...(e.target.files||[])].filter(f=>f.type==="application/pdf"||/\.pdf$/i.test(f.name));
  if(!files.length)return;
  let added=0;
  try{
    for(const file of files){
      const key=await putLocalPdf(file);
      const node=localPdfNode(file,key);
      data.nodes.push(node);
      added++;
    }
    saveData();
    log(`PDF locales importados: ${added}.`);
    showTab("map");
    showQR(`<b>${added} PDF${added>1?'s':''} IMPORTADO${added>1?'S':''}</b><br><span>Quedaron guardados en este dispositivo y disponibles sin volver a seleccionarlos.</span>`,`success`);
  }catch(err){console.error(err);alert("No se pudieron guardar los PDF: "+(err.message||err));}
  e.target.value="";
});

window.addEventListener("beforeunload",stopCamera);
window.addEventListener("error",e=>console.error("NEXUS-X:",e.error||e.message));

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("#installBtn").hidden=false});
$("#installBtn").addEventListener("click",async()=>{
  if(!deferredInstall)return;
  deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall=null;$("#installBtn").hidden=true;
});
if("serviceWorker" in navigator && location.protocol!=="file:"){
  navigator.serviceWorker.register("sw.js").then(()=>log("Service Worker registrado.")).catch(()=>log("Service Worker no disponible en este entorno."));
}
boot();
})();
