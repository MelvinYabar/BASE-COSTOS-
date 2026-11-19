"""Calcula días de cobertura del stock actual con ventas por código de Okfac."""

import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from openpyxl import load_workbook


SITE = Path(__file__).resolve().parents[1]
SOURCE = SITE.parent


def product_date(path):
    return datetime.strptime(path.stem[-10:], "%d-%m-%Y").date()


PRODUCTS = max(SOURCE.glob("20615607160-LISTA-PRODUCTOS-??-??-????.xlsx"), key=product_date)
SALES = SOURCE / "ventas_totales.xlsx"
OUTPUT = SITE / "dist" / "stock-cover.json"


def code(value):
    if value is None or value == "":
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def quantity(value):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", ""))
        except ValueError:
            pass
    return None


def source_rows(path, start):
    book = load_workbook(path, read_only=True, data_only=True)
    sheet = book.active
    return book, sheet, sheet.iter_rows(min_row=start, values_only=True)


def main():
    product_book, product_sheet, product_rows = source_rows(PRODUCTS, 7)
    snapshot = datetime.strptime(product_sheet["C3"].value, "%d-%m-%Y").date()
    last_complete = snapshot - timedelta(days=1)
    start30 = snapshot - timedelta(days=30)
    start90 = snapshot - timedelta(days=90)
    sales_book, sales_sheet, sales_rows = source_rows(SALES, 8)
    first_source_date = datetime.strptime(sales_sheet["C3"].value.split("Del ")[1].split(" al ")[0], "%d-%m-%Y").date()
    days_history = (snapshot - first_source_date).days

    products = {}
    inactive = 0
    for row in product_rows:
        if row[20] == "Inactivo":
            inactive += 1
            continue
        if row[20] != "Activo":
            continue
        item_code = code(row[1])
        if not item_code or item_code in products:
            raise ValueError(f"Código activo vacío o duplicado: {item_code}")
        stock = row[17]
        if not isinstance(stock, (int, float)):
            raise ValueError(f"Stock no numérico: {item_code}")
        products[item_code] = {"code": item_code, "name": str(row[3] or ""),
                               "category": str(row[4] or ""), "stock": stock,
                               "unit": str(row[5] or ""), "sold30": 0, "sold90": 0,
                               "soldHistory": 0, "lastSale": ""}
    product_book.close()

    counters = Counter()
    unlinked = Counter()
    for row in sales_rows:
        try:
            sold_at = datetime.strptime(row[1], "%d/%m/%Y").date()
        except (TypeError, ValueError):
            if row[1] and row[1] != "TOTALES:":
                counters["invalidDate"] += 1
            continue
        counters["datedRows"] += 1
        if sold_at >= snapshot:
            counters["snapshotDayRows"] += 1
            continue
        if sold_at < first_source_date:
            raise ValueError(f"Venta anterior al inicio declarado: {sold_at}")
        if row[5] != "Producto" or not code(row[2]):
            counters["excludedWithoutProductCode"] += 1
            continue
        qty = quantity(row[6])
        if qty is None or qty < 0:
            counters["invalidQuantity"] += 1
            continue
        item_code = code(row[2])
        product = products.get(item_code)
        if not product:
            counters["salesRowsOutsideActiveCatalog"] += 1
            unlinked[item_code] += 1
            continue
        counters["matchedRows"] += 1
        product["soldHistory"] += qty
        if sold_at >= start90:
            product["sold90"] += qty
        if sold_at >= start30:
            product["sold30"] += qty
        if sold_at.isoformat() > product["lastSale"]:
            product["lastSale"] = sold_at.isoformat()
    sales_book.close()

    for product in products.values():
        for period, days in (("30", 30), ("90", 90), ("History", days_history)):
            sold = product["sold" + period]
            product["cover" + period] = round(product["stock"] * days / sold, 2) if sold > 0 and product["stock"] >= 0 else None
        for key in ("sold30", "sold90", "soldHistory"):
            product[key] = round(product[key], 4)
    payload = {"meta": {"productFile": PRODUCTS.name, "salesFile": SALES.name,
                        "snapshot": snapshot.isoformat(), "lastCompleteDay": last_complete.isoformat(),
                        "start30": start30.isoformat(), "start90": start90.isoformat(),
                        "historyStart": first_source_date.isoformat(), "historyDays": days_history,
                        "activeProducts": len(products), "inactiveExcluded": inactive,
                        "salesQuality": dict(counters), "unlinkedCodes": len(unlinked)},
               "products": sorted(products.values(), key=lambda row: row["name"])}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    groups = Counter("stock negativo" if p["stock"] < 0 else "sin stock" if p["stock"] == 0 else
                     "sin venta 30d" if p["sold30"] == 0 else "menos de 15d" if p["cover30"] < 15 else
                     "15-30d" if p["cover30"] < 30 else "30d+" for p in products.values())
    print(f"{len(products)} activos, {inactive} inactivos excluidos; grupos: {dict(groups)}")
    print(f"Ventas: {dict(counters)}; códigos fuera del catálogo activo: {len(unlinked)}")


if __name__ == "__main__":
    main()
