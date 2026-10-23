# Traspaso del proyecto — Dashboard de costos Avanti

Actualizado: 23 de octubre de 2026.

## Continuación local del 23 de octubre de 2026

Se añadieron vistas de precios/cantidades, vendidos por día y volumen mensual de compras y ventas. Ver las reglas detalladas y el flujo de importación en README.md. La arquitectura continúa estática, sin compilación.

Archivos nuevos: `dist/analytics-core.js` (cálculos compartidos), `dist/analytics.js` (interfaz e importación), `scripts/prepare_sales.py` y `scripts/test_analytics.cjs`. Se incorporaron tres entradas de navegación y estilos adaptables. La exportación de las vistas nuevas usa SheetJS local y conserva los códigos como texto.

El reporte local de ventas tiene el patrón `*PRODUCTOS-VENDIDOS-POR-DIA*.xlsx`, hoja `VENTAS-DIARIAS-POR-ITEM`, con encabezados en fila 13. El generador exige que el detalle concilie exactamente con el resumen. Las filas sin código y los ajustes con signos distintos se conservan y se señalan. El reporte original no tiene columna de distribuidor. No inventar esa relación ni eliminar filas para forzar comparaciones.

El usuario ratificó la lista de proveedores con IGV incluido (FDS, FP Mayorista/Química Suiza, Alfaro, Ebenel y Castillo). No confirmó todavía la unidad y el IGV del archivo de **ventas**. Por eso el control de comparación permanece desactivado al cargar o importar; habilita márgenes de referencia después de la verificación. No interpretar esa lista de proveedores como confirmación tributaria de las ventas.

El Excel de ventas y el JSON `dist/sales.json` están excluidos de Git. La versión local lee ese JSON; las importaciones de la interfaz se guardan en IndexedDB del mismo navegador/origen y sustituyen el histórico completo. La publicación pública puede cargar ventas localmente desde la interfaz, sin subir el archivo a un servidor.

La copia de trabajo inicial se recibió sin `.git`. Para integrar los cambios se clonó el repositorio y se trasladaron únicamente código, pruebas y documentación; las fuentes privadas de ventas no se trasladaron. Los JSON originales de compras y costos permanecen intactos. La validación del JSON de costos pasa con `--published-only`; no se dispone del Excel madre para comparar contra la fuente. Se conservan las tres advertencias previas de calidad.

Este documento reúne el contexto operativo necesario para continuar el proyecto desde otra computadora o con otro asistente. Es un resumen técnico saneado del trabajo realizado; no contiene credenciales, claves ni una copia literal de conversaciones privadas.

## Objetivo y estado actual

El proyecto es un dashboard estático y adaptable a móviles para consultar:

- el histórico de precios de compra;
- la base madre de costos;
- comparativos entre proveedores y presentaciones;
- alertas para compras;
- la trazabilidad del cálculo del costo final;
- una exportación completa a Excel.

La versión actual está operativa y publicada. La lógica de IGV de ALFARO y EBENEL ya fue corregida, y la validación automática termina sin errores críticos.

## Enlaces del proyecto

- Repositorio: <https://github.com/MelvinYabar/BASE-COSTOS-.git>
- Producción en Render: <https://base-costos.onrender.com>
- Publicación privada en Sites: <https://avanti-historico-precios.sprymyna68.chatgpt.site>
- Proyecto de Sites: `appgprj_6ad62710793481918441c8fdbef5a27e`

Render es la publicación pública principal. Sites se conserva como una publicación privada/alternativa. No hay credenciales almacenadas en el repositorio.

## Organización de archivos

El repositorio contiene el sitio y los datos procesados, pero no las fuentes originales. Para regenerar todo, la estructura local esperada es:

```text
Dashboard/
├─ BD_MADRE_DE_COSTOS_*.xlsx
├─ BD_HISTORICO_PRECIOS/
│  └─ historico_precios.csv
└─ avanti-dashboard/              # este repositorio
   ├─ dist/
   ├─ scripts/
   ├─ render.yaml
   └─ .openai/hosting.json
```

Los archivos Excel y CSV originales deben copiarse por separado a la nueva computadora si se quiere regenerar la información. El repositorio por sí solo permite abrir, modificar y desplegar el dashboard usando los JSON ya generados.

## Arquitectura

