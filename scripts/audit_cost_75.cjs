/* Reconcile every item in Melvin's list against a traced, sellable-unit purchase. */
const fs = require('node:fs');
const path = require('node:path');
const A = require('../dist/analytics-core.js');

const root = path.resolve(__dirname, '..');
const inputFile = JSON.parse(fs.readFileSync(path.join(root, 'data', 'cost_75_input.json'), 'utf8'));
const input = inputFile.rows;
const costs = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'costs.json'), 'utf8'));
const invoices = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'invoices.json'), 'utf8')).records;
const invoiceByDocument = new Map();
for (const item of invoices) {
  const key = `${A.normalize(item.proveedor)}|${String(item.documento || '').replace(/-0+(?=\d+$)/, '-')}`;
  if (!invoiceByDocument.has(key) || (!invoiceByDocument.get(key).pdf_url && item.pdf_url)) invoiceByDocument.set(key, item);
}
const index = A.costIndex(costs);
const detail = new Map();
for (const row of costs.detail) {
  const code = String(row.gtin || '');
  if (!detail.has(code)) detail.set(code, []);
  detail.get(code).push(row);
}
const blocked = new Set(costs.presentations.map(row => String(row.gtin)));
const ambiguous = new Set(['736085410334']); // Invoice does not confirm both active ingredients.
const excluded = new Set(costs.meta.excludedCostProviders.map(A.normalize));
const rows = input.map((row, offset) => {
  const code = String(row.code);
  const all = detail.get(code) || [];
  const references = index.get(code) || [];
  const current = ambiguous.has(code) ? null : references.at(-1);
  const eligible = all.map(original => {
    const effective = A.applyUnitDecision(original, costs.unitDecisions);
    const calc = A.purchaseCost(effective, costs.meta.igvIncludedProviders);
    return {original, calc};
  }).filter(({original, calc}) => !excluded.has(A.normalize(original.provider)) &&
    !blocked.has(code) && !ambiguous.has(code) && !calc.issue && calc.unitCost > 0 && original.invoiceAmount > .10 &&
    !/\bBONI(?:FICACION)?\b/.test(A.normalize(original.description)));
  const monthRows = current ? eligible.filter(({original}) => {
    const iso = original.invoiceDate || '';
    return iso.startsWith(current.month) || (!iso && A.normalize(original.month) === A.normalize(costs.meta.months[Number(current.month.slice(5)) - 5]));
  }) : [];
  const latest = eligible.slice().sort((a, b) => (b.original.invoiceDate || '').localeCompare(a.original.invoiceDate || '') || b.original.n - a.original.n)[0];
  let sourceRows = (monthRows.length ? monthRows : latest ? [latest] : []).map(({original, calc}) => ({
    date: original.invoiceDate || '', provider: original.provider, invoice: original.invoice,
    file: original.file, description: original.description, boxes: calc.boxes, pack: calc.pack,
    amount: calc.amount, igvFactor: calc.factor, costPerUnit: calc.unitCost,
    unitsSource: calc.source, gtinSource: original.gtinSource,
    pdfUrl: invoiceByDocument.get(`${A.normalize(original.provider)}|${String(original.invoice || '').replace(/-0+(?=\d+$)/, '-')}`)?.pdf_url || ''
  }));
  // July invoice is present in the source ledger but predates the September integration window.
  let directReference = null;
  if (code === '7612797435601' && !current) {
    const invoice = invoices.find(item => item.id === 3311);
    if (invoice && /TOBRADEX/i.test(invoice.producto) && /5mL/i.test(invoice.producto)) {
      directReference = Number(invoice.importe_total) / Number(invoice.cantidad);
      sourceRows = [{date: invoice.fecha, provider: invoice.proveedor, invoice: invoice.documento,
        file: invoice.fuente, description: invoice.producto, boxes: invoice.cantidad, pack: 1,
        amount: invoice.importe_total, igvFactor: 1, costPerUnit: directReference,
        unitsSource: 'Frasco oftálmico de 5 mL: no se parte', gtinSource: 'Coincidencia manual comprobada',
        pdfUrl: invoice.pdf_url || ''}];
    }
  }
  const oldCost = Number(row.listCost);
  const referenceCost = current?.cost ?? directReference;
  const differencePct = referenceCost ? (oldCost / referenceCost - 1) * 100 : null;
  const monthCosts = sourceRows.map(item => item.costPerUnit);
  const spreadPct = monthCosts.length > 1 ? (Math.max(...monthCosts) / Math.min(...monthCosts) - 1) * 100 : 0;
  const status = blocked.has(code) || ambiguous.has(code) ? 'Revisar presentación' : !referenceCost ? 'Sin compra verificada' :
    spreadPct > 20 ? 'Revisar variación entre facturas' :
    Math.abs(differencePct) <= 5 ? 'Costo coincide con compra' : 'Actualizar costo de lista';
  return {row: offset + 2, code, product: String(row.product).trim(), listCost: oldCost,
    systemCost: row.systemCost ?? null,
    systemPrice: row.systemPrice ?? null,
    referenceCost, referenceMonth: current?.month || (directReference ? '2026-07' : ''),
    differencePct, spreadPct, status, detailLines: all.length, sourceRows};
});
const result = {meta: {source: inputFile.source, productMaster: inputFile.productMaster,
  purchaseThrough: costs.meta.effectiveThrough, count: rows.length,
  statusCounts: Object.fromEntries([...new Set(rows.map(row => row.status))].map(status => [status, rows.filter(row => row.status === status).length]))}, rows};
const output = path.join(root, 'dist', 'cost-audit-75.json');
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.meta));
console.log(output);
