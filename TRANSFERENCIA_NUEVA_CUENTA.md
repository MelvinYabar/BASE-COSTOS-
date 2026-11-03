# Transferencia integral — Dashboard Avanti / Base de costos

> Este archivo es el punto de partida para continuar el proyecto desde otra cuenta de ChatGPT o computadora. Léelo completo antes de editar datos, lógica o despliegues.

## 1. Objetivo

Construir y mantener un dashboard de compras de **Avanti Pharma Group S.A.C.** que sea útil para decisiones reales de abastecimiento y márgenes:

- consultar el histórico de precios de compra por producto, proveedor y mes;
- mantener la **BD madre de costos** por GTIN, proveedor y mes;
- calcular costos unitarios correctos, con unidades por envase e IGV correctamente tratados;
- comparar proveedores solo cuando la presentación sea realmente equivalente;
- revisar y confirmar asociaciones entre el nombre de una factura de distribuidor y el GTIN interno;
- ver facturas/PDF, compras históricas y trazabilidad de cada cifra;
- importar ventas, cruzarlas contra costos comparables y revisar márgenes;
- exportar las tablas y revisiones a Excel.

La meta no es “llenar indicadores” ni hacer coincidencias automáticas a cualquier precio: es que las conclusiones sean auditables y que las excepciones queden explícitamente pendientes de revisión humana.

## 2. Estado de publicación y repositorio

- Repositorio principal: <https://github.com/MelvinYabar/BASE-COSTOS->
- Rama publicada: `main`
- Último commit de la migración estática: `7331825` (`Publish complete static dashboard for Render`).
- Tecnología: HTML, CSS y JavaScript estáticos; no hay backend, base de datos, API, secretos ni variables de entorno requeridas.
- Despliegue objetivo: **Render Static Site**, no Web Service.
- Configuración incluida: `render.yaml`.

La antigua URL de ChatGPT Sites dependía de una cuenta Plus/Pro y ya no debe considerarse el canal principal. Render debe ser el despliegue duradero e independiente de la suscripción de ChatGPT.

### Configuración de Render

Usar una de estas dos opciones:

1. **New → Blueprint** y seleccionar el repositorio: Render detecta `render.yaml`.
2. Crear un **Static Site** manualmente:

   ```text
   Build Command: echo "Static assets are ready"
   Publish Directory: dist
   Environment Variables: ninguna
   ```

El directorio publicado es `dist/`. Después de cada `git push origin main`, Render debe desplegar de nuevo automáticamente.

> Atención: el repositorio contiene datos de compra y copias/previas de facturas para que la consulta funcione. Mantener el repositorio y el servicio de Render privados o con acceso controlado si la política de la empresa lo exige.

## 3. Datos actualmente publicados

Estos son los límites reales que hoy se deben mostrar. No presentar meses futuros como si fueran compras reales:

| Conjunto | Estado publicado |
| --- | --- |
| Histórico de precios | mayo–octubre de 2026; 3,985 líneas |
| Facturas integradas | 3 de mayo–22 de octubre de 2026; 6,354 líneas y 1,063 documentos |
| BD madre de costos | mayo–octubre de 2026; corte efectivo 2026-10-22 |
| Base maestra de costos | 1,883 filas producto–proveedor; 805 GTIN; 3,699 líneas de detalle; 231 comparativos |

El filtro global de precios debe decir aproximadamente **“Precios: May.–Oct. 2026”**. Si muestra mayo–agosto o meses hasta diciembre, no usar la pantalla como válida: revisar los JSON y la caché antes de sacar conclusiones.

## 4. Arquitectura y archivos importantes

