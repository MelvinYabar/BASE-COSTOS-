# Avanti — Histórico de precios

Dashboard estático para consultar el histórico de precios y la base de costos de Avanti Pharma Group S.A.C.

También incluye **Precios y cantidades**, **Vendidos por día** y **Volumen mensual**, con compras y ventas separadas. La pestaña de ventas contiene la base de precios, la base de cantidades, los márgenes de referencia y el detalle de origen. Los reportes se exportan a Excel con códigos como texto y cifras numéricas.

La sección **Compras por proveedor** usa el registro general de facturas y el consolidado de productos comprados. Separa las coincidencias exactas de GTIN de las propuestas por similitud; una propuesta nunca se considera confirmada automáticamente.

## Ventas

El reporte `*PRODUCTOS-VENDIDOS-POR-DIA*.xlsx` se prepara localmente con:

```powershell
python scripts/prepare_sales.py
```

También se puede indicar otra ruta: `python scripts/prepare_sales.py "C:\ruta\reporte.xlsx"`. El generador encuentra los encabezados del reporte, conserva códigos con ceros iniciales y compara la suma de las filas con el total declarado antes de escribir `dist/sales.json`. También busca el reporte en la carpeta superior. El Excel fuente y ese JSON local están excluidos de Git. No se publican las ventas automáticamente en GitHub ni Render; la publicación privada de Sites puede incluir el JSON generado dentro de su paquete privado.

## Compras por proveedor y conciliación GTIN

Las fuentes esperadas dentro de la carpeta superior son:

```text
COMPRAS/COMPRAS AVANTI FARMA 2026.xlsx
COMPRAS/Consolidado Facturas/consolidado.xlsx
COMPRAS/BDD DISTRIBUIDOR - LABORATORIO por medicamento.xlsx
```

Para regenerar la base procesada:

```powershell
python scripts/prepare_purchases.py
python -m unittest scripts.test_purchases
```

`dist/purchases.json` contiene únicamente los datos operativos necesarios para el dashboard. El proceso excluye contactos, teléfonos, cuentas bancarias, credenciales y observaciones privadas del maestro de proveedores.

La conciliación usa tres niveles:

- **Coincidencia exacta:** nombre normalizado único, con GTIN utilizable.
- **Propuesta alta / revisar propuesta:** candidato por nombre, concentración y presentación; requiere confirmación humana.
- **Sin coincidencia:** permanece sin GTIN. No se elige el candidato más parecido solo para aumentar cobertura.

El maestro tributario aplica factor 1 a ALFARO, CASTILLO, EBENEL, FDS y FP MAYORISTA (QUÍMICA SUIZA). Los demás proveedores usan factor 1.18 conforme a la regla vigente. Los proveedores no se fusionan por razón social parecida sin evidencia explícita.

Desde **Precios y cantidades → Cargar ventas** se puede importar el reporte original o un Excel/CSV con `fecha`, `codigo`, `producto`, `cantidad` e `importe`. La plantilla CSV admite además `distribuidor`, `unidad` y `costo_unitario`. La importación detecta la fila de encabezados y permite revisar las columnas. Reemplaza el histórico de ventas completo; no agrega filas a la base anterior. Se guarda en IndexedDB de ese navegador y origen, con un aviso si no se pudo persistir. Para usar ventas en otro navegador o en producción, hay que cargar el archivo allí. No se envía el archivo a un servidor.

Reglas de cálculo:

- **Precio de venta ponderado:** suma de importes / suma de cantidades del mismo código y unidad. No es una media simple de precios diarios.
- **Sin código:** se conserva el registro y se agrupa por descripción exacta, sin vincularlo automáticamente a un GTIN.
- **Cantidades e importes:** se conservan los signos originales y las ventas de importe cero. Si los signos son incompatibles, la fila permanece en los totales pero no recibe un margen de referencia.
- **Costo de referencia:** después de confirmar unidad e IGV comparables. Se usa el costo unitario explícito de ventas o se recalcula cada compra: `importe de la línea × factor IGV / (envases comprados × unidades por envase)`. El factor es 1 para los proveedores con IGV incluido y 1.18 para los demás. Con GTIN exacto se pondera por unidades del mismo mes o último anterior. Una cantidad X inequívoca del nombre puede recuperar unidades antes asumidas. Los conflictos nombre–catálogo, varias cantidades X, presentaciones distintas y meses posteriores se excluyen del cruce. No es un costo de inventario FIFO ni el costo real de la unidad vendida.
- **Margen sobre costo:** importe / costo total de referencia − 1. La tabla exige costo en todas las filas de cada grupo; la tarjeta muestra únicamente la población con costo comparable e indica su cobertura. El resultado se presenta como porcentaje.
- **Volumen de compras:** importes impresos del histórico; excluye bonificaciones y líneas sin importe. No reconstruye importes desde precios de lista ni uniformiza el IGV.
- **Volumen de ventas:** importes del archivo de ventas. El reporte original no identifica distribuidor: se muestra `Sin distribuidor` y cero distribuidores identificados. No se asignan ventas a proveedores de compra por inferencia.


