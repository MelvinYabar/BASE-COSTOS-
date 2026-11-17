import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

from prepare_purchases import core_name, provider_name
from cost_unit_rules import explicit_pack, strong_form_conflict
from glucophage_rules import SKU_BY_KEY, sku_key


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
PRODUCT_CATALOG = SITE / "dist" / "purchases.json"
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


def association_for(central, provider, description, excel_gtin="", catalog=None):
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
    glucophage = sku_key(provider_name(provider), description)
    if glucophage:
        expected = SKU_BY_KEY[glucophage]["gtin"]
        if gtin and gtin != expected:
            conflict = gtin
        gtin = expected
        association = {"gtin": expected, "systemName": (catalog or {}).get(expected) or SKU_BY_KEY[glucophage]["label"]}
        source = "Presentación FDS Glucophage verificada"
    return association, gtin, source, conflict


def load_invoices():
    if not INVOICES.exists():
        return {"meta": {}, "records": []}
    return json.loads(INVOICES.read_text(encoding="utf-8"))


def load_catalog():
    if not PRODUCT_CATALOG.exists():
        return {}
    payload = json.loads(PRODUCT_CATALOG.read_text(encoding="utf-8"))
    return {str(item["gtin"]): item.get("systemName", "") for item in payload.get("catalog", []) if item.get("gtin")}


def final_factor(provider):
    return 1 if provider_name(provider).upper() in IGV_INCLUDED_PROVIDERS else 1.18


def row_factor(item):
    tax_text = " ".join(str(item.get(field) or "") for field in ("tax", "description", "amountSource"))
    if re.search(r"S\s*/\s*IGV|SIN\s+IGV|IGV\s+INCLUIDO|EXONERAD[AO]|INAFECT[AO]", tax_text, re.I):
        return 1
    return final_factor(item.get("provider", ""))


def detail_cost_parts(item):
    boxes = item.get("boxes")
    pack = item.get("unitsPerBox")
    amount = item.get("invoiceAmount")
    if not all(isinstance(value, (int, float)) for value in (boxes, pack, amount)):
        return None
    units = boxes * pack
    if units <= 0 or amount <= 0.10:
        return None
    return units, amount * row_factor(item)


def safe_invoice_pack(description, inferred, reason):
    if inferred == 1 and reason.startswith("envase completo"):
        return True
    if inferred and inferred > 1 and reason.startswith("cantidad discreta"):
        return bool(re.search(r"\b(?:TAB|COMP|CAP|OVU|SOB|SCH|SACH)\w*\b", description, re.I)
                    or re.search(r"\b(?:CJA|CAJA)\b", description, re.I))
    return False


def catalog_confirms_whole(invoice_name, system_name):
    inferred, _ = explicit_pack(system_name)
    if inferred != 1:
        return False
    invoice_brand = re.match(r"[A-Z0-9]+", clean(invoice_name).upper())
    system_brand = re.match(r"[A-Z0-9]+", clean(system_name).upper())
    if not invoice_brand or not system_brand or invoice_brand.group() != system_brand.group():
        return False
    measure = re.compile(r"(\d+(?:[.,]\d+)?)[ ]*(ML|GR|G|DOSIS)\b", re.I)
    def last_measure(name):
        matches = measure.findall(name)
        if not matches:
            return None
        value, unit = matches[-1]
        return float(value.replace(",", ".")), "G" if unit.upper() == "GR" else unit.upper()
    invoice_size, system_size = last_measure(invoice_name), last_measure(system_name)
    return not (invoice_size and system_size and invoice_size != system_size)


