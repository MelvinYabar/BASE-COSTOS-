# Avanti — Histórico de precios

Dashboard estático para consultar el histórico de precios y la base de costos de Avanti Pharma Group S.A.C.

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

## Actualización de datos

1. Guarda la nueva base en la carpeta superior con un nombre que comience por `BD_MADRE_DE_COSTOS`.
2. Ejecuta `python scripts/prepare_costs.py`; el script toma automáticamente el archivo más reciente y regenera `dist/costs.json`.
3. Ejecuta `python scripts/validate_costs.py`.
4. Revisa manualmente las advertencias de GTIN ausente y unidades por envase asumidas.
5. Publica los cambios en `main`. Render actualizará el sitio estático desde `dist/`.

Para actualizar el histórico de precios, reemplaza `BD_HISTORICO_PRECIOS/historico_precios.csv` en la carpeta superior y ejecuta `python scripts/prepare_data.py` antes de validar y publicar.

## Controles de validación

La validación automática comprueba que los conteos del Excel coincidan con el JSON publicado, que no existan claves producto–proveedor duplicadas, que los meses observados y arrastrados sean coherentes, que las comparaciones cuadren y que unidades e IGV reproduzcan el costo final. La revisión humana confirma GTIN, presentación, equivalencias y cualquier unidad asumida contra la factura original.

## Estructura

- `dist/`: sitio listo para publicación, incluidos los datos procesados.
- `scripts/`: utilidades para regenerar los archivos de datos desde las fuentes locales.
- `.openai/hosting.json`: configuración de la publicación privada en Sites.
- `render.yaml`: infraestructura declarativa para Render.
