const PURCHASE_MAPPING_STORAGE='avanti-purchase-gtin-mappings-v1';
const purchaseView={tab:'providers',provider:'',status:'',query:'',from:'',to:'',page:0,selectedKey:'',candidateQuery:'',manual:{}};

function loadPurchaseMappings(){
  try{const saved=JSON.parse(localStorage.getItem(PURCHASE_MAPPING_STORAGE)||'{}');purchaseView.manual=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{}}
  catch(_){purchaseView.manual={}}
}
function savePurchaseMappings(){localStorage.setItem(PURCHASE_MAPPING_STORAGE,JSON.stringify(purchaseView.manual))}
function effectivePurchase(record){
  const manual=purchaseView.manual[record.mappingKey||record.key];
  if(!manual)return record;
  const target=state.purchases?.catalog?.find(item=>String(item.gtin)===String(manual.gtin));
  return target?{...record,gtin:target.gtin,systemName:target.systemName,catalogName:target.catalogNames?.[0]||'',systemCode:target.systemCode,barcode:target.barcode,status:'Confirmado manualmente',method:'manual_local',score:1,manual:true,manualLocal:true,masterValid:true}
    :{...record,gtin:manual.gtin,systemName:manual.systemName||'',catalogName:manual.catalogName||'',status:'GTIN fuera del maestro',method:'manual_invalid',score:null,manual:true,manualLocal:true,masterValid:false};
}
function purchaseScope(){
  const q=AC.normalize(purchaseView.query);
  return (state.purchases?.rows||[]).map(effectivePurchase).filter(r=>(!purchaseView.provider||r.provider===purchaseView.provider)&&
    (!purchaseView.from||r.date>=purchaseView.from)&&(!purchaseView.to||r.date<=purchaseView.to)&&
    (!purchaseView.status||r.status===purchaseView.status)&&
    (!q||AC.normalize([r.description,r.provider,r.document,r.gtin,r.systemName,r.catalogName].join(' ')).includes(q)));
}
function purchaseTabs(){return `<div class="cost-tabs">${[['providers','Proveedores'],['products','Productos comprados'],['mapping','Conciliación GTIN'],['invoices','Facturas']].map(([id,label])=>`<button data-purchase-tab="${id}" class="${purchaseView.tab===id?'active':''}">${label}</button>`).join('')}</div>`}
function purchaseFilters(){
  const data=state.purchases,providers=data.providers.map(r=>r.provider).sort();
  const statuses=[...new Set([...Object.keys(data.meta.mappingCounts),'Confirmado manualmente','GTIN fuera del maestro'])].sort();
  return `<div class="analytics-filters purchase-filters">
    <label>Desde<input id="purchaseFrom" type="date" value="${esc(purchaseView.from)}"></label>
    <label>Hasta<input id="purchaseTo" type="date" value="${esc(purchaseView.to)}"></label>
    <label>Proveedor<select id="purchaseProvider"><option value="">Todos</option>${providers.map(p=>`<option ${purchaseView.provider===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
    <label>Conciliación<select id="purchaseStatus"><option value="">Todos</option>${statuses.map(s=>`<option ${purchaseView.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
    <label class="analytics-search">Producto, GTIN o factura<input id="purchaseQuery" type="search" value="${esc(purchaseView.query)}" placeholder="Buscar en compras…"></label>
    <button class="btn secondary" id="purchaseClear">Limpiar</button>
  </div>`;
}
function summarizePurchaseProviders(rows){
  const groups=new Map();
  rows.forEach(r=>{if(!groups.has(r.provider))groups.set(r.provider,{provider:r.provider,amount:0,lines:0,documents:new Set(),products:new Set(),exact:0,proposed:0});const g=groups.get(r.provider);g.amount+=r.amount||0;g.lines++;g.documents.add(r.document);g.products.add(r.description);if(r.status.startsWith('Coincidencia exacta')||r.status==='Confirmado manualmente')g.exact++;else if(r.status==='Propuesta alta'||r.status==='Revisar propuesta')g.proposed++});
  return [...groups.values()].map(g=>({...g,documents:g.documents.size,products:g.products.size})).sort((a,b)=>b.amount-a.amount);
}
function purchasePager(total){const pages=Math.max(1,Math.ceil(total/50));purchaseView.page=Math.min(purchaseView.page,pages-1);return `<div class="pagination"><span>${quantity(total)} registros · página ${purchaseView.page+1} de ${pages}</span><div><button id="purchasePrev" ${purchaseView.page===0?'disabled':''}>←</button> <button id="purchaseNext" ${purchaseView.page===pages-1?'disabled':''}>→</button></div></div>`}
function renderPurchaseProviders(rows){
  const rule=new Map(state.purchases.rules.map(r=>[r.provider,r])),groups=summarizePurchaseProviders(rows);
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Proveedor</th><th>Tratamiento IGV</th><th>Importe de líneas</th><th>Facturas</th><th>Líneas</th><th>Productos descritos</th><th>GTIN vinculados</th><th>Propuestas por revisar</th></tr></thead><tbody>${groups.map(g=>`<tr><td><b>${esc(g.provider)}</b></td><td><span class="tag ${rule.get(g.provider)?.factor===1?'':'bonus'}">${esc(rule.get(g.provider)?.igv||'Añadir 18%')}</span></td><td class="numeric"><b>${money(g.amount)}</b></td><td class="numeric">${quantity(g.documents)}</td><td class="numeric">${quantity(g.lines)}</td><td class="numeric">${quantity(g.products)}</td><td class="numeric">${quantity(g.exact)}</td><td class="numeric">${quantity(g.proposed)}</td></tr>`).join('')||'<tr><td colspan="8">Sin compras para estos filtros.</td></tr>'}</tbody></table></div>`;
}
const canReviewPurchase=r=>!r.status.startsWith('Coincidencia exacta');
function reviewButton(r){return canReviewPurchase(r)?`<button class="purchase-link" data-match-key="${esc(r.mappingKey||r.key)}">${esc(r.description)}</button>`:`<b>${esc(r.description)}</b>`}
function statusTag(r){return `<span class="tag ${r.status.startsWith('Coincidencia exacta')||r.status==='Confirmado manualmente'?'':r.status==='Propuesta alta'||r.status==='Revisar propuesta'?'bonus':'calc'}">${esc(r.status)}</span>${r.score!=null?`<small class="cell-note">${r.manualCentral?'Centralizada para todos':r.manual?'Seleccionada por usuario':`Similitud ${(r.score*100).toFixed(1)}%`}</small>`:r.status==='GTIN fuera del maestro'?'<small class="cell-note">Reasociar contra el maestro vigente</small>':''}`}
function renderPurchaseProducts(rows){
  const pagination=purchasePager(rows.length),page=rows.slice(purchaseView.page*50,(purchaseView.page+1)*50);
  return `<div class="assumption">Pulsa un producto pendiente para ver candidatos del catálogo interno y asociarlo con un GTIN. Cambios de cantidad por caja se muestran como advertencia, no como descarte automático.</div><div class="table-wrap"><table class="data-table purchase-table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Producto de la factura</th><th>Cantidad</th><th>Importe</th><th>GTIN asociado</th><th>Producto del sistema</th><th>Estado</th></tr></thead><tbody>${page.map(r=>`<tr class="${r.manual?'manual-row':''}"><td>${dateFmt(r.date)}</td><td>${esc(r.provider)}</td><td class="mono">${esc(r.document||'—')}</td><td>${reviewButton(r)}<small class="cell-note">${esc(r.unit)} · ${esc(r.type)}</small></td><td class="numeric">${quantity(r.qty)}</td><td class="numeric">${money(r.amount)}</td><td class="mono">${esc(r.gtin||'Pendiente')}</td><td>${esc(r.systemName||r.catalogName||'Sin relación')}</td><td>${statusTag(r)}</td></tr>`).join('')||'<tr><td colspan="9">Sin productos para estos filtros.</td></tr>'}</tbody></table></div>${pagination}`;
}
function purchaseMappings(){
  const q=AC.normalize(purchaseView.query),rank={'GTIN fuera del maestro':0,'Confirmado manualmente':1,'Propuesta alta':2,'Revisar propuesta':3,'Coincidencia exacta':4,'Coincidencia exacta global':4,'Sin catálogo del proveedor':5,'Sin coincidencia':6};
  return state.purchases.mappings.map(effectivePurchase).filter(r=>(!purchaseView.provider||r.provider===purchaseView.provider)&&(!purchaseView.status||r.status===purchaseView.status)&&(!q||AC.normalize([r.description,r.provider,r.gtin,r.systemName,r.catalogName].join(' ')).includes(q))).sort((a,b)=>(rank[a.status]??9)-(rank[b.status]??9)||a.provider.localeCompare(b.provider)||a.description.localeCompare(b.description));
}
function renderPurchaseMappings(){
  const source=purchaseMappings(),pagination=purchasePager(source.length),page=source.slice(purchaseView.page*50,(purchaseView.page+1)*50);
  return `<div class="assumption">La factura no necesita traer GTIN. Pulsa una descripción pendiente para comparar candidatos del sistema. Las asociaciones ya centralizadas funcionan en cualquier PC; una selección nueva queda local hasta incorporar su respaldo en la siguiente actualización.</div><div class="table-wrap"><table class="data-table purchase-table"><thead><tr><th>Proveedor</th><th>Descripción de compra</th><th>GTIN asociado</th><th>Nombre del sistema</th><th>Método</th><th>Estado</th></tr></thead><tbody>${page.map(r=>`<tr class="${r.manual?'manual-row':''}"><td>${esc(r.provider)}</td><td>${reviewButton(r)}</td><td class="mono">${esc(r.gtin||'Pendiente')}</td><td>${esc(r.systemName||r.catalogName||'Sin relación')}</td><td>${esc(r.method)}</td><td>${statusTag(r)}</td></tr>`).join('')||'<tr><td colspan="6">Sin conciliaciones para estos filtros.</td></tr>'}</tbody></table></div>${pagination}`;
}
function renderPurchaseInvoices(){
  const q=AC.normalize(purchaseView.query),source=state.purchases.register.filter(r=>(!purchaseView.provider||r.provider===purchaseView.provider)&&(!purchaseView.from||r.date>=purchaseView.from)&&(!purchaseView.to||r.date<=purchaseView.to)&&(!q||AC.normalize([r.provider,r.document,r.status].join(' ')).includes(q))),pagination=purchasePager(source.length),page=source.slice(purchaseView.page*50,(purchaseView.page+1)*50);
  return `<div class="cost-note">El registro de facturas y el detalle de productos provienen de libros distintos y pueden cubrir periodos diferentes. Por eso sus totales se muestran por separado y no se fuerza una conciliación falsa.</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Documento</th><th>Monto registrado</th><th>Estado</th><th>Entrega</th><th>Vencimiento</th><th>Pago</th></tr></thead><tbody>${page.map(r=>`<tr><td>${dateFmt(r.date)}</td><td><b>${esc(r.provider)}</b></td><td class="mono">${esc(r.document||'Sin número')}</td><td class="numeric">${money(r.amount)}</td><td>${esc(r.status||'—')}</td><td>${dateFmt(r.deliveryDate)}</td><td>${dateFmt(r.dueDate)}</td><td>${dateFmt(r.paymentDate)}</td></tr>`).join('')||'<tr><td colspan="8">Sin facturas para estos filtros.</td></tr>'}</tbody></table></div>${pagination}`;
}
function exportPurchaseAssociations(){
  const merged=new Map(state.purchases.mappings.filter(r=>r.method==='manual_central').map(r=>[r.key,{mappingKey:r.key,provider:r.provider,description:r.description,gtin:String(r.gtin),systemName:r.systemName,catalogName:r.catalogName||'',systemCode:r.systemCode||'',barcode:r.barcode||'',savedAt:r.savedAt||''}]));
  Object.values(purchaseView.manual).forEach(item=>merged.set(item.mappingKey,item));
  const payload={version:2,exportedAt:new Date().toISOString(),associations:[...merged.values()]};
  const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));link.download=`asociaciones_gtin_${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(link.href);
}
function importPurchaseAssociations(file){
  if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const payload=JSON.parse(reader.result),items=Array.isArray(payload)?payload:payload.associations;if(!Array.isArray(items))throw new Error('Formato inválido');const keys=new Set(state.purchases.mappings.map(r=>r.key)),gtins=new Set(state.purchases.catalog.map(r=>String(r.gtin)));let imported=0;for(const item of items){if(item&&keys.has(item.mappingKey)&&gtins.has(String(item.gtin))){purchaseView.manual[item.mappingKey]={...item,gtin:String(item.gtin)};imported++}}savePurchaseMappings();alert(`${imported} asociaciones cargadas.`);renderPurchases()}catch(error){alert(`No se pudo cargar el respaldo: ${error.message}`)}};reader.readAsText(file);
}
function exportPurchases(rows){
  if(purchaseView.tab==='providers'){const matrix=[['proveedor','importe_lineas','facturas','lineas','productos','gtin_vinculados','propuestas'],...summarizePurchaseProviders(rows).map(g=>[g.provider,g.amount,g.documents,g.lines,g.products,g.exact,g.proposed])];return downloadWorkbook('compras_por_proveedor.xlsx',matrix,'Proveedores')}
  if(purchaseView.tab==='mapping'){const items=purchaseMappings();return downloadWorkbook('conciliacion_gtin.xlsx',[['proveedor','descripcion_compra','gtin_asociado','producto_sistema','estado','metodo','similitud','origen'],...items.map(r=>[r.provider,r.description,r.gtin,r.systemName||r.catalogName,r.status,r.method,r.score,r.manualCentral?'manual central':r.manual?'manual local':'automático'])],'Conciliación GTIN')}
  if(purchaseView.tab==='invoices'){const items=state.purchases.register.filter(r=>(!purchaseView.provider||r.provider===purchaseView.provider)&&(!purchaseView.from||r.date>=purchaseView.from)&&(!purchaseView.to||r.date<=purchaseView.to));return downloadWorkbook('registro_facturas.xlsx',[['fecha','proveedor','documento','monto','estado','entrega','vencimiento','pago'],...items.map(r=>[r.date,r.provider,r.document,r.amount,r.status,r.deliveryDate,r.dueDate,r.paymentDate])],'Facturas')}
  return downloadWorkbook('productos_comprados.xlsx',[['fecha','proveedor','factura','producto_factura','cantidad','unidad','importe','gtin_asociado','producto_sistema','estado','similitud','origen'],...rows.map(r=>[r.date,r.provider,r.document,r.description,r.qty,r.unit,r.amount,r.gtin,r.systemName||r.catalogName,r.status,r.score,r.manualCentral?'manual central':r.manual?'manual local':'automático'])],'Productos comprados');
}
function findPurchaseMapping(key){return state.purchases.mappings.find(item=>item.key===key)}
function matchBadges(candidate){
  const badges=[];if(candidate.sameBrand)badges.push('<span class="tag">Nombre principal similar</span>');if(candidate.sameStrength)badges.push('<span class="tag">Misma concentración</span>');if(candidate.strengthConflict)badges.push('<span class="tag bonus">Concentración distinta</span>');if(candidate.sourcePack&&candidate.targetPack)badges.push(`<span class="tag ${candidate.sourcePack===candidate.targetPack?'':'bonus'}">Presentación X${candidate.sourcePack} → X${candidate.targetPack}</span>`);return badges.join('');
}
function renderPurchaseMatcher(){
  const dialog=$('#purchaseMatchDialog'),mapping=findPurchaseMapping(purchaseView.selectedKey);if(!dialog||!mapping)return;
  const effective=effectivePurchase(mapping),candidates=AvantiPurchaseMatching.rank(mapping.description,state.purchases.catalog,purchaseView.candidateQuery,18);
  dialog.innerHTML=`<button class="dialog-close" id="closePurchaseMatch" aria-label="Cerrar">×</button><p class="eyebrow">ASOCIACIÓN MANUAL DE GTIN</p><h2 id="purchaseMatchTitle">${esc(mapping.description)}</h2><p>${esc(mapping.provider)} · La cantidad por caja puede cambiar; confirma que sea el mismo producto, concentración y forma.</p>
    <div class="match-current"><div><small>Asociación actual</small><b>${effective.gtin?`${esc(effective.gtin)} · ${esc(effective.systemName||effective.catalogName)}`:'Sin GTIN confirmado'}</b></div>${effective.manualLocal?'<button class="btn secondary" id="removePurchaseMatch">Quitar asociación local</button>':''}</div>
    <input class="candidate-search" id="candidateSearch" type="search" value="${esc(purchaseView.candidateQuery)}" placeholder="Buscar por nombre, GTIN o código interno…" autocomplete="off">
    <div class="candidate-list">${candidates.map(candidate=>`<article class="candidate-card"><div class="candidate-main"><b>${esc(candidate.systemName)}</b><small><span class="mono">${esc(candidate.barcode||candidate.gtin)}</span>${candidate.systemCode&&candidate.systemCode!==candidate.barcode?` · Código interno ${esc(candidate.systemCode)}`:''} · Maestro ${esc(candidate.systemStatus||'sin estado')}${candidate.catalogNames?.length?`<br>También figura como ${esc(candidate.catalogNames.slice(0,2).join(' / '))}`:''}${candidate.providers?.length?`<br>${esc(candidate.providers.slice(0,4).join(', '))}`:''}</small><div class="candidate-meta"><span class="candidate-score">${Math.round(candidate.score*100)}% semejanza</span>${matchBadges(candidate)}</div></div><button class="btn" data-confirm-gtin="${esc(candidate.gtin)}">Asociar</button></article>`).join('')||'<div class="candidate-empty">No hay candidatos en el maestro vigente con esa búsqueda. Prueba una palabra más corta, el GTIN o el código interno.</div>'}</div>`;
  $('#closePurchaseMatch').onclick=()=>dialog.close();
  $('#candidateSearch').oninput=e=>{const caret=e.target.selectionStart;purchaseView.candidateQuery=e.target.value;renderPurchaseMatcher();$('#candidateSearch').focus();$('#candidateSearch').setSelectionRange(caret,caret)};
  document.querySelectorAll('[data-confirm-gtin]').forEach(button=>button.onclick=()=>{const target=state.purchases.catalog.find(item=>String(item.gtin)===button.dataset.confirmGtin);if(!target)return;purchaseView.manual[mapping.key]={mappingKey:mapping.key,provider:mapping.provider,description:mapping.description,gtin:String(target.gtin),systemName:target.systemName,catalogName:target.catalogNames?.[0]||'',systemCode:target.systemCode,barcode:target.barcode,masterSource:state.purchases.meta.productMasterSource,savedAt:new Date().toISOString()};savePurchaseMappings();dialog.close();renderPurchases()});
  if($('#removePurchaseMatch'))$('#removePurchaseMatch').onclick=()=>{delete purchaseView.manual[mapping.key];savePurchaseMappings();dialog.close();renderPurchases()};
}
function openPurchaseMatcher(key){purchaseView.selectedKey=key;purchaseView.candidateQuery='';renderPurchaseMatcher();$('#purchaseMatchDialog').showModal()}
function bindPurchaseView(rows){
  document.querySelectorAll('[data-purchase-tab]').forEach(b=>b.onclick=()=>{purchaseView.tab=b.dataset.purchaseTab;purchaseView.page=0;renderPurchases()});
  for(const [id,key] of [['purchaseFrom','from'],['purchaseTo','to'],['purchaseProvider','provider'],['purchaseStatus','status']])$('#'+id).onchange=e=>{purchaseView[key]=e.target.value;purchaseView.page=0;renderPurchases()};
  $('#purchaseQuery').oninput=e=>{const caret=e.target.selectionStart;purchaseView.query=e.target.value;purchaseView.page=0;renderPurchases();$('#purchaseQuery').focus();$('#purchaseQuery').setSelectionRange(caret,caret)};
  $('#purchaseClear').onclick=()=>{Object.assign(purchaseView,{provider:'',status:'',query:'',from:'',to:'',page:0});renderPurchases()};
  if($('#purchasePrev'))$('#purchasePrev').onclick=()=>{purchaseView.page--;renderPurchases()};if($('#purchaseNext'))$('#purchaseNext').onclick=()=>{purchaseView.page++;renderPurchases()};
  document.querySelectorAll('[data-match-key]').forEach(button=>button.onclick=()=>openPurchaseMatcher(button.dataset.matchKey));
  $('#exportPurchases').onclick=()=>exportPurchases(rows);if($('#exportPurchaseMappings'))$('#exportPurchaseMappings').onclick=exportPurchaseAssociations;if($('#importPurchaseMappings'))$('#importPurchaseMappings').onchange=e=>importPurchaseAssociations(e.target.files[0]);
}
function renderPurchases(){
  const data=state.purchases;if(!data)return content.innerHTML='<div class="empty"><b>No se cargó la base de compras</b>Regenera dist/purchases.json con scripts/prepare_purchases.py.</div>';
  const rows=purchaseScope(),providers=new Set(rows.map(r=>r.provider)),invoices=new Set(rows.map(r=>`${r.provider}|${r.document}`)),linked=rows.filter(r=>r.gtin&&(r.status.startsWith('Coincidencia exacta')||r.status==='Confirmado manualmente')).length;
  const body=purchaseView.tab==='providers'?renderPurchaseProviders(rows):purchaseView.tab==='products'?renderPurchaseProducts(rows):purchaseView.tab==='mapping'?renderPurchaseMappings():renderPurchaseInvoices();
  const backup=purchaseView.tab==='mapping'?`<button class="btn secondary" id="exportPurchaseMappings">Descargar asociaciones</button><label class="btn secondary upload-inline">Cargar asociaciones<input id="importPurchaseMappings" type="file" accept=".json"></label>`:'';
  content.innerHTML=`<div class="view"><div class="section-head"><div><p class="eyebrow">HISTÓRICO DE COMPRAS</p><h2>Compras por proveedor</h2><p>Facturas, productos y conciliación contra los códigos internos del sistema.</p></div><div class="purchase-actions">${backup}<button class="btn secondary" id="exportPurchases">Exportar Excel</button></div></div>${purchaseTabs()}${purchaseFilters()}
    <section class="kpis">${kpi('S/',money(rows.reduce((s,r)=>s+(r.amount||0),0)),'Importe del detalle','según filtros')}${kpi('▤',quantity(invoices.size),'Facturas con detalle',`${quantity(rows.length)} líneas`)}${kpi('P',quantity(providers.size),'Proveedores','histórico disponible')}${kpi('⌁',rows.length?percentage(linked/rows.length):'—','Líneas con GTIN vinculado','exacto o confirmado')}</section>
    <div class="cost-note"><b>El maestro de productos vigente define el GTIN y el nombre oficial.</b> ${quantity(data.meta.centralAssociations||0)} asociaciones manuales están centralizadas y funcionan en cualquier PC. Las nuevas selecciones se guardan localmente hasta la próxima actualización. Asociar un GTIN no confirma automáticamente que la cantidad por caja sea igual; esa presentación se valida por separado. IGV incluido: ALFARO, CASTILLO, EBENEL, FDS y FP MAYORISTA (QUÍMICA SUIZA).</div>${body}</div>`;
  bindPurchaseView(rows);
}
loadPurchaseMappings();
