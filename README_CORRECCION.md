# NEXUS-X — Hotfix de carga de documentos a GitHub

## Qué corrige

La versión del repositorio tenía llamadas a `githubUploadDocument(file)` pero la función no estaba definida. Por eso, al seleccionar un archivo nuevo desde la web aparecía el error `githubUploadDocument is not defined` / `not defined`.

Este hotfix corrige además:

- subida de PDF/DOCX/XLSX/CSV/TXT/MD a `documentos/` mediante GitHub Contents API;
- actualización segura si ya existe un archivo con el mismo nombre;
- manejo de token ausente, 401, 403, 404, 409 y 422;
- límite de 6 MB coherente con NEXUS-X;
- nombres de archivo sanitizados;
- caché del Service Worker para que no vuelva a servir un `app.js` viejo;
- detección del repositorio fuera de GitHub Pages: `miqueas80/laboratorio-escolar`.

## Instalación recomendada

1. Descomprimí este ZIP.
2. En tu repositorio `miqueas80/laboratorio-escolar`, reemplazá **solo** el archivo `sw.js` por el `sw.js` de esta carpeta.
3. No borres `app.js`, `index.html`, `inventory.json`, `materiales/`, `protocolos/` ni los demás archivos que ya funcionan.
4. Publicá el cambio.
5. Abrí GitHub Pages y recargá dos veces si el navegador todavía tenía el Service Worker anterior en memoria.
6. En NEXUS-X, configurá el token de GitHub en Ajustes > Repositorio GitHub.
7. Probá con un archivo pequeño. Debe terminar en `documentos/<nombre-del-archivo>` y luego aparecer en la sincronización del repositorio.

## Permiso del token

El token debe tener permiso de escritura sobre el contenido del repositorio (`Contents: Read and write`). No se incluye ningún token en este ZIP.

## Importante

Este paquete es un **hotfix**, no un reemplazo destructivo del repositorio. Está diseñado para que conserves todos los documentos y recursos que ya tenés en GitHub.