def main():
    central = central_associations()
    catalog = load_catalog()
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
        if provider == "FDS" and not gtin and sku_key(provider, product):
            # The source workbook contains unmapped duplicate Glucophage rows.
            # Their invoice-backed costs are rebuilt below under the verified GTIN.
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
        association, gtin, gtin_source, original_gtin_conflict = association_for(central, provider, description, excel_gtin, catalog)
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
        association, gtin, gtin_source, conflict = association_for(central, provider, description, catalog=catalog)
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

    rejected_gtins = []
    restored_gtins = []
    for item in detail:
        gtin = str(item.get("gtin", ""))
        if not gtin or not strong_form_conflict(item["description"], catalog.get(gtin) or item.get("systemName", "")):
            continue
        original = str(item.get("centralGtinConflict", ""))
        item["rejectedGtin"] = gtin
        if original and catalog.get(original) and not strong_form_conflict(item["description"], catalog[original]):
            item["gtin"] = original
            item["systemName"] = catalog[original]
            item["gtinSource"] = "Excel restaurado: asociación manual incompatible"
            restored_gtins.append(item["n"])
        else:
            item["gtin"] = ""
            item["systemName"] = ""
            item["gtinSource"] = "Relación rechazada: presentación incompatible"
            rejected_gtins.append(item["n"])

    corrected_month_keys = set()
    corrected_provider_keys = set()
    validated_decisions = {}
    decision_conflicts = []
    unit_corrections = 0
    assumed_units_confirmed = 0
    catalog_units_confirmed = 0
    audited_unit_corrections = 0
    for item in detail:
        inferred, evidence = explicit_pack(item["description"])
        decision_key = f"ROW:{item['n']}"
        decision = unit_decisions.get(decision_key) if item["n"] <= source_detail_rows else None
        chosen = None
        source = ""
        if decision:
            manual_pack = num(decision.get("quantity"))
            if inferred is not None and manual_pack != inferred:
                item["unitDecisionConflict"] = f"Decisión manual {manual_pack} frente a factura {inferred:g}"
                decision_conflicts.append({"row": item["n"], "invoice": item["invoice"],
                                           "description": item["description"], "manual": manual_pack,
                                           "invoicePack": inferred})
            elif manual_pack and manual_pack > 0:
                validated_decisions[decision_key] = decision
                chosen, source = manual_pack, "decisión manual validada"
        if chosen is None and not item.get("unitDecisionConflict") and safe_invoice_pack(item["description"], inferred, evidence):
            chosen, source = inferred, evidence
        old_pack = item.get("unitsPerBox")
        if inferred == 1 and old_pack == 1 and not item.get("unitDecisionConflict") and "se asume 1" in item.get("unitsSource", ""):
            item["unitsSource"] = f"Factura: {evidence}; una unidad vendible por envase"
            item["unitAudit"] = "confirmado por descripción de factura"
            assumed_units_confirmed += 1
        elif old_pack == 1 and not item.get("unitDecisionConflict") and "se asume 1" in item.get("unitsSource", "") and catalog_confirms_whole(item["description"], item.get("systemName", "")):
            item["unitsSource"] = "Factura y producto asociado: una unidad vendible por envase"
            item["unitAudit"] = "confirmado por factura y maestro"
            catalog_units_confirmed += 1
        if chosen is None or old_pack == chosen:
            continue
        boxes, amount = item.get("boxes"), item.get("invoiceAmount")
        if not all(isinstance(value, (int, float)) and value > 0 for value in (boxes, amount)):
            continue
        units = boxes * chosen
        item["unitsPerBox"] = chosen
        item["units"] = round(units, 6)
        if amount > .10:
            item["costWithoutTax"] = round(amount / units, 6)
            item["finalCost"] = round(amount * row_factor(item) / units, 6)
        item["unitsSource"] = f"{source}; corregido desde factura/decisión"
        item["unitAdjustment"] = source
        if decision and decision.get("evidence"):
            item["unitAudit"] = "corregido con factura y maestro"
            item["unitAuditEvidence"] = decision["evidence"]
            audited_unit_corrections += 1
        unit_corrections += 1
        if item.get("gtin"):
            corrected_provider_keys.add((str(item["gtin"]), provider_name(item["provider"])))
            corrected_month_keys.add((str(item["gtin"]), provider_name(item["provider"]), item["month"]))

    for item in detail:
        if (item.get("gtin") and sku_key(item["provider"], item["description"])
                and item.get("invoiceAmount") is not None and item["invoiceAmount"] > .10):
            provider = provider_name(item["provider"])
            corrected_provider_keys.add((str(item["gtin"]), provider))
            corrected_month_keys.add((str(item["gtin"]), provider, item["month"]))

    observed = defaultdict(lambda: [0.0, 0.0])
    integrated_units = defaultdict(float)
    recomputed_units = defaultdict(float)
    for item in detail:
        provider = provider_name(item["provider"])
        provider_key = (str(item.get("gtin", "")), provider)
        parts = detail_cost_parts(item)
        if provider_key in corrected_provider_keys and parts is not None:
            recomputed_units[provider_key] += parts[0]
        month_key = (str(item.get("gtin", "")), provider_name(item["provider"]), item["month"])
        if item["month"] not in months[4:] and month_key not in corrected_month_keys:
            continue
        if not item.get("gtin") or parts is None or provider_name(item["provider"]).upper() in EXCLUDED_COST_PROVIDERS:
            continue
        units, final_amount = parts
        key = (str(item["gtin"]), provider_name(item["provider"]), item["month"])
        observed[key][0] += units
        observed[key][1] += final_amount
        if item["month"] in months[4:]:
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
        for month_index in range(len(months)):
            month = months[month_index]
            units, total = observed.get((key[0], key[1], month), (0, 0))
            was_corrected = (key[0], key[1], month) in corrected_month_keys
            if units > 0 and (month_index >= 4 or was_corrected):
                row["costs"][month_index] = {"value": round(total / units, 4), "carried": False}
            elif month_index >= 4 or row["costs"][month_index]["carried"]:
                previous = next((entry["value"] for entry in reversed(row["costs"][:month_index]) if entry["value"] is not None), None)
                row["costs"][month_index] = {"value": previous, "carried": previous is not None}
        row["monthsPurchased"] = sum(1 for entry in row["costs"] if entry["value"] is not None and not entry["carried"])
        row["unitsPurchased"] = round(recomputed_units[key] if key in corrected_provider_keys else
                                      (row.get("unitsPurchased") or 0) + integrated_units.get(key, 0), 6)

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
            "centralAssociationsApplied": sum(item["gtinSource"] == "Asociación manual central" for item in detail),
            "centralAssociationConflicts": central_conflicts,
            "incompatibleGtinsRejected": len(rejected_gtins), "originalGtinsRestored": len(restored_gtins),
            "centralUnitDecisions": len(validated_decisions), "unitDecisionConflicts": len(decision_conflicts),
            "unitCorrectionsApplied": unit_corrections, "igvIncludedProviders": sorted(IGV_INCLUDED_PROVIDERS),
            "assumedUnitsConfirmed": assumed_units_confirmed,
            "catalogUnitsConfirmed": catalog_units_confirmed,
            "auditedUnitCorrections": audited_unit_corrections,
            "excludedCostProviders": sorted(EXCLUDED_COST_PROVIDERS), "igvCorrectionsApplied": sorted(providers_needing_correction),
            "alfaroCorrectionApplied": "ALFARO" in providers_needing_correction,
        },
        "base": base, "comparisons": comparisons, "presentations": presentations,
        "unitDecisions": validated_decisions, "unitDecisionConflicts": decision_conflicts, "detail": detail,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
