#!/usr/bin/env python3
"""Validerar uttal.json och grammatik.json mot ordlistan och kursplanen.

Kontrollerar bl.a. att alla rang-referenser finns, att rätt svar ingår bland
alternativen, att regex-chips kompilerar och att kapitel-/lektions-id:n
stämmer med kursplan.json. Utgångsstatus 1 vid fel.

Kör:  python3 scripts/validate_innehall.py
      python3 scripts/validate_innehall.py --uttal sökväg.json      # enskild fil
      python3 scripts/validate_innehall.py --grammatik sökväg.json  # enskild fil
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent
DATA = ROT / "docs" / "data"

fel_lista = []


def fel(kalla, text):
    fel_lista.append(f"{kalla}: {text}")


def kontrollera_uttal(per_rang, kursplan, sokvag=None):
    sokvag = Path(sokvag) if sokvag else DATA / "uttal.json"
    if not sokvag.exists():
        print("uttal.json saknas — hoppar över")
        return
    u = json.loads(sokvag.read_text(encoding="utf-8"))
    lektioner = u.get("lektioner", [])
    titlar = {l["id"]: l["titel"] for l in kursplan["uttalLektioner"]}
    for lek in lektioner:
        k = f"uttal lektion {lek.get('id')}"
        if lek.get("id") not in titlar:
            fel(k, "id finns inte i kursplanen")
            continue
        if not lek.get("teori", "").strip():
            fel(k, "saknar teori")
        for ex in lek.get("exempel", []):
            if ex.get("rang") not in per_rang:
                fel(k, f"exempel pekar på obefintlig rang {ex.get('rang')}")
        chip = lek.get("chip")
        if chip:
            try:
                re.compile(chip.get("monster", ""))
            except re.error as e:
                fel(k, f"chip-regex kompilerar inte: {e}")
        for i, fr in enumerate(lek.get("sjalvtest", []), 1):
            kf = f"{k} fråga {i}"
            alternativ = fr.get("alternativ") or []
            if len(alternativ) < 2:
                fel(kf, "färre än två alternativ")
            if fr.get("ratt") not in alternativ:
                fel(kf, f"rätt svar {fr.get('ratt')!r} finns inte bland alternativen")
            if fr.get("rang") is not None and fr["rang"] not in per_rang:
                fel(kf, f"obefintlig rang {fr['rang']}")
            if fr.get("rang") is None and not fr.get("ljudText") and not fr.get("fraga"):
                fel(kf, "saknar både rang, ljudText och fråga")
    print(f"{sokvag.name}: {len(lektioner)} lektioner kontrollerade")


def kontrollera_grammatik(per_rang, kursplan, sokvag=None):
    sokvag = Path(sokvag) if sokvag else DATA / "grammatik.json"
    if not sokvag.exists():
        print("grammatik.json saknas — hoppar över")
        return
    g = json.loads(sokvag.read_text(encoding="utf-8"))
    kapitel = g.get("kapitel", [])
    titlar = {k["id"]: k["titel"] for k in kursplan["grammatikKapitel"]}
    KANDA_TYPER = {"lucka", "val", "ordfoljd", "oversatt"}
    for kap in kapitel:
        k = f"grammatik kapitel {kap.get('id')}"
        if kap.get("id") not in titlar:
            fel(k, "id finns inte i kursplanen")
            continue
        if not kap.get("teori", "").strip():
            fel(k, "saknar teori")
        ovningar = kap.get("ovningar", [])
        if len(ovningar) < 8:
            fel(k, f"bara {len(ovningar)} övningar (minst 8)")
        for i, ov in enumerate(ovningar, 1):
            ko = f"{k} övning {i}"
            typ = ov.get("typ")
            if typ not in KANDA_TYPER:
                fel(ko, f"okänd typ {typ!r}")
                continue
            if ov.get("rang") is not None and ov["rang"] not in per_rang:
                fel(ko, f"obefintlig rang {ov['rang']}")
            if typ == "ordfoljd":
                if not isinstance(ov.get("ord"), list) or len(ov["ord"]) < 3:
                    fel(ko, "ordfoljd kräver 'ord' som lista med minst 3 delar")
                continue
            svar = ov.get("svar")
            svar_lista = svar if isinstance(svar, list) else [svar]
            if not svar_lista or any(not isinstance(s, str) or not s.strip() for s in svar_lista):
                fel(ko, "saknar svar")
                continue
            if typ in ("lucka", "val") and ov.get("alternativ"):
                alternativ = ov["alternativ"]
                if len(alternativ) < 2:
                    fel(ko, "färre än två alternativ")
                norm = lambda s: s.lower().strip()
                if not any(norm(a) in {norm(s) for s in svar_lista} for a in alternativ):
                    fel(ko, "inget alternativ matchar svaret")
            if typ == "lucka" and ov.get("mening") and "___" not in ov["mening"]:
                fel(ko, "lucktext utan ___ i meningen")
    print(f"{sokvag.name}: {len(kapitel)} kapitel kontrollerade")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--uttal", help="validera bara denna uttalsfil")
    p.add_argument("--grammatik", help="validera bara denna grammatikfil")
    arg = p.parse_args()

    ord_lista = json.loads((DATA / "ord.json").read_text(encoding="utf-8"))
    per_rang = {o["rang"]: o for o in ord_lista}
    kursplan = json.loads((DATA / "kursplan.json").read_text(encoding="utf-8"))
    if arg.uttal or arg.grammatik:
        if arg.uttal:
            kontrollera_uttal(per_rang, kursplan, arg.uttal)
        if arg.grammatik:
            kontrollera_grammatik(per_rang, kursplan, arg.grammatik)
    else:
        kontrollera_uttal(per_rang, kursplan)
        kontrollera_grammatik(per_rang, kursplan)
    if fel_lista:
        print(f"\n{len(fel_lista)} fel:")
        for f in fel_lista:
            print(f"  ✗ {f}")
        sys.exit(1)
    print("\nInnehållet klarar valideringen.")


if __name__ == "__main__":
    main()
