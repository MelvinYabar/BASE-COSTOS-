"""Publica la valoración de la bonificación Glucophage de FDS."""

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

from glucophage_rules import RULES, SKU_BY_KEY, is_bonus, sku_key


SITE = Path(__file__).resolve().parents[1]
def master_date(path):
    match = re.search(r"(\d{2})-(\d{2})-(\d{4})", path.name)
    return date(int(match.group(3)), int(match.group(2)), int(match.group(1))) if match else date.min


MASTER = max(SITE.parent.glob("20615607160-LISTA-PRODUCTOS-*.xlsx"), key=master_date)
COSTS = SITE / "dist" / "costs.json"
INVOICES = SITE / "dist" / "invoices.json"
PURCHASES = SITE / "dist" / "purchases.json"
OUTPUT = SITE / "dist" / "fds-glucophage.json"


def product_prices():
    sheet = load_workbook(MASTER, read_only=True, data_only=True)["PRODUCTOS"]
    return {str(row[1]): {"name": str(row[3] or ""), "saleUnitPrice": row[16]}
            for row in sheet.iter_rows(min_row=7, values_only=True)
            if len(row) > 16 and row[1] and isinstance(row[16], (int, float))}


def main():
    costs = json.loads(COSTS.read_text(encoding="utf-8"))
    invoices = json.loads(INVOICES.read_text(encoding="utf-8"))
    purchases = json.loads(PURCHASES.read_text(encoding="utf-8"))
    prices = product_prices()
    latest = {}
    for row in costs["detail"]:
        key = sku_key(row["provider"], row["description"])
        if not key or is_bonus(row["description"]):
            continue
        boxes, amount = row.get("boxes"), row.get("invoiceAmount")
        if not boxes or amount is None or amount <= .10:
            continue
        if str(row.get("gtin")) != SKU_BY_KEY[key]["gtin"]:
            raise ValueError(f"GTIN FDS no conciliado: fila {row['n']}")
        if key not in latest or (row.get("invoiceDate") or "", row["n"]) > (latest[key].get("invoiceDate") or "", latest[key]["n"]):
            latest[key] = row

    missing = set(SKU_BY_KEY) - set(latest)
    if missing:
        raise ValueError(f"Presentaciones FDS sin compra pagada: {sorted(missing)}")
    skus = []
    for item in RULES["skus"]:
        key, gtin = item["key"], item["gtin"]
        row = latest[key]
        price = prices.get(gtin)
        if not price or not price["saleUnitPrice"]:
            raise ValueError(f"Sin precio de venta del maestro: {gtin}")
        skus.append({**item, "unitsPerBox": int(row["unitsPerBox"]),
                     "paidBoxCost": round(row["invoiceAmount"] / row["boxes"], 2),
                     "saleUnitPrice": price["saleUnitPrice"], "systemName": price["name"],
                     "invoice": row["invoice"], "invoiceDate": row.get("invoiceDate") or "",
                     "sourceRow": row["n"]})

    def observed_groups(rows, provider_field, product_field, invoice_field, date_field, qty_field, source):
        groups = defaultdict(lambda: {"paidBoxes": 0, "bonusBoxes": 0, "date": "", "source": source})
        for row in rows:
            description = row.get(product_field, "")
            if not sku_key(str(row.get(provider_field, "")), description) or not row.get(invoice_field):
                continue
            event = groups[str(row[invoice_field])]
            event["date"] = row.get(date_field, "")
            if is_bonus(description):
                event["bonusBoxes"] += float(row.get(qty_field) or 0)
            else:
                event["paidBoxes"] += float(row.get(qty_field) or 0)
        return groups

    by_invoice = observed_groups(purchases.get("rows", []), "provider", "description", "document", "date", "qty", "Consolidado de compras")
    recent = observed_groups(invoices.get("records", []), "proveedor", "producto", "documento", "fecha", "cantidad", "Facturas recientes")
    by_invoice.update({invoice: event for invoice, event in recent.items() if event["bonusBoxes"] > 0})
    observations = [
        {"invoice": invoice, **event}
        for invoice, event in by_invoice.items() if event["bonusBoxes"] > 0 and event["paidBoxes"] > 0
    ]
    observations.sort(key=lambda row: (row["date"], row["invoice"]))
    payload = {
        "meta": {"provider": "FDS", "invoiceThrough": costs["meta"]["effectiveThrough"],
                 "productMaster": MASTER.name, "productMasterDate": master_date(MASTER).isoformat(),
                 "pricingBasis": "Última compra pagada por presentación en BD de costos; precio de lista del maestro",
                 "bonusBasis": "Valor de reposición de XR 1000 a su última compra pagada; bonificación 12:4 declarada por el usuario",
                 "nominalBonusCostPerBox": .01},
        "promotion": {key: RULES[key] for key in ("paidBoxes", "bonusBoxes", "bonusSku")},
        "skus": skus,
        "observations": observations,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(skus)} presentaciones, {len(observations)} facturas con bonificación: {OUTPUT}")


if __name__ == "__main__":
    main()