- `dist/index.html`: estructura principal.
- `dist/styles.css`: estilos y adaptación móvil.
- `dist/app.js`: interfaz, estado, filtros, tablas, gráficas y exportación; no existe una etapa de compilación.
- `dist/data.json`: histórico de precios procesado.
- `dist/costs.json`: base de costos procesada.
- `dist/vendor/xlsx.full.min.js`: SheetJS incluido localmente para exportar `.xlsx` desde el navegador.
- `scripts/prepare_data.py`: genera el histórico publicado.
- `scripts/prepare_costs.py`: selecciona la base de costos más reciente, normaliza la información y genera `costs.json`.
- `scripts/validate_costs.py`: ejecuta controles automáticos sobre la fuente y el JSON.

La aplicación es completamente estática: no usa servidor, base de datos, API ni variables de entorno. Para Python se necesita `openpyxl`. Node.js solo es útil para comprobar la sintaxis de `app.js`.

## Sección «BD de costos»

Incluye cinco vistas/conjuntos de información:

1. Base maestra.
2. Comparativo.
3. Presentaciones distintas.
4. Detalle del cálculo.
5. Exportación a Excel.

El botón **Exportar Excel** genera un archivo con las hojas `Control`, `Base maestra`, `Comparativo`, `Presentaciones` y `Detalle del cálculo`. Los GTIN se conservan como texto y los importes como valores numéricos.

No debe reaparecer en la interfaz la etiqueta o elemento visual «AK», que fue retirado por solicitud del usuario.

## Reglas de negocio importantes

### IGV

Estos proveedores entregan precios de factura con IGV ya incluido:

- ALFARO
- CASTILLO
- EBENEL
- FDS
- FP MAYORISTA (QUIMICA SUIZA)

Para ellos, el resultado publicado debe cumplir:

```text
tratamiento = "IGV incluido"
costo final = costo sin impuesto
```

Si un archivo fuente antiguo los marca como `+18%`, `prepare_costs.py` elimina el doble cálculo dividiendo la base incorrecta entre `1.18` y vuelve a calcular los comparativos. La implementación usa una lista general `IGV_INCLUDED_PROVIDERS`; no deben agregarse excepciones aisladas fuera de esa lista.

Correcciones ya incorporadas:

- ALFARO: 506 líneas de detalle, 404 filas de base y 3,031 celdas mensuales corregidas.
- EBENEL: 490 líneas de detalle, 303 filas de base y 2,288 celdas mensuales corregidas; cambiaron 77 comparativos.

Para cualquier proveedor nuevo, se debe confirmar su tratamiento tributario con la factura. Los demás registros se calculan de acuerdo con la marca de la fuente: cuando corresponda `+18%`, el costo final es la base multiplicada por `1.18`.

### Histórico y alertas

- Los productos bonificados se excluyen de promedios y comparativos.
- La tarjeta **Atención de compras** prioriza incrementos mayores al 10%.
- Precios menores o iguales a S/ 0.10 se señalan para validación y se excluyen de alertas/comparativos.
- Los productos con proveedor único se muestran como riesgo de dependencia.
- En el histórico, la base de precio de ALFARO es el valor final impreso con IGV incluido.

## Último conjunto de datos conocido

Base de costos:

- Fuente: `BD_MADRE_DE_COSTOS_19-10-2026.xlsx`.
- Periodo: mayo a diciembre de 2026.
- 1,805 filas de base.
- 1,536 productos.
- 747 GTIN.
- 207 comparaciones.
- 12 presentaciones distintas.
- 2,724 filas de detalle.

Histórico de precios:

- Generado el 19 de octubre de 2026.
- Periodo: mayo a agosto de 2026.
- 2,958 líneas y 518 facturas.
- 1,962 descripciones observadas y 1,843 productos.
- 12 proveedores.

Existe una diferencia conocida entre las 1,952 descripciones declaradas por la fuente y las 1,962 observadas; se muestra como nota de control de calidad y no debe ocultarse sin investigar la causa.

La lógica vigente quedó establecida en el commit `409c236` antes de añadir este documento.

## Cómo actualizar los datos

Desde la raíz del repositorio:

1. Copiar el nuevo `BD_MADRE_DE_COSTOS*.xlsx` en la carpeta superior. El generador elige automáticamente el archivo más reciente.
2. Si cambió el histórico, reemplazar también `BD_HISTORICO_PRECIOS/historico_precios.csv`.
3. Regenerar y validar:

