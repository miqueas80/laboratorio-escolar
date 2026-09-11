#!/usr/bin/env python3
"""Genera data/inventory.json desde el Word maestro NEXUS-X.
No genera IDs por columna: un bloque REGISTRO produce exactamente un ID.
"""
import json,re,sys,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
SRC=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'data'/'Sustancias_Lab_BASE_NEXUS-X.docx'
OUT=ROOT/'data'/'inventory.json'
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
LABELS=['ID_NEXUS_X','Nº_Original','Sustancia_Mezcla_Material','Formula','Estado_Fisico','Presentacion','Envase_Original','Fecha_Envasado_Vencimiento','Ubicacion_Armario']
FIELD_RE=re.compile(r'('+'|'.join(map(re.escape,LABELS))+r')\s*:\s*([\s\S]*?)(?=\s*(?:'+'|'.join(map(re.escape,LABELS))+r')\s*:|$)')

def main():
    with zipfile.ZipFile(SRC) as z:
        xml=z.read('word/document.xml')
    root=ET.fromstring(xml)
    paragraphs=[]
    for p in root.findall('.//w:p',NS):
        s=''.join(t.text or '' for t in p.findall('.//w:t',NS)).strip()
        if s: paragraphs.append(s)
    text='\n'.join(paragraphs)
    blocks=re.split(r'(?=REGISTRO\s+\d+)',text)[1:]
    records=[]
    for block in blocks:
        m=re.match(r'REGISTRO\s+(\d+)',block)
        if not m: continue
        raw={k:' '.join(v.split()) for k,v in FIELD_RE.findall(block)}
        records.append({'id':raw.get('ID_NEXUS_X',''),'record':int(m.group(1)),'originalNumber':raw.get('Nº_Original',''),'name':raw.get('Sustancia_Mezcla_Material',''),'formula':raw.get('Formula',''),'physicalState':raw.get('Estado_Fisico',''),'presentation':raw.get('Presentacion',''),'originalPackage':raw.get('Envase_Original',''),'expiry':raw.get('Fecha_Envasado_Vencimiento',''),'location':raw.get('Ubicacion_Armario',''),'notes':'','source':SRC.name})
    ids=[r['id'] for r in records]
    assert len(records)==111, f'Se esperaban 111 registros, hay {len(records)}'
    assert len(set(ids))==111, 'Hay IDs duplicados'
    assert ids[0]=='NEXUS-X-0001' and ids[-1]=='NEXUS-X-0111', 'Rango de IDs incorrecto'
    assert all(re.fullmatch(r'NEXUS-X-\d{4}',x) for x in ids), 'Hay IDs inválidos'
    payload={'schemaVersion':1,'source':SRC.name,'recordCount':111,'identityRule':'1 registro = 1 ID NEXUS-X; los demás campos son atributos','records':records}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'OK: {OUT} · {len(records)} registros · {len(set(ids))} IDs únicos')
if __name__=='__main__': main()
