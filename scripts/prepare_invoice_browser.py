#!/usr/bin/env python3
"""Construye el historial navegable de facturas para el dashboard unificado.

Combina el data.json del dashboard de facturas original con comprobantes UBL
electrónicos (XML sueltos o dentro de ZIP) encontrados en carpetas de meses.
Los comprobantes se deduplican por número de factura y producto.
"""

from __future__ import annotations

import argparse
import html
import io
import json
import re
import unicodedata
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET


DISCRETE = {
    "TAB", "TABS", "TABLETA", "TABLETAS", "COMP", "COMPS", "CMP", "COMPR",
    "COMPRIMIDO", "COMPRIMIDOS", "CAP", "CAPS", "CAPSULA", "CAPSULAS",
    "GRAGEA", "GRAGEAS", "OVULO", "OVULOS", "SUPOSITORIO", "SUPOSITORIOS",
    "SOBRE", "SOBRES", "SOB", "AMP", "AMPOLLA", "AMPOLLAS", "JER",
    "JERINGA", "JERINGAS", "VIAL", "VIALES", "PARCHE", "PARCHES", "SACHET",
    "SACHETS", "UND", "UNID", "UNIDADES", "TIRAS", "TIRA", "BLISTER",
}
WHOLE = {"ML", "L", "LT", "GR", "G", "GRS", "KG", "CC", "DOSIS"}
PACK_RE = re.compile(r"(?:\bX|\*)\s*(\d{1,4})\s*([A-Z]{0,14})", re.I)
DOCUMENT_RE = re.compile(r"\b([A-Z]{1,3}\d{1,3})[-_]?0*(\d{3,})\b", re.I)


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def children(node, name):
    return [item for item in node.iter() if local(item.tag) == name]


def first_text(node, name, default=""):
    for item in node.iter():
        if local(item.tag) == name and item.text:
            return item.text.strip()
    return default


def direct_text(node, name, default=""):
    for item in node:
        if local(item.tag) == name and item.text:
            return item.text.strip()
    return default


def number(value):
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def normalize(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9./+%-]+", " ", text)).strip()


def normalize_document(value):
    """Devuelve una clave estable para enlazar XML, histórico y PDF."""
    match = DOCUMENT_RE.search(str(value or "").upper())
    return f"{match.group(1).upper()}-{match.group(2)}" if match else None


def clean_text(value):
    text = str(value or "")
    for _ in range(2):
        text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def canonical_provider(value):
    text = normalize(clean_text(value))
    rules = [
        ("representaciones castillo", "CASTILLO"),
        ("alfaro", "ALFARO"),
        ("dimexa", "DIMEXA"),
        ("promefar", "MYM"),
        ("m & m", "MYM"),
        ("m m productos", "MYM"),
        ("fp mayorista", "FP MAYORISTA (QUIMICA SUIZA)"),
        ("farmaceutica del sur", "FDS"),
        ("ebenel", "EBENEL"),
        ("alcon", "ALCON"),
        ("santa ursula", "SANTA URSULA"),
        ("farmagold", "FARMAGOLD"),
        ("bethel", "BETHEL"),
    ]
    for needle, name in rules:
        if needle in text:
            return name
    return clean_text(value) or "Proveedor no identificado"


def units_per_package(description):
    text = unicodedata.normalize("NFKD", str(description or "").upper())
    for match in PACK_RE.finditer(text):
        qty, token = int(match.group(1)), match.group(2).strip(" .")
        if token in WHOLE:
            return 1, f"envase completo ({token})"
        if token in DISCRETE and qty > 0:
            return qty, f"se parte en {qty} ({token})"
        context = text[max(0, match.start() - 28):match.start()]
        context_tokens = set(re.findall(r"[A-Z]+", context))
        if context_tokens & DISCRETE and qty > 0:
            form = sorted(context_tokens & DISCRETE)[0]
            return qty, f"se parte en {qty} ({form} antes de X)"
    if re.search(r"\b(?:DOSIS|ML|GRS?|KG|LT?)\b", text):
        return 1, "envase completo por volumen, peso o dosis"
    return None, "presentación por confirmar"


def supplier_name(root):
    for party in children(root, "AccountingSupplierParty"):
        for candidate in ("RegistrationName", "Name"):
            value = first_text(party, candidate)
            if value:
                return canonical_provider(value)
    return "Proveedor no identificado"


