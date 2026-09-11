# NEXUS-X V2.2 — Document Fabric / Graph / AI

Versión experimental para repositorios de prueba.

## Cambios de esta versión
- API Gemini: solo se introduce la API Key. NEXUS-X la guarda localmente, prueba la conexión y selecciona automáticamente un modelo compatible; no requiere endpoint, modelo ni parámetros manuales.
- Modelo gratuito preferido: Gemini 3.7 Flash; fallback automático.
- La búsqueda web sigue siendo independiente de Gemini, por lo que puede continuar aunque la API de Gemini tenga cuota agotada.
- Evidencia documental agrupada por archivo: un documento aparece una sola vez aunque contenga muchas coincidencias internas.
- Claims documentales deduplicados.
- Grafo visual SVG interactivo: nodos de documentos y materiales, arrastre, zoom y clic para abrir el documento o ficha correspondiente.
- Relaciones documentales filtradas para evitar coincidencias genéricas de baja calidad.
- Se conserva la base de 111 registros y la identidad única NEXUS-X.


## Persistencia documental en GitHub

Los archivos que el usuario carga desde **Indexar archivo**, **Cargar PDF** o **Cargar Word maestro** se indexan localmente y, si hay un token de escritura de GitHub guardado, se suben automáticamente a `documentos/` del repositorio detectado. En el siguiente arranque, la sincronización del repositorio vuelve a descargarlos e indexarlos.

### Configuración única de GitHub
1. En Ajustes, pegar un token de GitHub con permiso de escritura sobre el contenido del repositorio.
2. Guardarlo una sola vez.
3. A partir de ese momento, cada documento cargado se sincroniza automáticamente.

El token se guarda únicamente en el navegador y **no se escribe en el repositorio**. Si no se configura, NEXUS-X conserva el documento en IndexedDB local y avisa que todavía no está respaldado en GitHub.

> Para una instalación pública multiusuario, una clave/token en el navegador no es un secreto fuerte; para producción conviene un backend/proxy con autenticación.
