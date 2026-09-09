# NEXUS-X // Quantum Core — PWA Mobile

Versión preparada para **GitHub Pages** y uso móvil. No requiere Android Studio ni un APK para instalarse como aplicación: desde Chrome/Edge compatible se puede usar **Instalar aplicación**.

## Qué incluye

- PWA instalable con manifest + Service Worker.
- Interfaz responsive para teléfono y PC.
- Escáner QR por cámara (HTTPS + permiso del navegador).
- Carga de una imagen QR con `jsQR` y respaldo con `BarcodeDetector`.
- Entrada manual de identificadores NEXUS.
- Sincronización con `miqueas80/laboratorio-escolar`.
- Detección de PDFs, MD y TXT del repositorio.
- Importación de PDFs locales a IndexedDB.
- Visor PDF móvil con ajuste al ancho, zoom y navegación.
- Compartir/guardar PDF mediante Web Share cuando Android lo soporte.
- Mapa documental de documentos, protocolos, fórmulas y conceptos.
- Inventario JSON import/export.
- Gemini con `gemini-3.8-flash` como modelo recomendado y fallback 3.7/3.6/3.5.

## Publicar en GitHub Pages

1. Copiá **el contenido de esta carpeta** a la raíz de tu repositorio `laboratorio-escolar`.
2. Confirmá que `index.html` quede en la raíz.
3. En GitHub: **Settings → Pages → Deploy from a branch → main → /(root)**.
4. Guardá y esperá la publicación.
5. Abrí la URL `https://miqueas80.github.io/laboratorio-escolar/`.
6. En Android, desde Chrome, usá **Instalar aplicación** / **Agregar a pantalla de inicio** cuando aparezca la opción.

## Importante sobre Gemini

La API key se guarda solamente en el navegador mediante `localStorage`. Para una aplicación pública real, no conviene exponer una clave de Gemini en el frontend: usá un backend/proxy con autenticación y límites.

## Importante sobre cámara

La cámara requiere un contexto seguro (HTTPS). GitHub Pages entrega el sitio por HTTPS. Si el navegador pregunta por la cámara, elegí **Permitir**.

## Documentos nuevos

Los PDFs que agregues al repositorio pueden aparecer en la sincronización de NEXUS-X sin reconstruir la PWA. Los PDFs importados desde el teléfono se guardan localmente en IndexedDB y no se suben a GitHub.
