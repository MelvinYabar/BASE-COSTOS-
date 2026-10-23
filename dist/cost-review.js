const costReview = {status:'',provider:'',month:'',query:'',page:0};

function costReviewRows() {
  const blocked = new Set(state.costs.presentations.map(r => r.gtin));
  return state.costs.detail.map(row => {
    const calc = AC.purchaseCost(row, state.costs.meta.igvIncludedProviders);
    const changed = calc.unitCost != null && (row.finalCost == null || Math.abs(calc.unitCost - row.finalCost) > .0015);
    const status = calc.issue ? 'Revisar cálculo' : changed ? 'Difiere del publicado' : !row.gtin ? 'Falta GTIN' : blocked.has(row.gtin) ? 'Revisar presentación' : calc.recovered ? 'Unidades recuperadas' : 'Cálculo consistente';
    const reason = [calc.issue, !row.gtin ? 'Falta GTIN para relacionar la compra con ventas.' : '', blocked.has(row.gtin) ? 'El GTIN está marcado con presentaciones distintas; no se cruza automáticamente con ventas.' : '', changed ? 'El costo recalculado difiere del publicado; contrastar con la factura.' : '', calc.source].filter(Boolean).join(' ');
    return {...calc, status, reason, changed};
  });
}

function renderCostReview() {
  const q = AC.normalize(costReview.query);
  const all = costReviewRows().filter(c => (!costReview.provider || c.row.provider === costReview.provider) &&
    (!costReview.month || c.row.month === costReview.month) && (!q || AC.normalize([c.row.gtin,c.row.description,c.row.invoice,c.row.provider].join(' ')).includes(q)));
  const filtered = all.filter(c => !costReview.status || (costReview.status === '__recovered' ? c.recovered && !c.issue : c.status === costReview.status));
  const rank = c => c.issue ? 0 : c.changed ? 1 : !c.row.gtin ? 2 : 3;
  filtered.sort((a,b) => rank(a)-rank(b) || a.row.n-b.row.n);
  const pages = Math.max(1,Math.ceil(filtered.length/40)); costReview.page = Math.min(costReview.page,pages-1);
  const page = filtered.slice(costReview.page*40,(costReview.page+1)*40);
  const statuses = unique(costReviewRows().map(c=>c.status)).sort();
  content.innerHTML = `<div class="view"><div class="section-head"><div><p class="eyebrow">UNIDADES E IGV</p><h2>Revisión del costo unitario</h2><p>Cada importe se divide entre las unidades compradas de su presentación.</p></div><button class="btn secondary" id="exportCostReview">Exportar revisión</button></div>${costTabs()}
    <div class="cost-note"><b>Ejemplo:</b> 3 cajas × 30 tabletas = 90 unidades. Si el importe ya incluye IGV: S/ 180 ÷ 90 = <b>S/ 2,00 por unidad</b>. Si no incluye: S/ 180 × 1,18 ÷ 90 = <b>S/ 2,36</b>. ALFARO, CASTILLO, EBENEL, FDS y FP MAYORISTA (QUÍMICA SUIZA) no reciben otro 18%.</div>
    <div class="analytics-filters"><label>Proveedor<select id="reviewProvider"><option value="">Todos</option>${unique(state.costs.detail.map(r=>r.provider)).sort().map(p=>`<option ${costReview.provider===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>Mes<select id="reviewMonth"><option value="">Todos</option>${state.costs.meta.months.map(m=>`<option ${costReview.month===m?'selected':''}>${esc(m)}</option>`).join('')}</select></label><label>Estado<select id="reviewStatus"><option value="">Todos</option><option value="__recovered" ${costReview.status==='__recovered'?'selected':''}>Unidades recuperadas del nombre</option>${statuses.map(s=>`<option ${costReview.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label class="analytics-search">Código, producto o factura<input id="reviewQuery" type="search" value="${esc(costReview.query)}" placeholder="Buscar en las compras…"></label><button class="btn secondary" id="reviewClear">Limpiar</button></div>
    <section class="kpis">${kpi('▤',quantity(all.length),'Líneas de compra','proveedor, mes y búsqueda')}${kpi('÷',quantity(all.filter(c=>!c.issue).length),'Cálculos completos','con unidades e importe')}${kpi('X',quantity(all.filter(c=>c.recovered&&!c.issue).length),'Unidades recuperadas','X inequívoca en el nombre')}${kpi('!',quantity(all.filter(c=>c.issue).length),'Cálculos por revisar','sin asignar un costo nuevo')}</section>
    <div class="assumption">Esta revisión conserva el costo publicado para comparar. El costo de referencia de ventas usa el cálculo desde importe y unidades de las filas válidas. Un cálculo completo no garantiza el cruce: también se necesita GTIN, presentación compatible y un costo del periodo. X 10 ML, X 500 MG y X 200 DOSIS no se interpretan como diez, quinientas o doscientas unidades vendibles.</div>
    <div class="table-wrap"><table class="data-table sales-table"><thead><tr><th>Fila / GTIN</th><th>Producto</th><th>Proveedor / mes</th><th>Envases comprados</th><th>Unidades / envase</th><th>Unidades totales</th><th>Importe origen</th><th>IGV</th><th>Importe final</th><th>Costo / unidad calculado</th><th>Costo publicado</th><th>Estado y motivo</th></tr></thead><tbody>${page.map(c=>`<tr><td>${c.row.n}<br><span class="mono">${esc(c.row.gtin||'Sin GTIN')}</span></td><td><b>${esc(c.row.description)}</b><small class="cell-note">${esc(c.row.invoice)} · ${esc(c.row.amountSource)}</small></td><td>${esc(c.row.provider)}<br>${esc(c.row.month)}</td><td class="numeric">${quantity(c.boxes)}</td><td class="numeric">${quantity(c.pack)}</td><td class="numeric">${quantity(c.units)}</td><td class="numeric">${money(c.amount)}</td><td>${c.factor===1?'Incluido; ×1':'Añadir 18%; ×1,18'}</td><td class="numeric">${money(c.finalAmount)}</td><td class="numeric">${preciseMoney(c.unitCost)}</td><td class="numeric">${preciseMoney(c.row.finalCost)}</td><td><span class="tag ${c.issue||c.changed?'bonus':''}">${esc(c.status)}</span><small class="cell-note">${esc(c.reason)}</small></td></tr>`).join('')||'<tr><td colspan="12">Sin registros para estos filtros.</td></tr>'}</tbody></table></div>
    <div class="pagination"><span>${quantity(filtered.length)} filas · página ${costReview.page+1} de ${pages}</span><div><button id="reviewPrev" aria-label="Página anterior" ${costReview.page===0?'disabled':''}>←</button> <button id="reviewNext" aria-label="Página siguiente" ${costReview.page===pages-1?'disabled':''}>→</button></div></div></div>`;
  document.querySelectorAll('[data-cost-tab]').forEach(b=>b.onclick=()=>{state.costTab=b.dataset.costTab;state.costPage=0;renderCosts()});
  for (const [id,key] of [['reviewProvider','provider'],['reviewMonth','month'],['reviewStatus','status']]) $('#'+id).onchange=e=>{costReview[key]=e.target.value;costReview.page=0;renderCostReview()};
  $('#reviewQuery').oninput=e=>{const caret=e.target.selectionStart;costReview.query=e.target.value;costReview.page=0;renderCostReview();$('#reviewQuery').focus();$('#reviewQuery').setSelectionRange(caret,caret)};
  $('#reviewClear').onclick=()=>{Object.assign(costReview,{provider:'',month:'',status:'',query:'',page:0});renderCostReview()};
  $('#reviewPrev').onclick=()=>{costReview.page--;renderCostReview()};$('#reviewNext').onclick=()=>{costReview.page++;renderCostReview()};
  $('#exportCostReview').onclick=()=>downloadWorkbook('revision_costos.xlsx',[
    ['fila','codigo_gtin','producto','proveedor','mes','envases_comprados','unidades_por_envase','unidades_totales','importe_origen','factor_igv','importe_final','costo_unitario','costo_publicado','estado','motivo'],
    ...filtered.map(c=>[c.row.n,c.row.gtin,c.row.description,c.row.provider,c.row.month,c.boxes,c.pack,c.units,c.amount,c.factor,c.finalAmount,c.unitCost,c.row.finalCost,c.status,c.reason])
  ],'Revisión de costos',[
    ['Criterio','Valor'],['Fuente',state.costs.meta.source],['Fórmula','Costo unitario = importe de la línea × factor IGV / (envases comprados × unidades por envase)'],
    ['IGV incluido','ALFARO, CASTILLO, EBENEL, FDS, FP MAYORISTA (QUIMICA SUIZA). Factor 1; demás proveedores, 1.18.'],
    ['Unidades','X con cantidad inequívoca en el nombre o unidades confirmadas de catálogo/factura. No convertir ML, MG, dimensiones ni dosis en unidades vendibles.'],
    ['Contradicciones','Si nombre y catálogo difieren, o hay varias X de cantidad, revisar factura antes de asignar un costo.'],
    ['Costo publicado','Se conserva para contrastar; no se sobrescribe la BD madre sin fuente y validación completa.']
  ]);
}
