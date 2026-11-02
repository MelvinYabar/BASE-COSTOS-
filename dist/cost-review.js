const costReview = {status:'',provider:'',month:'',query:'',page:0};
const COST_UNIT_STORAGE='avanti-cost-unit-decisions-v1';
let costUnitDecisions={};
try{const saved=JSON.parse(localStorage.getItem(COST_UNIT_STORAGE)||'{}');costUnitDecisions=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{}}catch(_){costUnitDecisions={}}
function saveCostUnitDecisions(){localStorage.setItem(COST_UNIT_STORAGE,JSON.stringify(costUnitDecisions));analytics.costIndex=null}
function effectiveCostUnitDecisions(){return {...(state.costs?.unitDecisions||{}),...costUnitDecisions}}

function costReviewRows() {
  const blocked = new Set(state.costs.presentations.map(r => r.gtin));
  return state.costs.detail.map(original => {
    const decisions=effectiveCostUnitDecisions(),row=AC.applyUnitDecision(original,decisions);
    const calc = AC.purchaseCost(row, state.costs.meta.igvIncludedProviders);
    const changed = calc.unitCost != null && (row.finalCost == null || Math.abs(calc.unitCost - row.finalCost) > .0015);
    const status = calc.issue ? 'Revisar cálculo' : changed ? 'Difiere del publicado' : !row.gtin ? 'Falta GTIN' : blocked.has(row.gtin) ? 'Revisar presentación' : calc.recovered ? 'Unidades recuperadas' : 'Cálculo consistente';
    const reason = [calc.issue, !row.gtin ? 'Falta GTIN para relacionar la compra con ventas.' : '', row.gtinSource==='Asociación manual central' ? 'GTIN recuperado de una asociación manual validada.' : '', row.centralGtinConflict ? `La asociación manual central reemplazó el GTIN original ${row.centralGtinConflict}.` : '', blocked.has(row.gtin) ? 'El GTIN está marcado con presentaciones distintas; no se cruza automáticamente con ventas.' : '', changed ? 'El costo recalculado difiere del publicado; contrastar con la factura.' : '', calc.source].filter(Boolean).join(' ');
    const unitKey=AC.costUnitKey(row);
    return {...calc, status, reason, changed,unitKey,decision:decisions[unitKey]||decisions[`ROW:${row.n}`]||null};
  });
}

function openCostUnitDecision(key){
  const row=state.costs.detail.find(item=>AC.costUnitKey(item)===key);if(!row)return;
  const current=costUnitDecisions[key]||state.costs?.unitDecisions?.[`ROW:${row.n}`]||{},hasLocal=!!costUnitDecisions[key],dialog=$('#costUnitDialog');
  dialog.innerHTML=`<button class="dialog-close" id="closeCostUnit" aria-label="Cerrar">×</button><p class="eyebrow">UNIDAD VENDIBLE</p><h2 id="costUnitTitle">Definir cómo se vende</h2><p><b>${esc(row.systemName||row.description)}</b><br>${esc(row.provider)} · ${esc(row.invoice||'sin factura')}</p><label class="unit-decision-label">Decisión<select id="costUnitMode"><option value="split" ${current.mode==='split'?'selected':''}>Se parte</option><option value="whole" ${current.mode==='whole'?'selected':''}>No se parte</option></select></label><label class="unit-decision-label" id="costUnitQuantityLabel">Cantidad de unidades vendibles por envase<input id="costUnitQuantity" type="number" min="1" step="1" value="${current.mode==='split'?esc(current.quantity||''):''}" placeholder="Ejemplo: 30"></label><div class="cost-note">Usa “Se parte” para tabletas, cápsulas, ampollas, sobres o jeringas. Usa “No se parte” para frascos en ML, tubos en G/GR e inhaladores expresados en dosis.</div><div class="purchase-actions"><button class="btn" id="saveCostUnit">Guardar decisión</button>${hasLocal?'<button class="btn secondary" id="removeCostUnit">Quitar decisión local</button>':''}</div>`;
  const sync=()=>{$('#costUnitQuantityLabel').classList.toggle('hidden',$('#costUnitMode').value==='whole')};sync();$('#costUnitMode').onchange=sync;
  $('#closeCostUnit').onclick=()=>dialog.close();
  $('#saveCostUnit').onclick=()=>{const mode=$('#costUnitMode').value,quantity=mode==='whole'?1:Number($('#costUnitQuantity').value);if(!Number.isInteger(quantity)||quantity<1)return alert('Indica una cantidad entera mayor que cero.');costUnitDecisions[key]={mode,quantity,product:row.systemName||row.description,savedAt:new Date().toISOString()};saveCostUnitDecisions();dialog.close();renderCostReview()};
  if($('#removeCostUnit'))$('#removeCostUnit').onclick=()=>{delete costUnitDecisions[key];saveCostUnitDecisions();dialog.close();renderCostReview()};
  dialog.showModal();
}

