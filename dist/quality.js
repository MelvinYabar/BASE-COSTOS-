function renderQuality(){
  const cost=state.costs, buy=state.purchases, inv=state.invoices, price=state.data;
  const detail=cost.detail||[], mappings=buy?.mappings||[], invoices=inv?.records||[];
  const count=(list,predicate)=>list.reduce((n,row)=>n+(predicate(row)?1:0),0);
  const n=value=>Number(value||0).toLocaleString('es-PE');
  const pct=(part,total)=>total?`${(part/total*100).toFixed(1)}%`:'—';
  const linked=count(detail,r=>Boolean(String(r.gtin||'').trim()));
  const unitKnown=count(detail,r=>Number(r.unitsPerBox)>0);
  const assumed=count(detail,r=>/asumid/i.test(String(r.unitsSource||'')));
  const taxed=count(detail,r=>Boolean(String(r.tax||'').trim()));
  const mapped=count(mappings,r=>Boolean(String(r.gtin||'').trim())&&r.masterValid!==false);
  const pdf=count(invoices,r=>Boolean(r.pdf_url));
  const low=count(price.rows||[],r=>!r.bonus&&r.price!=null&&r.price<=.1);
  const items=[
    ['GTIN en costos',linked,detail.length,'costs','Abrir BD de costos'],
    ['Unidad por envase definida',unitKnown,detail.length,'costs','Revisar unidades e IGV'],
    ['Tratamiento IGV registrado',taxed,detail.length,'costs','Ver cálculo'],
    ['Asociación GTIN en compras',mapped,mappings.length,'purchases','Conciliar GTIN'],
    ['Líneas con PDF enlazado',pdf,invoices.length,'invoices','Ver facturas']
  ];
  content.innerHTML=`<div class="view"><div class="section-head"><div><p class="eyebrow">COBERTURA Y TRAZABILIDAD</p><h2>Calidad de datos</h2><p>Conteos de los archivos publicados; una cobertura alta no sustituye revisar las facturas.</p></div><span class="pill">Corte de facturas: ${esc(inv?.meta?.to||'sin dato')}</span></div>
    <div class="quality-grid">${items.map(([label,good,total,target,action])=>`<article class="card quality-card"><span>${esc(label)}</span><strong>${pct(good,total)}</strong><div class="quality-track"><i style="width:${total?Math.min(100,good/total*100):0}%"></i></div><small>${n(good)} de ${n(total)} filas</small><button class="quality-link" data-quality-target="${target}">${esc(action)} →</button></article>`).join('')}</div>
    <div class="grid-2"><article class="card"><div class="card-header"><div><h3>Revisión necesaria</h3><p>Excepciones que no se deben corregir por inferencia.</p></div></div>
      ${alertItem('amber',n(detail.length-linked)+' líneas de costo sin GTIN','Relacionar con el maestro interno','Revisar')}
      ${alertItem('amber',n(detail.length-unitKnown)+' líneas sin unidad por envase definida','Confirmar si se parte y en cuántas unidades','Revisar')}
      ${alertItem('amber',n(assumed)+' unidades asumidas','Contrastar la presentación con la factura','Validar')}
      ${alertItem('amber',n(low)+' precios ≤ S/ 0.10','Excluidos de alertas y comparativos','Validar')}
    </article><article class="card"><div class="card-header"><div><h3>Vigencia de las fuentes</h3><p>Las fechas se toman del contenido cargado.</p></div></div>
      <p>Histórico de precios: <b>${esc(price.meta.months?.[0]||'—')} a ${esc(price.meta.months?.at(-1)||'—')}</b> · ${n(price.rows?.length)} líneas.</p>
      <p>Facturas: <b>${esc(inv?.meta?.from||'—')} a ${esc(inv?.meta?.to||'—')}</b> · ${n(inv?.meta?.documents)} documentos.</p>
      <p>BD madre: <b>${esc(cost.meta.periodLabel||'—')}</b> · hasta ${esc(cost.meta.effectiveThrough||'—')}.</p>
      <p class="muted">Las ventas importadas se guardan en este navegador y se revisan en “Precios y cantidades”.</p>
    </article></div></div>`;
  content.querySelectorAll('[data-quality-target]').forEach(button=>button.onclick=()=>{state.view=button.dataset.qualityTarget;if(state.view==='costs')state.costTab='review';render()});
}
