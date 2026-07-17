#!/usr/bin/env python3
"""Fogar samman delfiler i docs/data/delar/ till uttal.json och grammatik.json.

Delfilerna (uttal_NN.json / gram_NN.json) har samma struktur som målfilerna
men med en post var. Sorterar på id, kontrollerar dubbletter och luckor.

Kör:  python3 scripts/merge_innehall.py
"""
import json
import sys
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent
DATA = ROT / "docs" / "data"
DELAR = DATA / "delar"


def foga(prefix, nyckel, mal, forvantat):
    filer = sorted(DELAR.glob(f"{prefix}_*.json"))
    poster = []
    for fil in filer:
        try:
            inneh = json.loads(fil.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"FEL: {fil.name}: {e}", file=sys.stderr)
            continue
        poster.extend(inneh.get(nyckel, []))
    poster.sort(key=lambda p: p["id"])
    idn = [p["id"] for p in poster]
    if len(set(idn)) != len(idn):
        dubbletter = sorted({i for i in idn if idn.count(i) > 1})
        sys.exit(f"FEL: dubbla id i {prefix}: {dubbletter}")
    saknas = sorted(set(range(1, forvantat + 1)) - set(idn))
    if saknas:
        print(f"varning: {prefix} saknar id {saknas}")
    ut = DATA / mal
    ut.write_text(json.dumps({nyckel: poster}, ensure_ascii=False, separators=(",", ":")),
                  encoding="utf-8")
    print(f"skrev {mal}: {len(poster)} poster ({ut.stat().st_size // 1024} kB)")


def main():
    if not DELAR.exists():
        sys.exit("docs/data/delar/ finns inte — inget att foga samman")
    foga("uttal", "lektioner", "uttal.json", 20)
    foga("gram", "kapitel", "grammatik.json", 30)


if __name__ == "__main__":
    main()
