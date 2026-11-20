function audit75Pdf(url) {
  return /^(?:invoice-pdfs\/[^?#]+\.pdf|https:\/\/[^\s]+\.pdf)$/i.test(url || '') ? url : '';
}

function exportCostAudit75() {
  const rows = state.costAudit.rows;
  downloadWorkbook('auditoria_75_costos_Melvin.xlsx', [
    ['N°','GTIN','Producto OKFAC','Costo lista','Costo OKFAC 19 nov','Costo de compra por unidad','Diferencia lista vs compra %','Estado lista','Diferencia OKFAC vs compra %','Acción OKFAC','Mes compra','Proveedor','Factura','Fecha factura','Producto en factura','Envases','Unidades por envase','Importe con IGV','Tratamiento IGV','Archivo'],
    ...rows.map(r => {
      const source = r.sourceRows[0] || {};
      return [r.row-1,r.code,r.product,r.listCost,r.systemCost,r.referenceCost,r.differencePct == null ? null : r.differencePct / 100,r.status,
        r.systemDifferencePct == null ? null : r.systemDifferencePct / 100,r.systemStatus,r.referenceMonth,
        source.provider || '',source.invoice || '',source.date || '',source.description || '',source.boxes ?? null,source.pack ?? null,
        source.amount == null ? null : source.amount * (source.igvFactor || 1),source.igvFactor === 1 ? 'Incluido en importe' : '+18% según fuente',source.file || ''];
    })
  ], 'Auditoría 75', [
    ['Criterio','Costo de compra por unidad vendible, según última factura verificable enlazada.'],
    ['Corte de facturas',state.costAudit.meta.purchaseThrough],
    ['Pendientes','Sin compra exacta o con presentación/fórmula sin confirmar; no se reemplaza el costo por una suposición.'],
    ['Nota','El costo de la última compra no valoriza automáticamente existencias anteriores de OKFAC.']
  ]);
}

function renderCostAudit75() {
  const d = state.costAudit;
  const query = (state.costQuery || '').trim().toLowerCase();
  const filtered = d.rows.filter(r => (!state.costAuditStatus || r.systemStatus === state.costAuditStatus) &&
    (!query || [r.code,r.product,r.status,r.systemStatus,...r.sourceRows.flatMap(s => [s.provider,s.invoice,s.description])]
      .some(v => String(v || '').toLowerCase().includes(query))));
  const counts = d.meta.systemStatusCounts;
  const statuses = ['Revisar OKFAC: compra reciente','Revisar OKFAC: referencia antigua','OKFAC cercano a compra','Sin compra verificada','Revisar presentación'];
  content.innerHTML = `<div class="view"><div class="section-head"><div><p class="eyebrow">CONCILIACIÓN PRODUCTO POR PRODUCTO</p><h2>Auditoría de 75 costos · Melvin</h2><p>Lista de precios vs. factura de compra por unidad vendible y maestro OKFAC del 19 de noviembre.</p></div><span class="pill">Facturas hasta ${esc(d.meta.purchaseThrough)}</span></div>
    <section class="kpis cost-kpis">${kpi('75',d.meta.count,'Productos revisados','lista completa')}${kpi('✓',counts['OKFAC cercano a compra'] || 0,'OKFAC cercano','diferencia ≤ 5%')}${kpi('↗',(counts['Revisar OKFAC: compra reciente'] || 0)+(counts['Revisar OKFAC: referencia antigua'] || 0),'Revisar en OKFAC',`${counts['Revisar OKFAC: compra reciente'] || 0} recientes · ${counts['Revisar OKFAC: referencia antigua'] || 0} antiguas`)}${kpi('?',(counts['Sin compra verificada'] || 0)+(counts['Revisar presentación'] || 0),'Sin costo confirmado','no inferir')}</section>
    <div class="cost-note"><b>Criterio.</b> “Costo de compra” es el importe de la factura, con IGV una sola vez, dividido entre envases y unidades vendibles. “Estado lista” compara el Excel de Melvin; “Acción OKFAC” compara el costo del maestro OKFAC del 19 de noviembre. Revisa la factura y la unidad de venta antes de cambiar OKFAC, especialmente si la última compra es anterior a septiembre. Una compra antigua no valoriza el stock actual.</div>
    <div class="cost-toolbar">${costTabs()}<input id="costSearch" value="${esc(state.costQuery)}" placeholder="Buscar producto, GTIN o factura…"><select id="costAuditStatus"><option value="">Todos los estados</option>${statuses.map(s => `<option value="${esc(s)}" ${state.costAuditStatus===s?'selected':''}>${esc(s)} (${counts[s] || 0})</option>`).join('')}</select><button class="btn secondary" id="exportCostAudit75">Exportar 75 a Excel</button></div>
    <div class="table-wrap cost-audit-table"><table class="data-table"><thead><tr><th>N°</th><th>GTIN / producto</th><th>Costo lista</th><th>Costo OKFAC</th><th>Costo compra / unidad</th><th>Dif. lista</th><th>Estado lista</th><th>Dif. OKFAC</th><th>Acción OKFAC</th><th>Factura y cálculo</th></tr></thead><tbody>${filtered.map(r => {
      const source = r.sourceRows[0];
      const pdf = audit75Pdf(source?.pdfUrl);
      const difference = r.differencePct == null ? '—' : Math.abs(r.differencePct) < .05 ? '0.0%' : `${r.differencePct > 0 ? '+' : ''}${r.differencePct.toFixed(1)}%`;
      const systemDifference = r.systemDifferencePct == null ? '—' : Math.abs(r.systemDifferencePct) < .05 ? '0.0%' : `${r.systemDifferencePct > 0 ? '+' : ''}${r.systemDifferencePct.toFixed(1)}%`;
      return `<tr><td>${r.row-1}</td><td><span class="mono">${esc(r.code)}</span><br><b>${esc(r.product)}</b></td><td>${costMoney(r.listCost)}</td><td>${costMoney(r.systemCost)}</td><td><b>${costMoney(r.referenceCost)}</b>${r.referenceMonth?`<br><small>${esc(r.referenceMonth)}</small>`:''}</td><td>${difference}</td><td>${esc(r.status)}</td><td>${systemDifference}</td><td><span class="tag ${r.systemStatus.startsWith('Revisar OKFAC')?'bonus':''}">${esc(r.systemStatus)}</span></td><td>${source ? `<details><summary>${esc(source.provider)} · ${esc(source.invoice || source.date)}</summary><div class="audit-evidence">${esc(source.date)} · ${esc(source.description)}<br>${source.boxes} envase(s) × ${source.pack} unidad(es) · ${money(source.amount)} ${source.igvFactor === 1 ? 'IGV incluido' : '+18% IGV'}<br>${esc(source.file || '')}${pdf ? `<br><a href="${esc(pdf)}" target="_blank" rel="noopener noreferrer">Ver factura PDF</a>` : ''}</div></details>` : 'Sin factura exacta'}</td></tr>`;
    }).join('') || '<tr><td colspan="10">Sin resultados para este filtro.</td></tr>'}</tbody></table></div><p class="muted">${filtered.length} de ${d.meta.count} productos</p></div>`;
  document.querySelectorAll('[data-cost-tab]').forEach(button => button.onclick = () => {state.costTab=button.dataset.costTab;state.costPage=0;renderCosts()});
  $('#costSearch').oninput = event => {state.costQuery=event.target.value;renderCostAudit75()};
  $('#costAuditStatus').onchange = event => {state.costAuditStatus=event.target.value;renderCostAudit75()};
  $('#exportCostAudit75').onclick = exportCostAudit75;
}