```text
BASE-COSTOS-/
├─ dist/                         # Todo lo que Render publica
│  ├─ index.html                 # Estructura, navegación y recursos
│  ├─ styles.css                 # Diseño responsive
│  ├─ app.js                     # Histórico, costos, filtros y exportación Excel
│  ├─ analytics-core.js          # Cálculos de ventas, costos y márgenes
│  ├─ analytics.js               # Vistas de ventas/cantidades/volumen e importación local
│  ├─ purchases.js               # Compras por proveedor y conciliación GTIN
│  ├─ purchase-matching.js       # Puntaje de candidatos de GTIN
│  ├─ invoices.js                # Navegador de facturas/PDF
│  ├─ cost-review.js             # Revisión temporal de unidades e IGV
│  ├─ data.json                  # Histórico de precios procesado
│  ├─ costs.json                 # BD madre de costos procesada
│  ├─ purchases.json             # Compras y asociaciones/propuestas GTIN
│  ├─ invoices.json              # Registro de facturas mayo–octubre
│  ├─ pdf-index.json             # Índice de PDF/previas
│  └─ invoice-pdfs*/             # PDF y previas de facturas
├─ data/
│  ├─ purchase_associations.json # Asociaciones GTIN aprobadas para publicar
│  └─ cost_unit_decisions.json   # Decisiones manuales de unidad/IGV
├─ scripts/                      # Generación, importación y pruebas
├─ render.yaml                   # Configuración de Render
├─ README.md                     # Manual técnico/funcional
└─ HANDOFF.md                    # Historial anterior; útil, pero validar fechas con este archivo
```

No editar manualmente JSON grandes salvo una corrección puntual y auditada. Cambiar la fuente o las decisiones y luego regenerar con los scripts.

## 5. Fuentes y cómo se trabaja

Las fuentes originales no deben depender únicamente del repositorio. Conservarlas en una carpeta local segura y hacer respaldo:

- maestro interno de productos, con GTIN/código interno/nombre/estado;
- histórico de precios;
- BD madre de costos fuente;
- consolidado de facturas y compras;
- PDF/XML de proveedores;
- reporte de ventas por día/producto;
- exportaciones manuales de asociaciones GTIN y revisión de costos.

Para regenerar desde fuentes locales, los scripts esperan que las fuentes estén en la carpeta de trabajo superior o en rutas indicadas por sus mensajes. Antes de ejecutarlos, leer `README.md` y verificar la fuente elegida por el script.

Flujo seguro al recibir compras nuevas:

1. Guardar los PDF/XML/CSV/XLSX originales, conservando proveedor, mes y número de factura.
2. Actualizar el consolidado/fuentes y correr el generador de facturas/compras que corresponda.
3. Revisar que `invoices.json.meta.to` sea la fecha real más reciente.
4. Regenerar `costs.json` y `data.json` sin inventar meses posteriores.
5. Ejecutar todas las pruebas y la validación.
6. Revisar visualmente filtros, PDF, costos, comparativos, pendientes y exportación Excel.
7. Hacer commit con la fecha/fuente incorporada y recién entonces publicar a `main`.

## 6. Reglas de negocio obligatorias

### 6.1 IGV

Estos proveedores entregan el precio de factura **con IGV incluido**:

- ALFARO
- CASTILLO
- EBENEL
- FDS
- FP MAYORISTA (QUÍMICA SUIZA)

Para ellos **no sumar otro 18%**. Si una línea dice `S/IGV`, `sin IGV`, `exonerado` o `inafecto`, tampoco se debe sumar IGV aunque el proveedor normalmente lo aplique. Los demás casos solo deben multiplicar por `1.18` cuando la evidencia de la factura indique precio sin IGV.

Fórmula general de compra cuando procede:

```text
costo final por unidad = importe final con IGV / (envases comprados × unidades por envase)
```

Nunca dividir al revés. El importe debe ser el importe de línea/factura verificable, no una lista estimada.

### 6.2 Unidades por envase

Reconocer como cantidad de unidades patrones inequívocos como:

- `CAJA X30`, `TAB X 30`, `X30TAB`, `CJAX30UND`, `CAPS X 2`, `FRASCO X 60 COMP`.

Ejemplos válidos: `JARDIANCE ... X 60 COMP` equivale a 60 comprimidos; `DEBLAX ... CAPS X 2` equivale a 2 cápsulas.

No convertir automáticamente en unidades vendibles:

- `ML`, `GR`, `MG`, centímetros;
- `X dosis` de inhaladores/sprays;
- presentaciones ambiguas, con varias cantidades X, o que contradicen catálogo/factura;
- accesorios médicos (jeringas, etc.) cuando no sea evidente cómo se vende la unidad.

