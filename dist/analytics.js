/* Sales stay local to this dashboard. Importing replaces the current sales dataset. */
const analytics = {
  data: [], meta: null, loading: true, message: '', error: '', tab: 'products',
  from: '', to: '', provider: '', query: '', page: 0, source: 'purchases',
  comparable: false, costIndex: null, staged: null
};
const AC = AvantiAnalytics;
const quantity = n => n == null ? '—' : new Intl.NumberFormat('es-PE', {maximumFractionDigits: 2}).format(n);
const preciseMoney = n => n == null ? '—' : new Intl.NumberFormat('es-PE', {style: 'currency', currency: 'PEN', minimumFractionDigits: 4, maximumFractionDigits: 4}).format(n);
const percentage = n => n == null ? '—' : new Intl.NumberFormat('es-PE', {style: 'percent', maximumFractionDigits: 1}).format(n);

function salesDatabase(mode, payload) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('avanti-sales', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('datasets');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('datasets', mode === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('datasets');
      const op = mode === 'get' ? store.get('current') : store.put(payload, 'current');
      tx.oncomplete = () => { db.close(); resolve(op.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('No se pudo guardar la base.')); };
    };
  });
}

async function loadSales() {
  try {
    let payload;
    try { payload = await salesDatabase('get'); }
    catch (_) { analytics.message = 'El navegador no permite guardar ventas entre sesiones.'; }
    if (!payload) {
      const response = await fetch('sales.json');
      if (response.ok) payload = await response.json();
      else if (response.status !== 404) throw new Error('No se pudo leer la base de ventas.');
    }
    if (payload) {
      analytics.data = payload.rows;
      analytics.meta = payload.meta;
    }
  } catch (e) { analytics.error = e.message; }
  analytics.loading = false;
  if (state.data && ['sales', 'daily', 'volume'].includes(state.view)) render();
}

function salesScope() {
  const q = AC.normalize(analytics.query);
  if (!analytics.costIndex) analytics.costIndex = AC.costIndex(state.costs);
  return AC.attachCosts(analytics.data.filter(r =>
    (!analytics.from || r.date >= analytics.from) && (!analytics.to || r.date <= analytics.to) &&
    (!analytics.provider || r.provider === analytics.provider) &&
    (!q || AC.normalize(r.code + ' ' + r.product).includes(q))), analytics.costIndex, analytics.comparable);
}

