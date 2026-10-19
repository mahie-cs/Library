#!/usr/bin/env python3
import json, os, re, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COVERS = ROOT / "covers"
BOOK_REPO = re.compile(r"^Library-books-\d+$", re.I)
APP_EXTENSIONS = (".apk",)   # files that count as downloadable apps


def api(path):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "library-build"}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    with urllib.request.urlopen(urllib.request.Request("https://api.github.com" + path, headers=headers)) as r:
        return json.load(r)


def list_book_repos(owner):
    repos, page = [], 1
    while True:
        batch = api(f"/users/{owner}/repos?per_page=100&page={page}")
        repos += batch
        if len(batch) < 100:
            break
        page += 1
    return sorted((r for r in repos if BOOK_REPO.match(r["name"])), key=lambda r: r["name"].lower())


def collect_repo(owner, name, branch):
    tree = api(f"/repos/{owner}/{name}/git/trees/{urllib.parse.quote(branch, safe='')}?recursive=1")
    if tree.get("truncated"):
        print(f"  warning: {name} has too many files, some were skipped")
    site = f"https://{owner}.github.io/{name}/"
    raw = f"https://raw.githubusercontent.com/{owner}/{name}/{urllib.parse.quote(branch, safe='')}/"
    out = []
    for item in tree["tree"]:
        path = item["path"]
        if item["type"] != "blob" or not path.lower().endswith(".pdf"):
            continue
        parts = path.split("/")
        if any(p.startswith(".") for p in parts):
            continue
        q = "/".join(urllib.parse.quote(p, safe="") for p in parts)
        out.append({"id": item["sha"][:12], "topic": " / ".join(parts[:-1]), "name": parts[-1],
                    "url": site + q, "size": item.get("size", 0), "raw": raw + q})
    return out


def collect_apps(owner, repo):
    out = []
    for rel in api(f"/repos/{owner}/{repo}/releases?per_page=100"):
        if rel.get("draft"):
            continue
        assets = [{"name": a["name"], "url": a["browser_download_url"], "size": a["size"]}
                  for a in rel.get("assets", []) if a["name"].lower().endswith(APP_EXTENSIONS)]
        if not assets:
            continue
        out.append({"tag": rel["tag_name"], "name": rel.get("name") or rel["tag_name"],
                    "date": rel.get("published_at") or rel.get("created_at") or "",
                    "prerelease": bool(rel.get("prerelease")), "notes": rel.get("body") or "", "assets": assets})
    out.sort(key=lambda r: r["date"], reverse=True)   # newest first
    return out


def make_covers(books):
    try:
        import pymupdf
    except ImportError:
        print("PyMuPDF not installed: covers skipped (pip install pymupdf)")
        return
    made = 0
    for b in books:
        out = COVERS / f"{b['id']}.jpg"
        if out.exists():
            continue
        try:
            with tempfile.TemporaryDirectory() as tmp:
                pdf = Path(tmp) / "book.pdf"
                with urllib.request.urlopen(b["raw"]) as r, open(pdf, "wb") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
                with pymupdf.open(pdf) as doc:
                    page = doc[0]
                    zoom = 480 / page.rect.width
                    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
                    COVERS.mkdir(exist_ok=True)
                    out.write_bytes(pix.tobytes("jpeg", jpg_quality=82))
                    made += 1
        except Exception as e:
            print(f"  cover skipped for {b['name']}: {e}")
    keep = {COVERS / f"{b['id']}.jpg" for b in books}   # drop covers of removed books
    if COVERS.exists():
        for jpg in COVERS.rglob("*.jpg"):
            if jpg not in keep:
                jpg.unlink()
        for d in sorted((p for p in COVERS.rglob("*") if p.is_dir()), reverse=True):
            if not any(d.iterdir()):
                d.rmdir()
    print(f"covers: {made} new")


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GITHUB_REPOSITORY", "")
    owner = arg.split("/")[0]
    main_repo = arg.split("/")[1] if "/" in arg else "Library"
    if not owner:
        sys.exit("Usage: python3 generate_books.py your-github-username")
    books = []
    for repo in list_book_repos(owner):
        found = collect_repo(owner, repo["name"], repo["default_branch"])
        print(f"{repo['name']}: {len(found)} book(s)")
        books += found
    books.sort(key=lambda b: b["name"].lower())
    public = [{k: v for k, v in b.items() if k != "raw"} for b in books]
    (ROOT / "books.json").write_text(json.dumps(public, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"books.json: {len(books)} book(s)")
    try:
        apps = collect_apps(owner, main_repo)
        (ROOT / "releases.json").write_text(json.dumps(apps, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"releases.json: {len(apps)} app release(s)")
    except Exception as e:
        print(f"  could not read releases ({e}); releases.json left as it was")
    make_covers(books)


if __name__ == "__main__":
    main()
