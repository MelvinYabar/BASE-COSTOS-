const purchaseView = {tab:'providers',provider:'',status:'',query:'',from:'',to:'',page:0};

function purchaseScope() {
  const source = state.purchases?.rows || [], q = AC.normalize(purchaseView.query);
  return source.filter(r => (!purchaseView.provider || r.provider === purchaseView.provider) &&
    (!purchaseView.from || r.date >= purchaseView.from) && (!purchaseView.to || r.date <= purchaseView.to) &&
    (!purchaseView.status || r.status === purchaseView.status) &&
    (!q || AC.normalize([r.description,r.provider,r.document,r.gtin,r.systemName,r.catalogName].join(' ')).includes(q)));
}

function purchaseTabs() {
  return `<div class="cost-tabs">${[['providers','Proveedores'],['products','Productos comprados'],['mapping','Conciliación GTIN'],['invoices','Facturas']].map(([id,label]) => `<button data-purchase-tab="${id}" class="${purchaseView.tab===id?'active':''}">${label}</button>`).join('')}</div>`;
}

function purchaseFilters() {
  const data = state.purchases, providers = data.providers.map(r=>r.provider).sort(), statuses = Object.keys(data.meta.mappingCounts).sort();
  return `<div class="analytics-filters purchase-filters">
    <label>Desde<input id="purchaseFrom" type="date" value="${esc(purchaseView.from)}"></label>
    <label>Hasta<input id="purchaseTo" type="date" value="${esc(purchaseView.to)}"></label>
    <label>Proveedor<select id="purchaseProvider"><option value="">Todos</option>${providers.map(p=>`<option ${purchaseView.provider===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
    <label>Conciliación<select id="purchaseStatus"><option value="">Todos</option>${statuses.map(s=>`<option ${purchaseView.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
    <label class="analytics-search">Producto, GTIN o factura<input id="purchaseQuery" type="search" value="${esc(purchaseView.query)}" placeholder="Buscar en compras…"></label>
    <button class="btn secondary" id="purchaseClear">Limpiar</button>
  </div>`;
}

function summarizePurchaseProviders(rows) {
  const groups = new Map();
  rows.forEach(r => {
    if (!groups.has(r.provider)) groups.set(r.provider,{provider:r.provider,amount:0,lines:0,documents:new Set(),products:new Set(),exact:0,proposed:0});
    const g=groups.get(r.provider); g.amount += r.amount || 0; g.lines++; g.documents.add(r.document); g.products.add(r.description);
    if (r.status.startsWith('Coincidencia exacta')) g.exact++;
    else if (r.status==='Propuesta alta'||r.status==='Revisar propuesta') g.proposed++;
  });
  return [...groups.values()].map(g=>({...g,documents:g.documents.size,products:g.products.size})).sort((a,b)=>b.amount-a.amount);
}

function purchasePager(total) {
  const pages=Math.max(1,Math.ceil(total/50)); purchaseView.page=Math.min(purchaseView.page,pages-1);
  return `<div class="pagination"><span>${quantity(total)} registros · página ${purchaseView.page+1} de ${pages}</span><div><button id="purchasePrev" ${purchaseView.page===0?'disabled':''}>←</button> <button id="purchaseNext" ${purchaseView.page===pages-1?'disabled':''}>→</button></div></div>`;
}

function renderPurchaseProviders(rows) {
  const rule = new Map(state.purchases.rules.map(r=>[r.provider,r]));
  const groups=summarizePurchaseProviders(rows);
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Proveedor</th><th>Tratamiento IGV</th><th>Importe de líneas</th><th>Facturas</th><th>Líneas</th><th>Productos descritos</th><th>GTIN exactos</th><th>Propuestas por revisar</th></tr></thead><tbody>${groups.map(g=>`<tr><td><b>${esc(g.provider)}</b></td><td><span class="tag ${rule.get(g.provider)?.factor===1?'':'bonus'}">${esc(rule.get(g.provider)?.igv||'Añadir 18%')}</span></td><td class="numeric"><b>${money(g.amount)}</b></td><td class="numeric">${quantity(g.documents)}</td><td class="numeric">${quantity(g.lines)}</td><td class="numeric">${quantity(g.products)}</td><td class="numeric">${quantity(g.exact)}</td><td class="numeric">${quantity(g.proposed)}</td></tr>`).join('')||'<tr><td colspan="8">Sin compras para estos filtros.</td></tr>'}</tbody></table></div>`;
}

function renderPurchaseProducts(rows) {
  const pagination=purchasePager(rows.length), page=rows.slice(purchaseView.page*50,(purchaseView.page+1)*50);
  return `<div class="table-wrap"><table class="data-table purchase-table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Producto de la factura</th><th>Cantidad</th><th>Importe</th><th>GTIN propuesto</th><th>Producto del sistema</th><th>Estado</th></tr></thead><tbody>${page.map(r=>`<tr><td>${dateFmt(r.date)}</td><td>${esc(r.provider)}</td><td class="mono">${esc(r.document||'—')}</td><td><b>${esc(r.description)}</b><small class="cell-note">${esc(r.unit)} · ${esc(r.type)}</small></td><td class="numeric">${quantity(r.qty)}</td><td class="numeric">${money(r.amount)}</td><td class="mono">${esc(r.gtin||'Pendiente')}</td><td>${esc(r.systemName||r.catalogName||'Sin relación')}</td><td><span class="tag ${r.status.startsWith('Coincidencia exacta')?'':r.status==='Propuesta alta'||r.status==='Revisar propuesta'?'bonus':'calc'}">${esc(r.status)}</span>${r.score!=null?`<small class="cell-note">Similitud ${(r.score*100).toFixed(1)}%</small>`:''}</td></tr>`).join('')||'<tr><td colspan="9">Sin productos para estos filtros.</td></tr>'}</tbody></table></div>${pagination}`;
}

function renderPurchaseMappings() {
  const q=AC.normalize(purchaseView.query), rank={'Propuesta alta':0,'Revisar propuesta':1,'Coincidencia exacta':2,'Coincidencia exacta global':2,'Sin catálogo del proveedor':3,'Sin coincidencia':4};
  const source=state.purchases.mappings.filter(r=>(!purchaseView.provider||r.provider===purchaseView.provider)&&(!purchaseView.status||r.status===purchaseView.status)&&(!q||AC.normalize([r.description,r.provider,r.gtin,r.systemName,r.catalogName].join(' ')).includes(q))).sort((a,b)=>(rank[a.status]??9)-(rank[b.status]??9)||a.provider.localeCompare(b.provider)||a.description.localeCompare(b.description));
  const pagination=purchasePager(source.length), page=source.slice(purchaseView.page*50,(purchaseView.page+1)*50);
  return `<div class="assumption">Las coincidencias exactas se pueden usar como vínculo técnico. Las propuestas por similitud nunca se confirman automáticamente: deben revisarse contra nombre, concentración y presentación. “Sin coincidencia” permanece sin GTIN.</div><div class="table-wrap"><table class="data-table purchase-table"><thead><tr><th>Proveedor</th><th>Descripción de compra</th><th>GTIN candidato</th><th>Nombre del sistema</th><th>Método</th><th>Estado</th></tr></thead><tbody>${page.map(r=>`<tr><td>${esc(r.provider)}</td><td><b>${esc(r.description)}</b></td><td class="mono">${esc(r.gtin||'Pendiente')}</td><td>${esc(r.systemName||r.catalogName||'Sin relación')}</td><td>${esc(r.method)}</td><td><span class="tag ${r.status.startsWith('Coincidencia exacta')?'':r.status.includes('propuesta')||r.status==='Propuesta alta'?'bonus':'calc'}">${esc(r.status)}</span>${r.score!=null?`<small class="cell-note">${(r.score*100).toFixed(1)}%</small>`:''}</td></tr>`).join('')||'<tr><td colspan="6">Sin conciliaciones para estos filtros.</td></tr>'}</tbody></table></div>${pagination}`;
}

function renderPurchaseInvoices() {
  const q=AC.normalize(purchaseView.query), source=state.purchases.register.filter(r=>(!purchaseView.provider||r.provider===purchaseView.provider)&&(!purchaseView.from||r.date>=purchaseView.from)&&(!purchaseView.to||r.date<=purchaseView.to)&&(!q||AC.normalize([r.provider,r.document,r.status].join(' ')).includes(q)));
  const pagination=purchasePager(source.length), page=source.slice(purchaseView.page*50,(purchaseView.page+1)*50);
  return `<div class="cost-note">El registro de facturas y el detalle de productos provienen de libros distintos y pueden cubrir periodos diferentes. Por eso sus totales se muestran por separado y no se fuerza una conciliación falsa.</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Documento</th><th>Monto registrado</th><th>Estado</th><th>Entrega</th><th>Vencimiento</th><th>Pago</th></tr></thead><tbody>${page.map(r=>`<tr><td>${dateFmt(r.date)}</td><td><b>${esc(r.provider)}</b></td><td class="mono">${esc(r.document||'Sin número')}</td><td class="numeric">${money(r.amount)}</td><td>${esc(r.status||'—')}</td><td>${dateFmt(r.deliveryDate)}</td><td>${dateFmt(r.dueDate)}</td><td>${dateFmt(r.paymentDate)}</td></tr>`).join('')||'<tr><td colspan="8">Sin facturas para estos filtros.</td></tr>'}</tbody></table></div>${pagination}`;
}

function exportPurchases(rows) {
  if (purchaseView.tab==='providers') {
    const matrix=[['proveedor','importe_lineas','facturas','lineas','productos','gtin_exactos','propuestas'],...summarizePurchaseProviders(rows).map(g=>[g.provider,g.amount,g.documents,g.lines,g.products,g.exact,g.proposed])];
    return downloadWorkbook('compras_por_proveedor.xlsx',matrix,'Proveedores');
  }
  if (purchaseView.tab==='mapping') {
    const q=AC.normalize(purchaseView.query), items=state.purchases.mappings.filter(r=>(!purchaseView.provider||r.provider===purchaseView.provider)&&(!purchaseView.status||r.status===purchaseView.status)&&(!q||AC.normalize([r.description,r.gtin,r.systemName,r.catalogName].join(' ')).includes(q)));
    return downloadWorkbook('conciliacion_gtin.xlsx',[['proveedor','descripcion_compra','gtin_candidato','producto_sistema','estado','metodo','similitud'],...items.map(r=>[r.provider,r.description,r.gtin,r.systemName||r.catalogName,r.status,r.method,r.score])],'Conciliación GTIN');
  }
  if (purchaseView.tab==='invoices') {
    const items=state.purchases.register.filter(r=>(!purchaseView.provider||r.provider===purchaseView.provider)&&(!purchaseView.from||r.date>=purchaseView.from)&&(!purchaseView.to||r.date<=purchaseView.to));
    return downloadWorkbook('registro_facturas.xlsx',[['fecha','proveedor','documento','monto','estado','entrega','vencimiento','pago'],...items.map(r=>[r.date,r.provider,r.document,r.amount,r.status,r.deliveryDate,r.dueDate,r.paymentDate])],'Facturas');
  }
  return downloadWorkbook('productos_comprados.xlsx',[['fecha','proveedor','factura','producto_factura','cantidad','unidad','importe','gtin_candidato','producto_sistema','estado','similitud'],...rows.map(r=>[r.date,r.provider,r.document,r.description,r.qty,r.unit,r.amount,r.gtin,r.systemName||r.catalogName,r.status,r.score])],'Productos comprados');
}

function bindPurchaseView(rows) {
  document.querySelectorAll('[data-purchase-tab]').forEach(b=>b.onclick=()=>{purchaseView.tab=b.dataset.purchaseTab;purchaseView.page=0;renderPurchases()});
  for(const [id,key] of [['purchaseFrom','from'],['purchaseTo','to'],['purchaseProvider','provider'],['purchaseStatus','status']]) $('#'+id).onchange=e=>{purchaseView[key]=e.target.value;purchaseView.page=0;renderPurchases()};
  $('#purchaseQuery').oninput=e=>{const caret=e.target.selectionStart;purchaseView.query=e.target.value;purchaseView.page=0;renderPurchases();$('#purchaseQuery').focus();$('#purchaseQuery').setSelectionRange(caret,caret)};
  $('#purchaseClear').onclick=()=>{Object.assign(purchaseView,{provider:'',status:'',query:'',from:'',to:'',page:0});renderPurchases()};
  if($('#purchasePrev')) $('#purchasePrev').onclick=()=>{purchaseView.page--;renderPurchases()};
  if($('#purchaseNext')) $('#purchaseNext').onclick=()=>{purchaseView.page++;renderPurchases()};
  $('#exportPurchases').onclick=()=>exportPurchases(rows);
}

function renderPurchases() {
  const data=state.purchases;
  if(!data) return content.innerHTML='<div class="empty"><b>No se cargó la base de compras</b>Regenera dist/purchases.json con scripts/prepare_purchases.py.</div>';
  const rows=purchaseScope(), providers=new Set(rows.map(r=>r.provider)), invoices=new Set(rows.map(r=>`${r.provider}|${r.document}`)), exact=rows.filter(r=>r.status.startsWith('Coincidencia exacta')).length;
  const body=purchaseView.tab==='providers'?renderPurchaseProviders(rows):purchaseView.tab==='products'?renderPurchaseProducts(rows):purchaseView.tab==='mapping'?renderPurchaseMappings():renderPurchaseInvoices();
  content.innerHTML=`<div class="view"><div class="section-head"><div><p class="eyebrow">HISTÓRICO DE COMPRAS</p><h2>Compras por proveedor</h2><p>Facturas, productos y conciliación conservadora contra los códigos del sistema.</p></div><button class="btn secondary" id="exportPurchases">Exportar Excel</button></div>${purchaseTabs()}${purchaseFilters()}
    <section class="kpis">${kpi('S/',money(rows.reduce((s,r)=>s+(r.amount||0),0)),'Importe del detalle','según filtros')}${kpi('▤',quantity(invoices.size),'Facturas con detalle',`${quantity(rows.length)} líneas`)}${kpi('P',quantity(providers.size),'Proveedores','histórico disponible')}${kpi('⌁',rows.length?percentage(exact/rows.length):'—','Líneas con GTIN exacto','propuestas aparte')}</section>
    <div class="cost-note">IGV incluido: ALFARO, CASTILLO, EBENEL, FDS y FP MAYORISTA (QUÍMICA SUIZA). Para los demás proveedores el maestro usa factor 1,18. El archivo publicado excluye contactos, teléfonos, cuentas, credenciales y observaciones privadas.</div>${body}</div>`;
  bindPurchaseView(rows);
}
