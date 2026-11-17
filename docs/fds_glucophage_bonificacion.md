# Bonificación FDS de Glucophage

El apartado **Bonificación FDS** simula el acuerdo indicado: por cada 12 cajas pagadas de cualquier Glucophage, se reciben 4 cajas de Glucophage XR 1000 de 30 comprimidos. Cada fila supone que las 12 cajas pagadas son de una sola presentación; el crédito por caja también sirve para pedidos mixtos.

## Fuentes y corte

- Costo de reposición de XR 1000: **S/ 84,68 por caja**, última compra pagada en F002-00073244 del 11 de agosto de 2026.
- Precio de lista de XR 1000: **S/ 4,10 por comprimido**, maestro de productos del 16 de noviembre de 2026. La caja de 30 tendría ingreso potencial de S/ 123,00.
- En la factura F002-00081036 del 30 de octubre, 24 cajas pagadas de XR 500 generaron 8 cajas bonificadas de XR 1000, registradas a S/ 0,01 cada una. La factura F002-00075159 del 31 de agosto también registra 24 y 8. En cambio, F002-00073244 del 11 de agosto registra 24 y 2, y F002-00069721 del 1 de julio registra 72 y 6. El acuerdo 12:4 no se aplica retroactivamente a esos pedidos.
- Los costos de las siete presentaciones provienen de la última línea pagada disponible de FDS hasta el 10 de noviembre de 2026. Los precios de venta vienen del maestro del 16 de noviembre. Son precios de lista, no importes realizados en ventas.

## Cálculo

Para 12 cajas pagadas y 4 bonificadas:

1. Valor de reposición del regalo: `4 × S/ 84,68 = S/ 338,72`.
2. Crédito gerencial por caja pagada: `S/ 338,72 ÷ 12 = S/ 28,2267`.
3. Costo atribuido por unidad del producto pagado: `(costo de su caja − S/ 28,2267) ÷ unidades de esa caja`.
4. Margen del pedido completo: `(ingreso de las cajas pagadas + ingreso de las cajas bonificadas − importe pagado por todas las cajas) ÷ ingreso total`. Incluye el cobro nominal de S/ 0,01 por caja bonificada.

El crédito es una atribución para analizar la promoción. El margen del conjunto es la medida de utilidad de la operación completa y evita sumar el mismo regalo dos veces. Esta vista no modifica la BD madre ni sustituye el registro contable del inventario.

Para actualizarla, incorporar las nuevas facturas a `dist/costs.json` e `dist/invoices.json`, cargar el nuevo maestro de productos y ejecutar `python scripts/prepare_glucophage_bonus.py`. La promoción 12:4 se configura en `data/fds_glucophage_promo.json`.