function correctionMatrix(rows) {
  return [
    ['id_temporal','fila_bd_costos','codigo_gtin_actual','producto_factura','proveedor','mes','factura','archivo_fuente','envases_comprados','unidades_por_envase_actual','importe_factura','motivo_pendiente','gtin_corregido','unidades_por_envase_corregidas','fuente_de_la_correccion','observacion'],
    ...rows.map((c,index)=>[
      `TMP-${String(index+1).padStart(4,'0')}`,c.row.n,c.row.gtin,c.row.description,c.row.provider,c.row.month,c.row.invoice,c.row.file,
      c.boxes,c.pack,c.amount,c.reason,'','','',''
    ])
  ];
}

function correctionCriteria(count) {
  return [
    ['Criterio','Valor'],['Estado','Hoja temporal: no modifica la BD madre hasta ser revisada e importada'],
    ['Filas pendientes',count],['GTIN corregido','Completar solo con un GTIN confirmado contra el maestro vigente.'],
    ['Unidades por envase corregidas','Completar con la cantidad vendible por caja o envase; no usar ML, MG, dimensiones ni dosis.'],
    ['Fuente de la corrección','Indicar factura, empaque físico, ficha técnica o maestro que respalda el dato.'],
    ['Observación','Explicar cualquier presentación distinta o duda antes de incorporar la corrección.']
  ];
}

function taxLabel(c) {
  const explicit = AC.normalize([c.row.tax,c.row.description,c.row.amountSource].filter(Boolean).join(' '));
  return c.factor===1 ? (/(?:S\s*\/\s*IGV|SIN IGV|EXONERAD|INAFECT)/.test(explicit) ? 'S/IGV; ×1' : 'Incluido; ×1') : 'Añadir 18%; ×1,18';
}

