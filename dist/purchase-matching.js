(function(root){
  const GENERIC=new Set('CAJA CAJ CJA UND UNIDAD UNIDADES BIENES PRODUCTO COMP COMPR COMPRIMIDO COMPRIMIDOS TAB TABLETA TABLETAS CAP CAPS CAPSULA CAPSULAS REC RECUB FCO FRASCO SOL SOLUCION ORAL INY INYECTABLE GTS GOTAS DSCTO BONIF BONIFICACION NUEVO NVA NVO'.split(' '));
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9.%+]+/g,' ').replace(/\s+/g,' ').trim();
  const tokens=value=>normalize(value).split(' ').filter(token=>token&&!GENERIC.has(token));
  const strengths=value=>new Set(normalize(value).replaceAll(' ','').match(/\d+(?:\.\d+)?(?:MG|MCG|UG|GR|G|ML|UI|%)/g)||[]);
  function pack(value){
    const text=normalize(value),hits=[];
    for(const match of text.matchAll(/(?:\bX|CAJA\s*X)\s*(\d{1,4})(?![\d.,])/g)){
      const rest=text.slice(match.index+match[0].length).trim();
      if(/^(?:ML|MG|MCG|UG|GR|G|KG|L|CM|MM|UI|DOSIS)\b/.test(rest))continue;
      hits.push(Number(match[1]));
    }
    return new Set(hits).size===1?hits[0]:null;
  }
  const intersect=(a,b)=>[...a].filter(value=>b.has(value));
  function dice(left,right){
    const pairs=value=>{const text=normalize(value).replaceAll(' ','');const out=[];for(let i=0;i<text.length-1;i++)out.push(text.slice(i,i+2));return out};
    const a=pairs(left),b=pairs(right);if(!a.length||!b.length)return 0;const pool=[...b];let matches=0;
    for(const pair of a){const index=pool.indexOf(pair);if(index>=0){matches++;pool.splice(index,1)}}
    return 2*matches/(a.length+b.length);
  }
  function compare(source,name){
    const a=new Set(tokens(source)),b=new Set(tokens(name)),union=new Set([...a,...b]);
    const shared=intersect(a,b),jaccard=union.size?shared.length/union.size:0;
    const sourceBrand=[...a].find(token=>!/^[\d.]+(?:MG|MCG|UG|GR|G|ML|UI|%)?$/.test(token))||'';
    const targetBrand=[...b].find(token=>!/^[\d.]+(?:MG|MCG|UG|GR|G|ML|UI|%)?$/.test(token))||'';
    const brandConflict=sourceBrand&&targetBrand&&sourceBrand!==targetBrand;
    const ss=strengths(source),ts=strengths(name),strengthShared=intersect(ss,ts).length;
    const strengthConflict=ss.size&&ts.size&&!strengthShared;
    const sp=pack(source),tp=pack(name);
    let score=.53*jaccard+.32*dice(source,name)+(sourceBrand&&sourceBrand===targetBrand?.25:0)-(brandConflict?.18:0)+(strengthShared?.08:0)-(strengthConflict?.28:0)+(sp&&tp&&sp===tp?.05:0)-(sp&&tp&&sp!==tp?.04:0);
    if(normalize(source)===normalize(name))score=1;
    return {score:Math.max(0,Math.min(1,score)),sameBrand:!!sourceBrand&&sourceBrand===targetBrand,brandConflict:!!brandConflict,
      sameStrength:!!strengthShared,strengthConflict:!!strengthConflict,sourcePack:sp,targetPack:tp};
  }
  function rank(source,catalog,query='',limit=16){
    const q=normalize(query),results=[];
    for(const target of catalog||[]){
      const names=[target.systemName,...(target.catalogNames||[])].filter(Boolean);
      const haystack=normalize([target.gtin,target.systemCode,target.barcode,...names,...(target.providers||[])].join(' '));
      if(q&&!haystack.includes(q))continue;
      let best={score:-1};
      for(const name of names){const current=compare(source,name);if(current.score>best.score)best={...current,matchedName:name}}
      results.push({...target,...best,searchHit:q?[target.gtin,target.systemCode,target.barcode].some(value=>normalize(value)===q)||haystack.startsWith(q):false});
    }
    return results.sort((a,b)=>(Number(b.searchHit)-Number(a.searchHit))||b.score-a.score||a.systemName.localeCompare(b.systemName)).slice(0,limit);
  }
  const api={normalize,tokens,strengths,pack,compare,rank};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AvantiPurchaseMatching=api;
})(typeof globalThis!=='undefined'?globalThis:this);