function analyticsFilters(sourceRows) {
  const providers = unique(sourceRows.map(r => r.provider)).sort();
  return `<div class="analytics-filters">
    <label>Desde<input id="analyticsFrom" type="date" value="${esc(analytics.from)}"></label>
    <label>Hasta<input id="analyticsTo" type="date" value="${esc(analytics.to)}"></label>
    <label>Distribuidor<select id="analyticsProvider"><option value="">Todos</option>${providers.map(p => `<option ${analytics.provider === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
    <label class="analytics-search">Producto o código<input id="analyticsQuery" type="search" value="${esc(analytics.query)}" placeholder="Nombre, GTIN o código…"></label>
    <button class="btn secondary" id="analyticsClear">Limpiar filtros</button>
  </div>${analytics.from && analytics.to && analytics.from > analytics.to ? '<p class="import-error" role="alert">La fecha inicial es posterior a la final.</p>' : ''}`;
}

function bindAnalyticsFilters() {
  for (const [id, key] of [['analyticsFrom','from'], ['analyticsTo','to'], ['analyticsProvider','provider']]) {
    $('#' + id).onchange = e => { analytics[key] = e.target.value; analytics.page = 0; render(); };
  }
  $('#analyticsQuery').oninput = e => {
    const caret = e.target.selectionStart;
    analytics.query = e.target.value; analytics.page = 0; render();
    $('#analyticsQuery').focus(); $('#analyticsQuery').setSelectionRange(caret, caret);
  };
  $('#analyticsClear').onclick = () => {
    analytics.from = analytics.to = analytics.provider = analytics.query = ''; analytics.page = 0; render();
  };
}

function salesToolbar() {
  return `<div class="analytics-actions"><button class="btn secondary" id="salesTemplate">Plantilla CSV</button><label class="btn upload-btn">Cargar ventas<input id="salesUpload" type="file" accept=".xlsx,.xls,.csv" aria-label="Cargar archivo de ventas"></label></div>`;
}

function bindSalesToolbar() {
  $('#salesUpload').onchange = e => readSalesFile(e.target.files[0]);
  $('#salesTemplate').onclick = () => downloadCSV('plantilla_ventas.csv', [['fecha','codigo','producto','cantidad','importe','distribuidor','unidad','costo_unitario']]);
}

function salesNotices() {
  const missing = analytics.data.filter(r => !r.code).length;
  const adjustments = analytics.data.filter(r => r.qty * r.amount < 0).length;
  return `${analytics.error ? `<div class="import-error" role="alert">${esc(analytics.error)}</div>` : ''}
    ${analytics.message ? `<div class="cost-note" role="status">${esc(analytics.message)}</div>` : ''}
    ${analytics.meta ? `<div class="sales-provenance"><span>Fuente: <b>${esc(analytics.meta.source)}</b></span><span>${quantity(analytics.data.length)} filas · ${dateFmt(analytics.meta.from)} al ${dateFmt(analytics.meta.to)}</span><span>Ventas guardadas en este navegador al importar.</span></div>` : ''}
    ${missing ? `<div class="quality-alert"><span><b>${quantity(missing)} filas sin código.</b> Se incluyen en los importes y se agrupan por descripción exacta, separadas de los productos con código. No se les asigna un costo automáticamente.</span></div>` : ''}
    ${adjustments ? `<div class="quality-alert"><span><b>${quantity(adjustments)} filas con cantidad e importe de signos distintos.</b> Se conservan tal como aparecen para cuadrar con el reporte. Su margen queda pendiente de revisar el ajuste.</span></div>` : ''}`;
}

function analyticsPager(total) {
  const pages = Math.max(1, Math.ceil(total / 50));
  analytics.page = Math.min(analytics.page, pages - 1);
  return `<div class="pagination"><span>${quantity(total)} registros · página ${analytics.page + 1} de ${pages}</span><div><button id="analyticsPrev" aria-label="Página anterior" ${analytics.page === 0 ? 'disabled' : ''}>←</button> <button id="analyticsNext" aria-label="Página siguiente" ${analytics.page === pages - 1 ? 'disabled' : ''}>→</button></div></div>`;
}

function bindAnalyticsPager() {
  if (!$('#analyticsPrev')) return;
  $('#analyticsPrev').onclick = () => { analytics.page--; render(); };
  $('#analyticsNext').onclick = () => { analytics.page++; render(); };
}

function salesTable(groups, daily) {
  const pagination = analyticsPager(groups.length);
  const page = groups.slice(analytics.page * 50, (analytics.page + 1) * 50);
  return `<div class="table-wrap"><table class="data-table sales-table"><thead><tr>${daily ? '<th>Fecha</th>' : ''}<th>Código producto</th><th>Medicamento / insumo</th><th>Unidad</th><th>Cantidad reportada</th><th>Importe vendido</th><th>Precio ponderado</th><th>Costo de referencia / unidad</th><th>Margen sobre costo</th><th>Estado del costo</th></tr></thead><tbody>${page.map(r => `<tr>${daily ? `<td>${dateFmt(r.date)}</td>` : ''}<td class="mono">${esc(r.code || 'Sin código')}</td><td><b>${esc(r.product)}</b>${r.descriptions > 1 ? `<small class="cell-note">${r.descriptions} descripciones para el mismo código</small>` : ''}</td><td>${esc(r.unit)}</td><td class="numeric">${quantity(r.qty)}</td><td class="numeric">${money(r.amount)}</td><td class="numeric">${preciseMoney(r.price)}</td><td class="numeric">${preciseMoney(r.unitCost)}</td><td class="numeric ${r.margin != null && r.margin < 0 ? 'negative' : ''}">${percentage(r.margin)}</td><td><span class="tag ${r.missingCost ? 'bonus' : ''}">${r.missingCost ? `${r.missingCost} filas sin costo comparable` : 'Referencia disponible'}</span></td></tr>`).join('') || `<tr><td colspan="${daily ? 11 : 10}"><div class="empty"><b>Sin ventas para estos filtros</b>Prueba otro rango o limpia los filtros.</div></td></tr>`}</tbody></table></div>${pagination}`;
}

function renderSales(daily = false) {
  const scope = salesScope(), total = AC.summarize(scope);
  const covered = AC.summarize(scope.filter(r => r.cost != null));
  const groups = AC.aggregate(scope, daily ? 'daily' : 'product');
  content.innerHTML = `<div class="view">
    <div class="section-head"><div><p class="eyebrow">VENTAS Y RENTABILIDAD</p><h2>${daily ? 'Vendidos por día' : 'Precios y cantidades'}</h2><p>${daily ? 'Cantidad e importe por fecha y medicamento.' : 'Base de precios de venta y cantidades por código de producto.'}</p></div>${salesToolbar()}</div>
    ${salesNotices()}${analyticsFilters(analytics.data)}
    <section class="kpis">${kpi('S/', money(total.amount), 'Importe vendido', 'según filtros')}${kpi('▦', unique(scope.map(r => r.unit)).length <= 1 ? quantity(total.qty) : '—', 'Cantidad reportada', `${quantity(groups.length)} ${daily ? 'grupos día–producto' : 'grupos producto–unidad'}`)}${kpi('⇄', percentage(covered.margin), 'Margen en ventas comparables', `${quantity(covered.count)} de ${quantity(total.count)} filas`)}${kpi('!', quantity(total.missingCost), 'Filas sin costo comparable', 'incluidas en ventas')}</section>
    <div class="cost-note"><b>Precio de venta:</b> suma de importes ÷ suma de cantidades del mismo código y unidad. Conserva importes cero, negativos y cantidades tal como aparecen en la fuente. <b>Margen sobre costo:</b> (precio ÷ costo − 1) × 100. Se deja vacío si falta costo en alguna fila del grupo.</div>
    <details class="analytics-method"><summary>Costo usado en el margen y criterios de comparación</summary><p>Primero se usa el costo unitario del archivo de ventas, si existe. En su ausencia, se busca el GTIN exacto en el detalle de costos y se calcula un promedio ponderado por unidades compradas del mes. Si no hubo compra en ese mes, se toma el último mes anterior disponible. No se usan meses posteriores, líneas con unidades asumidas ni GTIN marcados con presentaciones distintas.</p><p>Es una referencia mensual de compras de todos los proveedores, no el costo real del inventario vendido. No asigna el distribuidor de la venta. Los importes de compra pueden tener tratamientos de IGV distintos; la referencia de costos ya incorpora las reglas de la BD madre.</p></details>
    <label class="cost-confirm"><input id="salesComparable" type="checkbox" ${analytics.comparable ? 'checked' : ''}> Confirmo que las ventas están por tableta/unidad y tienen un tratamiento de IGV comparable con el costo final.</label>
    ${!analytics.comparable ? '<div class="assumption">Confirma la unidad de venta y el IGV para habilitar los costos y márgenes de referencia.</div>' : ''}
    ${analytics.loading ? '<div class="empty"><b>Cargando histórico de ventas…</b></div>' : !analytics.data.length ? '<div class="empty sales-empty"><b>Carga el histórico de ventas</b>Admite el reporte «PRODUCTOS / SERVICIOS VENDIDOS POR DÍA» de tu sistema o la plantilla CSV. La base de compras se conserva.</div>' : `
    <div class="cost-toolbar">${daily ? '<span class="muted">Detalle diario por código y unidad</span>' : `<div class="cost-tabs">${[['products','Precios y cantidades'],['prices','BD de precios'],['quantities','BD de cantidades'],['margins','Márgenes'],['detail','Base de ventas']].map(([id,label]) => `<button data-sales-tab="${id}" class="${analytics.tab === id ? 'active' : ''}">${label}</button>`).join('')}</div>`}<button id="exportSales" class="btn secondary">Exportar Excel</button></div>
    ${daily ? salesTable(groups, true) : analytics.tab === 'detail' ? salesDetailTable(scope) : analytics.tab === 'products' ? salesTable(groups, false) : analytics.tab === 'margins' ? salesTable(groups.slice().sort((a,b) => (a.margin ?? Infinity) - (b.margin ?? Infinity)), false) : salesSimpleTable(groups, analytics.tab)}
    ${analytics.comparable ? `<p class="analytics-footnote">El margen de la tarjeta considera únicamente ${money(covered.amount)} de ventas con costo comparable (${quantity(covered.count)} filas). En la tabla, cada producto requiere costo en todas sus filas filtradas. En Márgenes, los menores porcentajes aparecen primero.</p>` : ''}
    <p class="analytics-footnote">Los totales corresponden a todas las filas filtradas, incluidas las páginas que no se muestran. Las cantidades de unidades diferentes se mantienen separadas.</p>`}
  </div>`;
  bindAnalyticsFilters(); bindSalesToolbar(); bindAnalyticsPager();
  $('#salesComparable').onchange = e => { analytics.comparable = e.target.checked; render(); };
  document.querySelectorAll('[data-sales-tab]').forEach(b => b.onclick = () => { analytics.tab = b.dataset.salesTab; analytics.page = 0; render(); });
  if ($('#exportSales')) $('#exportSales').onclick = () => exportSales(scope, groups, daily);
}

function salesSimpleTable(groups, type) {
  const pagination = analyticsPager(groups.length), page = groups.slice(analytics.page * 50, (analytics.page + 1) * 50);
  const prices = type === 'prices';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Producto</th><th>Unidad</th><th>${prices ? 'Precio de venta ponderado' : 'Cantidad reportada vendida'}</th><th>Importe vendido</th><th>Última venta</th></tr></thead><tbody>${page.map(r => `<tr><td class="mono">${esc(r.code || 'Sin código')}</td><td>${esc(r.product)}</td><td>${esc(r.unit)}</td><td class="numeric">${prices ? preciseMoney(r.price) : quantity(r.qty)}</td><td class="numeric">${money(r.amount)}</td><td>${dateFmt(r.lastDate)}</td></tr>`).join('') || '<tr><td colspan="6">Sin registros para estos filtros.</td></tr>'}</tbody></table></div>${pagination}`;
}

function salesDetailTable(scope) {
  const pagination = analyticsPager(scope.length), page = scope.slice(analytics.page * 50, (analytics.page + 1) * 50);
  return `<div class="table-wrap"><table class="data-table sales-table"><thead><tr><th>Fecha</th><th>Código</th><th>Producto</th><th>Distribuidor</th><th>Cantidad</th><th>Importe</th><th>Costo / unidad</th><th>Origen del costo</th><th>Fila fuente</th></tr></thead><tbody>${page.map(r => `<tr><td>${dateFmt(r.date)}</td><td class="mono">${esc(r.code || 'Sin código')}</td><td>${esc(r.product)}</td><td>${esc(r.provider)}</td><td>${quantity(r.qty)} ${esc(r.unit)}</td><td>${money(r.amount)}</td><td>${preciseMoney(r.cost)}</td><td>${esc(r.costOrigin)}</td><td>${r.sourceRow}</td></tr>`).join('') || '<tr><td colspan="9">Sin registros para estos filtros.</td></tr>'}</tbody></table></div>${pagination}`;
}

function renderVolume() {
  const isSales = analytics.source === 'sales';
  const source = isSales ? analytics.data : state.data.rows;
  const q = AC.normalize(analytics.query);
  const filtered = source.filter(r => (!analytics.from || r.date >= analytics.from) && (!analytics.to || r.date <= analytics.to) && (!analytics.provider || r.provider === analytics.provider) && (!q || AC.normalize(r.code + ' ' + (r.product || r.description)).includes(q)));
  const purchase = isSales ? null : AC.purchases(filtered);
  const usable = isSales ? filtered : purchase.rows;
  const volume = AC.volume(usable), months = unique(volume.map(r => r.month)).sort(), providers = unique(volume.map(r => r.provider)).sort();
  const total = usable.reduce((sum, r) => sum + r.amount, 0);
  const monthTotals = months.map(m => [m, volume.filter(r => r.month === m).reduce((s, r) => s + r.amount, 0)]);
  const providerTotals = providers.map(p => [p, volume.filter(r => r.provider === p).reduce((s, r) => s + r.amount, 0)]).sort((a, b) => b[1] - a[1]);
  content.innerHTML = `<div class="view"><div class="section-head"><div><p class="eyebrow">VOLUMEN EN SOLES</p><h2>Volumen mensual</h2><p>Importes de compras y ventas, consultados por separado.</p></div><button class="btn secondary" id="exportVolume">Exportar Excel</button></div>
    <div class="cost-tabs volume-toggle"><button data-volume="purchases" class="${!isSales ? 'active' : ''}">Compras</button><button data-volume="sales" class="${isSales ? 'active' : ''}">Ventas</button></div>
    ${analyticsFilters(source)}
    ${isSales ? `<div class="cost-note">Cobertura de ventas: ${dateFmt(analytics.meta?.from)} al ${dateFmt(analytics.meta?.to)}. ${source.some(r => r.provider === 'Sin distribuidor') ? 'Hay ventas sin distribuidor informado. Se muestran como «Sin distribuidor»; no se reparten entre proveedores de compra. Puedes cargar una base con la columna distribuidor desde Precios y cantidades.' : 'Distribuidores según la base de ventas cargada.'}</div>` : `<div class="cost-note">Se suman los importes impresos de las líneas de compra del histórico, sin recalcular el IGV. <b>${purchase.missing} líneas sin importe</b> y <b>${purchase.bonuses} bonificaciones</b> quedan fuera. No es el valor del inventario ni una suma de costos unitarios. El histórico de compras cubre ${esc(state.data.meta.months[0])} a ${esc(state.data.meta.months.at(-1))}.</div>`}
    <section class="kpis">${kpi('S/', money(total), isSales ? 'Ventas reportadas' : 'Compras con importe', 'según filtros')}${kpi('▤', quantity(usable.length), 'Líneas consideradas', isSales ? 'histórico de ventas' : 'importe disponible')}${kpi('▦', quantity(months.length), 'Meses con datos', 'periodo observado')}${kpi('⇄', quantity(providers.filter(p => p !== 'Sin distribuidor').length), 'Distribuidores identificados', isSales ? 'según archivo de ventas' : 'según factura')}</section>
    <div class="grid-2"><article class="card"><div class="card-header"><div><h3>Importe por mes</h3><p>${isSales ? 'Ventas' : 'Compras'} en soles</p></div></div>${volumeBars(monthTotals)}</article><article class="card"><div class="card-header"><div><h3>Importe por distribuidor</h3><p>Participación en el periodo filtrado</p></div></div>${volumeBars(providerTotals)}</article></div>
    <article class="card volume-matrix"><div class="card-header"><div><h3>Mes y distribuidor</h3><p>Detalle reconciliado con el total filtrado</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Distribuidor</th>${months.map(m => `<th>${esc(m)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${providerTotals.map(([p, n]) => `<tr><td><b>${esc(p)}</b></td>${months.map(m => { const row = volume.find(r => r.month === m && r.provider === p); return `<td class="numeric">${row ? money(row.amount) : '—'}</td>`; }).join('')}<td class="numeric"><b>${money(n)}</b></td></tr>`).join('') || `<tr><td colspan="${months.length + 2}">Sin importes para estos filtros.</td></tr>`}</tbody><tfoot><tr><th>Total</th>${monthTotals.map(([, n]) => `<th class="numeric">${money(n)}</th>`).join('')}<th class="numeric">${money(total)}</th></tr></tfoot></table></div></article>
    <p class="analytics-footnote">«—» indica que no hay registros para esa combinación. Cada vista conserva su propio periodo de cobertura.</p></div>`;
  bindAnalyticsFilters();
  document.querySelectorAll('[data-volume]').forEach(b => b.onclick = () => { analytics.source = b.dataset.volume; analytics.provider = ''; analytics.page = 0; render(); });
  $('#exportVolume').onclick = () => downloadWorkbook(`volumen_${analytics.source}.xlsx`, [['mes','distribuidor','importe','lineas'], ...volume.map(r => [r.month, r.provider, r.amount, r.lines])], 'Volumen mensual');
}

function volumeBars(items) {
  const max = Math.max(1, ...items.map(([, n]) => Math.abs(n)));
  return items.map(([label, n]) => `<div class="bar-row volume-bar"><span title="${esc(label)}">${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.abs(n) / max * 100}%;${n < 0 ? 'background:var(--red)' : ''}"></div></div><strong>${money(n)}</strong></div>`).join('') || '<div class="empty"><b>Sin importes disponibles</b>Carga ventas o ajusta los filtros.</div>';
}

function downloadCSV(filename, matrix) {
  const safe = value => typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? "'" + value : value ?? '';
  const csv = matrix.map(row => row.map(value => '"' + String(safe(value)).replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadWorkbook(filename, matrix, sheetName) {
  const prepared = matrix.map((row,r) => r ? row.map((v,c) => typeof v === 'number' && /importe/.test(matrix[0][c]) ? Math.round(v * 100) / 100 : v) : row);
  const sheet = XLSX.utils.aoa_to_sheet(prepared);
  sheet['!cols'] = matrix[0].map(h => ({wch: /producto|origen/.test(h) ? 48 : /codigo/.test(h) ? 20 : 23}));
  sheet['!autofilter'] = {ref: XLSX.utils.encode_range({s:{r:0,c:0},e:{r:matrix.length-1,c:matrix[0].length-1}})};
  for (let c=0;c<matrix[0].length;c++) {
    const header = matrix[0][c];
    const format = /margen/.test(header) ? '0.0%' : /precio|^costo_/.test(header) ? '"S/ "#,##0.0000' : /importe/.test(header) ? '"S/ "#,##0.00' : '#,##0.##';
    for (let r=1;r<matrix.length;r++) {
      const cell = sheet[XLSX.utils.encode_cell({r,c})];
      if (cell?.t === 'n') cell.z = format;
      else if (/codigo/.test(header) && cell) {cell.t='s';cell.z='@';}
    }
  }
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,sheetName);
  const control = XLSX.utils.aoa_to_sheet([
    ['Criterio','Valor'],['Fuente',state.view === 'volume' && analytics.source === 'purchases' ? 'Histórico de compras data.json' : analytics.meta?.source || 'Sin fuente'],
    ['Desde',analytics.from || 'Toda la cobertura'],['Hasta',analytics.to || 'Toda la cobertura'],['Distribuidor',analytics.provider || 'Todos'],['Búsqueda',analytics.query],
    ['Precio de venta','Suma de importes / suma de cantidades del mismo código y unidad'],
    ['Margen sobre costo','Importe de ventas / costo total de referencia - 1. Fracción con formato porcentaje.'],
    ['Comparación de unidad e IGV',analytics.comparable ? 'Confirmada en la interfaz' : 'Pendiente'],
    ['Costo de referencia','GTIN exacto; promedio de compras ponderado por unidades del mismo mes o último anterior. No equivale al costo real de inventario vendido.'],
    ['Faltantes','Celdas vacías cuando no hay costo comparable. No representan cero.'],
    ['Volumen de compras','Solo importes impresos; excluye bonificaciones y líneas sin importe. No uniformiza IGV.']
  ]);
  control['!cols'] = [{wch:32},{wch:110}];
  XLSX.utils.book_append_sheet(book,control,'Criterios');
  XLSX.writeFile(book,filename);
}

function exportSales(scope, groups, daily) {
  if (!daily && analytics.tab === 'detail') {
    downloadWorkbook('base_ventas.xlsx', [['fecha','codigo','producto','cantidad','importe','distribuidor','unidad','costo_unitario','origen_costo','fila_fuente'], ...scope.map(r => [r.date,r.code,r.product,r.qty,r.amount,r.provider,r.unit,r.cost,r.costOrigin,r.sourceRow])], 'Base de ventas');
  } else {
    downloadWorkbook(daily ? 'vendidos_por_dia.xlsx' : 'precios_cantidades.xlsx', [['fecha','codigo','producto','unidad','cantidad','importe','precio_ponderado','costo_referencia_unitario','margen_sobre_costo','filas_sin_costo'], ...groups.map(r => [r.date,r.code,r.product,r.unit,r.qty,r.amount,r.price,r.unitCost,r.margin,r.missingCost])], daily ? 'Vendidos por día' : 'Precios y cantidades');
  }
}

async function readSalesFile(file) {
  if (!file) return;
  analytics.error = '';
  try {
    const bytes = await file.arrayBuffer();
    const book = XLSX.read(bytes, {type:'array', cellDates:false, raw:true});
    analytics.staged = {file: file.name, book};
    let dialog = $('#salesImportDialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'salesImportDialog'; document.body.appendChild(dialog); }
    dialog.innerHTML = `<button class="dialog-close" id="closeSalesImport" aria-label="Cerrar">×</button><p class="eyebrow">ACTUALIZAR BASE DE VENTAS</p><h2>Revisar archivo</h2><p>${esc(file.name)}</p><label class="import-sheet">Hoja<select id="salesImportSheet">${book.SheetNames.map((name, i) => `<option value="${i}">${esc(name)}</option>`).join('')}</select></label><div id="salesImportFields"></div>`;
    $('#closeSalesImport').onclick = () => dialog.close();
    $('#salesImportSheet').onchange = prepareImportPreview;
    prepareImportPreview(); dialog.showModal();
  } catch (e) { analytics.error = 'No se pudo leer el archivo: ' + e.message; render(); }
}

function prepareImportPreview() {
  const staged = analytics.staged, sheetName = staged.book.SheetNames[Number($('#salesImportSheet').value)];
  const sheet = staged.book.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {header:1, defval:'', raw:true, blankrows:true});
  const header = matrix.findIndex(row => { const cols = AC.detectColumns(row); return ['date','product','qty','amount'].every(k => cols[k] >= 0); });
  if (header < 0) { $('#salesImportFields').innerHTML = '<p class="import-error">No se encontraron las columnas de fecha, producto, cantidad e importe. Usa la plantilla CSV o el reporte de vendidos por día.</p>'; return; }
  const headers = matrix[header], detected = AC.detectColumns(headers);
  staged.matrix = matrix; staged.header = header; staged.sheetName = sheetName;
  const labels = {date:'Fecha',code:'Código de producto',product:'Producto / insumo',qty:'Cantidad',amount:'Importe vendido',provider:'Distribuidor (opcional)',unit:'Unidad (opcional)',cost:'Costo unitario (opcional)',document:'Documento (opcional)'};
  $('#salesImportFields').innerHTML = `<p>Encabezados encontrados en la fila ${header + 1}. El archivo reemplazará la base de ventas actual; vuelve a cargar un histórico completo para actualizarlo.</p><div class="import-fields">${Object.entries(labels).map(([key,label]) => `<label>${label}<select data-import-field="${key}"><option value="-1">Sin columna</option>${headers.map((name, i) => `<option value="${i}" ${detected[key] === i ? 'selected' : ''}>${esc(name || `Columna ${i + 1}`)}</option>`).join('')}</select></label>`).join('')}</div><p>Sin distribuidor se mostrará «Sin distribuidor». Sin código, las filas se conservan por descripción. Fechas: DD/MM/AAAA o AAAA-MM-DD. CSV: decimales con punto o coma; miles con separador solo si también hay decimales.</p><div id="salesImportError" class="import-error hidden" role="alert"></div><button class="btn" id="confirmSalesImport">Validar y reemplazar base</button>`;
  $('#confirmSalesImport').onclick = confirmSalesImport;
}

async function confirmSalesImport() {
  const staged = analytics.staged, errorBox = $('#salesImportError');
  try {
    const columns = Object.fromEntries([...document.querySelectorAll('[data-import-field]')].map(s => [s.dataset.importField, Number(s.value)]));
    // Code column may be empty for some rows, but must exist in the file.
    const source = staged.matrix.slice(staged.header + 1);
    let reported = null;
    const data = [], sourceNumbers = [];
    source.forEach((raw, i) => {
      const row = raw.slice();
      if (/^TOTALES?:?$/i.test(String(row[columns.date]).trim())) {
        reported = {qty: AC.number(row[columns.qty]), amount: AC.number(row[columns.amount])}; return;
      }
      if (!row.some(v => String(v).trim())) return;
      if (typeof row[columns.date] === 'number') {
        const d = XLSX.SSF.parse_date_code(row[columns.date], {date1904: !!staged.book.Workbook?.WBProps?.date1904});
        if (d) row[columns.date] = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      }
      if (typeof row[columns.code] === 'number') {
        if (!Number.isSafeInteger(row[columns.code])) throw new Error(`Código numérico inválido en fila ${staged.header + i + 2}. Usa códigos como texto.`);
        const cell = staged.book.Sheets[staged.sheetName][XLSX.utils.encode_cell({r: staged.header + i + 1, c: columns.code})];
        row[columns.code] = cell?.w && /^0\d+$/.test(cell.w) ? cell.w : String(row[columns.code]);
      }
      data.push(row); sourceNumbers.push(staged.header + i + 2);
    });
    const result = AC.importRows(data, columns);
    if (result.errors.length) throw new Error(result.errors.slice(0, 8).map(e => e.replace(/Fila (\d+)/, (_, n) => 'Fila ' + sourceNumbers[Number(n) - 2])).join('\n') + (result.errors.length > 8 ? `\nY ${result.errors.length - 8} errores más.` : ''));
    result.rows.forEach((r, i) => r.sourceRow = sourceNumbers[i]);
    const total = AC.summarize(result.rows);
    if (reported && (reported.qty == null || reported.amount == null || Math.abs(total.qty - reported.qty) > .005 || Math.abs(total.amount - reported.amount) > .005)) throw new Error('La suma de filas no coincide con los totales del reporte. No se reemplazó la base.');
    const dates = result.rows.map(r => r.date).sort();
    const payload = {meta:{source:staged.file, sheet:staged.sheetName, from:dates[0], to:dates.at(-1), amountTotal:total.amount, qtyTotal:total.qty, rowCount:result.rows.length}, rows:result.rows};
    let persisted = true;
    try { await salesDatabase('put', payload); } catch (_) { persisted = false; }
    analytics.data = payload.rows; analytics.meta = payload.meta; analytics.comparable = false;
    analytics.from = analytics.to = analytics.provider = analytics.query = ''; analytics.page = 0;
    analytics.message = `Base reemplazada: ${quantity(total.count)} filas y ${money(total.amount)}.${reported ? ' Total conciliado con el reporte.' : ''}${persisted ? ' Guardada en este navegador.' : ' Solo disponible durante esta sesión: no se pudo guardar en el navegador.'}`;
    analytics.error = ''; $('#salesImportDialog').close(); analytics.staged = null; render();
  } catch (e) { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); }
}

loadSales();
