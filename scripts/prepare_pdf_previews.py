#!/usr/bin/env python3
"""Prepara copias web livianas de los PDF de facturas por mes.

Los originales nunca se modifican. Lee PDF directos y PDF contenidos en ZIP,
deduplica por número de comprobante y genera un índice documento -> URL local.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import shutil
import tempfile
import zipfile
from pathlib import Path


DOC_RE = re.compile(r"\b([A-Z]{1,3}\d{1,3})[-_]?0*(\d{3,})\b", re.I)


def document_from_name(name):
    matches = DOC_RE.findall(Path(name).stem.upper())
    if not matches:
        return None
    series, number = matches[-1]
    return f"{series.upper()}-{number}"


def document_key(value):
    match = DOC_RE.search(str(value or "").upper())
    return f"{match.group(1).upper()}-{match.group(2)}" if match else None


def candidates(purchases_dir: Path, months):
    found = {}
    for month in months:
        for folder in purchases_dir.rglob(month):
            if not folder.is_dir():
                continue
            for path in folder.iterdir():
                if path.suffix.lower() == ".pdf":
                    doc = document_from_name(path.name)
                    if doc and doc not in found:
                        found[doc] = ("file", path, None)
                elif path.suffix.lower() == ".zip":
                    try:
                        with zipfile.ZipFile(path) as archive:
                            for name in archive.namelist():
                                if not name.lower().endswith(".pdf"):
                                    continue
                                doc = document_from_name(name)
                                if doc and doc not in found:
                                    found[doc] = ("zip", path, name)
                    except zipfile.BadZipFile:
                        continue
    return found


def optimize_pdf(blob: bytes, output: Path, preview: Path, dpi=115, quality=62):
    import fitz
    from PIL import Image

    source = fitz.open(stream=blob, filetype="pdf")
    target = fitz.open()
    scale = dpi / 72
    for page_number, page in enumerate(source):
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        if page_number == 0:
            thumb = image.copy()
            thumb.thumbnail((1000, 1600), Image.Resampling.LANCZOS)
            thumb.save(preview, format="WEBP", quality=68, method=6)
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
        rect = page.rect
        out_page = target.new_page(width=rect.width, height=rect.height)
        out_page.insert_image(out_page.rect, stream=buffer.getvalue())
    target.save(output, deflate=True, garbage=4)
    target.close()
    source.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--purchases-dir", required=True, type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--index-output", type=Path)
    parser.add_argument("--merge-index", type=Path, help="Índice publicado previo que debe conservarse")
    parser.add_argument("--months", nargs="+", default=["2026-08", "2026-09", "2026-10"])
    parser.add_argument("--plan", action="store_true")
    args = parser.parse_args()
    items = candidates(args.purchases_dir, args.months)
    if args.plan:
        print(json.dumps({"documents_with_pdf": len(items), "months": args.months}, indent=2))
        return
    if not args.output_dir or not args.index_output:
        parser.error("--output-dir y --index-output son obligatorios sin --plan")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    previous = json.loads(args.merge_index.read_text(encoding="utf-8")) if args.merge_index else {}
    index, errors = dict(previous.get("documents", {})), []
    for position, (document, (kind, path, member)) in enumerate(sorted(items.items()), 1):
        try:
            if kind == "file":
                blob = path.read_bytes()
                source = str(path)
            else:
                with zipfile.ZipFile(path) as archive:
                    blob = archive.read(member)
                source = f"{path}::{member}"
            filename = re.sub(r"[^A-Z0-9-]+", "-", document) + ".pdf"
            destination = args.output_dir / filename
            preview_name = Path(filename).with_suffix(".webp").name
            optimize_pdf(blob, destination, args.output_dir / preview_name)
            index[document] = {
                "url": f"invoice-pdfs/{filename}",
                "preview": f"invoice-pdfs/{preview_name}",
                "source": source,
            }
            if position % 50 == 0:
                print(f"Procesados {position}/{len(items)}")
        except Exception as exc:
            errors.append({"document": document, "source": str(path), "error": str(exc)})
    previous["documents"] = index
    previous["errors"] = list(previous.get("errors", [])) + errors
    args.index_output.write_text(json.dumps(previous, ensure_ascii=False, indent=2), encoding="utf-8")
    size = sum(item.stat().st_size for item in args.output_dir.glob("*.*"))
    print(json.dumps({"generated": len(index), "errors": len(errors), "size_mb": round(size / 1024 / 1024, 2)}, indent=2))


if __name__ == "__main__":
    main()
