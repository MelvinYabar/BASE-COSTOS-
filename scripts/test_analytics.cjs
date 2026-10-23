const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../dist/analytics-core.js');
const sale = (overrides = {}) => ({date:'2026-06-12',code:'00123',product:'Medicamento',qty:2,amount:30,unit:'UNIDAD VENDIDA',provider:'Distribuidor A',cost:10,...overrides});
const close = (observed, expected) => assert.ok(Math.abs(observed - expected) < 1e-7, `${observed} != ${expected}`);

test('Precio y margen ponderan por cantidades, no por número de filas', () => {
  const result = A.aggregate([sale({qty:2,amount:20,cost:5}), sale({qty:8,amount:160,cost:10})])[0];
  assert.equal(result.price, 18);
  assert.equal(result.unitCost, 9);
  assert.equal(result.margin, 1);
});
test('Costo ausente no se transforma en cero ni en un margen completo', () => {
  const r = A.summarize([sale(), sale({cost:null})]);
  assert.equal(r.amount,60); assert.equal(r.missingCost,1);
  assert.equal(r.margin,null); assert.equal(r.unitCost,null);
});
test('No mezcla unidades, códigos con ceros iniciales ni filas sin código', () => {
  assert.equal(A.aggregate([sale(),sale({unit:'CAJA'}),sale({code:'123'}),sale({code:''})]).length,4);
  assert.equal(A.aggregate([sale({code:'',product:'A'}),sale({code:'',product:'B'})]).length,2);
  assert.equal(A.summarize([sale(),sale({unit:'CAJA'})]).price,null);
});
test('Fechas inválidas, vacíos y números con dos convenciones', () => {
  assert.equal(A.date('29/02/2026'),null);
  assert.equal(A.date('29/02/2024'),'2024-02-29');
  assert.equal(A.number('S/ 1,234,567.89'),1234567.89);
  assert.equal(A.number('1.234.567,89'),1234567.89);
  assert.equal(A.number(''),null); assert.equal(A.number('texto'),null);
});
test('Importación conserva códigos, signos y filas sin código sin inventar devoluciones', () => {
  const columns = A.detectColumns(['Fecha','Código','Producto / Servicio','Cantidad','Total Vendido']);
  const result = A.importRows([['22/10/2026','00123','A',2,-3.2],['22/10/2026','','B',1,0]],columns);
  assert.deepEqual(result.errors,[]);
  assert.equal(result.rows[0].code,'00123'); assert.equal(result.rows[0].signIssue,true);
  assert.equal(result.rows[1].code,''); assert.equal(result.rows[1].amount,0);
});
test('Importación devuelve errores y rechaza asignaciones duplicadas', () => {
  const cols = {date:0,code:1,product:2,qty:3,amount:4};
  assert.equal(A.importRows([['2026-06-31','A','A',1,10],['2026-06-30','B','B',0,10]],cols).errors.length,2);
  assert.throws(() => A.importRows([],{...cols,amount:3}),/distinta/);
});
test('Ventas diarias y volumen mensual conservan la suma de importes', () => {
  const rows = [sale(),sale({date:'2026-06-13',amount:15}),sale({date:'2026-07-01',amount:25,provider:'B'})];
  assert.equal(A.aggregate(rows,'daily').length,3);
  assert.equal(A.volume(rows).reduce((s,r) => s+r.amount,0),70);
  assert.deepEqual(A.volume(rows).map(r => r.month),['2026-06','2026-07']);
});
test('Compras no estima importes ausentes a partir de precios de lista', () => {
  const r = A.purchases([{amount:20,bonus:false},{amount:null,price:100,qty:2,bonus:false},{amount:0,bonus:true}]);
  assert.equal(r.rows.length,1); assert.equal(r.missing,1); assert.equal(r.bonuses,1);
});
test('Referencia mensual ponderada ignora unidades asumidas y compras futuras', () => {
  const detail = (month, units, finalCost, more={}) => ({month,units,finalCost,boxes:units,unitsPerBox:1,invoiceAmount:units*finalCost,description:'Medicamento',gtin:'00123',provider:'ALFARO',unitsSource:'Factura',...more});
  const index = A.costIndex({meta:{source:'BD_MADRE_DE_COSTOS_19-10-2026.xlsx'},detail:[
    detail('Mayo',2,10),detail('Mayo',8,20),detail('Julio',10,99),
    detail('Junio',10,1000,{unitsSource:'se asume 1 por envase'})]});
  const r = A.attachCosts([sale({cost:null})],index,true)[0];
  assert.equal(r.cost,18); assert.match(r.costOrigin,/2026-05/);
  assert.equal(A.attachCosts([sale({date:'2026-04-01',cost:null})],index,true)[0].cost,null);
  assert.equal(A.attachCosts([sale({cost:null,code:'123'})],index,true)[0].cost,null);
  assert.equal(A.attachCosts([sale({cost:null,unit:'CAJA'})],index,true)[0].cost,null);
});
test('Tres cajas X30: importe final dividido entre 90, con IGV aplicado una vez', () => {
  const row = {description:'MEDICAMENTO TAB X 30',boxes:3,unitsPerBox:1,unitsSource:'se asume 1 por envase',invoiceAmount:180,provider:'ALFARO'};
  const included = A.purchaseCost(row);
  assert.equal(included.units,90); assert.equal(included.unitCost,2);
  assert.equal(included.finalAmount,180); assert.equal(included.recovered,true);
  const withoutIGV = A.purchaseCost({...row,provider:'DIMEXA'});
  assert.equal(withoutIGV.units,90); close(withoutIGV.finalAmount,212.4); close(withoutIGV.unitCost,2.36);
  for (const provider of ['FDS','QUIMICA SUIZA','FP MAYORISTA','FP MAYORISTA (QUIMICA SUIZA)','EBENEL','CASTILLO']) assert.equal(A.purchaseCost({...row,provider}).unitCost,2);
});
test('X30 se interpreta como cantidad; ML, MG, centímetros y dosis no son unidades de venta', () => {
  for (const name of ['MEDICAMENTO CAJA x30','MEDICAMENTO X30TAB','MEDICAMENTO CJA X 30 COMP','MEDICAMENTO CJAX30UND']) assert.equal(A.packFromName(name).count,30,name);
  for (const name of ['JARABE X 120ML','CREMA X 30 G','MEDICAMENTO X 10 MG','APOSITO X 10 CM','INHALADOR X 200 DOSIS','MEDICAMENTO X 1.5ML']) assert.equal(A.packFromName(name).count,null,name);
  assert.equal(A.packFromName('MEDICAMENTO X10 AMP X2ML').count,10);
  assert.equal(A.packFromName('MEDICAMENTO X2 BLISTER X10 TAB').count,null);
});
test('Unidades contradictorias y cantidades ausentes quedan pendientes en vez de inventar costos', () => {
  const row = {description:'MEDICAMENTO CAJA X30',boxes:3,unitsPerBox:20,unitsSource:'catálogo',invoiceAmount:180,provider:'FDS'};
  assert.match(A.purchaseCost(row).issue,/catálogo/);
  assert.equal(A.purchaseCost(row).unitCost,null);
  assert.equal(A.purchaseCost({...row,unitsPerBox:30,boxes:null}).unitCost,null);
  assert.equal(A.purchaseCost({...row,unitsPerBox:30,invoiceAmount:null}).unitCost,null);
});
test('Comparación requiere unidad/IGV confirmados y deja ajustes incompatibles sin margen', () => {
  assert.equal(A.attachCosts([sale()],new Map(),false)[0].cost,null);
  assert.equal(A.attachCosts([sale({amount:-3})],new Map(),true)[0].cost,null);
  const r = A.summarize([sale(),sale({qty:-1,amount:-15})]);
  assert.equal(r.qty,1); assert.equal(r.amount,15); close(r.margin,.5);
});
test('GTIN con presentaciones distintas no recibe una referencia automática', () => {
  const index = A.costIndex({meta:{source:'COSTOS_2026.xlsx'},presentations:[{gtin:'00123'}],detail:[{gtin:'00123',month:'Mayo',units:10,finalCost:2,provider:'A',unitsSource:'Factura'}]});
  assert.equal(index.has('00123'),false);
});
const salesPath = process.env.AVANTI_SALES_JSON || path.join(__dirname,'../dist/sales.json');
test('Histórico real concilia con los controles independientes del Excel', {skip:!fs.existsSync(salesPath)}, () => {
  const payload = JSON.parse(fs.readFileSync(salesPath,'utf8'));
  assert.equal(payload.rows.length,payload.meta.rowCount);
  const totals = A.summarize(payload.rows);
  close(totals.amount,payload.meta.reportedAmount);
  close(totals.qty,payload.meta.reportedQty);
  assert.equal(payload.rows.filter(r => !r.code).length,payload.meta.missingCode);
  assert.equal(payload.rows.filter(r => r.qty*r.amount < 0).length,payload.meta.signIssues);
  const byProduct = A.aggregate(payload.rows), byDay = A.aggregate(payload.rows,'daily');
  close(byProduct.reduce((s,r) => s+r.amount,0),payload.meta.reportedAmount);
  close(byDay.reduce((s,r) => s+r.amount,0),payload.meta.reportedAmount);
  close(A.volume(payload.rows).reduce((s,r) => s+r.amount,0),payload.meta.reportedAmount);
});
