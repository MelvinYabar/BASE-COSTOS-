const stockCoverView={query:'',filter:'all',sort:'cover30',page:0};

function stockCoverStatus(row){
  if(row.stock<0)return 'negative';
  if(row.stock===0)return 'out';
  if(row.sold30===0)return 'noSales';
  if(row.reviewUnit30)return 'review';
  if(row.suggestedOrder15>0)return 'urgent';
  if(row.cover30<30)return 'low';
  return 'covered';
}

function stockCoverRows(){
  const q=stockCoverView.query.toLocaleLowerCase('es-PE');
  return state.stockCover.products.filter(row=>(!q||`${row.code} ${row.name} ${row.category}`.toLocaleLowerCase('es-PE').includes(q))&&
    (stockCoverView.filter==='all'||stockCoverView.filter==='reorder'&&row.suggestedOrder15>0||stockCoverStatus(row)===stockCoverView.filter)).sort((a,b)=>{
      if(stockCoverView.sort==='sales30')return b.sold30-a.sold30||a.name.localeCompare(b.name);
      if(stockCoverView.sort==='stock')return b.stock-a.stock||a.name.localeCompare(b.name);
      const av=a.cover30,bv=b.cover30;
      return (av==null?Infinity:av)-(bv==null?Infinity:bv)||a.name.localeCompare(b.name);
    });
}

function stockCoverDays(value, row, period){
  if(row['reviewUnit'+period])return 'Revisar unidad';
  if(value==null)return row.stock<0?'Revisar stock':'Sin ventas en período';
  if(value>0&&value<.1)return '<0,1 día';
  return `${new Intl.NumberFormat('es-PE',{maximumFractionDigits:1}).format(value)} ${value===1?'día':'días'}`;
}

function stockCoverOrder(row){
  if(row.reviewUnit30)return 'Revisar unidad';
  if(row.stock<0)return 'Revisar stock';
  if(row.sold30===0)return 'Sin venta 30 días';
  return row.suggestedOrder15>0?quantity(row.suggestedOrder15):'—';
}

function renderStockCoverTable(){
  const scope=stockCoverRows(), body=$('#stockCoverBody');
  const pageSize=100, maxPage=Math.max(0,Math.ceil(scope.length/pageSize)-1);
  stockCoverView.page=Math.min(stockCoverView.page,maxPage);
  const from=stockCoverView.page*pageSize;
  $('#stockCoverCount').textContent=scope.length?`${(from+1).toLocaleString('es-PE')}–${Math.min(from+pageSize,scope.length).toLocaleString('es-PE')} de ${scope.length.toLocaleString('es-PE')} productos`:'0 productos';
  $('#stockPrev').disabled=stockCoverView.page===0;
  $('#stockNext').disabled=stockCoverView.page>=maxPage;
  body.innerHTML=scope.slice(from,from+pageSize).map(row=>`<tr><td><b>${esc(row.name)}</b><small class="cell-note mono">${esc(row.code)} · ${esc(row.category)}</small></td><td class="numeric">${quantity(row.stock)}</td><td class="numeric">${quantity(row.sold30)}</td><td class="numeric">${quantity(row.sold90)}</td><td class="numeric">${quantity(row.soldHistory)}</td><td class="numeric"><b>${esc(stockCoverDays(row.cover30,row,'30'))}</b></td><td class="numeric stock-order">${esc(stockCoverOrder(row))}</td><td class="numeric">${esc(stockCoverDays(row.cover90,row,'90'))}</td><td class="numeric">${esc(stockCoverDays(row.coverHistory,row,'History'))}</td><td><span class="stock-tag ${stockCoverStatus(row)}">${esc({negative:'Revisar stock',noSales:'Sin venta 30 días',out:'Sin stock',review:'Revisar unidad',urgent:'Menos de 15 días',low:'15 a 30 días',covered:'30 días o más'}[stockCoverStatus(row)])}</span></td><td>${row.lastSale?dateFmt(row.lastSale):'—'}</td></tr>`).join('')||'<tr><td colspan="11" class="muted">No hay productos con estos filtros.</td></tr>';
}

