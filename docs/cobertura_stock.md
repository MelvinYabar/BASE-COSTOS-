# Cobertura de stock

La vista **Cobertura de stock** cruza por código exacto las ventas diarias de `ventas_totales.xlsx` con el reporte más reciente `20615607160-LISTA-PRODUCTOS-DD-MM-AAAA.xlsx`. Solo entran productos con estado `Activo`. No se relacionan registros por parecido de nombre.

El stock corresponde a la fecha de descarga del maestro. Para evitar un día parcial, las ventas de esa misma fecha se excluyen. La cobertura en días se calcula como `stock × días del período ÷ unidades vendidas`. La vista usa 30 días completos como indicador principal y muestra también 90 días y todo el período disponible. El stock y las ventas se toman en la unidad que usa el mismo código de Okfac.

Si no hubo ventas en un período, la cobertura queda sin cálculo; cero ventas no significa cobertura infinita. Stock cero se muestra como agotado. Stock negativo se marca para revisión y no genera una cobertura negativa. Las líneas sin código de producto y las de códigos fuera del catálogo activo se excluyen y se cuentan en el pie de la vista.

Para actualizar el panel, sustituir `ventas_totales.xlsx`, colocar el nuevo maestro de productos en la carpeta principal y ejecutar `python scripts/prepare_stock_cover.py`. El resultado publicado es `dist/stock-cover.json`. El botón **Exportar Excel** descarga los productos que cumplen los filtros visibles, con las tres coberturas y los criterios del cálculo.
