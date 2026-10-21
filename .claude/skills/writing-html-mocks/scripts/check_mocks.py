#!/usr/bin/env python3
"""Validate a docs/mocks tree: coverage, HTML hygiene, accessibility basics, links.

Checks performed:
  * manifest.json lists every screen; every listed state file exists, every
    HTML file on disk is listed (no orphans), and every required state for the
    screen's kind is either present or explicitly marked not applicable.
  * each mock has a doctype, <html lang>, <title>, viewport meta, exactly one
    <h1>, a <main> landmark, mock:* meta tags that match its path, the shared
    tokens stylesheet, and no placeholder text (lorem ipsum, TODO, TBD).
  * images have alt text, form controls have labels, buttons and links have an
    accessible name, and every relative link, image, script and stylesheet
    resolves (including #fragments).
  * with --write, the coverage matrix in README.md (between the coverage
    markers) and the gallery index.html are regenerated from the manifest.

Usage:
    python check_mocks.py                 # checks docs/mocks
    python check_mocks.py docs/mocks --write
    python check_mocks.py docs/mocks --json

Exit status is 1 when any error is found. Only the standard library is used.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

KIND_FOLDERS = {"page": "pages", "dialog": "dialogs", "notification": "notifications"}
DEFAULT_REQUIRED = {
    "page": ["default", "loading", "empty", "error"],
    "dialog": ["default", "busy", "invalid"],
    "notification": ["info", "success", "warning", "danger"],
}
PLACEHOLDER_RE = re.compile(r"lorem ipsum|\bTODO\b|\bTBD\b|\bFIXME\b|placeholder text|\[insert\b", re.I)
COVERAGE_START = "<!-- coverage:start -->"
COVERAGE_END = "<!-- coverage:end -->"
LABELLED_INPUT_TYPES_EXEMPT = {"hidden", "submit", "button", "reset", "image"}


class MockInspector(HTMLParser):
    """Gather the facts the checks need from one HTML document."""

    def __init__(self) -> None:
        super().__init__()
        self.doctype = False
        self.lang = None
        self.title = ""
        self.in_title = False
        self.viewport = False
        self.h1_count = 0
        self.main = False
        self.metas: dict[str, str] = {}
        self.stylesheets: list[str] = []
        self.refs: list[tuple[str, str, int]] = []  # (kind, target, line)
        self.ids: set[str] = set()
        self.label_for: set[str] = set()
        self.wrapping_label_depth = 0
        self.unlabelled_controls: list[tuple[str, int]] = []
        self.images_without_alt: list[int] = []
        self.unnamed_buttons: list[int] = []
        self.unnamed_links: list[int] = []
        self.text_chunks: list[str] = []
        self.mock_bar = False
        self.skip_link = False
        self._open_name_elements: list[dict] = []  # buttons/links awaiting text
        self.in_script_or_style = 0

    def handle_decl(self, decl):
        if decl.lower().startswith("doctype"):
            self.doctype = True

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        line = self.getpos()[0]
        if tag in {"script", "style"}:
            self.in_script_or_style += 1
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "html":
            self.lang = attrs.get("lang")
        elif tag == "title":
            self.in_title = True
        elif tag == "meta":
            name = (attrs.get("name") or "").lower()
            if name == "viewport":
                self.viewport = True
            if name:
                self.metas[name] = attrs.get("content", "")
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "main":
            self.main = True
        elif tag == "link":
            rel = (attrs.get("rel") or "").lower()
            href = attrs.get("href", "")
            if "stylesheet" in rel:
                self.stylesheets.append(href)
            if href and "icon" not in rel:
                self.refs.append(("link", href, line))
        elif tag == "a":
            href = attrs.get("href")
            if href:
                self.refs.append(("a", href, line))
            if "skip" in (attrs.get("class") or "") or (href or "").startswith("#main"):
                self.skip_link = True
            self._open_name_elements.append({"tag": tag, "line": line, "named": bool(attrs.get("aria-label") or attrs.get("aria-labelledby") or attrs.get("title")), "text": ""})
        elif tag in {"img", "script", "iframe", "source", "video", "audio"}:
            src = attrs.get("src")
            if src:
                self.refs.append((tag, src, line))
            if tag == "img" and "alt" not in attrs:
                self.images_without_alt.append(line)
            if tag == "img" and attrs.get("alt"):
                for el in self._open_name_elements:
                    el["named"] = True
        elif tag == "button":
            self._open_name_elements.append({"tag": tag, "line": line, "named": bool(attrs.get("aria-label") or attrs.get("aria-labelledby") or attrs.get("title")), "text": ""})
        elif tag == "label":
            if attrs.get("for"):
                self.label_for.add(attrs["for"])
            self.wrapping_label_depth += 1
        elif tag in {"input", "select", "textarea"}:
            kind = (attrs.get("type") or "text").lower()
            if tag == "input" and kind in LABELLED_INPUT_TYPES_EXEMPT:
                pass
            else:
                labelled = bool(attrs.get("aria-label") or attrs.get("aria-labelledby") or self.wrapping_label_depth)
                if not labelled:
                    self.unlabelled_controls.append((attrs.get("id") or f"<{tag}>", line))
        if tag in {"nav", "aside", "div", "header"} and "mock-bar" in (attrs.get("class") or ""):
            self.mock_bar = True
        if attrs.get("aria-label") or attrs.get("title"):
            for el in self._open_name_elements:
                if el["tag"] == tag:
                    el["named"] = True
        if tag in {"svg", "span", "i"} and self._open_name_elements and attrs.get("aria-label"):
            self._open_name_elements[-1]["named"] = True

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag in {"script", "style"}:
            self.in_script_or_style -= 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.in_script_or_style = max(0, self.in_script_or_style - 1)
        if tag == "title":
            self.in_title = False
        elif tag == "label":
            self.wrapping_label_depth = max(0, self.wrapping_label_depth - 1)
        elif tag in {"button", "a"}:
            for index in range(len(self._open_name_elements) - 1, -1, -1):
                el = self._open_name_elements[index]
                if el["tag"] == tag:
                    del self._open_name_elements[index]
                    if not el["named"] and not el["text"].strip():
                        (self.unnamed_buttons if tag == "button" else self.unnamed_links).append(el["line"])
                    break

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_script_or_style:
            return
        self.text_chunks.append(data)
        for el in self._open_name_elements:
            el["text"] += data

    def resolve_pending_labels(self) -> None:
        self.unlabelled_controls = [(ident, line) for ident, line in self.unlabelled_controls if ident not in self.label_for]


def inspect(path: Path) -> MockInspector:
    parser = MockInspector()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    parser.close()
    parser.resolve_pending_labels()
    return parser


def check_reference(source: Path, root: Path, target: str, ids_cache: dict[Path, set[str]]) -> str | None:
    """Return an error message when a relative reference does not resolve."""
    parts = urlsplit(target)
    if parts.scheme or target.startswith("//") or target.startswith("mailto:") or target.startswith("tel:") or target.startswith("data:") or target.startswith("javascript:"):
        return None
    if not parts.path and not parts.fragment:
        return None
    if parts.path:
        candidate = (source.parent / unquote(parts.path)).resolve()
        if candidate.is_dir():
            candidate = candidate / "index.html"
        if not candidate.exists():
            return f"broken reference '{target}'"
    else:
        candidate = source.resolve()
    if parts.fragment and candidate.suffix.lower() in {".html", ".htm"}:
        if candidate not in ids_cache:
            ids_cache[candidate] = inspect(candidate).ids if candidate.exists() else set()
        if parts.fragment not in ids_cache[candidate] and parts.fragment != "top":
            return f"missing fragment '#{parts.fragment}' in '{target}'"
    return None


def load_manifest(root: Path) -> dict:
    path = root / "manifest.json"
    if not path.is_file():
        raise FileNotFoundError(f"{path} not found. Create it with a 'screens' list (see the skill's references/manifest.md).")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data.get("screens"), list) or not data["screens"]:
        raise ValueError(f"{path} has no 'screens' list")
    return data


def expected_file(root: Path, screen: dict, state: str) -> Path:
    return root / KIND_FOLDERS[screen["kind"]] / screen["id"] / f"{state}.html"


def run_checks(root: Path) -> tuple[list[str], list[str], dict]:
    errors: list[str] = []
    warnings: list[str] = []
    manifest = load_manifest(root)
    required_by_kind = dict(DEFAULT_REQUIRED)
    required_by_kind.update(manifest.get("required_states", {}))
    listed: set[Path] = set()
    ids_cache: dict[Path, set[str]] = {}
    seen_ids: set[str] = set()
    coverage: dict[str, list[dict]] = {kind: [] for kind in KIND_FOLDERS}

    for screen in manifest["screens"]:
        sid, kind = screen.get("id"), screen.get("kind")
        if not sid or kind not in KIND_FOLDERS:
            errors.append(f"manifest: screen {screen!r} needs an 'id' and a 'kind' of {sorted(KIND_FOLDERS)}")
            continue
        if sid in seen_ids:
            errors.append(f"manifest: duplicate screen id '{sid}'")
        seen_ids.add(sid)
        if not screen.get("title"):
            errors.append(f"manifest: screen '{sid}' has no title")
        states = screen.get("states") or []
        if not isinstance(states, list) or not states:
            errors.append(f"manifest: screen '{sid}' lists no states")
        not_applicable = screen.get("not_applicable") or {}
        for state, reason in not_applicable.items():
            if not str(reason).strip():
                errors.append(f"manifest: screen '{sid}' marks state '{state}' not applicable without a reason")
        row = {"id": sid, "kind": kind, "title": screen.get("title", sid), "route": screen.get("route", ""), "requirements": screen.get("requirements", []), "states": {}}
        for state in required_by_kind.get(kind, []):
            if state not in states and state not in not_applicable:
                errors.append(f"coverage: {kind} '{sid}' is missing required state '{state}' (add the mock or explain it under not_applicable)")
        for state in states:
            file = expected_file(root, screen, state)
            listed.add(file.resolve())
            if not file.is_file():
                errors.append(f"coverage: {kind} '{sid}' state '{state}' has no file at {file.relative_to(root).as_posix()}")
                row["states"][state] = {"status": "missing", "path": file.relative_to(root).as_posix()}
                continue
            row["states"][state] = {"status": "ok", "path": file.relative_to(root).as_posix()}
            check_html(file, root, sid, kind, state, screen, errors, warnings, ids_cache)
        for state, reason in not_applicable.items():
            row["states"][state] = {"status": "n/a", "reason": reason}
        coverage[kind].append(row)

    for folder in KIND_FOLDERS.values():
        for file in sorted((root / folder).rglob("*.html")) if (root / folder).is_dir() else []:
            if file.resolve() not in listed:
                errors.append(f"orphan: {file.relative_to(root).as_posix()} is not listed in manifest.json")

    for name in ("index.html", "README.md"):
        if not (root / name).is_file():
            warnings.append(f"{name} is missing; run with --write to generate it")
    index = root / "index.html"
    if index.is_file():
        inspector = inspect(index)
        for kind, target, line in inspector.refs:
            problem = check_reference(index, root, target, ids_cache)
            if problem:
                errors.append(f"index.html:{line}: {problem}")
    return errors, warnings, {"manifest": manifest, "coverage": coverage}


def check_html(file: Path, root: Path, sid: str, kind: str, state: str, screen: dict, errors: list[str], warnings: list[str], ids_cache: dict[Path, set[str]]) -> None:
    rel = file.relative_to(root).as_posix()
    doc = inspect(file)
    if not doc.doctype:
        errors.append(f"{rel}: missing <!doctype html>")
    if not doc.lang:
        errors.append(f"{rel}: <html> has no lang attribute")
    if not doc.title.strip():
        errors.append(f"{rel}: missing <title>")
    if not doc.viewport:
        errors.append(f"{rel}: missing viewport meta")
    if doc.h1_count != 1:
        errors.append(f"{rel}: expected exactly one <h1>, found {doc.h1_count}")
    if not doc.main:
        errors.append(f"{rel}: missing <main> landmark")
    if not doc.skip_link:
        warnings.append(f"{rel}: no skip link to #main")
    if not doc.mock_bar:
        warnings.append(f"{rel}: no .mock-bar chrome (state navigation and theme toggle)")
    for key, expected in (("mock:screen", sid), ("mock:kind", kind), ("mock:state", state)):
        actual = doc.metas.get(key)
        if actual is None:
            errors.append(f"{rel}: missing <meta name=\"{key}\">")
        elif actual != expected:
            errors.append(f"{rel}: <meta name=\"{key}\"> is '{actual}' but the path says '{expected}'")
    declared = set((doc.metas.get("mock:requirements") or "").replace(",", " ").split())
    manifest_reqs = set(screen.get("requirements") or [])
    if manifest_reqs and declared != manifest_reqs:
        warnings.append(f"{rel}: mock:requirements {sorted(declared)} differs from manifest {sorted(manifest_reqs)}")
    if not any(href.endswith("tokens.css") for href in doc.stylesheets):
        errors.append(f"{rel}: does not link a tokens.css stylesheet")
    text = " ".join(doc.text_chunks)
    match = PLACEHOLDER_RE.search(text)
    if match:
        errors.append(f"{rel}: placeholder text '{match.group(0)}' found; write real copy")
    for line in doc.images_without_alt:
        errors.append(f"{rel}:{line}: <img> without alt attribute")
    for ident, line in doc.unlabelled_controls:
        errors.append(f"{rel}:{line}: form control {ident} has no label")
    for line in doc.unnamed_buttons:
        errors.append(f"{rel}:{line}: <button> has no accessible name")
    for line in doc.unnamed_links:
        errors.append(f"{rel}:{line}: <a> has no accessible name")
    for ref_kind, target, line in doc.refs:
        problem = check_reference(file, root, target, ids_cache)
        if problem:
            errors.append(f"{rel}:{line}: {problem}")


def coverage_markdown(coverage: dict, required_by_kind: dict) -> str:
    lines = [COVERAGE_START, "", "Legend: ✅ mock exists · ➖ not applicable (reason in manifest) · ❌ missing", ""]
    for kind, rows in coverage.items():
        if not rows:
            continue
        states: list[str] = list(required_by_kind.get(kind, []))
        for row in rows:
            for state in row["states"]:
                if state not in states:
                    states.append(state)
        lines.append(f"### {KIND_FOLDERS[kind].capitalize()}")
        lines.append("")
        lines.append("| Screen | " + " | ".join(states) + " | Requirements |")
        lines.append("|---|" + "---|" * len(states) + "---|")
        for row in rows:
            cells = []
            for state in states:
                info = row["states"].get(state)
                if not info:
                    cells.append("")
                elif info["status"] == "ok":
                    cells.append(f"[✅]({info['path']})")
                elif info["status"] == "n/a":
                    cells.append("➖")
                else:
                    cells.append("❌")
            reqs = ", ".join(f"`{r}`" for r in row["requirements"]) or ""
            lines.append(f"| {row['title']} (`{row['id']}`) | " + " | ".join(cells) + f" | {reqs} |")
        lines.append("")
    lines.append(COVERAGE_END)
    return "\n".join(lines)


def write_readme(root: Path, coverage: dict, manifest: dict) -> None:
    required_by_kind = dict(DEFAULT_REQUIRED)
    required_by_kind.update(manifest.get("required_states", {}))
    block = coverage_markdown(coverage, required_by_kind)
    readme = root / "README.md"
    if readme.is_file():
        text = readme.read_text(encoding="utf-8")
        if COVERAGE_START in text and COVERAGE_END in text:
            start = text.index(COVERAGE_START)
            end = text.index(COVERAGE_END) + len(COVERAGE_END)
            text = text[:start] + block + text[end:]
        else:
            text = text.rstrip() + "\n\n## Coverage\n\n" + block + "\n"
    else:
        title = manifest.get("project", "Project")
        text = f"# {title} mocks\n\nStatic HTML mocks for every page, dialog and notification, in every state. Open [index.html](index.html) locally to browse them.\n\n## Coverage\n\n{block}\n"
    readme.write_text(text, encoding="utf-8")


def write_index(root: Path, coverage: dict, manifest: dict) -> None:
    title = manifest.get("project", "Project")
    sections = []
    for kind, rows in coverage.items():
        if not rows:
            continue
        cards = []
        for row in rows:
            links = []
            for state, info in row["states"].items():
                if info["status"] == "ok":
                    links.append(f'<li><a href="{info["path"]}">{state}</a></li>')
                elif info["status"] == "n/a":
                    links.append(f'<li class="na" title="{info["reason"]}">{state} <span>n/a</span></li>')
                else:
                    links.append(f'<li class="missing">{state} <span>missing</span></li>')
            first = next((i["path"] for i in row["states"].values() if i["status"] == "ok"), None)
            preview = f'<iframe loading="lazy" tabindex="-1" aria-hidden="true" src="{first}"></iframe>' if first else '<div class="no-preview">No mock yet</div>'
            route = f'<code>{row["route"]}</code>' if row["route"] else ""
            reqs = " ".join(f"<code>{r}</code>" for r in row["requirements"])
            cards.append(
                f'<article class="card"><div class="preview">{preview}</div><div class="body">'
                f'<h3>{row["title"]}</h3><p class="meta">{route} {reqs}</p><ul class="states">{"".join(links)}</ul></div></article>'
            )
        sections.append(f'<section><h2 id="{KIND_FOLDERS[kind]}">{KIND_FOLDERS[kind].capitalize()}</h2><div class="grid">{"".join(cards)}</div></section>')
    html = f"""<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} mocks</title>