```powershell
python scripts/prepare_costs.py
python scripts/prepare_data.py
python scripts/validate_costs.py
node --check dist/app.js
```

4. Probar localmente:

```powershell
python -m http.server 8000 --directory dist
```

5. Revisar el dashboard en `http://localhost:8000`, comprobar la exportación Excel y verificar los cambios con `git diff`.
6. Publicar en `main` solo cuando el usuario lo solicite. Render desplegará automáticamente el contenido de `dist/`.

Si solo cambió la base de costos, `prepare_data.py` no es obligatorio. Si solo cambió el histórico, `prepare_costs.py` no es obligatorio.

## Validación

La validación automática comprueba:

- conteos entre Excel y JSON;
- claves producto–proveedor duplicadas;
- meses observados frente a costos arrastrados;
- aritmética de comparativos, mínimos y máximos;
- unidades por envase;
- reglas de IGV y ausencia de doble impuesto;
- correspondencia del nombre de la fuente;
- conteo de filas exportables.

Último resultado conocido: **0 errores críticos** y tres advertencias para revisión humana:

- dos claves duplicadas: `KOPODEX 1000MG X30TAB J / CASTILLO` y `Mucocar 600mg Granulos x 20 Sobres (=) / ALFARO`;
- 1,213 filas de detalle sin GTIN;
- 457 filas con una unidad por envase asumida.

Esas advertencias no deben corregirse automáticamente sin contrastarlas con la factura, catálogo o maestro original. La revisión humana debe confirmar GTIN, presentación, equivalencias y unidades.

## Despliegue

Render debe configurarse como **Static Site**, no como Web Service:

```text
Build Command: echo "Static assets are ready"
Publish Directory: dist
Environment Variables: ninguna
```

`render.yaml` ya declara esta configuración. `.openai/hosting.json` conserva la referencia de la publicación privada en Sites.

## Criterios para continuar el trabajo

- Leer este archivo y `README.md` antes de modificar el proyecto.
- Ejecutar `git status` y preservar cambios existentes del usuario.
- No subir facturas, bases fuente, claves, tokens ni información privada al repositorio público.
- Mantener la aplicación sin proceso de compilación salvo que el usuario apruebe un cambio de arquitectura.
- Regenerar los JSON con los scripts; no editar manualmente grandes bloques de datos.
- Ejecutar las validaciones después de cualquier cambio de datos o lógica.
- No asumir la regla de IGV de un proveedor nuevo: verificarla primero.
- No hacer `push`, cambiar publicaciones o crear servicios externos sin solicitud del usuario.

## Texto sugerido para iniciar en la otra computadora

```text
Clona https://github.com/MelvinYabar/BASE-COSTOS-.git y abre el repositorio.
Lee completos HANDOFF.md y README.md antes de actuar. Luego revisa git status,
la estructura del proyecto y los scripts de preparación/validación. Continúa desde
el estado actual, preserva los cambios existentes y aplica las reglas de negocio de
IGV documentadas. No publiques ni subas fuentes privadas salvo que te lo solicite.
```

## Regla de unidades e IGV aclarada el 23 de octubre de 2026

El usuario confirmó la regla de compras: multiplicar envases por unidades de la presentación, aplicar IGV solo a proveedores que no lo incluyen y dividir el importe final entre las unidades totales. Se corrigió verbalmente la inversión de la división de su ejemplo: es importe / unidades.

`AvantiAnalytics.purchaseCost` implementa esa regla; `packFromName` reconoce X de cantidad sin confundir volumen, concentración, dimensiones ni dosis. Los conflictos con catálogo y múltiples cantidades quedan pendientes. `costIndex` usa las compras recalculadas válidas para las referencias de venta. No se han cambiado los JSON originales ni el generador de la BD madre sin fuente Excel.

Nueva vista: `dist/cost-review.js`, accesible en BD de costos → Revisión de costos. Muestra cálculo y costo publicado en paralelo, unidades recuperadas, faltantes, conflictos, filtros y exportación. Los avisos en ventas muestran motivos concretos y distinguen la confirmación de unidad/IGV todavía pendiente. La aclaración del usuario se refiere al costo de compras, no demuestra la unidad y base tributaria del reporte de ventas.
