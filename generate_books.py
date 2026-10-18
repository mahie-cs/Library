#!/usr/bin/env python3
"""Writes books/books.json: a list of every PDF under books/ (relative paths).
GitHub Pages can't list folders, so the site reads this file instead."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent / "books"
files = sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.suffix.lower() == ".pdf")
(root / "books.json").write_text(json.dumps(files, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"books.json: {len(files)} book(s)")
