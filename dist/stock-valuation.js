const stockValuationView={query:'',category:'',quality:'',sort:'value',page:0};

function stockValuationRows(){
  const q=stockValuationView.query.toLocaleLowerCase('es-PE');
  return state.stockValuation.products.filter(row=>
    (!q||`${row.code} ${row.name} ${row.sourceCategory}`.toLocaleLowerCase('es-PE').includes(q))&&
    (!stockValuationView.category||row.category===stockValuationView.category)&&
    (!stockValuationView.quality||(stockValuationView.quality==='abovePrice'?row.costAbovePrice:
      stockValuationView.quality==='unitReview'?row.reviewUnit90:row.valuationStatus===stockValuationView.quality))
  ).sort((a,b)=>{
    if(stockValuationView.sort==='sales90')return b.sold90-a.sold90||a.name.localeCompare(b.name);
    if(stockValuationView.sort==='stock')return b.stock-a.stock||a.name.localeCompare(b.name);
    if(stockValuationView.sort==='name')return a.name.localeCompare(b.name);
    return (b.value??-1)-(a.value??-1)||a.name.localeCompare(b.name);
  });
}

function renderStockValuationTable(){
  const scope=stockValuationRows(),size=75,last=Math.max(0,Math.ceil(scope.length/size)-1);
  stockValuationView.page=Math.min(stockValuationView.page,last);
  const start=stockValuationView.page*size;
  $('#valuationCount').textContent=scope.length?`${start+1}–${Math.min(start+size,scope.length)} de ${scope.length} productos`:'0 productos';
  $('#valuationPrev').disabled=stockValuationView.page===0;
  $('#valuationNext').disabled=stockValuationView.page===last;
  $('#valuationBody').innerHTML=scope.slice(start,start+size).map(row=>{
    const flags=[row.valuationStatus==='Costo faltante'?'Costo faltante':'',row.valuationStatus==='Stock negativo'?'Stock negativo':'',row.costAbovePrice?'Costo > precio':'',row.reviewUnit90?'Revisar unidad':''].filter(Boolean);
    return `<tr><td><b>${esc(row.name)}</b><small class="cell-note mono">${esc(row.code)} · ${esc(row.sourceCategory)}</small></td><td>${esc(row.category)}</td><td class="numeric">${quantity(row.stock)}</td><td class="numeric">${costMoney(row.cost)}</td><td class="numeric"><b>${row.value==null?'—':money(row.value)}</b></td><td class="numeric">${quantity(row.sold90)}</td><td class="numeric">${stockCoverDays(row.cover30,row,'30')}</td><td>${flags.length?flags.map(flag=>`<span class="valuation-flag">${esc(flag)}</span>`).join(' '):'—'}</td></tr>`;
  }).join('')||'<tr><td colspan="8" class="muted">No hay productos con estos filtros.</td></tr>';
}

function exportStockValuation(){
  const d=state.stockValuation,m=d.meta,scope=stockValuationRows();
  downloadWorkbook(`valorizacion_stock_${m.snapshot}.xlsx`,[
    ['codigo','producto','categoria_rotacion','categoria_okfac','stock_actual','costo_okfac','precio_okfac','valor_stock','vendido_30_dias','vendido_90_dias','unidades_por_dia_90','cobertura_30_dias','fecha_ultima_venta','estado_valorizacion','costo_mayor_precio','revisar_unidad_90d','filas_pdf_cronicos'],
    ...scope.map(r=>[r.code,r.name,r.category,r.sourceCategory,r.stock,r.cost,r.price,r.value,r.sold30,r.sold90,r.dailyRate90,r.cover30,r.lastSale,r.valuationStatus,r.costAbovePrice?'Sí':'No',r.reviewUnit90?'Sí':'No',r.chronicPdfRows.join(', ')])
  ],'Valorización',[
    ['Criterio','Valor'],['Stock al',m.snapshot],['Costo usado',m.costBasis],['Ventas incluidas hasta',m.salesThrough],
    ['Ventana de rotación desde',m.start90],['Clasificación',m.rotationRule],['Inactivos excluidos',m.inactiveExcluded],
    ['Con stock y costo faltante',m.missingCostProducts],['Unidades sin costo',m.missingCostUnits],
    ['Stock negativo excluido',m.negativeStockProducts],['Costo mayor al precio',m.costAbovePriceProducts],
    ['Renglones PDF crónicos sin GTIN inequívoco',m.chronicPdfUnmatchedRows],['Categoría seleccionada',stockValuationView.category||'Todas'],
    ['Calidad seleccionada',stockValuationView.quality||'Todas']
  ],[
    {name:'Resumen categorías',matrix:[['categoría','productos','stock_positivo_unidades','valor_stock','vendido_90_dias'],...d.categories.map(c=>[c.name,c.products,c.units,c.value,c.sold90])]},
    {name:'Crónicos sin asociar',matrix:[['fila_pdf','nombre_pdf','motivo'],...d.chronicUnmatched.map(r=>[r.row,r.name,'Sin equivalencia activa inequívoca de nombre y concentración'])]}
  ]);
}

