(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GlucophageBonus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function calculate(sku, bonusSku, settings){
    const paid=Number(settings.paidBoxes),free=Number(settings.bonusBoxes);
    const reference=Number(settings.referenceBoxCost),bonusSale=Number(settings.bonusSaleUnitPrice);
    const nominal=Number(settings.nominalBonusCostPerBox||0);
    const cost=Number(sku.paidBoxCost),price=Number(sku.saleUnitPrice),pack=Number(sku.unitsPerBox),bonusPack=Number(bonusSku.unitsPerBox);
    if(![paid,free,reference,bonusSale,nominal,cost,price,pack,bonusPack].every(Number.isFinite)||paid<=0||free<0||reference<0||bonusSale<0||nominal<0||cost<0||price<=0||pack<=0||bonusPack<=0)return null;
    const creditPerPaidBox=free*reference/paid;
    const paidRevenue=paid*pack*price,bonusRevenue=free*bonusPack*bonusSale;
    const cashCost=paid*cost+free*nominal;
    const totalRevenue=paidRevenue+bonusRevenue;
    return {
      grossCostPerUnit:cost/pack,
      creditPerPaidBox,
      attributedCostPerUnit:(cost-creditPerPaidBox)/pack,
      baseMargin:(paidRevenue-paid*cost)/paidRevenue,
      bundleRevenue:totalRevenue,
      bundleCost:cashCost,
      bundleProfit:totalRevenue-cashCost,
      bundleMargin:totalRevenue?1-cashCost/totalRevenue:null,
      bonusReferenceValue:free*reference,
      bonusSaleRevenue:bonusRevenue,
      bonusCashContribution:bonusRevenue-free*nominal,
      upliftPerPaidBox:(bonusRevenue-free*nominal)/paid
    };
  }
  return {calculate};
});
