const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate}=require('../dist/glucophage-bonus-core.js');

const xr500={paidBoxCost:58.82,saleUnitPrice:3.49,unitsPerBox:30};
const xr1000={unitsPerBox:30};
const deal={paidBoxes:12,bonusBoxes:4,referenceBoxCost:84.68,bonusSaleUnitPrice:4.10,nominalBonusCostPerBox:.01};

test('12 cajas XR 500 más 4 bonificadas concilian ingreso, costo y margen',()=>{
  const r=calculate(xr500,xr1000,deal);
  assert.ok(Math.abs(r.bonusReferenceValue-338.72)<1e-9);
  assert.ok(Math.abs(r.creditPerPaidBox-28.2266666667)<1e-8);
  assert.ok(Math.abs(r.attributedCostPerUnit-1.0197777778)<1e-8);
  assert.ok(Math.abs(r.bundleRevenue-1748.4)<1e-8);
  assert.ok(Math.abs(r.bundleCost-705.88)<1e-8);
  assert.ok(Math.abs(r.bundleProfit-1042.52)<1e-8);
  assert.ok(Math.abs(r.bundleMargin-1042.52/1748.4)<1e-8);
});

test('repartir valor de reposición no cuenta dos veces la bonificación',()=>{
  const r=calculate(xr500,xr1000,deal);
  const attributedPaidCost=(r.attributedCostPerUnit*30)*12;
  const attributedBonusCost=r.bonusReferenceValue;
  assert.ok(Math.abs(attributedPaidCost+attributedBonusCost-705.84)<1e-8);
  assert.ok(Math.abs(r.bonusCashContribution-491.96)<1e-8);
});

test('rechaza cantidades inválidas',()=>{
  assert.equal(calculate(xr500,xr1000,{...deal,paidBoxes:0}),null);
  assert.equal(calculate(xr500,xr1000,{...deal,bonusBoxes:-1}),null);
});