En los casos no claros, la interfaz debe dejar una decisión humana: **“se parte” + cantidad** o **“no se parte”**. No asumir 1 para ocultar la incertidumbre.

### 6.3 GTIN y equivalencias

Los proveedores no entregan GTIN confiable en sus facturas. El maestro interno de productos es la autoridad para GTIN, nombre y código interno.

Regla de conciliación:

- coincidencia exacta única: puede proponerse como exacta;
- similitud por nombre, concentración o presentación: mostrar candidatos, pero no confirmar automáticamente;
- una presentación distinta reduce el puntaje o genera advertencia; no siempre descarta el producto;
- concentración incompatible debe penalizarse fuertemente;
- una asociación elegida por el usuario queda como **Confirmado manualmente**;
- si no hay evidencia, mantener **Sin GTIN / pendiente**, no escoger el candidato más parecido solo para subir cobertura.

La sección **Compras por proveedor → Conciliación GTIN** debe permitir abrir un pendiente y ver candidatos. Las asociaciones se pueden exportar/importar; las confirmadas para publicación se centralizan en `data/purchase_associations.json`.

### 6.4 Santa Úrsula

Santa Úrsula se mantiene visible como proveedor histórico/de emergencia, pero **no alimenta el costo ponderado oficial ni el margen de referencia**.

### 6.5 Comparativos, alertas y margen

- No comparar productos con presentaciones distintas o unidad/IGV sin confirmar.
- Bonificaciones no contaminan el precio promedio ni los comparativos.
- Precios `≤ S/ 0.10` se excluyen de alertas y comparativos, y se marcan para validar.
- La alerta de compras prioriza aumentos mayores a 10% entre observaciones comparables.
- “Proveedor único” es una señal de dependencia, no un error.
- Precio ponderado = suma de importes / suma de cantidades comparables; no promedio simple de precios.
- Margen sobre costo = `(importe de venta / costo total de referencia) - 1`. Mostrarlo solo para cobertura comparable y aclarar cobertura/motivo de faltantes.

## 7. Ventas: precaución importante

`dist/sales.json` está excluido intencionalmente de Git para no publicar por accidente ventas internas. En el dashboard, las ventas pueden cargarse desde el navegador; se guardan localmente en IndexedDB de ese navegador/origen.

Por ello, después de migrar de computadora o de dominio, es normal que el usuario deba volver a importar el Excel/CSV de ventas. No significa que compras o costos estén caídos. No subir el Excel de ventas a un repositorio público sin autorización explícita.

## 8. Validación mínima antes de publicar

Desde la raíz del repositorio:

```powershell
node --check dist/app.js
node --test scripts/test_analytics.cjs
python scripts/validate_costs.py --published-only
python -m unittest discover -s scripts -p "test*.py"
python -m http.server 8000 --directory dist
```

Abrir `http://localhost:8000` y comprobar como mínimo:

- carga sin “Failed to fetch”;
- filtro de meses mayo–octubre 2026 y corte 22-octubre-2026;
- BD madre y su exportación Excel;
- PDF de una factura antigua y una reciente;
- un caso IGV incluido (ALFARO/EBENEL) y uno sin IGV;
- una presentación X válida y un inhalador/ML que no se parte;
- vista de pendientes y asociación GTIN;
- compras de Santa Úrsula visibles pero excluidas del costo oficial.

La última validación publicada pasó sin errores críticos. Persisten avisos humanos, que son controles y no deben ocultarse: GTIN pendientes, unidades asumidas y algunas claves proveedor-producto repetidas que requieren contraste con origen.

## 9. Qué falta para llegar al “100% fino”

No afirmar “100% correcto” hasta completar esta lista:

