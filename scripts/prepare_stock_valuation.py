"""Value the current active OKFAC stock and classify sales velocity by GTIN."""

import json
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from openpyxl import load_workbook

from prepare_stock_cover import SALES, OUTPUT as STOCK_COVER, code, quantity


SITE = Path(__file__).resolve().parents[1]
SOURCE = SITE.parent
PDF_NAMES = SITE / "data" / "chronic_medicines_2026-11-23.json"
PDF_MATCHES = SITE / "data" / "chronic_matches_2026-11-23.json"
OUTPUT = SITE / "dist" / "stock-valuation.json"


def money(value):
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def rotation(sold90, chronic):
    if chronic:
        return "Crónicos"
    # Units per 90 complete days: >=90, >=30, >=9, <9.
    if sold90 >= 90:
        return "Alta rotación"
    if sold90 >= 30:
        return "Media rotación"
    if sold90 >= 9:
        return "Baja rotación"
    return "Muy baja o nula rotación"


def sales_control():
    book = load_workbook(SALES, read_only=True, data_only=True)
    sheet = book.active
    declared_qty = quantity(sheet["C6"].value)
    declared_amount = quantity(str(sheet["F6"].value).replace("S/", "").strip())
    qty = amount = 0.0
    rows = 0
    for row in sheet.iter_rows(min_row=8, values_only=True):
        try:
            datetime.strptime(str(row[1]), "%d/%m/%Y")
        except (TypeError, ValueError):
            continue
        rows += 1
        qty += quantity(row[6]) or 0
        amount += quantity(row[7]) or 0
    book.close()
    if declared_qty is None or declared_amount is None:
        raise ValueError("Totales de control ausentes en el reporte de ventas")
    if abs(qty - declared_qty) > 0.001 or abs(amount - declared_amount) > 0.02:
        raise ValueError(f"El detalle de ventas no cuadra: {qty} / {amount} vs {declared_qty} / {declared_amount}")
    return {"rows": rows, "quantity": qty, "amount": money(amount)}


