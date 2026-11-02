#!/usr/bin/env python3
"""Añade al índice los PDF ya versionados en el dashboard anterior.

Los comprobantes antiguos se sirven desde jsDelivr usando el repositorio
GitHub existente; los PDF recientes empaquetados localmente conservan prioridad.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import quote


DOCUMENT_RE = re.compile(r"\b([A-Z]{1,3}\d{1,3})[-_]?0*(\d{3,})\b", re.I)


def document_key(value):
    matches = DOCUMENT_RE.findall(str(value or "").upper())
    if not matches:
        return None
    series, number = matches[-1]
    return f"{series.upper()}-{number}"


def render_preview(pdf: Path, output: Path):
    import fitz
    from PIL import Image

    source = fitz.open(pdf)
    page = source[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(1.35, 1.35), alpha=False)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    image.thumbnail((1000, 1600), Image.Resampling.LANCZOS)
    image.save(output, format="WEBP", quality=68, method=6)
    source.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-index", required=True, type=Path)
    parser.add_argument("--legacy-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--preview-dir", type=Path)
    parser.add_argument(
        "--cdn-base",
        default="https://cdn.jsdelivr.net/gh/MelvinYabar/dashboard@main/",
    )
    args = parser.parse_args()

    payload = json.loads(args.base_index.read_text(encoding="utf-8"))
    documents = payload.setdefault("documents", {})
    paths = payload.setdefault("paths", {})
    added_documents = 0
    generated_previews = 0

    if args.preview_dir:
        args.preview_dir.mkdir(parents=True, exist_ok=True)

    for pdf in sorted(args.legacy_root.rglob("*.pdf")):
        relative = pdf.relative_to(args.legacy_root.parent).as_posix()
        entry = {
            "url": args.cdn_base.rstrip("/") + "/" + quote(relative, safe="/"),
            "source": relative,
            "origin": "dashboard_anterior",
        }
        if args.preview_dir:
            key = document_key(pdf.stem) or re.sub(r"[^A-Z0-9]+", "-", pdf.stem.upper()).strip("-")
            digest = hashlib.sha1(relative.encode("utf-8")).hexdigest()[:10]
            preview_name = f"{key}-{digest}.webp"
            preview_path = args.preview_dir / preview_name
            if not preview_path.exists():
                render_preview(pdf, preview_path)
                generated_previews += 1
            entry["preview"] = f"invoice-pdfs-legacy/{preview_name}"
        paths[relative.casefold()] = entry
        key = document_key(pdf.stem)
        if key and key not in documents:
            documents[key] = entry
            added_documents += 1
        elif key and documents[key].get("origin") == "dashboard_anterior":
            documents[key] = entry

    payload["legacy"] = {
        "files": len(paths),
        "documentsAdded": added_documents,
        "previewsGenerated": generated_previews,
        "cdnBase": args.cdn_base,
    }
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(payload["legacy"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
