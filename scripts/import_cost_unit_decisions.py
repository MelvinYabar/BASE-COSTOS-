"""Importa decisiones manuales de unidades desde la revisión completa del dashboard."""
from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

from openpyxl import load_workbook


PROJECT = Path(__file__).resolve().parents[1]
COSTS = PROJECT / "dist" / "costs.json"
OUTPUT = PROJECT / "data" / "cost_unit_decisions.json"


def clean(value):
    return " ".join(str(value or "").split())


def main():
    parser = argparse.ArgumentParser(description="Centraliza decisiones se parte/no se parte.")
    parser.add_argument("source", type=Path, help="revision_costos.xlsx exportado sin filtros")
    args = parser.parse_args()

    costs = json.loads(COSTS.read_text(encoding="utf-8"))
    current = {int(row["n"]): row for row in costs["detail"]}
    workbook = load_workbook(args.source, data_only=True, read_only=True)
    sheet = workbook["Revisión de costos"]
    headers = [cell.value for cell in next(sheet.iter_rows())]
    decisions = {}
    rejected = []

    for values in sheet.iter_rows(min_row=2, values_only=True):
        row = dict(zip(headers, values))
        reason = clean(row.get("motivo"))
        if "Decisión manual:" not in reason:
            continue
        number = int(row["fila"])
        original = current.get(number)
        if not original:
            rejected.append({"fila": number, "reason": "La fila no existe en costs.json"})
            continue
        if clean(row.get("producto")) != clean(original.get("description")) or clean(row.get("proveedor")) != clean(original.get("provider")):
            rejected.append({"fila": number, "reason": "Producto o proveedor no coincide con la base vigente"})
            continue
        split = re.search(r"Decisión manual: se parte en\s+(\d+)", reason, re.I)
        if split:
            mode = "split"
            quantity = int(split.group(1))
        elif re.search(r"Decisión manual: no se parte", reason, re.I):
            mode = "whole"
            quantity = 1
        else:
            rejected.append({"fila": number, "reason": "Decisión manual no reconocida"})
            continue
        exported_quantity = row.get("unidades_por_envase")
        if exported_quantity is None or abs(float(exported_quantity) - quantity) > 0.000001:
            rejected.append({"fila": number, "reason": "La cantidad exportada no coincide con la decisión"})
            continue
        decisions[f"ROW:{number}"] = {
            "mode": mode,
            "quantity": quantity,
            "product": original.get("systemName") or original.get("description"),
            "provider": original.get("provider"),
            "sourceRow": number,
        }

    payload = {
        "version": 1,
        "sourceFile": args.source.name,
        "importedAt": date.today().isoformat(),
        "decisions": decisions,
        "rejected": rejected,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Decisiones aceptadas: {len(decisions):,}")
    print(f"Decisiones rechazadas: {len(rejected):,}")
    for item in rejected:
        print(f"RECHAZADA fila {item['fila']}: {item['reason']}")
    print(f"Generado: {OUTPUT}")


if __name__ == "__main__":
    main()