function renderCostReview() {
  const q = AC.normalize(costReview.query);
  const all = costReviewRows().filter(c => (!costReview.provider || c.row.provider === costReview.provider) &&
    (!costReview.month || c.row.month === costReview.month) && (!q || AC.normalize([c.row.gtin,c.row.description,c.row.invoice,c.row.provider].join(' ')).includes(q)));
  const filtered = all.filter(c => !costReview.status || (costReview.status === '__recovered' ? c.recovered && !c.issue : c.status === costReview.status));
  const pendingCorrections = all.filter(c => c.issue || !c.row.gtin);
  const rank = c => c.issue ? 0 : c.changed ? 1 : !c.row.gtin ? 2 : 3;
  filtered.sort((a,b) => rank(a)-rank(b) || a.row.n-b.row.n);
  const pages = Math.max(1,Math.ceil(filtered.length/40)); costReview.page = Math.min(costReview.page,pages-1);
  const page = filtered.slice(costReview.page*40,(costReview.page+1)*40);
  const statuses = unique(costReviewRows().map(c=>c.status)).sort();
  content.innerHTML = `<div class="view"><div class="section-head"><div><p class="eyebrow">UNIDADES E IGV</p><h2>Revisión del costo unitario</h2><p>Cada importe se divide entre las unidades compradas de su presentación.</p></div><div class="purchase-actions"><button class="btn secondary" id="exportPendingCorrections">Descargar pendientes</button><button class="btn secondary" id="exportCostReview">Exportar revisión</button></div></div>${costTabs()}
    <div class="cost-note"><b>Ejemplo:</b> 3 cajas × 30 tabletas = 90 unidades. Si el importe ya incluye IGV: S/ 180 ÷ 90 = <b>S/ 2,00 por unidad</b>. Si corresponde añadirlo: S/ 180 × 1,18 ÷ 90 = <b>S/ 2,36</b>. ALFARO, CASTILLO, EBENEL, FDS y FP MAYORISTA (QUÍMICA SUIZA), además de las líneas marcadas S/IGV, sin IGV, exoneradas o inafectas, usan factor 1.</div>
    <div class="analytics-filters"><label>Proveedor<select id="reviewProvider"><option value="">Todos</option>${unique(state.costs.detail.map(r=>r.provider)).sort().map(p=>`<option ${costReview.provider===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>Mes<select id="reviewMonth"><option value="">Todos</option>${state.costs.meta.months.map(m=>`<option ${costReview.month===m?'selected':''}>${esc(m)}</option>`).join('')}</select></label><label>Estado<select id="reviewStatus"><option value="">Todos</option><option value="__recovered" ${costReview.status==='__recovered'?'selected':''}>Unidades recuperadas del nombre</option>${statuses.map(s=>`<option ${costReview.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label class="analytics-search">Código, producto o factura<input id="reviewQuery" type="search" value="${esc(costReview.query)}" placeholder="Buscar en las compras…"></label><button class="btn secondary" id="reviewClear">Limpiar</button></div>
    <section class="kpis">${kpi('▤',quantity(all.length),'Líneas de compra','proveedor, mes y búsqueda')}${kpi('⌁',quantity(state.costs.meta.centralAssociationsApplied||0),'GTIN recuperados','asociación manual central')}${kpi('?',quantity(state.costs.meta.missingGtinAfter||0),'GTIN pendientes','aún sin relación')}${kpi('!',quantity(all.filter(c=>c.issue).length),'Cálculos por revisar','sin asignar un costo nuevo')}</section>
    <div class="assumption">ML, G/GR y DOSIS describen un frasco, tubo o inhalador completo: no se dividen. Tabletas, cápsulas, ampollas, sobres y jeringas sí usan la cantidad indicada después de X. Para un caso dudoso, pulsa “Ajustar” y elige “Se parte” con cantidad o “No se parte”.</div>
    <div class="table-wrap"><table class="data-table sales-table"><thead><tr><th>Fila / GTIN</th><th>Producto</th><th>Proveedor / mes</th><th>Envases comprados</th><th>Unidades / envase</th><th>Unidades totales</th><th>Importe origen</th><th>IGV</th><th>Importe final</th><th>Costo / unidad calculado</th><th>Costo publicado</th><th>Estado y motivo</th></tr></thead><tbody>${page.map(c=>`<tr><td>${c.row.n}<br><span class="mono">${esc(c.row.gtin||'Sin GTIN')}</span></td><td><b>${esc(c.row.description)}</b><small class="cell-note">${esc(c.row.invoice)} · ${esc(c.row.amountSource)}</small></td><td>${esc(c.row.provider)}<br>${esc(c.row.month)}</td><td class="numeric">${quantity(c.boxes)}</td><td class="numeric">${quantity(c.pack)}<br><button class="purchase-link unit-adjust" data-unit-key="${esc(c.unitKey)}">${c.decision?'Editar decisión':'Ajustar'}</button></td><td class="numeric">${quantity(c.units)}</td><td class="numeric">${money(c.amount)}</td><td>${taxLabel(c)}</td><td class="numeric">${money(c.finalAmount)}</td><td class="numeric">${preciseMoney(c.unitCost)}</td><td class="numeric">${preciseMoney(c.row.finalCost)}</td><td><span class="tag ${c.issue||c.changed?'bonus':''}">${esc(c.status)}</span><small class="cell-note">${esc(c.reason)}</small></td></tr>`).join('')||'<tr><td colspan="12">Sin registros para estos filtros.</td></tr>'}</tbody></table></div>
    <div class="pagination"><span>${quantity(filtered.length)} filas · página ${costReview.page+1} de ${pages}</span><div><button id="reviewPrev" aria-label="Página anterior" ${costReview.page===0?'disabled':''}>←</button> <button id="reviewNext" aria-label="Página siguiente" ${costReview.page===pages-1?'disabled':''}>→</button></div></div></div>`;
  document.querySelectorAll('[data-cost-tab]').forEach(b=>b.onclick=()=>{state.costTab=b.dataset.costTab;state.costPage=0;renderCosts()});
  for (const [id,key] of [['reviewProvider','provider'],['reviewMonth','month'],['reviewStatus','status']]) $('#'+id).onchange=e=>{costReview[key]=e.target.value;costReview.page=0;renderCostReview()};
  $('#reviewQuery').oninput=e=>{const caret=e.target.selectionStart;costReview.query=e.target.value;costReview.page=0;renderCostReview();$('#reviewQuery').focus();$('#reviewQuery').setSelectionRange(caret,caret)};
  $('#reviewClear').onclick=()=>{Object.assign(costReview,{provider:'',month:'',status:'',query:'',page:0});renderCostReview()};
  $('#reviewPrev').onclick=()=>{costReview.page--;renderCostReview()};$('#reviewNext').onclick=()=>{costReview.page++;renderCostReview()};
  document.querySelectorAll('[data-unit-key]').forEach(button=>button.onclick=()=>openCostUnitDecision(button.dataset.unitKey));
  $('#exportPendingCorrections').onclick=()=>downloadWorkbook('correcciones_temporales_costos.xlsx',correctionMatrix(pendingCorrections),'Pendientes temporales',correctionCriteria(pendingCorrections.length));
  $('#exportCostReview').onclick=()=>downloadWorkbook('revision_costos.xlsx',[
    ['fila','codigo_gtin','origen_gtin','conflicto_gtin_central','producto','proveedor','mes','envases_comprados','unidades_por_envase','unidades_totales','importe_origen','factor_igv','importe_final','costo_unitario','costo_publicado','estado','motivo'],
    ...filtered.map(c=>[c.row.n,c.row.gtin,c.row.gtinSource,c.row.centralGtinConflict,c.row.description,c.row.provider,c.row.month,c.boxes,c.pack,c.units,c.amount,c.factor,c.finalAmount,c.unitCost,c.row.finalCost,c.status,c.reason])
  ],'Revisión de costos',[
    ['Criterio','Valor'],['Fuente',state.costs.meta.source],['Fórmula','Costo unitario = importe de la línea × factor IGV / (envases comprados × unidades por envase)'],
    ['IGV incluido o no aplicable','ALFARO, CASTILLO, EBENEL, FDS, FP MAYORISTA (QUIMICA SUIZA), y líneas S/IGV, sin IGV, exoneradas o inafectas: factor 1.'],
    ['Unidades','X con cantidad inequívoca en el nombre o unidades confirmadas de catálogo/factura. No convertir ML, MG, dimensiones ni dosis en unidades vendibles.'],
    ['Contradicciones','Si nombre y catálogo difieren, o hay varias X de cantidad, revisar factura antes de asignar un costo.'],
    ['Costo publicado','Se conserva para contrastar; no se sobrescribe la BD madre sin fuente y validación completa.'],
    ['Hoja temporal','Pendientes temporales contiene GTIN o unidades por envase que deben completarse y validarse antes de importarlos.']
  ],[{name:'Pendientes temporales',matrix:correctionMatrix(pendingCorrections)}]);
}
