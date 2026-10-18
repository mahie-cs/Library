#!/usr/bin/env python3
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BOOKS, COVERS = ROOT / "books", ROOT / "covers"

files = sorted(p.relative_to(BOOKS).as_posix() for p in BOOKS.rglob("*") if p.suffix.lower() == ".pdf")
(BOOKS / "books.json").write_text(json.dumps(files, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"books.json: {len(files)} book(s)")

try:
    import pymupdf as fitz
except ImportError:
    sys.exit("PyMuPDF not installed: covers skipped (pip install pymupdf)")

made = 0
for rel in files:
    out = COVERS / (rel + ".jpg")
    if out.exists():
        continue
    try:
        with fitz.open(BOOKS / rel) as doc:
            page = doc[0]
            zoom = 480 / page.rect.width
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(pix.tobytes("jpeg", jpg_quality=82))
            made += 1
    except Exception as e:
        print(f"  skipped {rel}: {e}")

keep = {(COVERS / (r + ".jpg")) for r in files}
if COVERS.exists():
    for jpg in COVERS.rglob("*.jpg"):
        if jpg not in keep:
            jpg.unlink()
print(f"covers: {made} new")
