"""Genera la lista revisable de unidades que siguen asumidas en la BD."""

import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dist" / "costs.json"
OUTPUT = ROOT / "docs" / "auditoria_unidades_2026-11-17.md"


def safe(value):
    return str(value or "").replace("|", "\\|").replace("\n", " ").strip()


def main():
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    detail = payload["detail"]
    pending = [row for row in detail if "se asume 1" in row.get("unitsSource", "")]
    corrected = [row for row in detail if row.get("unitAudit") == "corregido con factura y maestro"]
    confirmed = [row for row in detail if row.get("unitAudit", "").startswith("confirmado por")]
    counts = Counter(row["provider"] for row in pending)
    lines = [
        "# Auditoría de unidades asumidas",
        "",
        "Corte de facturas de la base: " + safe(payload["meta"]["effectiveThrough"]) + ".",
        "",
        f"De las 451 líneas originalmente marcadas como «se asume 1», {len(confirmed)} quedaron respaldadas por la presentación de factura y/o el maestro; {len(corrected)} requerían otra cantidad y se recalcularon; {len(pending)} siguen pendientes.",
        "",
        "La validación del costo unitario usa importe de factura × factor IGV ÷ (envases comprados × unidades vendibles por envase). Una relación GTIN se revisa por separado de la cantidad.",
        "",
        "## Correcciones confirmadas",
        "",
        "| Fila | Proveedor | Producto de factura | Unidades por envase | Costo unitario final (S/) | Evidencia |",
        "| ---: | --- | --- | ---: | ---: | --- |",
    ]
    for row in corrected:
        lines.append(f"| {row['n']} | {safe(row['provider'])} | {safe(row['description'])} | {row['unitsPerBox']:g} | {row['finalCost']:.4f} | {safe(row['unitAuditEvidence'])} |")
    lines.extend(["", "## Líneas aún pendientes", "", "Proveedor: " + ", ".join(f"{safe(name)} {count}" for name, count in counts.most_common()) + ".", "", "Filtra **Unidad asumida pendiente** en *BD de costos → Revisión del costo unitario* para ajustar una fila. Santa Úrsula sigue visible, pero no alimenta el costo oficial.", "", "| Fila | Proveedor | Producto de factura | GTIN actual | Factura | Presentación del maestro | Motivo de revisión |", "| ---: | --- | --- | --- | --- | --- | --- |"])
    for row in pending:
        reason = "Envase o cantidad vendible sin confirmación inequívoca"
        if row["n"] == 1894:
            reason = "LAGRICEL: factura dice dosis única; el maestro indica venta en sobre de 5 y el catálogo anterior caja de 20"
        elif row["provider"] == "SANTA URSULA":
            reason = "Presentación pendiente; proveedor excluido del costo oficial"
        elif not row.get("gtin"):
            reason = "Falta confirmar presentación y relación GTIN"
        lines.append(f"| {row['n']} | {safe(row['provider'])} | {safe(row['description'])} | {safe(row.get('gtin'))} | {safe(row['invoice'])} | {safe(row.get('systemName'))} | {safe(reason)} |")
    lines.extend(["", "## Relaciones de producto ajustadas", "", "Se asociaron a la presentación exacta MOVIFLEX 50 ML, QUANOX 5 ML, DEBLAX de 1 cápsula y CEFALOGEN IV. CLAVUMOX 250 MG, frasco de 60 ML, quedó sin GTIN porque el maestro disponible no contiene esa presentación.", ""])
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(confirmed)} confirmadas, {len(corrected)} corregidas, {len(pending)} pendientes: {OUTPUT}")


if __name__ == "__main__":
    main()