<link rel="stylesheet" href="assets/tokens.css">
<style>
  body {{ margin: 0; font: var(--text-body); color: var(--color-fg-default); background: var(--color-bg-canvas); }}
  header {{ padding: var(--space-6) var(--layout-margin); border-bottom: 1px solid var(--color-border-default); display: flex; gap: var(--space-4); align-items: center; flex-wrap: wrap; }}
  header h1 {{ font: var(--text-h2); margin: 0; flex: 1; }}
  header nav a {{ margin-right: var(--space-4); color: var(--color-fg-link); }}
  main {{ padding: var(--space-6) var(--layout-margin); max-width: var(--layout-container-max); margin-inline: auto; }}
  h2 {{ font: var(--text-h3); margin: var(--space-8) 0 var(--space-4); }}
  .grid {{ display: grid; gap: var(--layout-gutter); grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); }}
  .card {{ background: var(--color-bg-surface); border: 1px solid var(--color-border-default); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-1); display: flex; flex-direction: column; }}
  .preview {{ aspect-ratio: 16 / 10; background: var(--color-bg-surface-sunken); overflow: hidden; position: relative; }}
  .preview iframe {{ width: 400%; height: 400%; transform: scale(0.25); transform-origin: top left; border: 0; pointer-events: none; }}
  .no-preview {{ display: grid; place-items: center; height: 100%; color: var(--color-fg-subtle); }}
  .body {{ padding: var(--space-4); }}
  .body h3 {{ margin: 0 0 var(--space-1); font: var(--text-h4); }}
  .meta {{ margin: 0 0 var(--space-3); color: var(--color-fg-muted); font: var(--text-body-sm); }}
  .meta code {{ font: var(--text-code); background: var(--color-bg-subtle); padding: 0 var(--space-1); border-radius: var(--radius-sm); }}
  .states {{ list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }}
  .states li {{ font: var(--text-label); }}
  .states a {{ display: inline-block; padding: var(--space-1) var(--space-2); border-radius: var(--radius-full); background: var(--color-accent-subtle); color: var(--color-fg-accent); text-decoration: none; min-height: var(--target-min); }}
  .states a:hover {{ background: var(--color-accent-subtle-hover); }}
  .states a:focus-visible {{ outline: var(--focus-ring-width) solid var(--color-focus-ring); outline-offset: var(--focus-ring-offset); }}
  .states .na, .states .missing {{ padding: var(--space-1) var(--space-2); border-radius: var(--radius-full); background: var(--color-bg-subtle); color: var(--color-fg-muted); }}
  .states .missing {{ background: var(--color-danger-bg); color: var(--color-danger-fg); }}
  .states span {{ font: var(--text-caption); }}
  button.theme {{ font: var(--text-label); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--color-border-strong); background: var(--color-bg-surface); color: var(--color-fg-default); cursor: pointer; min-height: var(--target-min); }}
  button.theme:focus-visible {{ outline: var(--focus-ring-width) solid var(--color-focus-ring); outline-offset: var(--focus-ring-offset); }}
