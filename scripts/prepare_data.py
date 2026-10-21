import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "BD_HISTORICO_PRECIOS" / "historico_precios.csv"
OUTPUT = Path(__file__).resolve().parents[1] / "dist" / "data.json"
IGV_INCLUDED_PROVIDERS = {"ALFARO", "CASTILLO", "EBENEL", "FP MAYORISTA (QUIMICA SUIZA)", "FDS"}


def number(value):
    try:
        return float(str(value).replace(",", ".")) if value not in (None, "") else None
    except ValueError:
        return None


def date_iso(*values):
    for value in values:
        if not value:
            continue
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d.%m.%y"):
            try:
                parsed = datetime.strptime(value.strip(), fmt).date()
                # The supplied corpus is explicitly May–August 2026. A few FDS
                # issue-date cells contain the lot expiry captured by the PDF
                # parser, so reject out-of-coverage dates and fall back to the
                # traceable date embedded in the filename.
                if parsed.year == 2026 and 5 <= parsed.month <= 8:
                    return parsed.isoformat()
            except ValueError:
                pass
    return ""


def ascii_upper(value):
    value = unicodedata.normalize("NFD", value.upper())
    return "".join(c for c in value if unicodedata.category(c) != "Mn")


NOISE = {
    "BONIF", "BONIFICACION", "CAJ", "CAJA", "CJA", "BX", "UND", "UNI", "NIU",
    "COMP", "COMPR", "COMPRIMIDOS", "TAB", "TABLETAS", "CAP", "CAPS", "CAPSULAS",
    "FCO", "FRASCO", "TBO", "TUBO", "SOL", "SOLUCION", "OFT", "OFTALMICA", "OFTALMICO",
    "REC", "RECUB", "RECUBIERTAS", "LIB", "LIBERACION", "PROLONG", "PROLONGADA",
    "SUSP", "SUSPENSION", "JBE", "JARABE", "CREMA", "GEL", "UNIDADES", "UNIDAD",
    "LAB", "LOTE", "PE", "C", "X", "DE", "LA", "EL", "CON", "PARA"
}


