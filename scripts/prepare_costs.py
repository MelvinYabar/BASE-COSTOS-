import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

from prepare_purchases import core_name, provider_name


ROOT = Path(__file__).resolve().parents[2]
SITE = Path(__file__).resolve().parents[1]
SOURCES = list(ROOT.glob("BD_MADRE_DE_COSTOS*.xlsx"))
if not SOURCES:
    raise FileNotFoundError(f"No se encontró BD_MADRE_DE_COSTOS*.xlsx en {ROOT}")
INPUT = max(SOURCES, key=lambda path: path.stat().st_mtime)
OUTPUT = SITE / "dist" / "costs.json"
INVOICES = SITE / "dist" / "invoices.json"
CENTRAL_ASSOCIATIONS = SITE / "data" / "purchase_associations.json"
COST_UNIT_DECISIONS = SITE / "data" / "cost_unit_decisions.json"
MONTHS_ALL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
START_MONTH = 5
INVOICE_INTEGRATION_FROM = "2026-09-01"
IGV_INCLUDED_PROVIDERS = {"ALFARO", "CASTILLO", "EBENEL", "FDS", "FP MAYORISTA (QUIMICA SUIZA)"}
EXCLUDED_COST_PROVIDERS = {"SANTA URSULA"}


def clean(value):
    if value is None:
        return ""
    return " ".join(str(value).replace("\ufffd", "").split())


def num(value):
    return round(float(value), 6) if isinstance(value, (int, float)) else None


def normalize_document(value):
    text = clean(value).upper().replace(" ", "")
    match = re.fullmatch(r"([A-Z0-9]+)-0*(\d+)", text)
    return f"{match.group(1)}-{int(match.group(2))}" if match else text


def month_name(iso_date):
    try:
        parsed = date.fromisoformat(str(iso_date)[:10])
    except (TypeError, ValueError):
        return ""
    return MONTHS_ALL[parsed.month - 1]


def month_from_filename(filename, year):
    matches = re.findall(r"(?<!\d)(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?(?!\d)", clean(filename))
    if not matches:
        return ""
    day, month, found_year = matches[-1]
    resolved_year = int(found_year) if found_year else year
    if resolved_year < 100:
        resolved_year += 2000
    try:
        return MONTHS_ALL[date(resolved_year, int(month), int(day)).month - 1]
    except ValueError:
        return ""


def latest_cost(row):
    return next((item["value"] for item in reversed(row["costs"]) if item["value"] is not None), None)


def central_associations():
    if not CENTRAL_ASSOCIATIONS.exists():
        return {}
    payload = json.loads(CENTRAL_ASSOCIATIONS.read_text(encoding="utf-8"))
    return {item["mappingKey"]: item for item in payload.get("associations", [])}


def central_unit_decisions():
    if not COST_UNIT_DECISIONS.exists():
        return {}
    payload = json.loads(COST_UNIT_DECISIONS.read_text(encoding="utf-8"))
    return payload.get("decisions", {})


def association_for(central, provider, description, excel_gtin=""):
    mapping_key = f"{provider_name(provider)}|{core_name(description)}"
    association = central.get(mapping_key, {})
    associated_gtin = str(association.get("gtin", ""))
    gtin = clean(excel_gtin)
    conflict = ""
    if associated_gtin and gtin and gtin != associated_gtin:
        conflict = gtin
        gtin = associated_gtin
        source = "Asociación manual central; reemplaza GTIN del Excel"
    elif not gtin and associated_gtin:
        gtin = associated_gtin
        source = "Asociación manual central"
    elif gtin and associated_gtin:
        source = "Excel y asociación central"
    elif gtin:
        source = "Excel"
    else:
        source = "Sin relación"
    return association, gtin, source, conflict


def load_invoices():
    if not INVOICES.exists():
        return {"meta": {}, "records": []}
    return json.loads(INVOICES.read_text(encoding="utf-8"))


def final_factor(provider):
    return 1 if provider_name(provider).upper() in IGV_INCLUDED_PROVIDERS else 1.18


def detail_cost_parts(item):
    boxes = item.get("boxes")
    pack = item.get("unitsPerBox")
    amount = item.get("invoiceAmount")
    if not all(isinstance(value, (int, float)) for value in (boxes, pack, amount)):
        return None
    units = boxes * pack
    if units <= 0 or amount <= 0.10:
        return None
    return units, amount * final_factor(item.get("provider", ""))


