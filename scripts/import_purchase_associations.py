"""Validate a browser association backup and promote it to the private site dataset."""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PURCHASES = ROOT / "dist" / "purchases.json"
OUTPUT = ROOT / "data" / "purchase_associations.json"


def main():
    parser = argparse.ArgumentParser(description="Centraliza asociaciones GTIN validadas contra el maestro vigente.")
    parser.add_argument("source", type=Path, help="Respaldo JSON descargado desde el dashboard")
    args = parser.parse_args()

    source_payload = json.loads(args.source.read_text(encoding="utf-8-sig"))
    items = source_payload if isinstance(source_payload, list) else source_payload.get("associations")
    if not isinstance(items, list):
        raise ValueError("El JSON no contiene una lista de asociaciones")

    purchases = json.loads(PURCHASES.read_text(encoding="utf-8"))
    mappings = {item["key"]: item for item in purchases["mappings"]}
    targets = {str(item["gtin"]): item for item in purchases["catalog"]}
    accepted = {}
    rejected = []

    for item in items:
        key = str(item.get("mappingKey") or item.get("key") or "")
        gtin = str(item.get("gtin") or "")
        mapping = mappings.get(key)
        target = targets.get(gtin)
        reason = ""
        if not mapping:
            reason = "Descripción de compra no existe en la base vigente"
        elif not target:
            reason = "GTIN no existe en el maestro vigente"
        if reason:
            rejected.append({"mappingKey": key, "gtin": gtin, "reason": reason})
            continue
        accepted[key] = {
            "mappingKey": key,
            "provider": mapping["provider"],
            "description": mapping["description"],
            "gtin": gtin,
            "systemName": target["systemName"],
            "catalogName": (target.get("catalogNames") or [""])[0],
            "systemCode": target.get("systemCode", ""),
            "barcode": target.get("barcode", ""),
            "savedAt": item.get("savedAt", ""),
        }

    payload = {
        "version": 2,
        "sourceFile": args.source.name,
        "exportedAt": source_payload.get("exportedAt", "") if isinstance(source_payload, dict) else "",
        "importedAt": date.today().isoformat(),
        "associations": [accepted[key] for key in sorted(accepted)],
        "rejected": rejected,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Asociaciones aceptadas: {len(accepted):,}")
    print(f"Asociaciones rechazadas: {len(rejected):,}")
    for item in rejected:
        print(f"RECHAZADA: {item['mappingKey']} -> {item['gtin']}: {item['reason']}")
    print(f"Generado: {OUTPUT}")


if __name__ == "__main__":
    main()
