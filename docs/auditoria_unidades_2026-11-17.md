# Auditoría de unidades asumidas

Corte de facturas de la base: 2026-11-10.

De las 451 líneas originalmente marcadas como «se asume 1», 291 quedaron respaldadas por la presentación de factura y/o el maestro; 12 requerían otra cantidad y se recalcularon; 148 siguen pendientes.

La validación del costo unitario usa importe de factura × factor IGV ÷ (envases comprados × unidades vendibles por envase). Una relación GTIN se revisa por separado de la cantidad.

## Correcciones confirmadas

| Fila | Proveedor | Producto de factura | Unidades por envase | Costo unitario final (S/) | Evidencia |
| ---: | --- | --- | ---: | ---: | --- |
| 580 | CASTILLO | 3-GEL 10ML X20SCH (Hidróxido de Al, Hidroxido de Mg, | 20 | 1.2120 | Factura F100-654692: 4 cajas X20 sobres; maestro 16-11-2026 vende por sobre |
| 621 | CASTILLO | CLACIER X30VIALES | 30 | 4.3592 | Factura F100-656191: cajas X30 viales; maestro 16-11-2026 vende por vial |
| 672 | CASTILLO | KEVAL COMP 40 MGX2 | 2 | 16.9390 | Factura F100-653858: cajas X2 comprimidos; maestro 16-11-2026 vende por tableta |
| 673 | CASTILLO | KEVAL COMP 40 MGX2 | 2 | 16.9389 | Factura F100-656291: cajas X2 comprimidos; maestro 16-11-2026 vende por tableta |
| 811 | CASTILLO | CLACIER X30VIALES | 30 | 4.3592 | Factura F100-663029: cajas X30 viales; maestro 16-11-2026 vende por vial |
| 812 | CASTILLO | CLACIER X30VIALES | 30 | 4.3591 | Factura F100-666801: cajas X30 viales; maestro 16-11-2026 vende por vial |
| 954 | CASTILLO | CLACIER X30VIALES | 30 | 4.3591 | Factura F100-669302: cajas X30 viales; maestro 16-11-2026 vende por vial |
| 955 | CASTILLO | CLACIER X30VIALES | 30 | 4.3591 | Factura F100-669368: cajas X30 viales; maestro 16-11-2026 vende por vial |
| 990 | CASTILLO | KEVAL COMP 40 MGX2 | 2 | 16.9388 | Factura F100-670732: cajas X2 comprimidos; maestro 16-11-2026 vende por tableta |
| 1427 | DIMEXA | BART H 150MG +12,5MG X 30CPR | 30 | 3.3483 | Factura F100-863897: cajas X30 comprimidos; maestro 16-11-2026 vende por comprimido |
| 2461 | MYM | ISOFACE 10MG X30CGB | 30 | 3.3330 | Factura FF04-381084: cajas X30 cápsulas; maestro 16-11-2026 vende por cápsula |
| 2462 | MYM | ISOFACE 10MG X30CGB | 30 | 3.3331 | Factura FF04-381084: cajas X30 cápsulas; maestro 16-11-2026 vende por cápsula |

## Líneas aún pendientes

Proveedor: EBENEL 30, MYM 30, ALFARO 17, ALCON 15, FP MAYORISTA (QUIMICA SUIZA) 14, CASTILLO 12, DIMEXA 10, SANTA URSULA 10, BETHEL 9, CORP LOURDES Y SAO PAULO 1.

Filtra **Unidad asumida pendiente** en *BD de costos → Revisión del costo unitario* para ajustar una fila. Santa Úrsula sigue visible, pero no alimenta el costo oficial.

| Fila | Proveedor | Producto de factura | GTIN actual | Factura | Presentación del maestro | Motivo de revisión |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | ALCON | 0000230104 MIOSTAT 1.5ML 12-LAC LOT:139LE |  | F011-00089603 |  | Falta confirmar presentación y relación GTIN |
| 2 | ALCON | 0000230104 MIOSTAT 1.5ML 12-LAC LOT:139LE |  | F011-00090027 |  | Falta confirmar presentación y relación GTIN |
| 3 | ALCON | 0002100088 ALCAINE 0.5% 15ML-PE LOT:1373D |  | F011-00089603 |  | Falta confirmar presentación y relación GTIN |
| 4 | ALCON | 0007950205 BSS 500ML-LAM LOT:12EV7 |  | F011-00089603 |  | Falta confirmar presentación y relación GTIN |
| 5 | ALCON | 0007950206 BSS BAG 500ML-LAM |  | F011-00089603 |  | Falta confirmar presentación y relación GTIN |
| 6 | ALCON | 0007950206 BSS BAG 500ML-LAM LOT:135A4 |  | F011-00090027 |  | Falta confirmar presentación y relación GTIN |
| 7 | ALCON | 8065100003 MICROSPONGE SURGICAL SPONGESHARP |  | F011-00089603 |  | Falta confirmar presentación y relación GTIN |
| 8 | ALCON | 8065100003 MICROSPONGE SURGICAL SPONGESHARP |  | F011-00090027 |  | Falta confirmar presentación y relación GTIN |
| 9 | ALCON | 8065752201 PAK CENTURION ULTRA BALANCE |  | F011-00089603 |  | Falta confirmar presentación y relación GTIN |
| 10 | ALCON | 8065752201 PAK CENTURION ULTRA BALANCE |  | F011-00090027 |  | Falta confirmar presentación y relación GTIN |
| 11 | ALCON | 8065921541 CLEARCUT SIDE PORT 1.2MM ANGDUAL |  | F011-00089603 |  | Falta confirmar presentación y relación GTIN |
| 12 | ALCON | 8065921541 CLEARCUT SIDE PORT 1.2MM ANGDUAL |  | F011-00090027 |  | Falta confirmar presentación y relación GTIN |
| 13 | ALCON | 8065982465 CLEARCUT HP2 DB SLIT 2.4MM ANG |  | F011-00089603 |  | Falta confirmar presentación y relación GTIN |
| 14 | ALCON | 8065982465 CLEARCUT HP2 DB SLIT 2.4MM ANG |  | F011-00090027 |  | Falta confirmar presentación y relación GTIN |
| 15 | ALCON | 0002100088 ALCAINE 0.5% 15ML-PE LOT:1373D |  | F011-00090505 |  | Falta confirmar presentación y relación GTIN |
| 37 | ALFARO | Agua Esteril para Inyecciòn PBD x 1000ml (TAPA EUR |  | FF78-0151212 |  | Falta confirmar presentación y relación GTIN |
| 56 | ALFARO | Betaduo 2 Susp Iny Jer. Prellenada 2mL x 1 | 7703153018849 | FF78-0150572 | BETADUO 5MG+2MG BETAMETASONA JERINGA PRELLENADA 1ML | Envase o cantidad vendible sin confirmación inequívoca |
| 214 | ALFARO | LANTUS SOLOSTAR 100UI/ml (3ml) x 1 IMP(Refrig.) | 3582910023623 | FF78-0150502 | LANTUS SOLOSTAR (INSULINA GLARGINA) 100 UI/ML X 3 ML (R) | Envase o cantidad vendible sin confirmación inequívoca |
| 306 | ALFARO | Systane Balance 0.6% Emulsión Oft x 10mL | 300651433203 | FF78-0151213 | SYSTANE BALANCE EMULSION OFTALMICA - FRASCO 10 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 307 | ALFARO | Systane Complete 6mg/mL Emulsion Oft x 10mL | 300651509601 | FF78-0150565 | SYSTANE COMPLETE SP 0.6% SOL.OFT. X 10 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 377 | ALFARO | Aero Om Gts x 15mL Fresa |  | FF78-0159632 |  | Falta confirmar presentación y relación GTIN |
| 378 | ALFARO | Aero Om Gts x 60mL Anis |  | FF78-0159632 |  | Falta confirmar presentación y relación GTIN |
| 379 | ALFARO | Aero Om Gts x 60mL Fresa |  | FF78-0159632 |  | Falta confirmar presentación y relación GTIN |
| 433 | ALFARO | Tobradex 1mg + 3mg/mL Susp Oft x |  | FF78-0156780 |  | Falta confirmar presentación y relación GTIN |
| 445 | ALFARO | APIDRA SOLOSTAR 100UI/ml (3ml) x 1IMP REFRIG |  | FF06-3004033 |  | Falta confirmar presentación y relación GTIN |
| 450 | ALFARO | Aero Om Gts x 60mL |  | FF78-0164060 |  | Falta confirmar presentación y relación GTIN |
| 451 | ALFARO | Aero Om Gts x 60mL Anis |  | FF78-0164060 |  | Falta confirmar presentación y relación GTIN |
| 470 | ALFARO | Doxiproct x 12gr |  | FF78-0164060 |  | Falta confirmar presentación y relación GTIN |
| 498 | ALFARO | SOLIQUA 10-40 Pre Llenada 3 mL Solo Star REFRIG |  | FF78-0162992 |  | Falta confirmar presentación y relación GTIN |
| 510 | ALFARO | Tomatodo Systane * (=) |  | FF78-0162173 |  | Falta confirmar presentación y relación GTIN |
| 511 | ALFARO | Tomatodo Systane * (=) |  | FF78-0163644 |  | Falta confirmar presentación y relación GTIN |
| 512 | ALFARO | Tomatodo Systane * (>) |  | FF78-0163644 |  | Falta confirmar presentación y relación GTIN |
| 522 | BETHEL | AEROCAMARA ADULTO Y NIÑO |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 523 | BETHEL | AGUJAS DESCART 21 , 18 |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 524 | BETHEL | AGUJAS DESCART 22,23 |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 525 | BETHEL | CATETER NIPRO 18, 20 ,22 ,24 |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 530 | BETHEL | GUYANTE QX ESTRIL 7 |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 536 | BETHEL | JERINGA DE 60 |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 538 | BETHEL | LLAVE DE 3VIAS CON EXT/ 50CMS Y 10 CMS |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 539 | BETHEL | STERI STRIP LILA Y VERDE |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 541 | BETHEL | TERMOMETRO ORAL |  | E001-30937 |  | Falta confirmar presentación y relación GTIN |
| 695 | CASTILLO | MASC C/NEBULIZADOR GAMED ADULTO | 7757093688198 | F100-656514 | MASCARA NEBULIZADOR ADULTO ALCYMASK BOLSA X 1 UND | Envase o cantidad vendible sin confirmación inequívoca |
| 696 | CASTILLO | MASC C/NEBULIZADOR GAMED PEDIATRICA | 7757093622147 | F100-656514 | GAMED MASCARA NEBULIZADORA ESTERIL NINO CAJA X 50 | Envase o cantidad vendible sin confirmación inequívoca |
| 718 | CASTILLO | NETAF 10MG/ML X20ML GTS | 7750304009058 | F100-655214 | NETAF 10 MG/ML SUSPENSION ORAL GOTAS - FRASCO 20 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 781 | CASTILLO | AMOXIDAL PLUS 600+42.9 /5ML PPS X100ML [99] |  | F100-662774 |  | Falta confirmar presentación y relación GTIN |
| 890 | CASTILLO | NEOLIFE 2000MG+200MCG(INOSITOL + ACIDO FOLICO) |  | F100-665053 |  | Falta confirmar presentación y relación GTIN |
| 903 | CASTILLO | PEDIASURE PEPTIGRO VAINILLA X850GR |  | F100-663029 |  | Falta confirmar presentación y relación GTIN |
| 904 | CASTILLO | PEDIASURE UPAGE 10+ 850 G |  | F100-663029 |  | Falta confirmar presentación y relación GTIN |
| 916 | CASTILLO | SYSTALAN X15ML GTS |  | F100-663922 |  | Falta confirmar presentación y relación GTIN |
| 937 | CASTILLO | AQUASOL EMULSION X60GR |  | F100-669059 |  | Falta confirmar presentación y relación GTIN |
| 986 | CASTILLO | JELONET 10CM X10CM X1 [10] |  | F100-667467 |  | Falta confirmar presentación y relación GTIN |
| 993 | CASTILLO | KLARICID 125MG/5ML GRANULOS X50ML |  | F100-669059 |  | Falta confirmar presentación y relación GTIN |
| 1036 | CASTILLO | VENDA ELASTICA GALENO 6X5YDS |  | F100-668145 |  | Falta confirmar presentación y relación GTIN |
| 1045 | CORP LOURDES Y SAO PAULO | CASSETTE PARA FACOCENTURION REF.8065752201 |  | F026-192 |  | Falta confirmar presentación y relación GTIN |
| 1064 | DIMEXA | AMBROXOL 15 MG/5ML JBE FCO 120 ML | 7750304964708 | F100-851682 | AMBROXOL 15MG/5MLFRASCO X 120 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 1112 | DIMEXA | CLAVUMOX 250 MG SUSP FCO 60 ML |  | F100-849313 |  | Falta confirmar presentación y relación GTIN |
| 1197 | DIMEXA | FARMA D GOTAS SOLUCION PARA GOTAS ORALES X |  | F100-849901 |  | Falta confirmar presentación y relación GTIN |
| 1251 | DIMEXA | HISALER JARABE 60ML | 7751495162881 | F100-853865 | HISALER 5MG/ 5ML JARABE - FRASCO 60 ML (CETIRIZINA) | Envase o cantidad vendible sin confirmación inequívoca |
| 1256 | DIMEXA | IBUPROFENO 100MG/5ML SUS60MLCJAX1 | 7759307012997 | F100-849263 | IBUPROFENO 100 MG/5 ML (SUSPENSION ORAL 60 ML) | Envase o cantidad vendible sin confirmación inequívoca |
| 1518 | DIMEXA | ONY TEC 8% C 3.3ML |  | F100-866986 |  | Falta confirmar presentación y relación GTIN |
| 1560 | DIMEXA | ALERCET JARABE 60 ML |  | F100-879530 |  | Falta confirmar presentación y relación GTIN |
| 1579 | DIMEXA | BETADUO JERINGA PRELLENADA X 1 ML |  | F100-877814 |  | Falta confirmar presentación y relación GTIN |
| 1615 | DIMEXA | ENFAGROW PREESCOLAR PROM. X 1.1 KG. (6) |  | F100-873266 |  | Falta confirmar presentación y relación GTIN |
| 1671 | DIMEXA | NYLON NEGRO 10/0 DLZ6.2 2A 30 CM |  | F100-877847 |  | Falta confirmar presentación y relación GTIN |
| 1809 | EBENEL | ELECTRORAL ADVANCE 1LT - Medifarma | 7759307010863 | F002-00012348 | ELECTRORAL ADVANCE FRUTAL FRASCO X 1 LITRO | Envase o cantidad vendible sin confirmación inequívoca |
| 1811 | EBENEL | EQUIPO DE VENOCLISIS - Alkofarma | 7755969000495 | F002-00012348 | EQUIPO DE VENOCLISIS BOLSA X 1 | Envase o cantidad vendible sin confirmación inequívoca |
| 1825 | EBENEL | FERINJECT 50MG/5ML FCO 10ML - Farmakonsuma | 7640114721809 | F002-00012348 | FERINJECT 50MG VIAL X 10 ML X 1 (CARBOXIMALTOSA FERRICA) | Envase o cantidad vendible sin confirmación inequívoca |
| 1840 | EBENEL | GASEOVET JBE MENTA 100ML - Medifarma | 7759307002400 | F002-00012348 | GASEOVET FCO MENTA 80 MG X100M | Envase o cantidad vendible sin confirmación inequívoca |
| 1890 | EBENEL | KRYTANTEK GTS FCO 5ML - Labofta / sophia | 736085406504 | F002-00012348 | KRYTANTEK 2 MG + 20 MG + 5 MG GTS FCO 5ML | Envase o cantidad vendible sin confirmación inequívoca |
| 1894 | EBENEL | LAGRICEL GTS DOSIS UNICA 0.5ML - Labofta / | 736085280005 | F002-00012348 | LAGRICEL OFTENO 0.4% OCUVIALES CAJA X 20 UNIDOSIS. | LAGRICEL: factura dice dosis única; el maestro indica venta en sobre de 5 y el catálogo anterior caja de 20 |
| 1898 | EBENEL | LIPIKAR BAUME AP+M 400ML - La roche-posay | 3337875696548 | F002-00012348 | LIPIKAR BAUME AP BALSAMO 400 ML CREMA | Envase o cantidad vendible sin confirmación inequívoca |
| 1926 | EBENEL | MICOLIS CREM TUBO 30G - Megalabs | 7750958003396 | F002-00012348 | MICOLIS 1% (NITRATO DE ECONAZOL) CREMA 30G | Envase o cantidad vendible sin confirmación inequívoca |
| 1984 | EBENEL | THEALOZ DUO GTS 10ML - Thea pharma sac | 3662042004643 | F002-00012348 | THEALOZ DUO 3% + 0.15% ( TREHALOSA + HIALURONATO DE SODIO) SOLUCION OFTALMICA X 10 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 1998 | EBENEL | TUSICLOX 35.4MG/5ML SUSP 120ML - Unimed | T3SO_6722 | F002-00012348 | TUSICLOX 35.4MG/5ML SUSPENSION ORAL | Envase o cantidad vendible sin confirmación inequívoca |
| 2060 | EBENEL | DEBLAX 100.000 UI CJA*1 - Tecnofarma | 7730979097925 | F002-00012859 | DEBLAX 100000 UI [CAJA CAPS 1] (COLECALCIFEROL (VITAMINA D3)) | Envase o cantidad vendible sin confirmación inequívoca |
| 2112 | EBENEL | KRYTANTEK GTS FCO 5ML - Labofta / sophia | 736085406504 | F002-00013164 | KRYTANTEK 2 MG + 20 MG + 5 MG GTS FCO 5ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2149 | EBENEL | THEALOZ DUO GTS 10ML - Thea pharma sac | 3662042004643 | F002-00013164 | THEALOZ DUO 3% + 0.15% ( TREHALOSA + HIALURONATO DE SODIO) SOLUCION OFTALMICA X 10 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2163 | EBENEL | AMINOTER MAX ACOND FCO 300ML - Lafage |  | F002-00013398 |  | Falta confirmar presentación y relación GTIN |
| 2167 | EBENEL | BANES FORTE 200 MG SUSP 60 ML - Droguerias |  | F002-00013398 |  | Falta confirmar presentación y relación GTIN |
| 2168 | EBENEL | BANES FORTE 200 MG SUSP 60 ML - Droguerias |  | FC02-00000243 |  | Falta confirmar presentación y relación GTIN |
| 2175 | EBENEL | CROMUS 0.03% UNGUENTO TUBO 15 G - Unimed |  | F002-00013537 |  | Falta confirmar presentación y relación GTIN |
| 2177 | EBENEL | DUOTRAV GOTAS OFT 2.5 ML - Novartis |  | F002-00013537 |  | Falta confirmar presentación y relación GTIN |
| 2178 | EBENEL | DUOTRAV GOTAS OFT 2.5 ML - Novartis |  | F002-00013537 |  | Falta confirmar presentación y relación GTIN |
| 2187 | EBENEL | HIRUDOID FORTE GEL 40G - Deutsche pharma |  | F002-00013537 |  | Falta confirmar presentación y relación GTIN |
| 2191 | EBENEL | MUCOSOLVAN COMPOSITUM JBE PED 120ML - Sanofi |  | F002-00013537 |  | Falta confirmar presentación y relación GTIN |
| 2196 | EBENEL | RUPAFIN JBE FCO 120ML - Itf farmaceutica |  | F002-00013316 |  | Falta confirmar presentación y relación GTIN |
| 2198 | EBENEL | UNIDORZO GTS FCO 5ML - Roster |  | F002-00013398 |  | Falta confirmar presentación y relación GTIN |
| 2199 | EBENEL | UNIGEL GEL OFT 10G - Roster |  | F002-00013398 |  | Falta confirmar presentación y relación GTIN |
| 2200 | EBENEL | UNIGEL GEL OFT 10G - Roster |  | F002-00013398 |  | Falta confirmar presentación y relación GTIN |
| 2201 | EBENEL | UNIGEL GEL OFT 10G - Roster |  | F002-00013398 |  | Falta confirmar presentación y relación GTIN |
| 2202 | EBENEL | UNIGEL GEL OFT 10G - Roster |  | F002-00013398 |  | Falta confirmar presentación y relación GTIN |
| 2203 | EBENEL | VIGAMOX 0,5 SOL OFT 5ML - Novartis | 7612797607244 | F002-00013398 | VIGAMOX 0.5% SOL.OFT.X 5 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2204 | EBENEL | VIGAMOX 0,5 SOL OFT 5ML - Novartis | 7612797607244 | F002-00013398 | VIGAMOX 0.5% SOL.OFT.X 5 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2205 | EBENEL | ZYMAXID GTS OFT 5ML - Quimica suiza |  | F002-00013537 |  | Falta confirmar presentación y relación GTIN |
| 2312 | FP MAYORISTA (QUIMICA SUIZA) | BUSCAPINA 20MG/ML INY CJA 1 UND | 7795304018136 |  | BUSCAPINA 20MG/SOLUCION INYECTABLE) (N-BUTILBROMURO DE ESCOPOLAMINA) | Envase o cantidad vendible sin confirmación inequívoca |
| 2318 | FP MAYORISTA (QUIMICA SUIZA) | ESTROGEL GEL TOPICO 60MG/100GR FCO80GR |  |  |  | Falta confirmar presentación y relación GTIN |
| 2326 | FP MAYORISTA (QUIMICA SUIZA) | NASONEX 50MCG SPRAY NASAL FCOX60DSS, PED |  |  |  | Falta confirmar presentación y relación GTIN |
| 2332 | FP MAYORISTA (QUIMICA SUIZA) | VICTOZA 6MG/ML INY CJAX1UND REF (3004.39.19.00) |  |  |  | Falta confirmar presentación y relación GTIN |
| 2344 | FP MAYORISTA (QUIMICA SUIZA) | AUDAL NF SOLUCIÓN OTICA FCOX10ML |  |  |  | Falta confirmar presentación y relación GTIN |
| 2345 | FP MAYORISTA (QUIMICA SUIZA) | BENALGIN 10000 NF SOL INY 2.5ML CJ 1UND |  |  |  | Falta confirmar presentación y relación GTIN |
| 2347 | FP MAYORISTA (QUIMICA SUIZA) | COMBIGAN SOL.OFT FCOX5ML (3004.90.29.00) |  |  |  | Falta confirmar presentación y relación GTIN |
| 2350 | FP MAYORISTA (QUIMICA SUIZA) | ESTROGEL GEL TOPICO 60MG/100GR FCO80GR |  |  |  | Falta confirmar presentación y relación GTIN |
| 2351 | FP MAYORISTA (QUIMICA SUIZA) | EUCER.DERM PUR OIL CONT.FX200ML, GEL LIM |  |  |  | Falta confirmar presentación y relación GTIN |
| 2352 | FP MAYORISTA (QUIMICA SUIZA) | EUCER.DERM.PURE OIL CONT.TBX100ML, EXFOL |  |  |  | Falta confirmar presentación y relación GTIN |
| 2353 | FP MAYORISTA (QUIMICA SUIZA) | EUCERIN AQUAPHOR LIP CARE TBO 10ML |  |  |  | Falta confirmar presentación y relación GTIN |
| 2357 | FP MAYORISTA (QUIMICA SUIZA) | FERANIN NF 50MG/5ML JBE FCOX100ML |  |  |  | Falta confirmar presentación y relación GTIN |
| 2378 | FP MAYORISTA (QUIMICA SUIZA) | TRESIBA 100UI/ML INY PREC. CJAX1UND REF |  |  |  | Falta confirmar presentación y relación GTIN |
| 2379 | FP MAYORISTA (QUIMICA SUIZA) | TRESIBA 100UI/ML INY PREC. CJAX1UND REF |  |  |  | Falta confirmar presentación y relación GTIN |
| 2392 | MYM | BETADUO INY X 2ML | 7703153020545 | FF04-381102 | BETADUO10 MG + 4 MG/2 ML (BETAMETASONA DIPROPIONATO + BETAMETASONA FOSFATO DISODICO) JERINGA PRELLENADA X 2 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2407 | MYM | CEFALOGEN IV X1GRX1AMP(CEFTRIAXONA) | 7891317207304 | FF04-381573 | CEFALOGEN I.V X 1GR POLVO PARA SOLUCION INYECTABLE | Envase o cantidad vendible sin confirmación inequívoca |
| 2497 | MYM | SOPHIPREN OFTENO 1% X 5ML | 736085409895 | FF04-379511 | SOPHIPREN OFTENO SUSPENSION OFTALMICA - FRASCO 5 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2498 | MYM | SOPHIPREN OFTENO 1% X 5ML | 736085409895 | FF04-379909 | SOPHIPREN OFTENO SUSPENSION OFTALMICA - FRASCO 5 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2499 | MYM | SOPHIPREN OFTENO 1% X 5ML | 736085409895 | FF04-383523 | SOPHIPREN OFTENO SUSPENSION OFTALMICA - FRASCO 5 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2500 | MYM | SPRAINER X 80ML | 7707239275249 | FF04-383523 | SPRAINER SOL.OFT X 80 ML CAJA X 120 APLICADORES | Envase o cantidad vendible sin confirmación inequívoca |
| 2524 | MYM | BETADUO INY X 2ML | 7703153020545 | FF04-387061 | BETADUO10 MG + 4 MG/2 ML (BETAMETASONA DIPROPIONATO + BETAMETASONA FOSFATO DISODICO) JERINGA PRELLENADA X 2 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2552 | MYM | ELECTRORAL ADVN FRUT SOL 1000ML FCO X1 |  | FF04-387062 |  | Falta confirmar presentación y relación GTIN |
| 2553 | MYM | ELECTRORAL NF FRESA SOL 1000ML FCOX1-N |  | FF04-387062 |  | Falta confirmar presentación y relación GTIN |
| 2554 | MYM | ELECTRORAL PED NF FRESA SOL 1000ML FCOX1 |  | FF04-387689 |  | Falta confirmar presentación y relación GTIN |
| 2570 | MYM | FP ISDIN PED TRANSP. SPRAY WET SKIN 50SPF 250ML | 8429420188020 | FF04-385345 | ISDIN FOTOP.PEDIATRICS TRANSPARENT SPRAY SPF50+ FRASCO X 250ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2585 | MYM | NOTIL X 10G |  | FF04-387062 |  | Falta confirmar presentación y relación GTIN |
| 2586 | MYM | POSITON. CREMA. CAJA CON TUBO 30 G |  | FF04-387541 |  | Falta confirmar presentación y relación GTIN |
| 2587 | MYM | POSITON. CREMA. CAJA CON TUBO 30 G |  | FF04-387689 |  | Falta confirmar presentación y relación GTIN |
| 2591 | MYM | SOPHIPREN OFTENO 1% X 5ML | 736085409895 | FF04-384938 | SOPHIPREN OFTENO SUSPENSION OFTALMICA - FRASCO 5 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2592 | MYM | SOPHIPREN OFTENO 1% X 5ML | 736085409895 | FF04-387061 | SOPHIPREN OFTENO SUSPENSION OFTALMICA - FRASCO 5 ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2593 | MYM | SPRAINER X 80ML | 7707239275249 | FF04-385849 | SPRAINER SOL.OFT X 80 ML CAJA X 120 APLICADORES | Envase o cantidad vendible sin confirmación inequívoca |
| 2595 | MYM | TEEN SKIN RX ACNIBEN REPAIR RENOV LAB 10ML | 8429420902435 | FF04-384247 | ACNIBEN REPAIR (RENOVADOR LABIAL) X 10ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2609 | MYM | BETACORT DEPOT X 1 ML INYECTABLE |  | FF04-390097 |  | Falta confirmar presentación y relación GTIN |
| 2638 | MYM | EVALAX 17G FRASCO POLVO PARA SOLUCIÓN ORAL 250G |  | FF04-389853 |  | Falta confirmar presentación y relación GTIN |
| 2639 | MYM | EVALAX 17G FRASCO POLVO PARA SOLUCIÓN ORAL 250G |  | FF04-390895 |  | Falta confirmar presentación y relación GTIN |
| 2655 | MYM | FP ISDIN FUSION WATER MAGIC COLOR MEDIUM 50ML |  | FF04-392123 |  | Falta confirmar presentación y relación GTIN |
| 2671 | MYM | LANDAX X 5ML |  | FF04-389175 |  | Falta confirmar presentación y relación GTIN |
| 2672 | MYM | LANDAX X 5ML |  | FF04-389175 |  | Falta confirmar presentación y relación GTIN |
| 2682 | MYM | NUTRATOPIC PRO-AMP CREMA EMOLIENTE FACIAL 50ML |  | FF04-389460 |  | Falta confirmar presentación y relación GTIN |
| 2683 | MYM | NUTRATOPIC PRO-AMP LOCION CORPORAL E 400ML |  | FF04-389460 |  | Falta confirmar presentación y relación GTIN |
| 2684 | MYM | OILY SKIN ACNIBEN BODY SPRAY 150ML |  | FF04-389460 |  | Falta confirmar presentación y relación GTIN |
| 2685 | MYM | OILY SKIN ACNIBEN BODY SPRAY 150ML |  | FF04-392123 |  | Falta confirmar presentación y relación GTIN |
| 2695 | MYM | TEEN SKIN RX ACNIBEN REPAIR RENOV LAB 10ML | 8429420902435 | FF04-389460 | ACNIBEN REPAIR (RENOVADOR LABIAL) X 10ML | Envase o cantidad vendible sin confirmación inequívoca |
| 2696 | MYM | TIDORZAK FREE 20MG/ML SOL OFT 5ML CJA X1 |  | FF04-391395 |  | Falta confirmar presentación y relación GTIN |
| 2706 | SANTA URSULA | AGUA THERMAL URIAGE X 300ML** | 3661434000522 | F001-23524 | URIAGE EAU THERMALE X 300 ML | Presentación pendiente; proveedor excluido del costo oficial |
| 2708 | SANTA URSULA | ANTH UVM FLUID 50+ 50ML C/C** |  | F001-23524 |  | Presentación pendiente; proveedor excluido del costo oficial |
| 2709 | SANTA URSULA | ANTH UVM GEL C/C SPF50 50ML** |  | F001-23524 |  | Presentación pendiente; proveedor excluido del costo oficial |
| 2710 | SANTA URSULA | AVE SOL COMP SPF50 AREN 10G** |  | F002-276 |  | Presentación pendiente; proveedor excluido del costo oficial |
| 2713 | SANTA URSULA | CICAPLAST BALM B5 T40** |  | F001-23524 |  | Presentación pendiente; proveedor excluido del costo oficial |
| 2715 | SANTA URSULA | EFFAC DUO+M X40ML |  | F001-23524 |  | Presentación pendiente; proveedor excluido del costo oficial |
| 2716 | SANTA URSULA | EFFAC GEL LIMP PURIFIC 400ML** |  | F002-276 |  | Presentación pendiente; proveedor excluido del costo oficial |
| 2717 | SANTA URSULA | EFFAC SERUM ULTR CONCE 30ML ** |  | F001-23524 |  | Presentación pendiente; proveedor excluido del costo oficial |
| 2719 | SANTA URSULA | FOT SPRAY PED W/S SPF50250ML** |  | F001-23524 |  | Presentación pendiente; proveedor excluido del costo oficial |
| 2721 | SANTA URSULA | LIPIKAR BAUME AP+ MAX X400ML** |  | F001-23524 |  | Presentación pendiente; proveedor excluido del costo oficial |

## Relaciones de producto ajustadas

Se asociaron a la presentación exacta MOVIFLEX 50 ML, QUANOX 5 ML, DEBLAX de 1 cápsula y CEFALOGEN IV. CLAVUMOX 250 MG, frasco de 60 ML, quedó sin GTIN porque el maestro disponible no contiene esa presentación.
