import json
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
SOURCES = list(ROOT.glob("BD_MADRE_DE_COSTOS*.xlsx"))
if not SOURCES:
    raise FileNotFoundError(f"No se encontró BD_MADRE_DE_COSTOS*.xlsx en {ROOT}")
INPUT = max(SOURCES, key=lambda path: path.stat().st_mtime)
OUTPUT = Path(__file__).resolve().parents[1] / "dist" / "costs.json"
MONTHS = ["Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]


def clean(value):
    if value is None:
        return ""
    return " ".join(str(value).replace("\ufffd", "").split())


def num(value):
    return round(float(value), 6) if isinstance(value, (int, float)) else None


def main():
    formulas = load_workbook(INPUT, data_only=False, read_only=False)
    values = load_workbook(INPUT, data_only=True, read_only=False)

    base_f = formulas["BD MADRE DE COSTOS"]
    base_v = values["BD MADRE DE COSTOS"]
    base = []
    for r in range(5, base_v.max_row + 1):
        gtin = clean(base_v.cell(r, 2).value)
        product = clean(base_v.cell(r, 3).value)
        provider = clean(base_v.cell(r, 4).value)
        if not (product or provider):
            continue
        costs = []
        for c in range(5, 13):
            value = num(base_v.cell(r, c).value)
            formula = base_f.cell(r, c).value
            costs.append({"value": value, "carried": isinstance(formula, str) and formula.startswith("=")})
        base.append({
            "n": base_v.cell(r, 1).value,
            "gtin": gtin,
            "product": product,
            "provider": provider,
            "costs": costs,
            "providerCount": base_v.cell(r, 13).value or 0,
            "unitsPerBox": num(base_v.cell(r, 14).value),
            "unitsPurchased": num(base_v.cell(r, 15).value),
            "monthsPurchased": base_v.cell(r, 16).value or 0,
        })

    ws = values["COMPARATIVO PROVEEDORES"]
    comparisons = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        if not row[2]:
            continue
        comparisons.append({
            "n": row[0], "gtin": clean(row[1]), "product": clean(row[2]),
            "unitsPerBox": num(row[3]), "providerCount": row[4] or 0,
            "cheapest": clean(row[5]), "cheapestCost": num(row[6]),
            "mostExpensive": clean(row[7]), "mostExpensiveCost": num(row[8]),
            "difference": num(row[9]), "differencePct": num(row[10]),
            "unitsPurchased": num(row[11]), "estimatedSaving": num(row[12]),
        })

    ws = values["PRESENTACIONES DISTINTAS"]
    presentations = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        if row[2]:
            presentations.append({"n": row[0], "gtin": clean(row[1]), "product": clean(row[2]), "detail": clean(row[3])})

    ws = values.worksheets[3]
    detail = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        if not row[2]:
            continue
        detail.append({
            "n": row[0], "gtin": clean(row[1]), "description": clean(row[2]), "provider": clean(row[3]),
            "month": clean(row[4]), "invoice": clean(row[5]), "file": clean(row[6]),
            "boxes": num(row[7]), "unitsPerBox": num(row[8]), "units": num(row[9]),
            "invoiceAmount": num(row[10]), "costWithoutTax": num(row[11]), "tax": clean(row[12]),
            "finalCost": num(row[13]), "amountSource": clean(row[14]), "unitsSource": clean(row[15]),
        })

    payload = {
        "meta": {
            "source": INPUT.name,
            "months": MONTHS,
            "baseRows": len(base),
            "products": len({x["gtin"] or x["product"] for x in base}),
            "gtinCount": len({x["gtin"] for x in base if x["gtin"]}),
            "comparisons": len(comparisons),
            "differentPresentations": len(presentations),
            "detailRows": len(detail),
        },
        "base": base,
        "comparisons": comparisons,
        "presentations": presentations,
        "detail": detail,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
