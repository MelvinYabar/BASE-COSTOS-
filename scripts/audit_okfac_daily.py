"""Conciliación privada de diez productos entre el Excel de OKFAC y las vistas de ventas."""

import json
import random
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

from openpyxl import load_workbook

from prepare_sales import columns_for, number


SITE = Path(__file__).resolve().parents[1]
SOURCE = SITE.parent / "ventas_totales.xlsx"
PUBLISHED = SITE / "dist" / "sales.json"
OUTPUT = SITE.parent / "output"
END = datetime(2026, 11, 18).date()
START = datetime(2026, 8, 19).date()
SEED = 20261119


def sales_code(value):
    if value is None or value == "":
        return ""
    if isinstance(value, (int, float)):
        if int(value) != value:
            raise ValueError(f"Código numérico fraccionario: {value}")
        return str(int(value))
    return str(value).strip()


def source_sales():
    book = load_workbook(SOURCE, read_only=True, data_only=True)
    sheet = book.active
    columns = None
    rows = []
    for line, cells in enumerate(sheet.iter_rows(values_only=True), 1):
        if not columns:
            columns = columns_for(cells)
            continue
        day = cells[columns["date"]]
        try:
            day = datetime.strptime(str(day), "%d/%m/%Y").date()
        except ValueError:
            continue
        if not START <= day <= END:
            continue
        rows.append({"date": day.isoformat(), "code": sales_code(cells[columns["code"]]),
                     "name": str(cells[columns["product"]] or ""),
                     "category": str(cells[3] or ""), "qty": number(cells[columns["qty"]]),
                     "amount": number(cells[columns["amount"]]), "line": line})
    book.close()
    return rows


def totals(rows):
    grouped = defaultdict(lambda: [Decimal(0), Decimal(0), 0])
    for row in rows:
        key = (row["code"], row["date"])
        entry = grouped[key]
        entry[0] += row["qty"]
        entry[1] += row["amount"]
        entry[2] += 1
    return grouped


def main():
    source = source_sales()
    payload = json.loads(PUBLISHED.read_text(encoding="utf-8"))
    if payload["meta"]["source"] != SOURCE.name:
        raise ValueError("La base local de ventas no proviene de ventas_totales.xlsx")
    app = [{"date": row["date"], "code": row["code"], "qty": Decimal(str(row["qty"])),
            "amount": Decimal(str(row["amount"]))}
           for row in payload["rows"] if START.isoformat() <= row["date"] <= END.isoformat()]
    original, displayed = totals(source), totals(app)
    if original != displayed:
        different = [key for key in set(original) | set(displayed) if original[key] != displayed[key]]
        raise ValueError(f"Diferencias por día y código entre Excel y la base: {different[:10]}")

    by_code = defaultdict(lambda: {"qty": Decimal(0), "amount": Decimal(0), "days": set(), "rows": 0})
    names = {}
    categories = {}
    for row in source:
        if not row["code"]:
            continue
        item = by_code[row["code"]]
        item["qty"] += row["qty"]
        item["amount"] += row["amount"]
        item["days"].add(row["date"])
        item["rows"] += 1
        names[row["code"]] = row["name"]
        categories[row["code"]] = row["category"]
    ranked = sorted(by_code, key=lambda code: (-by_code[code]["amount"], code))
    leaders = ranked[:5]
    pool = [code for code in ranked[5:100] if "ACCESORIO" not in categories[code].upper() and len(by_code[code]["days"]) >= 8]
    random_codes = random.Random(SEED).sample(pool, 5)
    selected = leaders + random_codes

    report = ["# Auditoría OKFAC · diez medicamentos", "",
              f"Período: **{START.isoformat()} al {END.isoformat()}** (92 días completos). Fuente independiente: `{SOURCE.name}`. Se cotejó cada combinación código–día contra `dist/sales.json`, que alimenta **Vendidos por día** y **Precios y cantidades**.", "",
              "Selección: cinco mayores por importe vendido y cinco seleccionados al azar con semilla 20261119 entre los puestos 6–100 (al menos ocho días de venta; sin accesorios). La muestra es reproducible.", "",
              "| Grupo | Código | Producto | Días con venta | Cantidad OKFAC | Importe OKFAC | Cruce diario |",
              "| --- | --- | --- | ---: | ---: | ---: | --- |"]
    detail = []
    for index, code in enumerate(selected):
        item = by_code[code]
        daily = [{"date": day, "qty": float(original[(code, day)][0]),
                  "amount": float(original[(code, day)][1]), "rows": original[(code, day)][2]}
                 for day in sorted(item["days"])]
        detail.append({"group": "Mayor venta" if index < 5 else "Aleatorio", "code": code,
                       "name": names[code], "qty": float(item["qty"]),
                       "amount": float(item["amount"]), "days": daily})
        report.append(f"| {'Mayor venta' if index < 5 else 'Aleatorio'} | `{code}` | {names[code].replace('|', '/')} | {len(daily)} | {item['qty']:,.2f} | S/ {item['amount']:,.2f} | Cuadra |")
    total_amount = sum((row["amount"] for row in source), Decimal(0))
    total_qty = sum((row["qty"] for row in source), Decimal(0))
    no_code_amount = sum((row["amount"] for row in source if not row["code"]), Decimal(0))
    report += ["", f"**Control de toda la ventana:** {len(source):,} líneas, {total_qty:,.2f} cantidades reportadas y S/ {total_amount:,.2f}. Las líneas sin código suman S/ {no_code_amount:,.2f}; se incluyen en las ventas totales, pero quedan fuera de la muestra por producto.", "",
               f"Los diez códigos cuadran en cantidad e importe en **{sum(len(item['days']) for item in detail)} combinaciones producto–día**, y por suma también en la pestaña de ventas. Esta conciliación confirma la transcripción de OKFAC; no valida que una cantidad represente siempre la misma unidad de presentación ni que el precio de lista coincida con el importe cobrado. Para margen, el costo debe cotejarse por unidad y factura.", ""]
    OUTPUT.mkdir(exist_ok=True)
    path = OUTPUT / "auditoria_10_okfac_2026-11-19.md"
    path.write_text("\n".join(report), encoding="utf-8")
    (OUTPUT / "auditoria_10_okfac_2026-11-19.json").write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(selected)} códigos: {len(source)} líneas, cantidad {total_qty}, S/ {total_amount}; {len(original)} grupos día–código idénticos")
    print(f"Informe: {path}")


if __name__ == "__main__":
    main()