Para comprobar la lógica y los JSON existentes:

```powershell
node --test scripts/test_analytics.cjs
python scripts/validate_costs.py --published-only
```

El modo `--published-only` no compara contra el Excel original de costos; conserva esa limitación como advertencia. La validación completa sigue siendo `python scripts/validate_costs.py` cuando se dispone de la fuente.

Para retomar el proyecto desde otra computadora o con otro asistente, consulta primero [HANDOFF.md](HANDOFF.md). Allí están el contexto funcional, las reglas de negocio, el flujo de actualización y el estado conocido de los datos.

## Despliegue en Render

El repositorio incluye un Blueprint en `render.yaml`. Para desplegarlo:

1. En Render, selecciona **New > Blueprint**.
2. Conecta este repositorio de GitHub.
3. Confirma la creación del servicio `avanti-historico-precios`.

Render publicará directamente el contenido de `dist/`; no se requieren variables de entorno ni servicios de backend.

Si prefieres crear el sitio manualmente, usa:

- Tipo: **Static Site**
- Build Command: `echo "Static assets are ready"`
- Publish Directory: `dist`

## Ejecución local

Desde la raíz del repositorio:

```powershell
python -m http.server 8000 --directory dist
```

Después abre `http://localhost:8000`.

## Exportación a Excel

La sección **BD de costos** incluye el botón **Exportar Excel**. Descarga un libro `.xlsx` con cinco hojas: control, base maestra, comparativo, presentaciones distintas y detalle del cálculo. Los códigos GTIN se conservan como texto y los importes se exportan como valores numéricos.

ALFARO, CASTILLO, EBENEL, FP MAYORISTA (QUÍMICA SUIZA) y FDS facturan con IGV incluido. El proceso de actualización no vuelve a aplicar el 18% a esos proveedores. Si una base anterior marca cualquiera de ellos como `+18%`, el generador elimina automáticamente ese doble cálculo y vuelve a calcular los comparativos.

## Actualización de datos

1. Guarda la nueva base en la carpeta superior con un nombre que comience por `BD_MADRE_DE_COSTOS`.
2. Ejecuta `python scripts/prepare_costs.py`; el script toma automáticamente el archivo más reciente y regenera `dist/costs.json`.
3. Ejecuta `python scripts/validate_costs.py`.
4. Revisa manualmente las advertencias de GTIN ausente y unidades por envase asumidas.
5. Publica los cambios en `main`. Render actualizará el sitio estático desde `dist/`.

Para actualizar el histórico de precios, reemplaza `BD_HISTORICO_PRECIOS/historico_precios.csv` en la carpeta superior y ejecuta `python scripts/prepare_data.py` antes de validar y publicar.

## Controles de validación

La validación automática comprueba que los conteos del Excel coincidan con el JSON publicado, que no existan claves producto–proveedor duplicadas, que los meses observados y arrastrados sean coherentes, que las comparaciones cuadren y que unidades e IGV reproduzcan el costo final. También exige que todos los proveedores con IGV incluido aparezcan con ese tratamiento y que su costo final no reciba un segundo 18%. La revisión humana confirma GTIN, presentación, equivalencias y cualquier unidad asumida contra la factura original.

## Estructura

- `dist/`: sitio listo para publicación, incluidos los datos procesados.
- `scripts/`: utilidades para regenerar los archivos de datos desde las fuentes locales.
- `dist/purchases.json`: compras y propuestas de conciliación sin información de contacto o bancaria.
- `.openai/hosting.json`: configuración de la publicación privada en Sites.
- `render.yaml`: infraestructura declarativa para Render.

## Revisión de unidades e IGV

En **BD de costos → Revisión de costos** se muestran los cálculos desde el importe original, la cantidad comprada y las unidades por envase. Por ejemplo, 3 cajas X30 son 90 unidades: un importe de 180 con IGV incluido da 2 por unidad; un importe de 180 sin IGV da 2.36 después de aplicar el 18% una sola vez.

Se reconocen cantidades como `CAJA X30`, `TAB X 30`, `X30TAB` y `CJAX30UND`. Una X seguida de ML, MG, centímetros o dosis no expresa unidades vendibles. Si el nombre contiene varias cantidades de envase o contradice el catálogo, la fila queda pendiente de revisar la factura. Si no hay X inequívoca se conservan únicamente unidades confirmadas por catálogo/factura, no una unidad asumida.

La revisión conserva el costo publicado para contrastarlo con el cálculo desde el importe; incluye filtro de estado y exportación Excel. No sobrescribe la BD madre ni sus comparativos sin disponer de la fuente original y una validación completa. Los márgenes de referencia usan las compras válidas recalculadas. Los avisos de ventas distinguen la confirmación pendiente de los motivos de falta de costo: código sin relacionar, falta de historia, presentación o unidades.
