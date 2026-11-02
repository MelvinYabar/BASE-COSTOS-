const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../dist/purchase-matching.js');

test('prioriza nombre y concentración aunque cambie la cantidad del envase',()=>{
  const ranked=M.rank('AGUJA HIPODERMICA 21G CAJA X 100',[
    {gtin:'1',systemName:'AGUJA HIPODERMICA 21G CAJA X 50',catalogNames:[],providers:[]},
    {gtin:'2',systemName:'AGUJA HIPODERMICA 25G CAJA X 100',catalogNames:[],providers:[]},
    {gtin:'3',systemName:'JERINGA HIPODERMICA 10 ML',catalogNames:[],providers:[]}
  ]);
  assert.equal(ranked[0].gtin,'1');
  assert.equal(ranked[0].sourcePack,100);
  assert.equal(ranked[0].targetPack,50);
});

test('la búsqueda manual encuentra por GTIN o nombre aunque la similitud sea baja',()=>{
  const catalog=[{gtin:'775001',systemName:'AGUJA ESTERIL',catalogNames:['AGUJA DESCARTABLE'],providers:['A']}];
  assert.equal(M.rank('OTRO PRODUCTO',catalog,'775001')[0].gtin,'775001');
  assert.equal(M.rank('OTRO PRODUCTO',catalog,'descartable')[0].gtin,'775001');
});

test('la búsqueda manual encuentra también por código interno del maestro',()=>{
  const catalog=[{gtin:'77500123',systemCode:'SKU-42',barcode:'77500123',systemName:'PRODUCTO OFICIAL',catalogNames:[],providers:[]}];
  assert.equal(M.rank('OTRO PRODUCTO',catalog,'SKU-42')[0].gtin,'77500123');
});

test('prioriza la misma marca sobre productos que solo comparten dosis y empaque',()=>{
  const ranked=M.rank('Latixa 500mg x 30 Comp LP',[
    {gtin:'7406048002069',systemName:'LATIXA 500 MG (RANOLAZINA) CAJA COMP',catalogNames:[],providers:['ALFARO']},
    {gtin:'7800029003906',systemName:'KEPPRA 500MG (LEVETIRACETAM) CAJA TAB X 30',catalogNames:[],providers:['ALFARO']}
  ]);
  assert.equal(ranked[0].gtin,'7406048002069');
});

test('no confunde mililitros con cantidad de envase',()=>{
  assert.equal(M.pack('JARABE X 120 ML'),null);
  assert.equal(M.pack('TABLETAS CAJA X 30'),30);
});