def invoice_xml_records(blob: bytes, source: str):
    try:
        root = ET.fromstring(blob)
    except ET.ParseError:
        return []
    if local(root.tag) != "Invoice":
        return []
    document = direct_text(root, "ID") or first_text(root, "ID")
    issue_date = direct_text(root, "IssueDate") or first_text(root, "IssueDate")
    provider = supplier_name(root)
    rows = []
    for line in children(root, "InvoiceLine"):
        qty_node = next((x for x in line if local(x.tag) == "InvoicedQuantity"), None)
        qty = number(qty_node.text if qty_node is not None else None)
        unit = qty_node.attrib.get("unitCode", "") if qty_node is not None else ""
        description = first_text(next(iter(children(line, "Item")), line), "Description")
        if not description:
            description = first_text(line, "Description")
        description = clean_text(description)
        extension = number(direct_text(line, "LineExtensionAmount")) or 0
        tax_node = next(iter(children(line, "TaxTotal")), None)
        tax = number(direct_text(tax_node, "TaxAmount")) if tax_node is not None else 0
        total = round(extension + (tax or 0), 6)
        package_price = total / qty if qty else None
        pack, method = units_per_package(description)
        unit_cost = package_price / pack if package_price is not None and pack else None
        rows.append({
            "proveedor": provider,
            "fecha": issue_date,
            "fecha_valida": bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", issue_date or "")),
            "documento": document,
            "producto": description,
            "producto_norm": normalize(description),
            "cantidad": qty,
            "um": unit,
            "precio_unitario": round(package_price, 6) if package_price is not None else None,
            "importe_total": round(total, 6),
            "unidades_caja": pack,
            "unidades_totales": qty * pack if qty is not None and pack else None,
            "costo_unidad": round(unit_cost, 6) if unit_cost is not None else None,
            "metodo_deteccion": f"{method} | XML UBL | importe de línea con IGV",
            "fuente": source,
            "pdf_status": "xml",
            "pdf_match_motivo": "comprobante electrónico UBL",
            "pdf_candidates": [],
            "sin_costo": unit_cost is None,
            "duplicado": False,
        })
    return rows


def electronic_records(purchases_dir: Path, months):
    records, documents, files = [], set(), 0
    for month in months:
        for folder in purchases_dir.rglob(month):
            if not folder.is_dir():
                continue
            for path in folder.iterdir():
                blobs = []
                if path.suffix.lower() == ".xml":
                    blobs.append((path.read_bytes(), path.relative_to(purchases_dir.parent).as_posix()))
                elif path.suffix.lower() == ".zip":
                    try:
                        with zipfile.ZipFile(path) as archive:
                            for name in archive.namelist():
                                if name.lower().endswith(".xml"):
                                    blobs.append((archive.read(name), f"{path.relative_to(purchases_dir.parent).as_posix()}::{name}"))
                    except zipfile.BadZipFile:
                        continue
                for blob, source in blobs:
                    parsed = invoice_xml_records(blob, source)
                    if parsed:
                        files += 1
                        records.extend(parsed)
                        documents.add(parsed[0]["documento"])
    return records, documents, files


def merge_records(base, new):
    def key(row):
        return (normalize(row.get("documento")), normalize(row.get("producto")))
    merged = [{**row, "proveedor": canonical_provider(row.get("proveedor"))} for row in base]
    positions = {key(row): i for i, row in enumerate(merged)}
    added = replaced = 0
    for row in new:
        item_key = key(row)
        if not all(item_key):
            continue
        if item_key in positions:
            current = merged[positions[item_key]]
            if str(row.get("fecha", "")) >= str(current.get("fecha", "")) and row.get("costo_unidad") is not None:
                row["id"] = current.get("id")
                merged[positions[item_key]] = row
                replaced += 1
        else:
            row["id"] = len(merged) + 1
            positions[item_key] = len(merged)
            merged.append(row)
            added += 1
    for index, row in enumerate(merged, 1):
        row["id"] = index
    return merged, added, replaced


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-json", required=True, type=Path)
    parser.add_argument("--purchases-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--pdf-index", type=Path)
    parser.add_argument("--months", nargs="+", default=["2026-08", "2026-09"])
    args = parser.parse_args()
    base_payload = json.loads(args.base_json.read_text(encoding="utf-8-sig"))
    base = base_payload.get("registros", [])
    electronic, documents, files = electronic_records(args.purchases_dir, args.months)
    records, added, replaced = merge_records(base, electronic)
    pdf_documents, pdf_paths = {}, {}
    if args.pdf_index and args.pdf_index.exists():
        pdf_payload = json.loads(args.pdf_index.read_text(encoding="utf-8"))
        pdf_documents = pdf_payload.get("documents", {})
        pdf_paths = pdf_payload.get("paths", {})
    for row in records:
        pdf = pdf_documents.get(normalize_document(row.get("documento")))
        if not pdf:
            for candidate in row.get("pdf_candidates") or []:
                pdf = pdf_paths.get(str(candidate).replace("\\", "/").casefold())
                if pdf:
                    break
        row["pdf_url"] = pdf.get("url") if pdf else None
        row["pdf_preview_url"] = pdf.get("preview") if pdf else None
    providers = Counter(row.get("proveedor") or "Sin proveedor" for row in records)
    valid_dates = [row.get("fecha") for row in records if re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(row.get("fecha") or ""))]
    payload = {
        "meta": {
            "generated": date.today().isoformat(),
            "baseSource": str(args.base_json),
            "monthsImported": args.months,
            "rows": len(records),
            "documents": len({normalize(r.get("documento")) for r in records if r.get("documento")}),
            "products": len({normalize(r.get("producto")) for r in records if r.get("producto")}),
            "providers": len(providers),
            "from": min(valid_dates) if valid_dates else None,
            "to": max(valid_dates) if valid_dates else None,
            "electronicFilesParsed": files,
            "electronicDocuments": len(documents),
            "newRows": added,
            "replacedRows": replaced,
            "pdfDocuments": len({r.get("documento") for r in records if r.get("pdf_url")}),
            "pdfPreviews": sum(1 for r in records if r.get("pdf_preview_url")),
        },
        "providers": [{"provider": name, "rows": count} for name, count in providers.most_common()],
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
