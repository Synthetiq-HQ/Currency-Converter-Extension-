#!/usr/bin/env python3
"""Validate and package only the files needed to install QuickCurrency."""
import hashlib
import json
from pathlib import Path
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ["manifest.json", "background.js", "currency.js", "settings.js", "rates.js", "content.js",
           "popup.html", "popup.js", "options.html", "options.js", "ui.css",
           "icon16.png", "icon32.png", "icon48.png", "icon128.png"]


def validate():
    reserved = [p for p in ROOT.rglob("__pycache__") if ".git" not in p.parts]
    if reserved:
        raise ValueError("Remove generated __pycache__ directories before loading unpacked")
    manifest = json.loads((ROOT / "manifest.json").read_text())
    expected = [manifest["background"]["service_worker"], manifest["action"]["default_popup"], manifest["options_page"]]
    expected += list(manifest["icons"].values()) + list(manifest["action"]["default_icon"].values())
    for name in set(RUNTIME + expected):
        if not (ROOT / name).is_file():
            raise ValueError(f"Missing runtime file: {name}")
    for size, name in manifest["icons"].items():
        raw = (ROOT / name).read_bytes()
        if raw[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", raw[16:24]) != (int(size), int(size)):
            raise ValueError(f"Wrong icon dimensions: {name}")
    from html.parser import HTMLParser
    class References(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for key, value in attrs:
                if key in ("src", "href") and value and not value.startswith(("https:", "http:", "#")):
                    if value not in RUNTIME:
                        raise ValueError(f"Unpackaged page reference: {value}")
    for name in ("popup.html", "options.html"):
        References().feed((ROOT / name).read_text())
    return manifest


def package():
    manifest = validate()
    dest = ROOT / "dist" / f"QuickCurrency-{manifest['version']}.zip"
    dest.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in RUNTIME + ["LICENSE", "README.md", "AI_CONTRIBUTIONS.md"]:
            archive.write(ROOT / name, name)
    digest = hashlib.sha256(dest.read_bytes()).hexdigest()
    dest.with_suffix(".sha256").write_text(f"{digest}  {dest.name}\n")
    print(f"Validated {len(RUNTIME)} runtime files. Created {dest.name} ({dest.stat().st_size:,} bytes)")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    package()