</style>
</head>
<body>
<header>
  <h1>{title} mocks</h1>
  <nav aria-label="Sections">{"".join(f'<a href="#{KIND_FOLDERS[k]}">{KIND_FOLDERS[k].capitalize()}</a>' for k, rows in coverage.items() if rows)}<a href="README.md">Coverage</a></nav>
  <button class="theme" type="button" onclick="var r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';">Toggle theme</button>
</header>
<main id="main">
{"".join(sections)}
</main>
</body>
</html>
"""
    (root / "index.html").write_text(html, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default="docs/mocks", type=Path)
    parser.add_argument("--write", action="store_true", help="Regenerate README.md coverage matrix and index.html from the manifest")
    parser.add_argument("--json", action="store_true", help="Emit results as JSON")
    args = parser.parse_args(argv)
    if not args.root.is_dir():
        print(f"error: {args.root} is not a directory", file=sys.stderr)
        return 2
    try:
        errors, warnings, data = run_checks(args.root)
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if args.write:
        write_readme(args.root, data["coverage"], data["manifest"])
        write_index(args.root, data["coverage"], data["manifest"])
        # Re-run so the freshly written index is link-checked too.
        errors, warnings, data = run_checks(args.root)
    if args.json:
        print(json.dumps({"errors": errors, "warnings": warnings, "coverage": data["coverage"]}, indent=2, ensure_ascii=False))
    else:
        for w in warnings:
            print(f"WARN  {w}")
        for e in errors:
            print(f"ERROR {e}")
        screens = sum(len(rows) for rows in data["coverage"].values())
        mocks = sum(1 for rows in data["coverage"].values() for row in rows for i in row["states"].values() if i["status"] == "ok")
        print(f"\n{screens} screens, {mocks} mocks, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
