# NEXUS-X // OMEGA ∞

## Inventario con identidad persistente

Esta versión agrega una capa de identidad estructurada para inventarios Excel.

### Flujo
1. Importá un `.xlsx`, `.xls` o `.csv`.
2. NEXUS-X detecta las columnas y asigna códigos `NXC:C####` persistentes a cada columna.
3. Si un registro no tiene ID NEXUS, se genera uno (`NEXUS:REA-0001`, `NEXUS:INS-0001`, etc.) y se conserva en el almacenamiento local.
4. Cada registro guarda la fuente, fila, identidad y códigos de sus atributos.
5. `Exportar Excel NEXUS` crea un libro enriquecido con `Inventario NEXUS`, `NEXUS CODES` y `NEXUS META`.
6. Los QR se generan usando el ID NEXUS del objeto físico.

### Regla de identidad
Los IDs existentes se conservan. Para registros sin ID se intenta encontrar una identidad estable mediante identificadores fuertes (serie, patrimonio, catálogo, CAS, código) y, si no existen, mediante datos estables del material. Los duplicados idénticos se distinguen por ocurrencia.

### Columnas
Cada columna recibe un código único `NXC:C####`. Los valores se vinculan como `NXC:C####:R#####:<ID_NEXUS>`. Esto permite rastrear un dato hasta su columna y material.

### Seguridad
La API key de Gemini no se incluye en el código. Para producción, usá un backend/proxy.

### Dependencias
PDF.js, jsQR, SheetJS/XLSX y QRCode se cargan desde CDN.
