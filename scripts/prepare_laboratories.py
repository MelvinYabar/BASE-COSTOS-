"""Match active OKFAC GTINs to the laboratory in column K of the supplied catalog."""

import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook


SITE = Path(__file__).resolve().parents[1]
SOURCE = SITE.parent
DEFAULT_CATALOG = (Path.home() / "Downloads" / "Costos_Precios" / "SANTA URSULA NUEVO"
                   / "Catálogo GTIN (EAN) DS. 024-2005 - SA 01 julio.xlsx")
OUTPUT = SITE / "data" / "laboratories_gtin.json"
COVER = SITE / "dist" / "stock-cover.json"


def gtin(value):
    if value is None:
        return ""
    return str(value).strip().removesuffix(".0")


def main(catalog_path=DEFAULT_CATALOG):
    catalog_path = Path(catalog_path)
    cover = json.loads(COVER.read_text(encoding="utf-8"))
    master_path = SOURCE / cover["meta"]["productFile"]
    catalog_book = load_workbook(catalog_path, read_only=True, data_only=True)
    catalog_sheet = catalog_book.active
    if catalog_sheet["B1"].value != "CO_CODIGO" or catalog_sheet["K1"].value != "DE_LABORATORIO":
        raise ValueError("El catálogo no tiene GTIN en B y laboratorio en K")
    by_gtin = defaultdict(list)
    for row_num, row in enumerate(catalog_sheet.iter_rows(min_row=2, values_only=True), 2):
        item_gtin = gtin(row[1])
        if item_gtin:
            by_gtin[item_gtin].append((row_num, str(row[10] or "").strip()))
    catalog_book.close()

    master_book = load_workbook(master_path, read_only=True, data_only=True)
    active = {gtin(row[1]): str(row[3] or "") for row in master_book.active.iter_rows(min_row=7, values_only=True)
              if row[20] == "Activo"}
    master_book.close()
    if len(active) != cover["meta"]["activeProducts"]:
        raise ValueError(f"Conteo inesperado del maestro activo: {len(active)}")
    matched = {}
    for item_gtin in active:
        entries = by_gtin.get(item_gtin, [])
        labels = {name for _, name in entries if name}
        if len(labels) > 1:
            raise ValueError(f"Laboratorios contradictorios para {item_gtin}: {labels}")
        if len(entries) > 1:
            raise ValueError(f"GTIN duplicado en catálogo: {item_gtin}")
        if len(labels) == 1:
            matched[item_gtin] = {"laboratory": labels.pop(), "catalogRow": entries[0][0]}
    payload = {
        "meta": {"masterFile": master_path.name, "catalogFile": catalog_path.name,
                 "catalogSha256": hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
                 "catalogRows": sum(len(v) for v in by_gtin.values()),
                 "activeProducts": len(active), "matched": len(matched),
                 "unmatched": len(active) - len(matched), "matchRule": "GTIN exacto: maestro código de barras = catálogo columna B; laboratorio de columna K"},
        "byGtin": matched,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CATALOG)