def main():
    cover = json.loads(STOCK_COVER.read_text(encoding="utf-8"))
    snapshot = cover["meta"]["snapshot"]
    product_path = SOURCE / cover["meta"]["productFile"]
    cover_by_code = {item["code"]: item for item in cover["products"]}
    chronic_names = json.loads(PDF_NAMES.read_text(encoding="utf-8"))["names"]
    chronic_mapping = json.loads(PDF_MATCHES.read_text(encoding="utf-8"))["rowToCodes"]
    if len(chronic_names) != 110:
        raise ValueError("El PDF de crónicos no contiene las 110 filas esperadas")
    chronic_by_code = defaultdict(list)
    for raw_row, codes in chronic_mapping.items():
        row_num = int(raw_row)
        if not 1 <= row_num <= len(chronic_names):
            raise ValueError(f"Fila de crónicos fuera del PDF: {row_num}")
        for item_code in codes:
            chronic_by_code[item_code].append(row_num)
    missing_pdf_rows = [{"row": i, "name": name} for i, name in enumerate(chronic_names, 1)
                        if str(i) not in chronic_mapping]
    book = load_workbook(product_path, read_only=True, data_only=True)
    sheet = book.active
    if datetime.strptime(sheet["C3"].value, "%d-%m-%Y").date().isoformat() != snapshot:
        raise ValueError("La fecha del maestro no coincide con la cobertura de stock")
    products = []
    inactive = 0
    for row in sheet.iter_rows(min_row=7, values_only=True):
        if row[20] == "Inactivo":
            inactive += 1
            continue
        if row[20] != "Activo":
            continue
        item_code = code(row[1])
        source_cover = cover_by_code.get(item_code)
        if not source_cover:
            raise ValueError(f"Producto activo ausente de cobertura: {item_code}")
        stock = quantity(row[17])
        cost = quantity(row[12])
        price = quantity(row[16])
        if stock is None:
            raise ValueError(f"Stock no numérico: {item_code}")
        if stock < 0:
            valuation_status = "Stock negativo"
            value = None
        elif stock > 0 and (cost is None or cost <= 0):
            valuation_status = "Costo faltante"
            value = None
        else:
            valuation_status = "Valorizado"
            value = money(Decimal(str(stock)) * Decimal(str(cost or 0)))
        chronic_rows = chronic_by_code.get(item_code, [])
        sold90 = source_cover["sold90"]
        category = rotation(sold90, bool(chronic_rows))
        cost_above_price = bool(stock > 0 and cost is not None and price is not None and cost > price > 0)
        products.append({
            "code": item_code, "name": str(row[3] or ""), "sourceCategory": str(row[4] or ""),
            "unit": str(row[5] or ""), "stock": stock, "cost": cost, "price": price,
            "value": value, "valuationStatus": valuation_status, "category": category,
            "chronicPdfRows": chronic_rows, "sold30": source_cover["sold30"], "sold90": sold90,
            "dailyRate90": round(sold90 / 90, 4), "cover30": source_cover["cover30"],
            "reviewUnit30": source_cover["reviewUnit30"],
            "lastSale": source_cover["lastSale"], "reviewUnit90": source_cover["reviewUnit90"],
            "costAbovePrice": cost_above_price,
        })
    book.close()
    if len(products) != cover["meta"]["activeProducts"]:
        raise ValueError("El conteo de productos activos no concilia con la cobertura")
    unmatched_codes = sorted(set(chronic_by_code) - {item["code"] for item in products})
    if unmatched_codes:
        raise ValueError(f"GTIN crónicos no activos en el maestro: {unmatched_codes}")
    categories = []
    for label in ("Crónicos", "Alta rotación", "Media rotación", "Baja rotación", "Muy baja o nula rotación"):
        group = [item for item in products if item["category"] == label]
        categories.append({"name": label, "products": len(group),
                           "units": sum(max(0, item["stock"]) for item in group),
                           "value": money(sum(Decimal(str(item["value"] or 0)) for item in group)),
                           "sold90": sum(item["sold90"] for item in group)})
    valued = [item for item in products if item["value"] is not None and item["stock"] > 0]
    missing_cost = [item for item in products if item["valuationStatus"] == "Costo faltante"]
    negative = [item for item in products if item["valuationStatus"] == "Stock negativo"]
    cost_above_price = [item for item in products if item["costAbovePrice"]]
    payload = {"meta": {
        "snapshot": snapshot, "productFile": product_path.name, "salesFile": SALES.name,
        "salesThrough": cover["meta"]["lastCompleteDay"], "start90": cover["meta"]["start90"],
        "activeProducts": len(products), "inactiveExcluded": inactive,
        "costBasis": "Costo registrado por unidad en OKFAC; sin ajuste adicional de IGV",
        "totalValue": money(sum(Decimal(str(item["value"])) for item in valued)),
        "valuedProducts": len(valued), "missingCostProducts": len(missing_cost),
        "missingCostUnits": sum(item["stock"] for item in missing_cost),
        "negativeStockProducts": len(negative), "zeroStockProducts": sum(item["stock"] == 0 for item in products),
        "costAbovePriceProducts": len(cost_above_price),
        "costAbovePriceValue": money(sum(Decimal(str(item["value"] or 0)) for item in cost_above_price)),
        "chronicPdfEntries": len(chronic_names), "chronicPdfMatchedRows": len(chronic_mapping),
        "chronicMatchedProducts": len(chronic_by_code), "chronicPdfUnmatchedRows": len(missing_pdf_rows),
        "salesReportControl": sales_control(),
        "rotationRule": "Sobre 90 días completos: alta >=90, media 30-89, baja 9-29, muy baja/nula <9 unidades; crónicos prevalecen.",
    }, "categories": categories, "chronicUnmatched": missing_pdf_rows,
        "products": sorted(products, key=lambda item: item["name"])}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({key: payload["meta"][key] for key in ("totalValue", "activeProducts", "valuedProducts", "missingCostProducts", "negativeStockProducts", "costAbovePriceProducts", "chronicMatchedProducts")}, ensure_ascii=False))
    print(payload["categories"])


if __name__ == "__main__":
    main()