def main():
    central = central_associations()
    unit_decisions = central_unit_decisions()
    invoice_data = load_invoices()
    invoice_records = invoice_data.get("records", [])
    latest_invoice_date = invoice_data.get("meta", {}).get("to", "")
    try:
        cutoff = date.fromisoformat(latest_invoice_date)
    except ValueError:
        cutoff = date(2026, 8, 31)
        latest_invoice_date = cutoff.isoformat()
    months = MONTHS_ALL[START_MONTH - 1:cutoff.month]
    month_set = set(months)
    year = cutoff.year

    dates_by_document = defaultdict(set)
    for record in invoice_records:
        emitted = clean(record.get("fecha"))
        if not emitted or emitted > latest_invoice_date:
            continue
        key = (provider_name(record.get("proveedor", "")), normalize_document(record.get("documento", "")))
        dates_by_document[key].add(emitted)

    formulas = load_workbook(INPUT, data_only=False, read_only=False)
    values = load_workbook(INPUT, data_only=True, read_only=False)
    detail_ws = values.worksheets[3]
    providers_needing_correction = {
        clean(row[3]).upper()
        for row in detail_ws.iter_rows(min_row=5, values_only=True)
        if row[2] and clean(row[3]).upper() in IGV_INCLUDED_PROVIDERS and clean(row[12]) == "+18%"
    }

    base_f = formulas["BD MADRE DE COSTOS"]
    base_v = values["BD MADRE DE COSTOS"]
    base = []
    for r in range(5, base_v.max_row + 1):
        gtin = clean(base_v.cell(r, 2).value)
        product = clean(base_v.cell(r, 3).value)
        provider = provider_name(clean(base_v.cell(r, 4).value))
        if not (product or provider):
            continue
        costs = []
        for offset, _month in enumerate(months):
            c = 5 + offset
            value = num(base_v.cell(r, c).value)
            if provider.upper() in providers_needing_correction and value is not None:
                value = round(value / 1.18, 4)
            formula = base_f.cell(r, c).value
            costs.append({"value": value, "carried": isinstance(formula, str) and formula.startswith("=")})
        base.append({
            "n": len(base) + 1, "gtin": gtin, "product": product, "provider": provider, "costs": costs,
            "providerCount": base_v.cell(r, 13).value or 0, "unitsPerBox": num(base_v.cell(r, 14).value),
            "unitsPurchased": num(base_v.cell(r, 15).value) or 0, "monthsPurchased": 0,
        })

    ws = values["PRESENTACIONES DISTINTAS"]
    presentations = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        if row[2]:
            presentations.append({"n": row[0], "gtin": clean(row[1]), "product": clean(row[2]), "detail": clean(row[3])})

    detail = []
    source_detail_rows = corrected_month_rows = missing_gtin_before = central_applied = central_conflicts = 0
    for row in detail_ws.iter_rows(min_row=5, values_only=True):
        if not row[2]:
            continue
        source_detail_rows += 1
        provider = provider_name(clean(row[3]))
        description = clean(row[2])
        excel_gtin = clean(row[1])
        missing_gtin_before += int(not excel_gtin)
        association, gtin, gtin_source, original_gtin_conflict = association_for(central, provider, description, excel_gtin)
        central_applied += int(gtin_source == "Asociación manual central")
        central_conflicts += int(bool(original_gtin_conflict))

        original_month = clean(row[4]).title()
        document_key = (provider, normalize_document(row[5]))
        matched_dates = dates_by_document.get(document_key, set())
        real_date = next(iter(matched_dates)) if len(matched_dates) == 1 else ""
        real_month = month_name(real_date) if real_date else month_from_filename(row[6], year)
        resolved_month = real_month or original_month
        corrected_month_rows += int(resolved_month != original_month)
        if resolved_month not in month_set:
            continue

        cost_without_tax = num(row[11])
        tax = clean(row[12])
        final_cost = num(row[13])
        if provider.upper() in IGV_INCLUDED_PROVIDERS:
            tax = "IGV incluido"
            final_cost = cost_without_tax
        detail.append({
            "n": len(detail) + 1, "gtin": gtin, "gtinSource": gtin_source,
            "centralGtinConflict": original_gtin_conflict,
            "systemName": association.get("systemName", "") if gtin and gtin == str(association.get("gtin", "")) else "",
            "description": description, "provider": provider, "month": resolved_month,
            "invoice": clean(row[5]), "file": clean(row[6]), "boxes": num(row[7]),
            "unitsPerBox": num(row[8]), "units": num(row[9]), "invoiceAmount": num(row[10]),
            "costWithoutTax": cost_without_tax, "tax": tax, "finalCost": final_cost,
            "amountSource": clean(row[14]), "unitsSource": clean(row[15]), "invoiceDate": real_date,
        })

    existing_keys = {
        (provider_name(item["provider"]), normalize_document(item["invoice"]), core_name(item["description"]))
        for item in detail
    }
    integrated_invoice_rows = 0
    for record in invoice_records:
        emitted = clean(record.get("fecha"))
        if not (INVOICE_INTEGRATION_FROM <= emitted <= latest_invoice_date):
            continue
        provider = provider_name(record.get("proveedor", ""))
        description = clean(record.get("producto", ""))
        invoice = clean(record.get("documento", ""))
        key = (provider, normalize_document(invoice), core_name(description))
        if key in existing_keys:
            continue
        association, gtin, gtin_source, conflict = association_for(central, provider, description)
        # The consolidated invoice source does not provide our internal GTIN;
        # every appended row starts unlinked before applying the central map.
        missing_gtin_before += 1
        central_applied += int(gtin_source == "Asociación manual central")
        central_conflicts += int(bool(conflict))
        boxes = num(record.get("cantidad"))
        pack = num(record.get("unidades_caja"))
        units = round(boxes * pack, 6) if boxes is not None and pack is not None else None
        amount = num(record.get("importe_total"))
        factor = final_factor(provider)
        base_cost = round(amount / units, 6) if amount is not None and units and units > 0 else None
        final_cost = round(base_cost * factor, 6) if base_cost is not None else None
        detail.append({
            "n": len(detail) + 1, "gtin": gtin, "gtinSource": gtin_source, "centralGtinConflict": conflict,
            "systemName": association.get("systemName", "") if gtin else "", "description": description,
            "provider": provider, "month": month_name(emitted), "invoice": invoice, "file": clean(record.get("fuente")),
            "boxes": boxes, "unitsPerBox": pack, "units": units, "invoiceAmount": amount,
            "costWithoutTax": base_cost, "tax": "IGV incluido" if factor == 1 else "+18%", "finalCost": final_cost,
            "amountSource": "Histórico consolidado de facturas; importe de línea",
            "unitsSource": clean(record.get("metodo_deteccion")), "invoiceDate": emitted,
        })
        existing_keys.add(key)
        integrated_invoice_rows += 1

    observed = defaultdict(lambda: [0.0, 0.0])
    integrated_units = defaultdict(float)
    for item in detail:
        if item["month"] not in months[4:]:
            continue
        parts = detail_cost_parts(item)
        if not item.get("gtin") or parts is None or provider_name(item["provider"]).upper() in EXCLUDED_COST_PROVIDERS:
            continue
        units, final_amount = parts
        key = (str(item["gtin"]), provider_name(item["provider"]), item["month"])
        observed[key][0] += units
        observed[key][1] += final_amount
        integrated_units[(str(item["gtin"]), provider_name(item["provider"]))] += units

    base_by_key = {(str(item["gtin"]), provider_name(item["provider"])): item for item in base if item["gtin"]}
    product_by_gtin = {}
    pack_by_key = {}
    for item in detail:
        if item.get("gtin"):
            product_by_gtin.setdefault(str(item["gtin"]), item.get("systemName") or item["description"])
            if item.get("unitsPerBox"):
                pack_by_key[(str(item["gtin"]), provider_name(item["provider"]))] = item["unitsPerBox"]
    for gtin, provider, _month in observed:
        key = (gtin, provider)
        if key not in base_by_key:
            row = {
                "n": len(base) + 1, "gtin": gtin, "product": product_by_gtin.get(gtin, gtin), "provider": provider,
                "costs": [{"value": None, "carried": False} for _ in months], "providerCount": 0,
                "unitsPerBox": pack_by_key.get(key), "unitsPurchased": 0, "monthsPurchased": 0,
            }
            base.append(row)
            base_by_key[key] = row

    for row in base:
        key = (str(row.get("gtin", "")), provider_name(row["provider"]))
        for month_index in range(4, len(months)):
            month = months[month_index]
            units, total = observed.get((key[0], key[1], month), (0, 0))
            if units > 0:
                row["costs"][month_index] = {"value": round(total / units, 4), "carried": False}
            else:
                previous = next((entry["value"] for entry in reversed(row["costs"][:month_index]) if entry["value"] is not None), None)
                row["costs"][month_index] = {"value": previous, "carried": previous is not None}
        row["monthsPurchased"] = sum(1 for entry in row["costs"] if entry["value"] is not None and not entry["carried"])
        row["unitsPurchased"] = round((row.get("unitsPurchased") or 0) + integrated_units.get(key, 0), 6)

    providers_by_product = defaultdict(set)
    for row in base:
        providers_by_product[row["gtin"] or row["product"]].add(row["provider"])
    for index, row in enumerate(base, 1):
        row["n"] = index
        row["providerCount"] = len(providers_by_product[row["gtin"] or row["product"]])

    comparisons = []
    for product_key in providers_by_product:
        rows = [item for item in base if (item["gtin"] or item["product"]) == product_key and item["provider"].upper() not in EXCLUDED_COST_PROVIDERS]
        candidates = [(latest_cost(item), item["provider"], item) for item in rows]
        candidates = [item for item in candidates if item[0] is not None]
        if len({item[1] for item in candidates}) < 2:
            continue
        cheapest_cost, cheapest, cheapest_row = min(candidates, key=lambda item: item[0])
        expensive_cost, expensive, _ = max(candidates, key=lambda item: item[0])
        difference = round(expensive_cost - cheapest_cost, 4)
        units_purchased = max((item[2].get("unitsPurchased") or 0 for item in candidates), default=0)
        comparisons.append({
            "n": 0, "gtin": cheapest_row.get("gtin", ""), "product": cheapest_row["product"],
            "unitsPerBox": cheapest_row.get("unitsPerBox"), "providerCount": len({item[1] for item in candidates}),
            "cheapest": cheapest, "cheapestCost": cheapest_cost, "mostExpensive": expensive,
            "mostExpensiveCost": expensive_cost, "difference": difference,
            "differencePct": round(difference / cheapest_cost * 100, 1) if cheapest_cost else None,
            "unitsPurchased": units_purchased, "estimatedSaving": round(difference * units_purchased, 2),
        })
    comparisons.sort(key=lambda item: item["estimatedSaving"] or 0, reverse=True)
    for index, item in enumerate(comparisons, 1):
        item["n"] = index

    payload = {
        "meta": {
            "source": INPUT.name, "invoiceSource": str(INVOICES.relative_to(SITE)),
            "effectiveThrough": latest_invoice_date, "periodLabel": f"Mayo a {months[-1].lower()} de {year}",
            "months": months, "sourceBaseRows": sum(1 for row in base_v.iter_rows(min_row=5, values_only=True) if row[2] or row[3]),
            "sourceDetailRows": source_detail_rows, "integratedInvoiceRows": integrated_invoice_rows,
            "correctedMonthRows": corrected_month_rows, "baseRows": len(base),
            "products": len({x["gtin"] or x["product"] for x in base}),
            "gtinCount": len({x["gtin"] for x in base if x["gtin"]}), "comparisons": len(comparisons),
            "differentPresentations": len(presentations), "detailRows": len(detail),
            "missingGtinBefore": missing_gtin_before, "missingGtinAfter": sum(1 for item in detail if not item["gtin"]),
            "centralAssociationsApplied": central_applied, "centralAssociationConflicts": central_conflicts,
            "centralUnitDecisions": len(unit_decisions), "igvIncludedProviders": sorted(IGV_INCLUDED_PROVIDERS),
            "excludedCostProviders": sorted(EXCLUDED_COST_PROVIDERS), "igvCorrectionsApplied": sorted(providers_needing_correction),
            "alfaroCorrectionApplied": "ALFARO" in providers_needing_correction,
        },
        "base": base, "comparisons": comparisons, "presentations": presentations,
        "unitDecisions": unit_decisions, "detail": detail,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
