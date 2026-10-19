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

## Estructura

- `dist/`: sitio listo para publicación, incluidos los datos procesados.
- `scripts/`: utilidades para regenerar los archivos de datos desde las fuentes locales.
- `.openai/hosting.json`: configuración de la publicación privada en Sites.
- `render.yaml`: infraestructura declarativa para Render.
