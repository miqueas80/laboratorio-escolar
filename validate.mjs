import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const required=['index.html','app.js','manifest.webmanifest','sw.js','inventory.json','icon.svg'];
const errors=[];
for(const f of required)if(!fs.existsSync(path.join(root,f)))errors.push('Falta '+f);
const data=JSON.parse(fs.readFileSync(path.join(root,'inventory.json'),'utf8'));
const ids=data.records.map(x=>x.id); if(data.recordCount!==111)errors.push('recordCount != 111'); if(ids.length!==111)errors.push('records != 111'); if(new Set(ids).size!==111)errors.push('IDs duplicados'); if(ids[0]!=='NEXUS-X-0001'||ids.at(-1)!=='NEXUS-X-0111')errors.push('rango inicial/final incorrecto'); if(ids.some(x=>!/^(NEXUS-X-\d{4})$/.test(x)))errors.push('ID inválido');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
try{new vm.Script(js); }catch(e){errors.push('JavaScript inválido: '+e.message)}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const idMatches=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);const seen=new Set();for(const id of idMatches){if(seen.has(id))errors.push('ID HTML duplicado: '+id);seen.add(id)}
const domRefs=[...js.matchAll(/\$\(['\"]#([^'\"]+)['\"]\)/g)].map(m=>m[1]);for(const id of new Set(domRefs))if(!seen.has(id) && !['qrOpenResult'].includes(id))errors.push('Referencia DOM inexistente: '+id);
for(const fn of ['loadMaster','importExcel','importWord','startQr','processQr','runResearch','runIntegrity'])if(!new RegExp('function\\s+'+fn+'\\s*\\(').test(js)&&!js.includes('async function '+fn+'('))errors.push('Función crítica ausente: '+fn)
for(const ref of ['app.js','manifest.webmanifest'])if(!html.includes(ref))errors.push('Referencia ausente: '+ref);
console.log(JSON.stringify({ok:errors.length===0,records:ids.length,uniqueIds:new Set(ids).size,first:ids[0],last:ids.at(-1),htmlIds:idMatches.length,errors},null,2));
process.exitCode=errors.length?1:0;