def cleaned_description(value):
    value = ascii_upper(value)
    value = re.sub(r"\b(?:BONI(?:F(?:ICACION)?)?|LOT(?:E)?|VCTO|VENC)\b[:\s-]*[A-Z0-9./-]*", " ", value)
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"\b0+(\d+)\b", r"\1", value)
    value = re.sub(r"[^A-Z0-9.%]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def product_signature(value):
    cleaned = cleaned_description(value)
    tokens = []
    for token in cleaned.split():
        token = token.replace("MGR", "MG").replace("MCG", "UG")
        if token in NOISE:
            continue
        if re.fullmatch(r"\d{5,}", token):
            continue
        tokens.append(token)
    # Conservative signature: brand/name plus strengths/counts; no fuzzy drug-name merging.
    return " ".join(tokens[:9]) or cleaned


def display_name(value):
    text = cleaned_description(value)
    text = re.sub(r"\b\d{6,}\b", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.title() if text else "Sin descripción"


def normalized_um(value):
    value = ascii_upper(value or "").strip()
    mapping = {
        "CAJ": "CAJA", "CJA": "CAJA", "CAJA": "CAJA", "BX": "CAJA", "CJA-BX": "CAJA",
        "UND": "UNIDAD", "UNI": "UNIDAD", "NIU": "UNIDAD", "UNI-CS": "UNIDAD",
        "FCO": "FRASCO", "FCO-CS": "FRASCO", "TBO-CS": "TUBO", "TUB": "TUBO", "TU": "TUBO",
    }
    return mapping.get(value, value or "SIN UM")


def pack_count(description):
    text = ascii_upper(description)
    matches = re.findall(r"(?:\bX\s*|CAJA\s*(?:POR|X)\s*)(\d{1,4})\b", text)
    return int(matches[-1]) if matches else None


def is_bonus(row):
    blob = " ".join((row.get("descripcion", ""), row.get("nota", ""))).upper()
    if "BONIF" in blob or row.get("tipo") == "Y":
        return True
    fields = [row.get("precio_unitario"), row.get("precio_unit_final"), row.get("valor_unitario"), row.get("valor_venta_unit")]
    present = [number(v) for v in fields if v not in (None, "")]
    return bool(present) and max(present) == 0


def observed_price(row):
    p = row["proveedor"]
    qty = number(row.get("cantidad"))
    amount = number(row.get("importe"))
    # Prefer a final unit price explicitly printed by the supplier.
    direct = {
        "ALFARO": ("precio_unit_final", "Final impreso con IGV incluido"),
        "FARMAGOLD": ("valor_unitario", "Final impreso"),
        "BETHEL": ("valor_unitario", "Valor unitario sin IGV impreso"),
    }
    if p in direct:
        field, label = direct[p]
        value = number(row.get(field))
        if value is not None:
            return value, field, label, False
    # When the line total is printed, expose the division as a calculation, never as document data.
    if amount is not None and qty not in (None, 0):
        return amount / qty, "importe/cantidad", "Calculado desde importe impreso", True
    value = number(row.get("precio_unitario"))
    if value is not None:
        if p == "FDS":
            discounts = [number(row.get(f"dcto{i}")) or 0 for i in range(1, 5)]
            final = value
            for discount in discounts:
                final *= 1 - discount / 100
            return final, "precio_unitario × descuentos", "Calculado desde precio y descuentos impresos", True
        return value, "precio_unitario", "Precio unitario impreso", False
    return None, "", "Sin precio utilizable", False


def main():
    with INPUT.open(encoding="utf-8-sig", newline="") as fh:
        source = list(csv.DictReader(fh))

    by_signature = defaultdict(list)
    for row in source:
        by_signature[product_signature(row["descripcion"])].append(row["descripcion"])

    product_ids = {sig: f"P{i:04d}" for i, sig in enumerate(sorted(by_signature), 1)}
    preferred = {}
    for sig, descriptions in by_signature.items():
        # Favor the most frequent, then the shortest wording as the proposed editable label.
        counts = Counter(descriptions)
        best = sorted(counts, key=lambda x: (-counts[x], len(x), x))[0]
        preferred[sig] = display_name(best)

    rows = []
    for idx, row in enumerate(source, 1):
        sig = product_signature(row["descripcion"])
        price, price_field, price_basis, calculated = observed_price(row)
        bonus = is_bonus(row)
        pack = pack_count(row["descripcion"])
        um = normalized_um(row.get("um"))
        rows.append({
            "id": idx,
            "productId": product_ids[sig],
            "product": preferred[sig],
            "description": row["descripcion"],
            "provider": row["proveedor"],
            "date": date_iso(row.get("fecha_emision"), row.get("fecha_archivo")),
            "invoice": row.get("nro_factura", ""),
            "file": row.get("archivo", ""),
            "code": row.get("codigo", ""),
            "qty": number(row.get("cantidad")),
            "um": row.get("um", "") or "—",
            "umGroup": um,
            "pack": pack,
            "comparisonKey": f"{um}|{pack if pack is not None else '?'}",
            "bonus": bonus,
            "price": None if bonus else (round(price, 6) if price is not None else None),
            "priceField": price_field,
            "priceBasis": price_basis,
            "calculated": calculated,
            "includesIgv": row["proveedor"] in IGV_INCLUDED_PROVIDERS,
            "amount": number(row.get("importe")) or number(row.get("total")) or number(row.get("valor_venta")),
            "lot": row.get("lote") or row.get("lote_venc") or "",
            "raw": row.get("raw", ""),
        })

    descriptions = []
    for desc in sorted({r["descripcion"] for r in source}):
        sig = product_signature(desc)
        descriptions.append({"description": desc, "productId": product_ids[sig], "product": preferred[sig]})

    providers = sorted({r["proveedor"] for r in source})
    months = sorted({r["date"][:7] for r in rows if r["date"]})
    payload = {
        "meta": {
            "generated": "2026-10-19",
            "rowCount": len(rows),
            "invoiceCount": len({(r["provider"], r["invoice"], r["file"]) for r in rows}),
            "descriptionCount": len(descriptions),
            "productCount": len(product_ids),
            "providers": providers,
            "months": months,
            "sourceDescriptionCountClaim": 1952,
        },
        "rows": rows,
        "mappings": descriptions,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
