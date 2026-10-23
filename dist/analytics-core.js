/* Shared calculations. No browser dependencies; also used by the validation suite. */
(function (root) {
  'use strict';
  const normalize = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const text = value => String(value ?? '').trim();
  const number = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let s = text(value).replace(/^(S\/\.?|PEN)\s*/i, '').replace(/\s/g, '');
    if (!s) return null;
    if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (s.includes(',')) s = s.replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) && Number.isFinite(Number(s)) ? Number(s) : null;
  };
  function date(value) {
    let s = text(value), match;
    if (value instanceof Date && !isNaN(value)) s = value.toISOString().slice(0, 10);
    if ((match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) s = `${match[3]}-${match[2]}-${match[1]}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s ? s : null;
  }
  const aliases = {
    date: ['fecha', 'fecha venta', 'fecha de venta', 'fecha emision'],
    code: ['codigo', 'codigo producto', 'codigo de producto', 'sku', 'gtin'],
    product: ['producto', 'producto / servicio', 'medicamento', 'descripcion', 'insumo'],
    qty: ['cantidad', 'cantidad vendida', 'unidades'],
    amount: ['importe', 'importe vendido', 'venta total', 'total vendido', 'total'],
    provider: ['distribuidor', 'proveedor'],
    unit: ['unidad', 'unidad de venta', 'um', 'presentacion'],
    cost: ['costo unitario', 'costo por unidad', 'costo'],
    document: ['documento', 'comprobante', 'factura']
  };
  function detectColumns(headers) {
    const names = headers.map(h => normalize(h).replace(/[_-]/g, ' ').replace(/\s+/g, ' '));
    return Object.fromEntries(Object.entries(aliases).map(([key, options]) => [key, names.findIndex(h => options.some(v => normalize(v) === h))]));
  }
  function importRows(matrix, columns) {
    const required = ['date', 'code', 'product', 'qty', 'amount'];
    if (required.some(k => columns[k] == null || columns[k] < 0)) throw new Error('Selecciona fecha, código, producto, cantidad e importe.');
    const selected = Object.values(columns).filter(v => v >= 0);
    if (new Set(selected).size !== selected.length) throw new Error('Cada campo debe usar una columna distinta.');
    const rows = [], errors = [];
    matrix.forEach((row, index) => {
      if (!row.some(v => text(v))) return;
      const get = k => columns[k] >= 0 ? row[columns[k]] : '';
      const d = date(get('date')), qty = number(get('qty')), amount = number(get('amount'));
      const costText = text(get('cost')), cost = costText ? number(get('cost')) : null;
      let issue = !d ? 'fecha inválida (AAAA-MM-DD o DD/MM/AAAA)' : !text(get('product')) ? 'falta producto' : qty == null || qty === 0 ? 'cantidad inválida o cero' : amount == null ? 'importe inválido' : costText && (cost == null || cost < 0) ? 'costo unitario inválido' : '';
      if (issue) { errors.push(`Fila ${index + 2}: ${issue}.`); return; }
      rows.push({date: d, code: text(get('code')), product: text(get('product')), qty, amount,
        provider: text(get('provider')) || 'Sin distribuidor', unit: normalize(get('unit')) || 'UNIDAD VENDIDA',
        cost, signIssue: qty * amount < 0, document: text(get('document')), sourceRow: index + 2});
    });
    if (!rows.length && !errors.length) errors.push('La hoja no contiene filas de ventas.');
    return {rows, errors};
  }
  function summarize(rows) {
    let qty = 0, amount = 0, costTotal = 0, missingCost = 0;
    const units = new Set();
    for (const r of rows) {
      qty += r.qty; amount += r.amount; units.add(r.unit);
      if (r.cost == null) missingCost++; else costTotal += r.qty * r.cost;
    }
    const sameUnit = units.size === 1;
    const complete = rows.length > 0 && !missingCost;
    return {qty, amount, costTotal: complete ? costTotal : null, missingCost,
      price: sameUnit && qty > 0 ? amount / qty : null,
      unitCost: complete && sameUnit && qty > 0 ? costTotal / qty : null,
      margin: complete && costTotal > 0 ? amount / costTotal - 1 : null,
      profit: complete ? amount - costTotal : null, count: rows.length};
  }
  function aggregate(rows, mode = 'product') {
    const groups = new Map();
    for (const r of rows) {
      const identity = r.code ? ['code', r.code] : ['description', normalize(r.product)];
      const key = JSON.stringify(mode === 'daily' ? [r.date, identity, r.unit] : [identity, r.unit]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    return [...groups.values()].map(rs => ({...summarize(rs), code: rs[0].code, product: rs[0].product,
      date: mode === 'daily' ? rs[0].date : '', unit: rs[0].unit,
      providers: [...new Set(rs.map(r => r.provider))].sort().join(', '),
      descriptions: new Set(rs.map(r => normalize(r.product))).size,
      lastDate: rs.map(r => r.date).sort().at(-1)}))
      .sort((a, b) => mode === 'daily' ? b.date.localeCompare(a.date) || a.product.localeCompare(b.product) : b.amount - a.amount);
  }
  function volume(rows) {
    const groups = new Map();
    for (const r of rows) {
      const month = r.date.slice(0, 7), key = JSON.stringify([month, r.provider]);
      if (!groups.has(key)) groups.set(key, {month, provider: r.provider, amount: 0, lines: 0});
      const g = groups.get(key); g.amount += r.amount; g.lines++;
    }
    return [...groups.values()].sort((a, b) => a.month.localeCompare(b.month) || b.amount - a.amount);
  }
  function purchases(rows) {
    // Only printed amounts. A quoted price is not a paid invoice amount.
    const valid = rows.filter(r => !r.bonus && Number.isFinite(r.amount));
    return {rows: valid, missing: rows.filter(r => !r.bonus && !Number.isFinite(r.amount)).length,
      bonuses: rows.filter(r => r.bonus).length};
  }
  function costIndex(costs) {
    const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const year = costs.meta.source.match(/(20\d{2})\.xlsx$/i)?.[1];
    const groups = new Map();
    if (!year) return groups;
    const blocked = new Set((costs.presentations || []).map(r => String(r.gtin)));
    for (const r of costs.detail) {
      const m = months.indexOf(normalize(r.month));
      if (!r.gtin || blocked.has(String(r.gtin)) || m < 0 || !(r.units > 0) || !(r.finalCost > 0) || /se asume/i.test(r.unitsSource)) continue;
      const month = `${year}-${String(m + 1).padStart(2, '0')}`;
      const key = JSON.stringify([String(r.gtin), month]);
      if (!groups.has(key)) groups.set(key, {code: String(r.gtin), month, units: 0, total: 0, providers: new Set()});
      const g = groups.get(key); g.units += r.units; g.total += r.units * r.finalCost; g.providers.add(r.provider);
    }
    const index = new Map();
    for (const g of groups.values()) {
      if (!index.has(g.code)) index.set(g.code, []);
      index.get(g.code).push({month: g.month, cost: g.total / g.units, providers: [...g.providers].sort()});
    }
    for (const items of index.values()) items.sort((a, b) => a.month.localeCompare(b.month));
    return index;
  }
  function attachCosts(rows, index, comparable) {
    return rows.map(r => {
      if (!comparable) return {...r, cost: null, costOrigin: 'Confirmar unidad e IGV'};
      if (r.qty * r.amount < 0) return {...r, cost: null, costOrigin: 'Revisar ajuste: cantidad e importe con signos distintos'};
      if (r.cost != null) return {...r, costOrigin: 'Costo unitario del archivo de ventas'};
      if (r.unit !== 'UNIDAD VENDIDA' && normalize(r.unit) !== 'UNIDAD') return {...r, cost: null, costOrigin: 'Unidad no comparable'};
      const ref = (index.get(r.code) || []).filter(v => v.month <= r.date.slice(0, 7)).at(-1);
      return {...r, cost: ref?.cost ?? null, costOrigin: ref ? `Referencia ${ref.month}: ${ref.providers.join(', ')}` : 'Sin GTIN / costo comparable'};
    });
  }
  const api = {normalize, number, date, aliases, detectColumns, importRows, summarize, aggregate, volume, purchases, costIndex, attachCosts};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AvantiAnalytics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
