#!/usr/bin/env python3
"""Screenshot every mock at phone, tablet and desktop widths in both themes.

Writes PNGs to ``.cache/mocks/`` (never commit that folder) plus a contact
sheet ``.cache/mocks/index.html`` for visual review. Uses the Python
``playwright`` package when installed; otherwise falls back to the Playwright
CLI via ``npx playwright screenshot``. Chromium must be available to one of
them (``PLAYWRIGHT_BROWSERS_PATH`` or ``npx playwright install chromium``).

Usage:
    python screenshot_mocks.py                      # docs/mocks -> docs/mocks/.cache/mocks
    python screenshot_mocks.py docs/mocks --filter login --viewport 360x800
    python screenshot_mocks.py docs/mocks --theme dark --out /tmp/shots

Each mock is opened as a file:// URL with ``?theme=<theme>&chrome=0`` so the
mock bar is hidden and the theme is forced (mock.js reads both parameters).
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_VIEWPORTS = ["360x800", "768x1024", "1280x800"]
DEFAULT_THEMES = ["light", "dark"]


def collect(root: Path, pattern: str | None) -> list[Path]:
    files = [p for p in sorted(root.rglob("*.html")) if ".cache" not in p.parts and p.name != "index.html" and p.parent != root]
    if pattern:
        files = [p for p in files if pattern in p.relative_to(root).as_posix()]
    return files


def target_name(root: Path, file: Path, viewport: str, theme: str) -> str:
    rel = file.relative_to(root).with_suffix("").as_posix().replace("/", "__")
    return f"{rel}--{viewport}--{theme}.png"


def shoot_with_python(jobs: list[tuple[Path, str, str, Path]], full_page: bool) -> None:
    from playwright.sync_api import sync_playwright  # type: ignore

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for file, viewport, theme, out in jobs:
            width, height = (int(v) for v in viewport.split("x"))
            page = browser.new_page(viewport={"width": width, "height": height}, color_scheme=theme)
            page.goto(f"{file.resolve().as_uri()}?theme={theme}&chrome=0")
            page.wait_for_timeout(150)
            page.screenshot(path=str(out), full_page=full_page)
            page.close()
            print(f"wrote {out}")
        browser.close()


def shoot_with_cli(jobs: list[tuple[Path, str, str, Path]], full_page: bool) -> None:
    npx = shutil.which("npx")
    if not npx:
        raise RuntimeError("Neither the Python 'playwright' package nor 'npx' is available; install one to take screenshots.")
    for file, viewport, theme, out in jobs:
        width, height = viewport.split("x")
        command = [npx, "--yes", "playwright", "screenshot", "--browser=chromium", f"--viewport-size={width},{height}", f"--color-scheme={theme}", "--wait-for-timeout=150"]
        if full_page:
            command.append("--full-page")
        command += [f"{file.resolve().as_uri()}?theme={theme}&chrome=0", str(out)]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"playwright screenshot failed for {file}:\n{result.stderr.strip() or result.stdout.strip()}")
        print(f"wrote {out}")


def write_contact_sheet(out_dir: Path, jobs: list[tuple[Path, str, str, Path]], root: Path) -> None:
    rows = []
    for file, viewport, theme, out in jobs:
        rel = file.relative_to(root).as_posix()
        rows.append(f'<figure><img src="{out.name}" alt="{rel} at {viewport}, {theme} theme" loading="lazy"><figcaption>{rel} · {viewport} · {theme}</figcaption></figure>')
    html = ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            "<title>Mock screenshots</title><style>body{font:14px system-ui;margin:16px;background:#eee}figure{margin:0 0 24px;display:inline-block;vertical-align:top;max-width:420px}"
            "img{max-width:100%;border:1px solid #bbb;background:#fff}figcaption{font-size:12px;color:#444}</style></head><body><h1>Mock screenshots</h1>"
            + "".join(rows) + "</body></html>")
    (out_dir / "index.html").write_text(html, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default="docs/mocks", type=Path)
    parser.add_argument("--out", type=Path, help="Output folder (default <root>/.cache/mocks)")
    parser.add_argument("--viewport", action="append", help="WIDTHxHEIGHT, repeatable (default 360x800, 768x1024, 1280x800)")
    parser.add_argument("--theme", action="append", choices=["light", "dark"], help="Theme(s) to capture (default both)")
    parser.add_argument("--filter", help="Only mocks whose relative path contains this text")
    parser.add_argument("--no-full-page", action="store_true", help="Capture only the viewport instead of the full page")
    args = parser.parse_args(argv)
    if not args.root.is_dir():
        print(f"error: {args.root} is not a directory", file=sys.stderr)
        return 2
    files = collect(args.root, args.filter)
    if not files:
        print("error: no mock HTML files found", file=sys.stderr)
        return 2
    out_dir = args.out or args.root / ".cache" / "mocks"
    out_dir.mkdir(parents=True, exist_ok=True)
    viewports = args.viewport or DEFAULT_VIEWPORTS
    themes = args.theme or DEFAULT_THEMES
    jobs = [(f, v, t, out_dir / target_name(args.root, f, v, t)) for f in files for v in viewports for t in themes]
    try:
        try:
            import playwright  # type: ignore # noqa: F401
            shoot_with_python(jobs, not args.no_full_page)
        except ImportError:
            shoot_with_cli(jobs, not args.no_full_page)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    write_contact_sheet(out_dir, jobs, args.root)
    print(f"\n{len(jobs)} screenshots in {out_dir}; open {out_dir / 'index.html'} to review. Do not commit .cache/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