function renderStockCover(){
  const data=state.stockCover,m=data.meta,rows=data.products;
  const count=status=>rows.filter(row=>stockCoverStatus(row)===status).length;
  content.innerHTML=`<div class="view"><div class="section-head"><div><p class="eyebrow">INVENTARIO · ROTACIÓN REAL</p><h2>¿Cuántos días cubre el stock?</h2><p>Stock del ${dateFmt(m.snapshot)} cruzado por código con ventas diarias.</p></div><span class="pill">${rows.length.toLocaleString('es-PE')} productos activos</span></div>
    <div class="assumption"><span><b>Cobertura:</b> stock actual ÷ (cantidad vendida ÷ días del período). <b>Pedido sugerido a 15 días:</b> máximo entre 0 y el redondeo hacia arriba de (ventas de 30 días ÷ 30 × 15 − stock actual). Usa 30 días completos (${dateFmt(m.start30)} al ${dateFmt(m.lastCompleteDay)}); se muestran 90 días y el histórico de ${m.historyDays} días como referencia. La sugerencia está en unidades de OKFAC, no en cajas de proveedor; confirma la presentación antes de emitir el pedido. Se excluyen los ${m.inactiveExcluded} productos inactivos y las ventas del ${dateFmt(m.snapshot)}, que pueden estar incompletas. Cuando un mismo código muestra precios por cantidad en niveles muy distintos, se deja la cobertura y el pedido pendientes de revisar la unidad (30 días: ${m.unitReview30}; 90 días: ${m.unitReview90}).</span></div>
    <section class="kpis">${kpi('＋',rows.filter(row=>row.suggestedOrder15>0).length,'Con pedido sugerido','para llegar a 15 días')}${kpi('◫',count('low'),'15 a 30 días','con ventas en 30 días')}${kpi('✓',count('covered'),'30 días o más','con ventas en 30 días')}${kpi('—',count('noSales'),'Sin venta en 30 días','con stock disponible')}</section>
    <div class="stock-controls"><label>Buscar producto o código<input id="stockQuery" type="search" placeholder="Nombre, código o categoría" value="${esc(stockCoverView.query)}"></label><label>Estado<select id="stockFilter"><option value="all">Todos</option><option value="reorder">Con pedido sugerido</option><option value="out">Sin stock</option><option value="urgent">Menos de 15 días</option><option value="low">15 a 30 días</option><option value="covered">30 días o más</option><option value="noSales">Sin venta 30 días</option><option value="review">Revisar unidad</option><option value="negative">Stock negativo</option></select></label><label>Orden<select id="stockSort"><option value="cover30">Menor cobertura</option><option value="sales30">Más ventas recientes</option><option value="stock">Mayor stock</option></select></label><button class="btn secondary" id="stockExport">Exportar Excel</button></div>
    <div class="stock-table-head"><strong>Cobertura por producto</strong><div class="stock-pager"><span id="stockCoverCount"></span><button id="stockPrev" aria-label="Página anterior">‹</button><button id="stockNext" aria-label="Página siguiente">›</button></div></div><div class="table-wrap"><table class="data-table stock-table"><thead><tr><th>Producto / código</th><th>Stock actual</th><th>Ventas 30 días</th><th>Ventas 90 días</th><th>Ventas históricas</th><th>Cobertura 30 días</th><th>Pedido sugerido a 15 días (unid.)</th><th>Cobertura 90 días</th><th>Cobertura histórica</th><th>Estado</th><th>Última venta</th></tr></thead><tbody id="stockCoverBody"></tbody></table></div>
    <p class="analytics-footnote">${m.salesQuality.salesRowsOutsideActiveCatalog.toLocaleString('es-PE')} líneas de ventas corresponden a códigos fuera del catálogo activo; ${m.salesQuality.excludedWithoutProductCode.toLocaleString('es-PE')} líneas no tienen código de producto. No se vincularon por parecido de nombre. ${count('negative')} productos activos tienen stock negativo y requieren revisión.</p></div>`;
  $('#stockFilter').value=stockCoverView.filter;$('#stockSort').value=stockCoverView.sort;
  $('#stockQuery').oninput=event=>{stockCoverView.query=event.target.value;stockCoverView.page=0;renderStockCoverTable()};
  $('#stockFilter').onchange=event=>{stockCoverView.filter=event.target.value;stockCoverView.page=0;renderStockCoverTable()};
  $('#stockSort').onchange=event=>{stockCoverView.sort=event.target.value;stockCoverView.page=0;renderStockCoverTable()};
  $('#stockPrev').onclick=()=>{stockCoverView.page--;renderStockCoverTable()};
  $('#stockNext').onclick=()=>{stockCoverView.page++;renderStockCoverTable()};
  $('#stockExport').onclick=()=>{
    const scope=stockCoverRows();
    downloadWorkbook(`cobertura_stock_${m.snapshot}.xlsx`,[['codigo','producto','categoria','stock_actual','vendido_30_dias','vendido_90_dias','vendido_historico','cobertura_30_dias','pedido_sugerido_15_dias_unidades','cobertura_90_dias','cobertura_historica_dias','revisar_unidad_30d','revisar_unidad_90d','revisar_unidad_historica','estado','ultima_venta'],...scope.map(row=>[row.code,row.name,row.category,row.stock,row.sold30,row.sold90,row.soldHistory,row.cover30,row.suggestedOrder15,row.cover90,row.coverHistory,row.reviewUnit30?'Sí':'No',row.reviewUnit90?'Sí':'No',row.reviewUnitHistory?'Sí':'No',{negative:'Revisar stock',noSales:'Sin venta 30 días',out:'Sin stock',review:'Revisar unidad',urgent:'Menos de 15 días',low:'15 a 30 días',covered:'30 días o más'}[stockCoverStatus(row)],row.lastSale])], 'Cobertura', [['Criterio','Valor'],['Stock al',m.snapshot],['Ventas 30 días desde',m.start30],['Ventas 90 días desde',m.start90],['Histórico desde',m.historyStart],['Último día de venta incluido',m.lastCompleteDay],['Productos activos',m.activeProducts],['Inactivos excluidos',m.inactiveExcluded],['Objetivo de cobertura (días)',m.orderTargetDays],['Fórmula de pedido','max(0; redondear hacia arriba(venta 30 días × 15 ÷ 30 − stock))'],['Unidad pendiente 30 días',m.unitReview30],['Unidad pendiente 90 días',m.unitReview90],['Filtro',stockCoverView.filter],['Búsqueda',stockCoverView.query]]);
  };
  renderStockCoverTable();
}
