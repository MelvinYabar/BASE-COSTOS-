(function(root){
  function key(row,normalize){
    const identity=row.code?`CODE:${row.code}`:`PRODUCT:${normalize(row.product)}`;
    return `${identity}|UNIT:${normalize(row.unit)}|REASON:${row.costOrigin}`;
  }
  function groups(rows,normalize){
    const result=new Map();
    for(const row of rows){
      const id=key(row,normalize);
      if(!result.has(id))result.set(id,{key:id,code:row.code||'',product:row.product,unit:row.unit,reason:row.costOrigin,rows:[],amount:0,qty:0,months:new Set()});
      const group=result.get(id);group.rows.push(row);group.amount+=Number(row.amount)||0;group.qty+=Number(row.qty)||0;group.months.add(String(row.date||'').slice(0,7));
    }
    return [...result.values()].map(group=>({...group,months:[...group.months].filter(Boolean).sort()}));
  }
  function evaluate(group,decision,index,analytics){
    if(!decision)return {state:'pending',verified:false,coveredRows:0,coveredAmount:0};
    if(decision.mode==='exclude')return {state:'excluded',verified:true,coveredRows:0,coveredAmount:0};
    if(decision.mode==='manual_cost')return {state:'resolved',verified:true,coveredRows:group.rows.length,coveredAmount:group.amount};
    if(decision.mode!=='cost_gtin'||!decision.targetGtin)return {state:'pending',verified:false,coveredRows:0,coveredAmount:0};
    const attached=analytics.attachCosts(group.rows.map(row=>({...row,code:String(decision.targetGtin),cost:null})),index,true);
    const covered=attached.filter(row=>row.cost!=null);
    return {state:covered.length===group.rows.length?'resolved':covered.length?'partial':'pending',verified:covered.length===group.rows.length,
      coveredRows:covered.length,coveredAmount:covered.reduce((sum,row)=>sum+(Number(row.amount)||0),0)};
  }
  const api={key,groups,evaluate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AvantiPendingReview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
