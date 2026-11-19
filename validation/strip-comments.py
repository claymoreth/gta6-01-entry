#!/usr/bin/env python3
"""Strip comments from CITY OF EMBERS dossier sources to free dossier bytes.

Dossier cap is 163,840 bytes; Phase 4 left ~161 bytes free. Phase 5 needs
room, so this removes ALL comments (line // and block /* */) from the
counted source files, plus blank lines left behind. NO logic changes:
no code, strings, or identifiers are touched. Only pure deletions.

Files processed (dossier text sources):
  game/src/*.js, game/index.html, game/style.css, main.ts
NOT touched: vendor/, *.min.js, validation/, screenshots/, README.md.

Safety: a state machine tracks single/double/backtick strings so a //
inside a string is never stripped. Verified beforehand: no template
literal in the codebase contains //, and no string contains ://.
After running: verify with `node --check` (parse) + `node main.ts`
(dossier builds) + the regression tests.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # gta6-01-entry/

JS_FILES = sorted((ROOT / "game" / "src").glob("*.js")) + [ROOT / "main.ts"]
CSS_FILES = [ROOT / "game" / "style.css"]
HTML_FILES = [ROOT / "game" / "index.html"]


def strip_js(text: str) -> str:
    """Remove // and /* */ comments from JS/TS, preserving strings."""
    out = []
    i = 0
    n = len(text)
    # string state: None, "'", '"', '`'
    in_str = None
    esc = False
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if in_str:
            out.append(c)
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == in_str:
                in_str = None
            i += 1
            continue
        # not in string
        if c in ("'", '"', "`"):
            in_str = c
            out.append(c)
            i += 1
            continue
        if c == "/" and nxt == "/":
            # line comment: skip to end of line (keep the newline)
            while i < n and text[i] != "\n":
                i += 1
            continue
        if c == "/" and nxt == "*":
            # block comment: skip to */
            j = text.find("*/", i + 2)
            if j == -1:
                break  # unterminated; drop rest
            i = j + 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def strip_css(text: str) -> str:
    """Remove /* */ comments from CSS."""
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def strip_html(text: str) -> str:
    """Remove <!-- --> comments from HTML."""
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def collapse_blank_lines(text: str) -> str:
    """Drop lines that are empty/whitespace-only (left behind by comments)."""
    lines = [ln for ln in text.split("\n") if ln.strip() != ""]
    return "\n".join(lines) + "\n"


def process(path: Path, strip_fn) -> int:
    orig = path.read_text(encoding="utf-8")
    stripped = strip_fn(orig)
    stripped = collapse_blank_lines(stripped)
    # strip trailing spaces on remaining lines
    stripped = "\n".join(ln.rstrip() for ln in stripped.split("\n"))
    if not stripped.endswith("\n"):
        stripped += "\n"
    freed = len(orig.encode("utf-8")) - len(stripped.encode("utf-8"))
    path.write_text(stripped, encoding="utf-8")
    print(f"{path.relative_to(ROOT)}: {len(orig.encode())} -> {len(stripped.encode())} bytes (freed {freed})")
    return freed


def main() -> None:
    total = 0
    for p in JS_FILES:
        total += process(p, strip_js)
    for p in CSS_FILES:
        total += process(p, strip_css)
    for p in HTML_FILES:
        total += process(p, strip_html)
    print(f"TOTAL FREED: {total} bytes")


if __name__ == "__main__":
    main()