1. Revisar manualmente todos los pendientes de unidades, IGV y presentación; exportar, corregir y reimportar decisiones.
2. Asociar los productos de distribuidor restantes al maestro mediante candidatos, sin automatismos agresivos.
3. Verificar cada asociación manual que afecte margen o decisión de compra con factura/catálogo.
4. Conciliar el costo de referencia de ventas solo con GTIN, unidad, mes e IGV comparables.
5. Actualizar las facturas a la fecha objetivo y confirmar que la fecha máxima se refleja en todos los filtros.
6. Mantener PDFs indexados y accesibles desde la vista de facturas.
7. Agregar una pantalla de calidad que muestre cobertura: líneas con GTIN, sin GTIN, unidad confirmada, IGV confirmado, comparables, excluidas y motivos.
8. Añadir pruebas de regresión para cada regla nueva antes de cambiar un cálculo.

## 10. Prompt listo para pegar en el nuevo ChatGPT

```text
Trabaja sobre el repositorio https://github.com/MelvinYabar/BASE-COSTOS-.git.

Primero lee completos TRANSFERENCIA_NUEVA_CUENTA.md, README.md y HANDOFF.md. Después revisa git status, el último commit, render.yaml y la estructura del proyecto. No borres ni reemplaces cambios existentes, no inventes datos y no publiques ni cambies accesos sin que te lo pida.

Objetivo: terminar y mantener un dashboard estático, mobile-first y auditable para compras, costos, facturas, conciliación GTIN y márgenes de Avanti Pharma. Debe desplegarse como Render Static Site desde dist/, sin depender de ChatGPT Sites ni de variables de entorno.

Reglas no negociables:
1) ALFARO, CASTILLO, EBENEL, FDS y FP MAYORISTA (QUÍMICA SUIZA) ya entregan IGV incluido: nunca sumarles otro 18%. Si una línea dice S/IGV, sin IGV, exonerado o inafecto, tampoco sumar IGV.
2) Costo unitario = importe final con IGV / (envases comprados × unidades por envase). Solo dividir cuando la presentación sea inequívoca. X30 TAB/CAPS/COMP se puede partir; ML, GR, MG, dosis de inhalador/spray, varias cantidades X, conflictos o accesorios ambiguos deben ir a revisión humana con opciones “se parte + cantidad” o “no se parte”.
3) El GTIN viene del maestro interno, no de la factura del proveedor. Las similitudes deben mostrarse como candidatos y requerir confirmación humana; nunca mapear automáticamente solo para aumentar cobertura.
4) Santa Úrsula debe seguir visible como histórico/emergencia, pero no puede alimentar costo oficial ni márgenes.
5) No comparar ni calcular ahorro/margen si presentación, unidad, fecha o IGV no son comparables. Bonificaciones y precios <= S/0.10 se tratan de forma separada.
6) Los meses y fechas deben salir de los datos reales. Hoy el corte publicado es mayo–octubre de 2026, hasta 2026-10-22; no mostrar mayo–agosto ni meses futuros.
7) Las ventas son privadas y se cargan localmente en el navegador; no subir su Excel o sales.json a GitHub/Render sin autorización explícita.

Quiero que lleves el dashboard a un estándar 100% profesional: interfaz clara, filtros consistentes, PDF/facturas rastreables, exportaciones Excel correctas, panel de pendientes accionable, indicadores de cobertura/calidad, mensajes comprensibles y cálculos auditables. Antes de modificar, propón el alcance puntual; al implementar, cambia solo lo necesario, agrega o ajusta pruebas y valida con:
node --check dist/app.js
node --test scripts/test_analytics.cjs
python scripts/validate_costs.py --published-only
python -m unittest discover -s scripts -p "test*.py"

Al finalizar, resume qué cambiaste, qué quedó pendiente, los resultados de validación y el commit. No hagas push ni despliegue externo salvo que te lo pida expresamente.
```

## 11. Uso en la nueva cuenta

1. Iniciar sesión con la nueva cuenta de ChatGPT.
2. Abrir el repositorio y descargar/clonar el proyecto.
3. Abrir `TRANSFERENCIA_NUEVA_CUENTA.md`.
4. Pegar el prompt anterior en un chat nuevo junto con el enlace del repositorio.
5. Conectar Render al repositorio si aún no está conectado; usar Static Site y `dist`.
6. Mantener copias locales de las fuentes originales y de las exportaciones de asociaciones/decisiones.