function renderStockValuation(){
  const d=state.stockValuation,m=d.meta;
  content.innerHTML=`<div class="view"><div class="section-head"><div><p class="eyebrow">INVENTARIO AL ${esc(m.snapshot)}</p><h2>Valorización y rotación</h2><p>Stock activo × costo registrado en OKFAC, clasificado con ventas diarias y la lista de crónicos.</p></div><span class="pill">${quantity(m.activeProducts)} productos activos</span></div>
    <section class="kpis">${kpi('S/',money(m.totalValue),'Valor registrado','parcial; costos OKFAC')}${kpi('✓',quantity(m.valuedProducts),'Productos valorizados',`${quantity(m.inactiveExcluded)} inactivos excluidos`)}${kpi('!',quantity(m.missingCostProducts),'Con stock sin costo',`${quantity(m.missingCostUnits)} unidades`)}${kpi('↗',quantity(m.costAbovePriceProducts),'Costo mayor al precio','revisar unidad y precio')}</section>
    <div class="assumption"><b>Alcance de la cifra.</b> El costo se toma tal como está en OKFAC, sin volver a sumar IGV. Se excluyen ${m.negativeStockProducts} stocks negativos y ${m.inactiveExcluded} productos inactivos; ${m.missingCostProducts} productos con stock positivo y costo cero o vacío no aportan valor. Por eso S/ ${quantity(m.totalValue)} es el valor registrado de las filas valorizables, no el valor completo auditado. ${m.costAbovePriceProducts} productos incluidos en la cifra tienen costo mayor que su precio de venta y requieren revisión.</div>
    <div class="valuation-rule"><b>Categorías exclusivas:</b> los ${m.chronicMatchedProducts} GTIN asociados inequívocamente al PDF van en Crónicos. En los demás, las ventas de 90 días completos (${dateFmt(m.start90)}–${dateFmt(m.salesThrough)}) definen alta (≥90 unid.), media (30–89), baja (9–29) o muy baja/nula (&lt;9). El PDF tiene ${m.chronicPdfEntries} renglones; ${m.chronicPdfUnmatchedRows} no se asociaron sin duda. Las ventas sin código o fuera del catálogo activo no se asignan por parecido.</div>
    <div class="valuation-categories">${d.categories.map(c=>`<button class="valuation-category ${stockValuationView.category===c.name?'active':''}" data-valuation-category="${esc(c.name)}"><span>${esc(c.name)}</span><strong>${money(c.value)}</strong><small>${quantity(c.products)} productos · ${quantity(c.units)} unidades en stock</small></button>`).join('')}</div>
    <div class="stock-controls"><label>Buscar<input id="valuationQuery" type="search" placeholder="Producto, GTIN o categoría OKFAC" value="${esc(stockValuationView.query)}"></label><label>Rotación<select id="valuationCategory"><option value="">Todas</option>${d.categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select></label><label>Revisión<select id="valuationQuality"><option value="">Todos</option><option value="Costo faltante">Costo faltante</option><option value="Stock negativo">Stock negativo</option><option value="abovePrice">Costo mayor al precio</option><option value="unitReview">Revisar unidad</option></select></label><label>Orden<select id="valuationSort"><option value="value">Mayor valor</option><option value="sales90">Más ventas 90 días</option><option value="stock">Mayor stock</option><option value="name">Nombre</option></select></label><button class="btn secondary" id="valuationExport">Exportar Excel</button></div>
    <div class="stock-table-head"><strong>Detalle por producto</strong><div class="stock-pager"><span id="valuationCount"></span><button id="valuationPrev" aria-label="Página anterior">‹</button><button id="valuationNext" aria-label="Página siguiente">›</button></div></div><div class="table-wrap"><table class="data-table valuation-table"><thead><tr><th>Producto / GTIN</th><th>Categoría</th><th>Stock</th><th>Costo OKFAC</th><th>Valor stock</th><th>Vendido 90d</th><th>Cobertura 30d</th><th>Revisión</th></tr></thead><tbody id="valuationBody"></tbody></table></div>
    <p class="analytics-footnote">Control del archivo de ventas: ${quantity(m.salesReportControl.rows)} líneas; ${quantity(m.salesReportControl.quantity)} unidades y ${money(m.salesReportControl.amount)} concilian con sus totales impresos. La valorización usa stock del ${dateFmt(m.snapshot)} y excluye ventas del mismo día para medir rotación.</p></div>`;
  $('#valuationCategory').value=stockValuationView.category;
  $('#valuationQuality').value=stockValuationView.quality;
  $('#valuationSort').value=stockValuationView.sort;
  $('#valuationQuery').oninput=e=>{stockValuationView.query=e.target.value;stockValuationView.page=0;renderStockValuationTable()};
  $('#valuationCategory').onchange=e=>{stockValuationView.category=e.target.value;stockValuationView.page=0;renderStockValuation()};
  $('#valuationQuality').onchange=e=>{stockValuationView.quality=e.target.value;stockValuationView.page=0;renderStockValuationTable()};
  $('#valuationSort').onchange=e=>{stockValuationView.sort=e.target.value;stockValuationView.page=0;renderStockValuationTable()};
  document.querySelectorAll('[data-valuation-category]').forEach(b=>b.onclick=()=>{stockValuationView.category=stockValuationView.category===b.dataset.valuationCategory?'':b.dataset.valuationCategory;stockValuationView.page=0;renderStockValuation()});
  $('#valuationPrev').onclick=()=>{stockValuationView.page--;renderStockValuationTable()};
  $('#valuationNext').onclick=()=>{stockValuationView.page++;renderStockValuationTable()};
  $('#valuationExport').onclick=exportStockValuation;
  renderStockValuationTable();
}
